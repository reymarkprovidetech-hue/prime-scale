'use strict';
const kb = require('./kb');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
const validISO = (s) => { const d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === s; };
const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/* "2026-10-30", "Oct 30", "30 October 2026", "tomorrow", "next Friday" -> YYYY-MM-DD or null */
function parseDate(text, today) {
  const t = String(text).toLowerCase();
  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) { const s = iso(+m[1], +m[2], +m[3]); return validISO(s) ? s : null; }
  if (/\btoday\b/.test(t)) return today;
  if (/\b(tomorrow|tmrw|bukas)\b/.test(t)) return addDays(today, 1);
  const yr = +today.slice(0, 4);
  let mo = 0, day = 0, y = null;
  m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/);
  if (m) { mo = MONTHS.indexOf(m[1]) + 1; day = +m[2]; y = m[3] ? +m[3] : null; }
  else {
    m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s*(\d{4}))?\b/);
    if (m) { day = +m[1]; mo = MONTHS.indexOf(m[2]) + 1; y = m[3] ? +m[3] : null; }
  }
  if (mo) {
    let s = iso(y || yr, mo, day);
    if (!validISO(s)) return null;
    if (!y && s < today) s = iso(yr + 1, mo, day);
    return validISO(s) ? s : null;
  }
  m = t.match(/\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/);
  if (m) {
    const target = WD[m[1]];
    const now = new Date(today + 'T00:00:00Z').getUTCDay();
    let delta = (target - now + 7) % 7;
    if (delta === 0) delta = 7;
    return addDays(today, delta);
  }
  return null;
}

/* "3pm", "3:30 PM", "15:00", "noon" -> HH:MM or null */
function parseTime(text) {
  const t = String(text).toLowerCase().trim();
  let m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/);
  if (m) {
    let h = +m[1]; const mi = m[2] ? +m[2] : 0; const pm = m[3][0] === 'p';
    if (h < 1 || h > 12 || mi > 59) return null;
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return pad(h) + ':' + pad(mi);
  }
  m = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m) return pad(+m[1]) + ':' + m[2];
  if (/\bnoon\b/.test(t)) return '12:00';
  return null;
}

