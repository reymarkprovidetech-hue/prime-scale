'use strict';
const chats = require('../lib/chats');
const assistant = require('../lib/assistant');
const { send, readBody, ip, limit, clean, isBot, device, source } = require('../lib/util');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const ua = String(req.headers['user-agent'] || '');
    if (isBot(ua)) return send(res, 200, { id: '', msgs: [], total: 0, adminActive: false });
    const b = await readBody(req);
    const after = Math.max(0, parseInt(b.after, 10) || 0);
    let id = clean(b.id, 20);

    if (b.action === 'send') {
      if (!(await limit('ps:rl:chat:' + ip(req), 40, 600))) return send(res, 429, { error: 'You\'re sending messages very quickly. Please wait a moment.' });
      const out = await chats.visitorSend(id, b.text, {
        vid: clean(b.vid, 40).replace(/[^a-zA-Z0-9_-]/g, ''),
        dev: device(ua),
        cty: String(req.headers['x-vercel-ip-country'] || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2),
        src: source(clean(b.ref, 200))
      });
      if (out.error) return send(res, 400, { error: out.error });
      id = out.id;
    }
    const v = await chats.view(id, after);
    v.ai = assistant.llmEnabled();
    return send(res, 200, v);
  } catch (e) {
    return send(res, 500, { error: 'The assistant is unavailable right now. Please use the contact details on this page.' });
  }
};
