'use strict';
const store = require('./store');
const stats = require('./stats');
const kb = require('./kb');
const assistant = require('./assistant');
const appointments = require('./appointments');
const { uid, clean, manila } = require('./util');

/* After a team member replies, the AI stays quiet until this much time passes with no manual reply. */
const RESUME_MS = Number(process.env.AI_RESUME_MS) || 10 * 60 * 1000;
const FRESH_MS = 30 * 60 * 1000; /* AI won't answer a visitor message older than this */
const MAX_MSGS = 300;

const kM = (id) => 'ps:chat:' + id + ':m';
const kMeta = (id) => 'ps:chat:' + id + ':meta';
const validId = (id) => /^c_[a-f0-9]{12}$/.test(String(id || ''));
const parse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

async function meta(id) { return store.obj(await store.cmd(['HGETALL', kMeta(id)])); }

async function add(id, role, text, extra) {
  const m = Object.assign({ r: role, t: text, ts: Date.now() }, extra || {});
  await store.pipe([
    ['RPUSH', kM(id), JSON.stringify(m)],
    ['HSET', kMeta(id), 'lastTs', String(m.ts), 'lastRole', role],
    ['ZADD', 'ps:chatidx', String(m.ts), id]
  ]);
  return m;
}

async function messages(id, after) {
  const raw = await store.cmd(['LRANGE', kM(id), String(Math.max(0, after | 0)), '-1']);
  return raw.map(parse).filter(Boolean);
}

const adminActive = (m) => Boolean(Number(m.lastAdminTs || 0)) && Date.now() - Number(m.lastAdminTs) < RESUME_MS;

async function init(id, ctx) {
  await store.cmd(['HSET', kMeta(id), 'createdAt', String(Date.now()), 'vid', ctx.vid || '', 'dev', ctx.dev || '', 'cty', ctx.cty || '', 'src', ctx.src || '', 'unread', '0']);
  await Promise.all([
    stats.total('chats_total'),
    stats.daily('chats'),
    stats.event('chat', 'New chat started', ctx)
  ]);
}

/* Reply with the AI unless a team member replied within the last RESUME_MS. */
async function maybeAiReply(id) {
  const m = await meta(id);
  if (!m.createdAt || m.lastRole !== 'visitor') return { paused: false };
  if (adminActive(m)) return { paused: true };
  if (Date.now() - Number(m.lastTs || 0) > FRESH_MS) return { paused: false };

  const n = await store.cmd(['LLEN', kM(id)]);
  const got = await store.cmd(['SET', 'ps:lock:' + id + ':' + n, '1', 'NX', 'EX', '60']);
  if (!got) return { paused: false };

  const history = (await messages(id, Math.max(0, n - 14))).map((x) => ({ r: x.r, t: x.t }));
  if (!history.length || history[history.length - 1].r !== 'visitor') return { paused: false };

  const booking = m.booking ? parse(m.booking) : null;
  const out = await assistant.respond({
    history,
    booking,
    today: manila(),
    createAppt: (data) => appointments.create(data, { source: 'chat', chatId: id, vid: m.vid, device: m.dev, country: m.cty, ref: m.src })
  });

  for (const r of out.replies) {
    await add(id, 'ai', r.text, { q: r.q, ui: r.ui });
  }
  const patch = ['booking', out.booking ? JSON.stringify(out.booking) : ''];
  if (out.name) patch.push('name', out.name);
  if (out.needsHuman) patch.push('needsHuman', '1');
  await store.cmd(['HSET', kMeta(id)].concat(patch));
  if (out.needsHuman) await stats.event('chat', 'Visitor asked for a person', { dev: m.dev, cty: m.cty });
  return { paused: false };
}

