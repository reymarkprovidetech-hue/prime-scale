'use strict';
const store = require('../lib/store');
const stats = require('../lib/stats');
const { send, readBody, ip, limit, clean, isBot, device, source, manila } = require('../lib/util');

const safe = (s, n) => clean(s, n || 32).toLowerCase().replace(/[^a-z0-9_-]/g, '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const ua = String(req.headers['user-agent'] || '');
    if (isBot(ua)) return send(res, 204);
    const b = await readBody(req);
    if (!(await limit('ps:rl:trk:' + ip(req), 240, 600))) return send(res, 204);

    const type = safe(b.type, 12);
    const name = safe(b.name, 32);
    const vid = clean(b.vid, 40).replace(/[^a-zA-Z0-9_-]/g, '');
    const dev = device(ua);
    const cty = String(req.headers['x-vercel-ip-country'] || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    const day = manila();

    if (type === 'view' && vid) {
      const src = source(b.ref).replace(/[^a-zA-Z0-9. \-]/g, '');
      const cmds = [
        ['HINCRBY', 'ps:stats', 'views', '1'],
        ['HINCRBY', 'ps:stats', 'dev:' + dev, '1'],
        ['HINCRBY', 'ps:stats', 'src:' + src, '1'],
        ['HINCRBY', 'ps:daily:' + day, 'views', '1'],
        ['EXPIRE', 'ps:daily:' + day, String(stats.KEEP_DAYS * 86400)],
        ['SADD', 'ps:vis:all', vid],
        ['SADD', 'ps:vis:' + day, vid],
        ['EXPIRE', 'ps:vis:' + day, String(stats.KEEP_DAYS * 86400)]
      ];
      if (cty) cmds.push(['HINCRBY', 'ps:stats', 'cty:' + cty, '1']);
      const out = await store.pipe(cmds);
      const follow = [];
      if (out[5] === 1) follow.push(['HINCRBY', 'ps:stats', 'uniq', '1']);
      if (out[6] === 1) follow.push(['HINCRBY', 'ps:daily:' + day, 'uniq', '1']);
      if (follow.length) await store.pipe(follow);
      if (out[5] === 1) await stats.event('visitor', 'New visitor from ' + src + ' on ' + dev, { dev, cty });
    } else if (type === 'section' && name) {
      await store.cmd(['HINCRBY', 'ps:stats', 'sec:' + name, '1']);
    } else if (type === 'click' && name) {
      await store.cmd(['HINCRBY', 'ps:stats', 'clk:' + name, '1']);
      await stats.event('click', name, { dev, cty });
    } else if (type === 'chatopen') {
      await store.cmd(['HINCRBY', 'ps:stats', 'chat_opens', '1']);
    }
    return send(res, 204);
  } catch (e) {
    return send(res, 204);
  }
};
