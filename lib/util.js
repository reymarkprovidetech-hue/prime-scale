'use strict';
const crypto = require('crypto');
const store = require('./store');

function send(res, code, body, headers) {
  res.statusCode = code;
  res.setHeader('Cache-Control', 'no-store');
  if (headers) for (const k of Object.keys(headers)) res.setHeader(k, headers[k]);
  if (code === 204) return res.end();
  if (typeof body === 'string') {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(body);
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(body == null ? {} : body));
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        try { return resolve(JSON.parse(req.body.toString('utf8'))); } catch (e) { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 100000) { req.destroy(); resolve({}); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const ip = (req) => String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown').split(',')[0].trim();

/* true while the caller is still under the limit */
async function limit(key, max, seconds) {
  const n = await store.cmd(['INCR', key]);
  if (n === 1) await store.cmd(['EXPIRE', key, seconds]);
  return n <= max;
}

const uid = (n = 6) => crypto.randomBytes(n).toString('hex');
/* Philippine date (UTC+8) as YYYY-MM-DD */
const manila = (ts = Date.now()) => new Date(ts + 8 * 3600 * 1000).toISOString().slice(0, 10);
const clean = (s, max = 200) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const isBot = (ua) => /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime/i.test(ua || '');
const device = (ua) => (/ipad|tablet/i.test(ua || '') ? 'tablet' : /mobi|android|iphone/i.test(ua || '') ? 'mobile' : 'desktop');

function source(ref) {
  const r = String(ref || '').toLowerCase();
  if (!r) return 'Direct';
  if (/facebook|fb\.|messenger|l\.facebook/.test(r)) return 'Facebook';
  if (/instagram/.test(r)) return 'Instagram';
  if (/tiktok/.test(r)) return 'TikTok';
  if (/google/.test(r)) return 'Google';
  if (/wa\.me|whatsapp/.test(r)) return 'WhatsApp';
  if (/t\.co|twitter|x\.com/.test(r)) return 'X';
  return r.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].slice(0, 30) || 'Direct';
}

module.exports = { send, readBody, ip, limit, uid, manila, clean, isBot, device, source };