async function visitorSend(id, text, ctx) {
  const t = clean(text, 1000);
  if (!t) return { error: 'Please type a message.' };
  let cid = id;
  let m = validId(cid) ? await meta(cid) : {};
  if (!m.createdAt) {
    if (!validId(cid)) cid = 'c_' + uid(6);
    await init(cid, ctx);
    m = await meta(cid);
  }
  if ((await store.cmd(['LLEN', kM(cid)])) >= MAX_MSGS) return { error: 'This chat is full. Please book an appointment or contact the team directly.' };
  const guess = /(?:my name is|this is|ako si|call me)\s+([A-Za-z][A-Za-z .'-]{1,30})/i.exec(t);
  const fields = [];
  if (guess && !m.name) fields.push('name', guess[1].trim());
  await add(cid, 'visitor', t);
  await store.pipe([
    ['HINCRBY', kMeta(cid), 'unread', '1']
  ].concat(fields.length ? [['HSET', kMeta(cid)].concat(fields)] : []));
  const r = await maybeAiReply(cid);
  return { id: cid, paused: r.paused };
}

/* what a visitor's browser receives */
async function view(id, after) {
  if (!validId(id)) return { id: '', msgs: [], total: 0, adminActive: false };
  const [metaRaw, listRaw] = await store.pipe([['HGETALL', kMeta(id)], ['LRANGE', kM(id), String(Math.max(0, after | 0)), '-1']]);
  const m = store.obj(metaRaw);
  if (!m.createdAt) return { id: '', msgs: [], total: 0, adminActive: false };
  const msgs = listRaw.map(parse).filter(Boolean);
  return { id, msgs, total: Math.max(0, after | 0) + msgs.length, adminActive: adminActive(m) };
}

/* ---------------- admin side ---------------- */
async function list() {
  const ids = await store.cmd(['ZRANGE', 'ps:chatidx', '0', '39', 'REV']);
  if (!ids.length) return [];
  const raw = await store.pipe(ids.flatMap((id) => [['HGETALL', kMeta(id)], ['LRANGE', kM(id), '-1', '-1'], ['LLEN', kM(id)]]));
  const out = [];
  const resume = [];
  ids.forEach((id, i) => {
    const m = store.obj(raw[i * 3]);
    if (!m.createdAt) return;
    const last = parse((raw[i * 3 + 1] || [])[0]) || {};
    const entry = {
      id, name: m.name || '', vid: (m.vid || '').slice(0, 6), dev: m.dev || '', cty: m.cty || '',
      createdAt: Number(m.createdAt), lastTs: Number(m.lastTs || m.createdAt),
      unread: Number(m.unread || 0), needsHuman: m.needsHuman === '1',
      lastAdminTs: Number(m.lastAdminTs || 0), adminActive: adminActive(m),
      total: Number(raw[i * 3 + 2] || 0),
      last: { r: last.r || '', t: String(last.t || '').slice(0, 140) },
      booking: Boolean(m.booking)
    };
    out.push(entry);
    if (m.lastRole === 'visitor' && !entry.adminActive && Date.now() - entry.lastTs < FRESH_MS) resume.push(id);
  });
  /* the AI picks up visitor messages that waited after the team went quiet */
  for (const id of resume) { try { await maybeAiReply(id); } catch (e) { /* ignore */ } }
  return out;
}

async function open(id) {
  if (!validId(id)) return null;
  try { await maybeAiReply(id); } catch (e) { /* ignore */ }
  const m = await meta(id);
  if (!m.createdAt) return null;
  const msgs = await messages(id, 0);
  await store.cmd(['HSET', kMeta(id), 'unread', '0']);
  return {
    id, name: m.name || '', dev: m.dev || '', cty: m.cty || '', src: m.src || '',
    createdAt: Number(m.createdAt), lastAdminTs: Number(m.lastAdminTs || 0), adminActive: adminActive(m),
    needsHuman: m.needsHuman === '1', booking: m.booking ? parse(m.booking) : null,
    resumeAt: Number(m.lastAdminTs || 0) ? Number(m.lastAdminTs) + RESUME_MS : 0,
    msgs
  };
}

async function adminReply(id, text) {
  const t = clean(text, 1500);
  if (!validId(id) || !t) return false;
  const m = await meta(id);
  if (!m.createdAt) return false;
  await add(id, 'admin', t);
  await store.cmd(['HSET', kMeta(id), 'lastAdminTs', String(Date.now()), 'booking', '', 'needsHuman', '0', 'unread', '0']);
  return true;
}

async function handBack(id) {
  if (!validId(id)) return false;
  await store.cmd(['HSET', kMeta(id), 'lastAdminTs', '0']);
  await maybeAiReply(id);
  return true;
}

async function remove(id) {
  if (!validId(id)) return false;
  await store.pipe([['DEL', kM(id)], ['DEL', kMeta(id)], ['ZREM', 'ps:chatidx', id]]);
  return true;
}

module.exports = { visitorSend, view, maybeAiReply, list, open, adminReply, handBack, remove, RESUME_MS, validId };