function fmtWhen(date, time) {
  const d = new Date(date + 'T00:00:00Z');
  const h = +time.slice(0, 2);
  return WEEK[d.getUTCDay()] + ', ' + MONTH_NAMES[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear() +
    ' at ' + ((h % 12) || 12) + ':' + time.slice(3) + ' ' + (h >= 12 ? 'PM' : 'AM') + ' PHT';
}

const reply = (text, extra) => Object.assign({ text }, extra || {});

/* ---------------- guided booking ---------------- */
async function bookingFlow(b, text, env) {
  const t = String(text).trim();
  const d = Object.assign({}, b.data || {});
  const stay = (msg, ui) => ({ replies: [reply(msg, ui ? { ui } : {})], booking: b });
  const go = (step, msg, ui, extra) => ({ replies: [reply(msg, ui ? { ui } : {})], booking: { step, data: d }, ...(extra || {}) });

  if (/^(cancel|stop|never ?mind|exit|quit)\b/i.test(t) || /\bcancel (that|this|it|the booking)\b/i.test(t)) {
    return { replies: [reply('No problem, I\'ve cancelled that. Let me know if you\'d like to book later or have other questions.', { q: kb.QUICK })], booking: null };
  }

  switch (b.step) {
    case 'name': {
      const name = t.replace(/^(my name is|i am|i'm|this is|ako si)\s+/i, '').trim().slice(0, 60);
      if (name.length < 2 || !/[a-zA-Z]/.test(name) || /[?@\d]/.test(name)) return stay('Please type your full name, for example “Juan Dela Cruz”.');
      d.name = name;
      return go('phone', 'Thanks, ' + name.split(/\s+/)[0] + '. What\'s the best phone number to reach you?', null, { name });
    }
    case 'phone': {
      const digits = t.replace(/\D/g, '');
      if (!/^[0-9+\-\s()]{7,30}$/.test(t) || digits.length < 7 || digits.length > 15) return stay('That phone number doesn\'t look right. Please enter it like 0912 345 6789 or +63 912 345 6789.');
      d.phone = t;
      return go('email', 'Got it. And your email address?');
    }
    case 'email': {
      const email = t.replace(/^mailto:/i, '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return stay('Please enter a valid email address, like name@example.com.');
      d.email = email;
      return go('date', 'Which date works best for your call? Pick one below or type it, like “Oct 30”.', 'date');
    }
    case 'date': {
      const date = parseDate(t, env.today);
      if (!date) return stay('I couldn\'t read that date. Pick one below or type it like “2026-10-30”, “Oct 30” or “next Friday”.', 'date');
      if (date < env.today) return stay('That date has passed. Please choose today or a later date.', 'date');
      if (date > addDays(env.today, 365)) return stay('Please choose a date within the next year.', 'date');
      d.date = date;
      return go('time', 'And what time do you prefer? All times are in Philippine Time (PHT).', 'time');
    }
    case 'time': {
      const time = parseTime(t);
      if (!time) return stay('I couldn\'t read that time. Pick one below or type it like “3:00 PM” or “15:00”.', 'time');
      d.time = time;
      const out = go('confirm', 'Please check your details:\n\nName: ' + d.name + '\nPhone: ' + d.phone + '\nEmail: ' + d.email + '\nWhen: ' + fmtWhen(d.date, d.time) +
        '\n\nShall I book this?');
      out.replies[0].q = ['Yes, confirm', 'Change details', 'Cancel'];
      return out;
    }
    case 'confirm': {
      if (/^(yes|y|yep|yeah|confirm|ok|okay|sure|correct|right|book|oo|sige)\b/i.test(t)) {
        const out = await env.createAppt(d);
        if (out.error) {
          const step = /date/i.test(out.error) ? 'date' : /time/i.test(out.error) ? 'time' : 'name';
          return { replies: [reply(out.error + ' Let\'s fix that.', step === 'date' || step === 'time' ? { ui: step } : {})], booking: { step, data: d } };
        }
        return {
          replies: [reply('You\'re booked for ' + fmtWhen(d.date, d.time) + '. The team will confirm by phone or email. Is there anything else I can help with?', { q: kb.QUICK })],
          booking: null, booked: out.appt.id
        };
      }
      if (/\b(change|edit|redo|wrong|no)\b/i.test(t)) return { replies: [reply('No problem, let\'s start again. What\'s your full name?')], booking: { step: 'name', data: {} } };
      return { replies: [reply('Shall I book it? Choose an option below.', { q: ['Yes, confirm', 'Change details', 'Cancel'] })], booking: b };
    }
    default:
      return { replies: [reply('Let\'s start your booking. What\'s your full name?')], booking: { step: 'name', data: {} } };
  }
}

/* ---------------- optional real AI (Claude) ---------------- */
async function llm(history) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
  const msgs = [];
  for (const m of history.slice(-12)) {
    const role = m.r === 'visitor' ? 'user' : 'assistant';
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + m.t;
    else msgs.push({ role, content: m.t });
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 400, system: kb.SYSTEM_PROMPT, messages: msgs })
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text || null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- main entry ---------------- */
async function respond(env) {
  const history = env.history;
  const text = history[history.length - 1].t;

  if (env.booking && env.booking.step) return bookingFlow(env.booking, text, env);

  if (kb.isHuman(text)) {
    return { replies: [reply(kb.A.human, { q: kb.QUICK })], booking: null, needsHuman: true };
  }
  if (kb.isBooking(text)) {
    return {
      replies: [reply('Happy to set that up. What\'s your full name?')],
      booking: { step: 'name', data: {} }
    };
  }
  const ai = await llm(history);
  if (ai) return { replies: [reply(ai, { q: kb.QUICK })], booking: null };
  return { replies: [reply(kb.rule(text), { q: kb.QUICK })], booking: null };
}

module.exports = { respond, parseDate, parseTime, fmtWhen, llmEnabled: () => Boolean(process.env.ANTHROPIC_API_KEY) };
