'use strict';
const crypto = require('crypto');

/*
  Admin login.
  Defaults are admin / password (as requested). CHANGE THEM after deploying:
  Vercel -> your project -> Settings -> Environment Variables -> add ADMIN_USER and ADMIN_PASS, then redeploy.
*/
const USER = process.env.ADMIN_USER || 'admin';
const PASS = process.env.ADMIN_PASS || 'password';
const defaultCreds = USER === 'admin' && PASS === 'password';
const SECRET = process.env.ADMIN_SECRET || crypto.createHash('sha256').update('primescale|' + USER + '|' + PASS).digest('hex');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

function checkLogin(u, p) {
  const a = same(u, USER);
  const b = same(p, PASS);
  return a && b;
}

const sig = (exp) => crypto.createHmac('sha256', SECRET).update('admin.' + exp).digest('base64url');

function makeToken(days) {
  const exp = Date.now() + (days || 7) * 86400000;
  return exp + '.' + sig(exp);
}

function verifyToken(t) {
  if (!t) return false;
  const parts = String(t).split('.');
  if (parts.length !== 2 || Number(parts[0]) < Date.now()) return false;
  const good = Buffer.from(sig(parts[0]));
  const got = Buffer.from(parts[1]);
  return good.length === got.length && crypto.timingSafeEqual(good, got);
}

function cookieFrom(req) {
  const m = /(?:^|;\s*)ps_admin=([^;]+)/.exec(req.headers.cookie || '');
  return m ? decodeURIComponent(m[1]) : '';
}

const isAdmin = (req) => verifyToken(cookieFrom(req));

function setCookie(req, res, token, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', 'ps_admin=' + encodeURIComponent(token) + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + maxAge + secure);
}

module.exports = { defaultCreds, checkLogin, makeToken, isAdmin, setCookie };
