'use strict';
/* Language detection for the chat: 'en' (English), 'tgl' (Taglish) or 'tl' (pure Tagalog). */

const TAG = new Set(('ako ikaw ka mo ko ang ng nang sa na ba po opo hindi hindi gusto gusto pwede puwede paano pano magkano ano saan kailan bakit naman lang din rin kung para yung yun mga kami tayo namin natin ninyo niyo nyo kayo salamat kumusta kamusta musta magandang umaga tanghali hapon gabi mag nag pag pa ito iyan yan iyon yon may wala meron marami sino tulong patulong negosyo benta bayad presyo oras bukas ngayon mahal mura sige oo di eh kasi pero at o sana talaga dito doon dun nila niya siya sila akin amin atin inyo aking iyong inyong ating aming gagawin gawin ginagawa kailangan kelangan pwedeng puwedeng ilan isang dalawa tatlo lahat bawat walang mayroon magpa mapa makapag makakuha makuha kumita kita puhunan paninda tindahan customer? bumili bili binili nagbebenta benta ibenta mas pinaka masyado medyo sobra tingin akala alam alamin sabihin sabi ipakita ipaliwanag paliwanag kontak kontakin alok inaalok serbisyo resulta kanselahin baguhin ulitin mali huwag wag').split(/\s+/).filter((w) => w && !w.endsWith('?')));
const EN = new Set(('the is are was were what how do does did you your can could would should will i my me we our us to for and of with in on at it this that these those a an be have has had not no yes please hi hello hey thanks thank want need looking help about tell show give know get make run work works working much many more best good better which who where when why if or but so just also any some from by as than then them they their there here out up there price cost pricing offer service services results result contact book appointment schedule call email phone number team founder founders tools tool awards award mission vision budget target audience campaign campaigns creative creatives video photos photo sales leads lead customers customer business store shop online page link website only still really very rate rates package packages').split(/\s+/).filter(Boolean));
/* words that look the same in both languages, ignored */
const NEUTRAL = new Set(['ads', 'ad', 'facebook', 'instagram', 'tiktok', 'google', 'shopee', 'meta', 'ig', 'fb', 'roas', 'cpm', 'ctr', 'cpc', 'ok', 'okay', 'hi', 'hello', 'prime', 'scale', 'canva', 'capcut']);

function score(text) {
  const words = String(text || '').toLowerCase().replace(/[^a-zñ'\-\s]/g, ' ').split(/[\s\-]+/).filter(Boolean);
  let tag = 0, en = 0, loan = 0;
  for (const w of words) {
    if (NEUTRAL.has(w)) { loan++; continue; }
    if (TAG.has(w)) tag++;
    else if (EN.has(w)) en++;
    else if (/^(mag|nag|pag|ipa|makapag)[a-z]{4,}$/.test(w) && !/ing$/.test(w)) tag += 0.5;
    else if (/(han|hin)$/.test(w) && w.length > 5) tag += 0.25;
  }
  return { tag, en, loan };
}

/* an explicit request ("in English", "sa Tagalog", "Taglish please") wins */
function asked(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(taglish)\b/.test(t)) return 'tgl';
  if (/\b(speak|reply|answer|respond|write|talk|chat)\b.*\b(in )?(english|ingles)\b|\b(in )?english (please|po|lang|na lang)\b|\benglish\b.*\b(please|po)\b|\bsa english\b|\bgamit ang english\b/.test(t)) return 'en';
  if (/\b(speak|reply|answer|respond|write|talk|chat)\b.*\b(in )?(tagalog|filipino)\b|\bsa (tagalog|filipino)\b|\b(tagalog|filipino) (please|po|lang|na lang)\b|\bpure tagalog\b|\bmagtagalog\b|\btagalog na\b/.test(t)) return 'tl';
  return null;
}

/* the chat's own quick-reply buttons always count as the language they are written in */
const LABELS = {
  tl: ['Ano ang inaalok ninyo?', 'Ipakita ang mga resulta', 'Magpa-book ng appointment', 'Kontakin ang team', 'Oo, kumpirmahin', 'Baguhin ang detalye', 'Kanselahin'],
  tgl: ['Ano ang offer nyo?', 'Ipakita ang results', 'Mag-book ng appointment', 'Contact info nyo', 'Oo, confirm', 'Palitan ang details', 'Cancel na']
};
const BYLABEL = {};
Object.keys(LABELS).forEach((k) => LABELS[k].forEach((l) => { BYLABEL[l.toLowerCase()] = k; }));

function classify(text) {
  const exact = BYLABEL[String(text || '').trim().toLowerCase()];
  if (exact) return exact;
  const { tag, en, loan } = score(text);
  if (tag < 1 && en === 0) return null; /* names, numbers, emails: no signal */
  if (tag < 1) return 'en';
  if (en === 0) return tag >= 3 && loan === 0 ? 'tl' : 'tgl'; /* casual Tagalog with ad terms like "ads" or "Facebook" is how people really chat, so it gets Taglish */
  return 'tgl'; /* any English content word means the visitor is mixing, so reply in Taglish */
}

/* looks at the newest visitor messages first; ambiguous short ones inherit the earlier language */
function detect(history) {
  const mine = (history || []).filter((m) => m.r === 'visitor').slice(-6).reverse();
  for (const m of mine) { const a = asked(m.t); if (a) return a; }
  for (const m of mine) { const c = classify(m.t); if (c) return c; }
  return 'en';
}

const pick = (obj, lang) => (obj && (obj[lang] || obj.en)) || '';

module.exports = { detect, classify, asked, pick, TAG, EN };
