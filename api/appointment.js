'use strict';
const store = require('../lib/store');
const appointments = require('../lib/appointments');
const { send, readBody, ip, limit, clean, isBot, device, source } = require('../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const ua = String(req.headers['user-agent'] || '');
    const b = await readBody(req);
    if (b.website) return send(res, 200, { ok: true, persisted: true }); /* honeypot: pretend success */
    if (isBot(ua)) return send(res, 400, { error: 'Not allowed.' });
    if (!(await limit('ps:rl:appt:' + ip(req), 6, 3600))) return send(res, 429, { error: 'Too many requests. Please try again in a little while or contact us directly.' });

    const out = await appointments.create(b, {
      source: 'form',
      vid: b.vid,
      device: device(ua),
      country: String(req.headers['x-vercel-ip-country'] || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2),
      ref: source(clean(b.ref, 200))
    });
    if (out.error) return send(res, 400, { error: out.error });
    return send(res, 200, { ok: true, persisted: store.persistent, id: out.appt.id });
  } catch (e) {
    return send(res, 500, { error: 'Something went wrong on our side. Please try again or contact us directly.' });
  }
};
