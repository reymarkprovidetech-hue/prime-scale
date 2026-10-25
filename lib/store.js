'use strict';
/*
  Storage layer for Prime Scale.

  - When Upstash Redis variables exist (Vercel -> Storage -> Upstash Redis), everything is saved permanently.
  - Otherwise a temporary in-memory store is used. That is fine for local testing,
    but on Vercel it is NOT permanent (it resets whenever the server restarts).
*/

const URL_ = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const persistent = Boolean(URL_ && TOKEN);

/* ---------- tiny in-memory Redis (only the commands this site uses) ---------- */
const db = globalThis.__psdb || (globalThis.__psdb = { d: new Map(), e: new Map() });

function live(k, type) {
  const exp = db.e.get(k);
  if (exp && exp <= Date.now()) { db.d.delete(k); db.e.delete(k); }
  const v = db.d.get(k);
  if (v === undefined) return undefined;
  if (type && v.t !== type) throw new Error('WRONGTYPE');
  return v;
}
function make(k, type, init) {
  let v = live(k, type);
  if (!v) { v = { t: type, v: init() }; db.d.set(k, v); }
  return v.v;
}
function slice(arr, s, e) {
  const n = arr.length;
  let i = parseInt(s, 10), j = parseInt(e, 10);
  if (i < 0) i = Math.max(n + i, 0);
  if (j < 0) j = n + j;
  j = Math.min(j, n - 1);
  return i > j ? [] : arr.slice(i, j + 1);
}

function memRun(args) {
  const c = String(args[0]).toUpperCase();
  const a = args.slice(1).map((x) => (typeof x === 'number' ? String(x) : x));
  switch (c) {
    case 'GET': { const v = live(a[0], 's'); return v ? v.v : null; }
    case 'SET': {
      let nx = false, ex = 0;
      for (let i = 2; i < a.length; i++) {
        const o = String(a[i]).toUpperCase();
        if (o === 'NX') nx = true; else if (o === 'EX') ex = parseInt(a[++i], 10);
      }
      if (nx && live(a[0]) !== undefined) return null;
      db.d.set(a[0], { t: 's', v: String(a[1]) });
      if (ex) db.e.set(a[0], Date.now() + ex * 1000); else db.e.delete(a[0]);
      return 'OK';
    }
    case 'DEL': { let n = 0; for (const k of a) if (live(k) !== undefined) { db.d.delete(k); db.e.delete(k); n++; } return n; }
    case 'INCR': { const v = live(a[0], 's'); const n = (v ? parseInt(v.v, 10) : 0) + 1; db.d.set(a[0], { t: 's', v: String(n) }); return n; }
    case 'EXPIRE': { if (live(a[0]) === undefined) return 0; db.e.set(a[0], Date.now() + parseInt(a[1], 10) * 1000); return 1; }
    case 'HINCRBY': { const h = make(a[0], 'h', () => new Map()); const n = parseInt(h.get(a[1]) || '0', 10) + parseInt(a[2], 10); h.set(a[1], String(n)); return n; }
    case 'HGET': { const v = live(a[0], 'h'); return v && v.v.has(a[1]) ? v.v.get(a[1]) : null; }
    case 'HSET': { const h = make(a[0], 'h', () => new Map()); let n = 0; for (let i = 1; i < a.length; i += 2) { if (!h.has(a[i])) n++; h.set(a[i], String(a[i + 1])); } return n; }
    case 'HGETALL': { const v = live(a[0], 'h'); const out = []; if (v) for (const [f, x] of v.v) out.push(f, x); return out; }
    case 'HDEL': { const v = live(a[0], 'h'); let n = 0; if (v) for (const f of a.slice(1)) if (v.v.delete(f)) n++; return n; }
    case 'RPUSH': case 'LPUSH': { const l = make(a[0], 'l', () => []); for (const x of a.slice(1)) { if (c === 'RPUSH') l.push(String(x)); else l.unshift(String(x)); } return l.length; }
    case 'LRANGE': { const v = live(a[0], 'l'); return v ? slice(v.v, a[1], a[2]) : []; }
    case 'LLEN': { const v = live(a[0], 'l'); return v ? v.v.length : 0; }
    case 'LTRIM': { const v = live(a[0], 'l'); if (v) v.v = slice(v.v, a[1], a[2]); return 'OK'; }
    case 'SADD': { const s = make(a[0], 'set', () => new Set()); let n = 0; for (const m of a.slice(1)) if (!s.has(m)) { s.add(m); n++; } return n; }
    case 'SCARD': { const v = live(a[0], 'set'); return v ? v.v.size : 0; }
    case 'ZADD': { const z = make(a[0], 'z', () => new Map()); const had = z.has(a[2]); z.set(a[2], parseFloat(a[1])); return had ? 0 : 1; }
    case 'ZREM': { const v = live(a[0], 'z'); return v && v.v.delete(a[1]) ? 1 : 0; }
    case 'ZRANGE': {
      const v = live(a[0], 'z'); if (!v) return [];
      const rev = a.slice(3).some((x) => String(x).toUpperCase() === 'REV');
      const arr = [...v.v.entries()].sort((x, y) => (rev ? y[1] - x[1] : x[1] - y[1])).map((x) => x[0]);
      return slice(arr, a[1], a[2]);
    }
    default: throw new Error('ERR unknown command ' + c);
  }
}

/* ---------- Upstash Redis over REST ---------- */
async function remote(path, body) {
  const r = await fetch(URL_ + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Storage error ' + r.status);
  return r.json();
}

async function cmd(args) {
  if (!persistent) return memRun(args);
  const j = await remote('', args);
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function pipe(list) {
  if (!list.length) return [];
  if (!persistent) return list.map(memRun);
  const j = await remote('/pipeline', list);
  return j.map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}

/* HGETALL returns [field, value, field, value...] -> object */
function obj(flat) {
  const o = {};
  if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) o[flat[i]] = flat[i + 1];
  return o;
}

module.exports = { persistent, cmd, pipe, obj };
