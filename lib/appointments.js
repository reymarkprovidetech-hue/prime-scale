'use strict';
const store = require('./store');
const stats = require('./stats');
const { uid, clean, manila } = require('./util');

const STATUSES = ['new', 'confirmed', 'done', 'cancelled'];
const dayNum = (iso) => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);

function validate(b) {
  const name = clean(b.name, 80);
  const phone = clean(b.phone, 30);
  const email = clean(b.email, 120);
  const date = clean(b.date, 10);
  const time = clean(b.time, 5);
  if (name.length < 2) return { error: 'Please enter your full name.' };
  if (!/^[0-9+\-\s()]{7,30}$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15) return { error: 'Please enter a valid phone number.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'Please enter a valid email address.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + 'T00:00:00Z'))) return { error: 'Please choose a valid date.' };
  const diff = dayNum(date) - dayNum(manila());
  if (diff < 0) return { error: 'Please choose today or a future date.' };
  if (diff > 400) return { error: 'Please choose a date within the next year.' };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: 'Please choose a valid time.' };
  return { data: { name, phone, email, date, time } };
}

async function create(body, extra) {
  const v = validate(body);
  if (v.error) return { error: v.error };
  const x = extra || {};
  const appt = Object.assign({}, v.data, {
    id: 'a_' + uid(5),
    status: 'new',
    source: x.source || 'form',
    chatId: x.chatId || '',
    vid: clean(x.vid, 40),
    device: x.device || '',
    country: x.country || '',
    ref: x.ref || '',
    createdAt: Date.now()
  });
  await store.cmd(['HSET', 'ps:appts', appt.id, JSON.stringify(appt)]);
  await Promise.all([
    stats.total('appts_total'),
    stats.total('appt_src:' + appt.source),
    stats.daily('appts'),
    stats.event('appointment', appt.name + ' booked ' + appt.date + ' ' + appt.time + ' (' + appt.source + ')', { dev: appt.device, cty: appt.country })
  ]);
  return { appt };
}

async function list() {
  const all = store.obj(await store.cmd(['HGETALL', 'ps:appts']));
  const out = [];
  for (const k of Object.keys(all)) { try { out.push(JSON.parse(all[k])); } catch (e) { /* skip */ } }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

async function setStatus(id, status) {
  if (!STATUSES.includes(status)) return false;
  const raw = await store.cmd(['HGET', 'ps:appts', id]);
  if (!raw) return false;
  const a = JSON.parse(raw);
  a.status = status;
  await store.cmd(['HSET', 'ps:appts', id, JSON.stringify(a)]);
  return true;
}

async function remove(id) {
  return store.cmd(['HDEL', 'ps:appts', id]);
}

module.exports = { create, list, setStatus, remove, validate, STATUSES, dayNum };
