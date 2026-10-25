'use strict';
const store = require('./store');
const { manila } = require('./util');

const KEEP_DAYS = 120;

/* add to today's counters (Philippine time) */
function daily(field, n) {
  const key = 'ps:daily:' + manila();
  return store.pipe([['HINCRBY', key, field, String(n || 1)], ['EXPIRE', key, String(KEEP_DAYS * 86400)]]);
}

function total(field, n) {
  return store.cmd(['HINCRBY', 'ps:stats', field, String(n || 1)]);
}

/* activity feed, newest first, capped at 200 */
function event(type, detail, ctx) {
  const c = ctx || {};
  return store.pipe([
    ['LPUSH', 'ps:events', JSON.stringify({ ts: Date.now(), type, d: String(detail || '').slice(0, 120), dev: c.dev || '', cty: c.cty || '' })],
    ['LTRIM', 'ps:events', '0', '199']
  ]);
}

module.exports = { daily, total, event, KEEP_DAYS };
