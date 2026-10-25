'use strict';
const store = require('../lib/store');
const auth = require('../lib/auth');
const chats = require('../lib/chats');
const appointments = require('../lib/appointments');
const assistant = require('../lib/assistant');
const stats = require('../lib/stats');
const { send, readBody, ip, limit, manila } = require('../lib/util');

const num = (v) => Number(v || 0);

/* spreadsheet-safe CSV cell */
function cell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

async function overview() {
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(manila(Date.now() - i * 86400000));
  const [all, events, appts, ...daily] = await store.pipe([
    ['HGETALL', 'ps:stats'],
    ['LRANGE', 'ps:events', '0', '39'],
    ['HGETALL', 'ps:appts']
  ].concat(days.map((d) => ['HGETALL', 'ps:daily:' + d])));
  const s = store.obj(all);
  const group = (prefix) => {
    const o = {};
    for (const k of Object.keys(s)) if (k.indexOf(prefix) === 0) o[k.slice(prefix.length)] = num(s[k]);
    return o;
  };
  const status = { new: 0, confirmed: 0, done: 0, cancelled: 0 };
  const a = store.obj(appts);
  for (const k of Object.keys(a)) { try { const x = JSON.parse(a[k]); if (status[x.status] !== undefined) status[x.status]++; } catch (e) { /* skip */ } }
  return {
    totals: { views: num(s.views), uniq: num(s.uniq), appts: num(s.appts_total), chats: num(s.chats_total), chatOpens: num(s.chat_opens), newAppts: status.new },
    days: days.map((d, i) => { const o = store.obj(daily[i]); return { d, views: num(o.views), uniq: num(o.uniq), appts: num(o.appts), chats: num(o.chats) }; }),
    breakdown: { dev: group('dev:'), src: group('src:'), cty: group('cty:'), sec: group('sec:'), clk: group('clk:'), apptSrc: group('appt_src:') },
    status,
    events: events.map((e) => { try { return JSON.parse(e); } catch (x) { return null; } }).filter(Boolean)
  };
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');

    /* CSV download (GET) */
    if (req.method === 'GET') {
      if (url.searchParams.get('action') !== 'export') return send(res, 404, { error: 'Not found' });
      if (!auth.isAdmin(req)) return send(res, 401, 'Please log in first.');
      const rows = await appointments.list();
      const head = ['Received', 'Name', 'Phone', 'Email', 'Preferred date', 'Preferred time (PHT)', 'Status', 'Source', 'Device', 'Country', 'Came from'];
      const lines = [head.map(cell).join(',')].concat(rows.map((r) => [new Date(r.createdAt).toISOString(), r.name, r.phone, r.email, r.date, r.time, r.status, r.source, r.device, r.country, r.ref].map(cell).join(',')));
      return send(res, 200, '﻿' + lines.join('\r\n'), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="prime-scale-appointments.csv"' });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

    const b = await readBody(req);
    const action = String(b.action || '');

    if (action === 'login') {
      if (!(await limit('ps:rl:login:' + ip(req), 10, 900))) return send(res, 429, { error: 'Too many attempts. Please wait 15 minutes and try again.' });
      const ok = auth.checkLogin(String(b.user || ''), String(b.pass || ''));
      if (!ok) { await new Promise((r) => setTimeout(r, 500)); return send(res, 401, { error: 'Wrong username or password.' }); }
      auth.setCookie(req, res, auth.makeToken(7), 7 * 86400);
      return send(res, 200, { ok: true });
    }
    if (action === 'logout') { auth.setCookie(req, res, '', 0); return send(res, 200, { ok: true }); }

    if (!auth.isAdmin(req)) return send(res, 401, { error: 'login' });

    switch (action) {
      case 'me':
        return send(res, 200, { ok: true, defaultCreds: auth.defaultCreds, persistent: store.persistent, ai: assistant.llmEnabled(), resumeMin: Math.round(chats.RESUME_MS / 60000) });
      case 'stats':
        return send(res, 200, await overview());
      case 'badges': {
        /* cheap check used for the red counters: newest 20 chats + appointment list */
        const ids = await store.cmd(['ZRANGE', 'ps:chatidx', '0', '19', 'REV']);
        const r = await store.pipe(ids.map((id) => ['HGET', 'ps:chat:' + id + ':meta', 'unread']).concat([['HGETALL', 'ps:appts']]));
        const unread = r.slice(0, ids.length).map(num);
        const a = store.obj(r[ids.length]);
        let newAppts = 0;
        for (const k of Object.keys(a)) { try { if (JSON.parse(a[k]).status === 'new') newAppts++; } catch (e) { /* skip */ } }
        return send(res, 200, { unreadChats: unread.filter((n) => n > 0).length, unreadMsgs: unread.reduce((x, y) => x + y, 0), newAppts });
      }
      case 'appts':
        return send(res, 200, { appts: await appointments.list() });
      case 'appt_status':
        return send(res, 200, { ok: await appointments.setStatus(String(b.id || ''), String(b.status || '')) });
      case 'appt_delete':
        await appointments.remove(String(b.id || ''));
        return send(res, 200, { ok: true });
      case 'chats':
        return send(res, 200, { chats: await chats.list(), resumeMs: chats.RESUME_MS });
      case 'chat': {
        const c = await chats.open(String(b.id || ''));
        return c ? send(res, 200, c) : send(res, 404, { error: 'Chat not found' });
      }
      case 'reply':
        return send(res, 200, { ok: await chats.adminReply(String(b.id || ''), b.text) });
      case 'handback':
        return send(res, 200, { ok: await chats.handBack(String(b.id || '')) });
      case 'chat_delete':
        return send(res, 200, { ok: await chats.remove(String(b.id || '')) });
      default:
        return send(res, 400, { error: 'Unknown action' });
    }
  } catch (e) {
    return send(res, 500, { error: 'Server error: ' + (e && e.message ? e.message : 'unknown') });
  }
};

void stats;
