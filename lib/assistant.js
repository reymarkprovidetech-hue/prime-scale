'use strict';
const kb = require('./kb');
const { detect, pick } = require('./lang');

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
  if (/\b(ngayon|ngayong araw)\b/.test(t)) return today;
  if (/\bmakalawa\b/.test(t)) return addDays(today, 2);
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
  m = t.match(/\balas[-\s]?(\d{1,2})(?::(\d{2}))?\s*(?:ng\s+)?(umaga|tanghali|hapon|gabi)\b/);
  if (m) {
    let h = +m[1]; const mi = m[2] ? +m[2] : 0;
    if (h < 1 || h > 12 || mi > 59) return null;
    if (m[3] === 'umaga') { if (h === 12) h = 0; }
    else if (m[3] === 'tanghali') { if (h < 11) h += 12; }
    else if (h < 12) h += 12;
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


/* booking prompts in English (en), Taglish (tgl) and Tagalog (tl) */
const S = {
  cancelled: {
    en: 'No problem, I\'ve cancelled that. Let me know if you\'d like to book later or have other questions.',
    tgl: 'Okay lang, na-cancel ko na. Sabihan mo lang ako kung gusto mong mag-book later o may iba kang tanong.',
    tl: 'Walang problema, kinansela ko na iyon. Sabihan mo lang ako kung nais mong magpa-book sa ibang pagkakataon o may iba kang tanong.'
  },
  start: {
    en: 'Happy to set that up. What\'s your full name?',
    tgl: 'Sige, i-set up natin yan. Ano ang full name mo?',
    tl: 'Sige, ihahanda natin iyan. Ano ang buong pangalan mo?'
  },
  nameBad: {
    en: 'Please type your full name, for example “Juan Dela Cruz”.',
    tgl: 'Paki-type ang full name mo, halimbawa “Juan Dela Cruz”.',
    tl: 'Pakitype ang buong pangalan mo, halimbawa “Juan Dela Cruz”.'
  },
  phone: {
    en: (n) => 'Thanks, ' + n + '. What\'s the best phone number to reach you?',
    tgl: (n) => 'Thanks, ' + n + '. Ano ang best phone number para ma-reach ka?',
    tl: (n) => 'Salamat, ' + n + '. Ano ang pinakamainam na numero ng telepono para ka namin makontak?'
  },
  phoneBad: {
    en: 'That phone number doesn\'t look right. Please enter it like 0912 345 6789 or +63 912 345 6789.',
    tgl: 'Parang mali ang phone number. Paki-enter ulit, tulad ng 0912 345 6789 o +63 912 345 6789.',
    tl: 'Mukhang hindi tama ang numero. Pakipasok muli, tulad ng 0912 345 6789 o +63 912 345 6789.'
  },
  email: {
    en: 'Got it. And your email address?',
    tgl: 'Got it. Ano naman ang email address mo?',
    tl: 'Nakuha ko. At ang iyong email address?'
  },
  emailBad: {
    en: 'Please enter a valid email address, like name@example.com.',
    tgl: 'Paki-enter ang valid na email address, tulad ng name@example.com.',
    tl: 'Pakipasok ang wastong email address, tulad ng name@example.com.'
  },
  date: {
    en: 'Which date works best for your call? Pick one below or type it, like “Oct 30”.',
    tgl: 'Anong date ang best para sa call mo? Pumili sa ibaba o i-type, tulad ng “Oct 30” o “bukas”.',
    tl: 'Anong petsa ang pinakamainam para sa tawag? Pumili sa ibaba o i-type, tulad ng “Oct 30” o “bukas”.'
  },
  dateBad: {
    en: 'I couldn\'t read that date. Pick one below or type it like “2026-10-30”, “Oct 30” or “next Friday”.',
    tgl: 'Hindi ko nabasa ang date. Pumili sa ibaba o i-type tulad ng “2026-10-30”, “Oct 30” o “bukas”.',
    tl: 'Hindi ko mabasa ang petsa. Pumili sa ibaba o i-type tulad ng “2026-10-30”, “Oct 30” o “bukas”.'
  },
  datePast: {
    en: 'That date has passed. Please choose today or a later date.',
    tgl: 'Lumipas na ang date na yan. Pumili ng ngayon o mas huling date.',
    tl: 'Lumipas na ang petsang iyan. Pumili ng ngayong araw o mas huling petsa.'
  },
  dateFar: {
    en: 'Please choose a date within the next year.',
    tgl: 'Pumili ng date sa loob ng susunod na isang taon.',
    tl: 'Pumili ng petsa sa loob ng susunod na isang taon.'
  },
  time: {
    en: 'And what time do you prefer? All times are in Philippine Time (PHT).',
    tgl: 'Anong oras ang gusto mo? Philippine Time (PHT) ang lahat ng oras.',
    tl: 'Anong oras ang nais mo? Philippine Time (PHT) ang lahat ng oras.'
  },
  timeBad: {
    en: 'I couldn\'t read that time. Pick one below or type it like “3:00 PM” or “15:00”.',
    tgl: 'Hindi ko nabasa ang oras. Pumili sa ibaba o i-type tulad ng “3:00 PM”, “15:00” o “alas-3 ng hapon”.',
    tl: 'Hindi ko mabasa ang oras. Pumili sa ibaba o i-type tulad ng “3:00 PM”, “15:00” o “alas-3 ng hapon”.'
  },
  confirm: {
    en: (d, w) => 'Please check your details:\n\nName: ' + d.name + '\nPhone: ' + d.phone + '\nEmail: ' + d.email + '\nWhen: ' + w + '\n\nShall I book this?',
    tgl: (d, w) => 'Paki-check ang details mo:\n\nName: ' + d.name + '\nPhone: ' + d.phone + '\nEmail: ' + d.email + '\nKailan: ' + w + '\n\nI-book ko na ba ito?',
    tl: (d, w) => 'Pakisuri ang iyong mga detalye:\n\nPangalan: ' + d.name + '\nTelepono: ' + d.phone + '\nEmail: ' + d.email + '\nKailan: ' + w + '\n\nIpa-book ko na ba ito?'
  },
  confirmQ: {
    en: ['Yes, confirm', 'Change details', 'Cancel'],
    tgl: ['Oo, confirm', 'Palitan ang details', 'Cancel na'],
    tl: ['Oo, kumpirmahin', 'Baguhin ang detalye', 'Kanselahin']
  },
  confirmAsk: {
    en: 'Shall I book it? Choose an option below.',
    tgl: 'I-book ko na ba? Pumili sa ibaba.',
    tl: 'Ipa-book ko na ba? Pumili ng opsyon sa ibaba.'
  },
  fix: {
    en: (e) => e + ' Let\'s fix that.',
    tgl: (e) => e + ' Ayusin natin.',
    tl: (e) => e + ' Ayusin natin ito.'
  },
  booked: {
    en: (w) => 'You\'re booked for ' + w + '. The team will confirm by phone or email. Is there anything else I can help with?',
    tgl: (w) => 'Booked ka na sa ' + w + '. Ica-confirm ng team via phone o email. May iba pa ba akong maitutulong?',
    tl: (w) => 'Naka-book ka na sa ' + w + '. Kukumpirmahin ng team sa pamamagitan ng tawag o email. May iba pa ba akong maitutulong?'
  },
  restart: {
    en: 'No problem, let\'s start again. What\'s your full name?',
    tgl: 'Okay, ulitin natin. Ano ang full name mo?',
    tl: 'Walang problema, ulitin natin. Ano ang buong pangalan mo?'
  },
  begin: {
    en: 'Let\'s start your booking. What\'s your full name?',
    tgl: 'Simulan na natin ang booking mo. Ano ang full name mo?',
    tl: 'Simulan na natin ang iyong booking. Ano ang buong pangalan mo?'
  }
};
const say = (key, lang, ...args) => { const v = pick(S[key], lang); return typeof v === 'function' ? v(...args) : v; };

const reply = (text, extra) => Object.assign({ text }, extra || {});

/* ---------------- guided booking ---------------- */
async function bookingFlow(b, text, env, lang) {
  const t = String(text).trim();
  const d = Object.assign({}, b.data || {});
  const stay = (msg, ui) => ({ replies: [reply(msg, ui ? { ui } : {})], booking: b });
  const go = (step, msg, ui, extra) => ({ replies: [reply(msg, ui ? { ui } : {})], booking: { step, data: d }, ...(extra || {}) });

  if (/^(cancel|stop|never ?mind|exit|quit|kanselahin|kansel|huwag na|wag na|cancel na)\b/i.test(t) || /\bcancel (that|this|it|the booking)\b/i.test(t)) {
    return { replies: [reply(say('cancelled', lang), { q: kb.quick(lang) })], booking: null };
  }

  switch (b.step) {
    case 'name': {
      const name = t.replace(/^(my name is|i am|i'm|this is|ako si|ako po si|ang pangalan ko ay|pangalan ko)\s+/i, '').trim().slice(0, 60);
      if (name.length < 2 || !/[a-zA-Z]/.test(name) || /[?@\d]/.test(name)) return stay(say('nameBad', lang));
      d.name = name;
      return go('phone', say('phone', lang, name.split(/\s+/)[0]), null, { name });
    }
    case 'phone': {
      const digits = t.replace(/\D/g, '');
      if (!/^[0-9+\-\s()]{7,30}$/.test(t) || digits.length < 7 || digits.length > 15) return stay(say('phoneBad', lang));
      d.phone = t;
      return go('email', say('email', lang));
    }
    case 'email': {
      const email = t.replace(/^mailto:/i, '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return stay(say('emailBad', lang));
      d.email = email;
      return go('date', say('date', lang), 'date');
    }
    case 'date': {
      const date = parseDate(t, env.today);
      if (!date) return stay(say('dateBad', lang), 'date');
      if (date < env.today) return stay(say('datePast', lang), 'date');
      if (date > addDays(env.today, 365)) return stay(say('dateFar', lang), 'date');
      d.date = date;
      return go('time', say('time', lang), 'time');
    }
    case 'time': {
      const time = parseTime(t);
      if (!time) return stay(say('timeBad', lang), 'time');
      d.time = time;
      const out = go('confirm', say('confirm', lang, d, fmtWhen(d.date, d.time)));
      out.replies[0].q = pick(S.confirmQ, lang);
      return out;
    }
    case 'confirm': {
      if (/^(yes|y|yep|yeah|confirm|ok|okay|sure|correct|right|book|oo|sige|opo|tama)\b/i.test(t)) {
        const out = await env.createAppt(d);
        if (out.error) {
          const step = /date/i.test(out.error) ? 'date' : /time/i.test(out.error) ? 'time' : 'name';
          return { replies: [reply(say('fix', lang, out.error), step === 'date' || step === 'time' ? { ui: step } : {})], booking: { step, data: d } };
        }
        return {
          replies: [reply(say('booked', lang, fmtWhen(d.date, d.time)), { q: kb.quick(lang) })],
          booking: null, booked: out.appt.id
        };
      }
      if (/\b(change|edit|redo|wrong|no|baguhin|palitan|ulitin|mali|hindi)\b/i.test(t)) return { replies: [reply(say('restart', lang))], booking: { step: 'name', data: {} } };
      return { replies: [reply(say('confirmAsk', lang), { q: pick(S.confirmQ, lang) })], booking: b };
    }
    default:
      return { replies: [reply(say('begin', lang))], booking: { step: 'name', data: {} } };
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
      body: JSON.stringify({ model, max_tokens: 500, system: kb.SYSTEM_PROMPT, messages: msgs })
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

  const lang = detect(history);
  const q = kb.quick(lang);

  if (env.booking && env.booking.step) return bookingFlow(env.booking, text, env, lang);

  if (kb.isHuman(text)) {
    return { replies: [reply(kb.say('human', lang), { q })], booking: null, needsHuman: true };
  }
  if (kb.isBooking(text)) {
    return {
      replies: [reply(say('start', lang))],
      booking: { step: 'name', data: {} }
    };
  }
  const ai = await llm(history);
  if (ai) return { replies: [reply(ai, { q })], booking: null };
  return { replies: [reply(kb.rule(text, lang), { q })], booking: null };
}

module.exports = { respond, parseDate, parseTime, fmtWhen, detect, llmEnabled: () => Boolean(process.env.ANTHROPIC_API_KEY) };
