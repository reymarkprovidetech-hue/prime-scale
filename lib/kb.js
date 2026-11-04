'use strict';
/* What the Prime Scale assistant knows. Edit this file to change what the chat says. */

const ads = require('./ads');
const { pick } = require('./lang');

const QUICKS = {
  en: ['What do you offer?', 'Show me results', 'Book an appointment', 'Contact the team'],
  tgl: ['Ano ang offer nyo?', 'Ipakita ang results', 'Mag-book ng appointment', 'Contact info nyo'],
  tl: ['Ano ang inaalok ninyo?', 'Ipakita ang mga resulta', 'Magpa-book ng appointment', 'Kontakin ang team']
};
const QUICK = QUICKS.en;
const quick = (lang) => QUICKS[lang] || QUICKS.en;

const FACTS = `
ABOUT PRIME SCALE
- Prime Scale (logo: "Prime Scale Ads", tagline "We scale brands. You grow.") is a social media ads agency founded by two social media ads specialists: Reymark Dulutan and D'Lanor Romanes.
- Platforms: Facebook and Instagram (Meta), TikTok, Shopee and other social platforms. Reymark also manages Google Ads.
- Services: campaign strategy and planning; campaign setup and audience targeting; creative coordination (ad creatives, copy, video edits); landing pages (built with Webcake); optimization and performance monitoring; analytics and detailed reporting.
- Most campaigns are click-to-message ads, so a "conversation" means a potential customer messaging the business.

FOUNDERS
- Reymark Dulutan: Ads Manager for Facebook, TikTok, Shopee and other platforms for over 2 years. Employee of the Month (Ads Manager, May 2026) at ProvideTech.
- D'Lanor Romanes: social media ads specialist, strong in Facebook advertising and digital marketing, multi-award-winning advertiser. Awards: The Peak Performer (Atomic Digital Deals, Dec 2024), Top Advertiser of the Month (June 2024), Revival Award, DAV - Boho Pioneer Luminary Award (Dec 2023), Mt. Kalatungan Award (TopYugo).

RESULTS (real Meta Ads Manager screenshots are in the Projects section)
- Athena's Car Trading: Facebook Ads managed from February to now. June was the best month: 18 cars sold on about PHP 18,000 in ad spend (roughly PHP 1,000 of ad spend per car sold).
- Lead generation (messaging conversations, cost per conversation): School enrolment 2,393 at PHP 6.70 (PHP 16,023.27 spent, Mar 1 - Jun 30, 2026); Hotel and resort 2,022 at PHP 5.95 (PHP 12,030.97, Jul 1 - Sep 19, 2026); Travel and tours 938 at PHP 3.94; Pet grooming 407 at PHP 7.42; Salon 391 at PHP 7.17; Medical supplies 297 at PHP 8.50; WiFi vendo machine 233 at PHP 5.02; Garden set 207 at PHP 5.69; Food (lomi) 185 at PHP 6.45; Salon and spa 181 at PHP 7.18; Logistics 131 at PHP 10.28.
- Sales campaigns: e-commerce 261 website purchases at PHP 114.83 each (PHP 29,971.34 spent).

TOOLS
Meta Ads Manager, Facebook, Instagram, TikTok, Shopee, Canva, CapCut, Webcake, ElevenLabs, ChatGPT, Claude, Gemini, Excel, Word, PowerPoint, Google Docs, Gmail, Google Photos, Zoom, Google Meet, Viber.

MISSION
To turn every advertising opportunity into a pathway for growth by combining strategic thinking, creative execution, and data-driven decisions that connect businesses with the right customers.

VISION
To become the growth partner behind businesses that dare to scale - where advertising goes beyond visibility, creating meaningful connections, measurable progress, and lasting business impact.

CONTACT
- Reymark Dulutan: reymarkbdulutan@gmail.com, +63 991 297 0369 (phone and WhatsApp), Facebook: facebook.com/reymark.dulutan
- D'Lanor Romanes: dlanorromanes15@gmail.com, 0949 329 5303 / +63 949 329 5303 (phone and WhatsApp), Facebook: facebook.com/dlanor.romanes.2024
- Instagram: @primescale.19 (instagram.com/primescale.19)

APPOINTMENTS
Visitors can book a call in this chat (say "book an appointment") or with the form at the bottom of the page. They choose a preferred date and time in Philippine Time (PHT). The team confirms by phone or email.

PRICING
Not published. It depends on the business, goals and ad budget, so it is discussed on a call.
`.trim();

const ADS_FACTS = Object.keys(ads.PLATFORMS).map((k) => k.toUpperCase() + ': ' + ads.PLATFORMS[k].en).concat(Object.keys(ads.TOPICS).map((k) => 'TOPIC ' + k.toUpperCase() + ': ' + ads.TOPICS[k].en)).join('\n');

const SYSTEM_PROMPT = `You are the Prime Scale Assistant, the website chat for Prime Scale, a social media ads agency.
Your jobs: explain what is on this website, answer questions about Prime Scale, answer general questions about advertising on Facebook, Instagram, TikTok, Google and Shopee, and help visitors set an appointment.

Language:
- Reply in the visitor's language. Three styles are supported: English, Taglish (natural Tagalog and English mixed, the way Filipinos chat) and pure Tagalog. Mirror the visitor: English in, English out; Taglish in, Taglish out; Tagalog in, Tagalog out. If the visitor asks for a language, use it. Keep brand names and ad terms (CTR, ROAS, Pixel, Ads Manager) in English.

Rules:
- Facts about Prime Scale (services, results, prices, contacts, awards, founders) come ONLY from the FACTS below. If something is not covered, say you don't have that detail and offer a call with the founders. Never invent numbers, clients, prices or promises.
- For general ads questions use the ADS KNOWLEDGE below and your own general knowledge of these platforms. Platform menus, features and rules change, so avoid exact fees, limits or dates and say that features can change when it matters. Do not promise results or guarantee outcomes.
- Be warm, clear and brief: usually 2 to 5 short sentences. Plain text only, no markdown, no bullet symbols.
- To book an appointment, tell the visitor to say "book an appointment" and you will take their details here. Do not collect booking details yourself.
- You are an AI assistant, not a human. If the visitor wants a person, say the team has been notified.
- Results are examples of past campaigns, not guarantees of future results.

FACTS:
${FACTS}

ADS KNOWLEDGE:
${ADS_FACTS}`;

const re = {
  human: /\b(human|real person|live agent|agent|representative|staff|team member|someone from|talk to (a |the )?(person|someone|owner|founder)|speak (to|with)|tao|totoong tao|makausap|kausapin|kausap)\b/i,
  booking: /\b(book|booking|appointment|schedule|reserve|meeting|consultation|consult|set (up )?(a )?(call|meet)|magpa-?book|mag-?book|magpa-?schedule|iskedyul|pa-?appointment)\b/i,
  greeting: /^(hi|hello|hey|yo|good (morning|afternoon|evening)|kumusta|kamusta|musta|hola|magandang (umaga|hapon|gabi|araw)|hi po|hello po)\b/i,
  thanks: /\b(thanks|thank you|salamat|ty|maraming salamat)\b/i,
  pricing: /\b(price|pricing|cost|rate|rates|fee|fees|how much|package|packages|magkano|budget|presyo|singil|bayad)\b/i,
  services: /\b(service|services|offer|what do you do|do you do|help (me|with)|manage|handle|ads management|run ads|facebook ads|tiktok|shopee|instagram ads|meta|inaalok|alok|serbisyo|ano ang (ginagawa|offer)|offer nyo|offer ninyo)\b/i,
  results: /\b(result|results|proof|portfolio|case study|cases|projects?|sales|sold|worked|success|performance|conversations?|clients?|resulta|patunay|halimbawa)\b/i,
  founders: /\b(who|founder|founders|reymark|dlanor|d'lanor|owner|owners|about|team|sino|sino kayo)\b/i,
  contact: /\b(contact|email|phone|number|call|whatsapp|facebook|instagram|ig|messenger|reach|kontak|kontakin|numero|tawagan|makontak)\b/i,
  tools: /\b(tool|tools|software|canva|capcut|webcake|platform|platforms|gamit|ginagamit)\b/i,
  awards: /\b(award|awards|recognition|certificate|certificates|achievement|achievements|parangal|gantimpala)\b/i,
  mv: /\b(mission|vision|values|purpose|misyon|bisyon|layunin ng)\b/i
};

const CONTACT_LINES = 'Reymark Dulutan: reymarkbdulutan@gmail.com, +63 991 297 0369 (phone and WhatsApp).\nD\'Lanor Romanes: dlanorromanes15@gmail.com, 0949 329 5303 (phone and WhatsApp).\nInstagram: @primescale.19.';

const A = {
  greeting: {
    en: 'Hi! I\'m the Prime Scale Assistant. I can explain our services and results, answer questions about Facebook, Instagram, TikTok, Google and Shopee ads, share contact details, or set up an appointment with the founders. You can chat in English, Taglish or Tagalog. What would you like to know?',
    tgl: 'Hi! Ako ang Prime Scale Assistant. Pwede kong i-explain ang services at results namin, sagutin ang tanong tungkol sa Facebook, Instagram, TikTok, Google at Shopee ads, ibigay ang contact details, o mag-set ng appointment sa founders. Ano ang gusto mong malaman?',
    tl: 'Kumusta! Ako ang Prime Scale Assistant. Maipapaliwanag ko ang aming mga serbisyo at resulta, masasagot ko ang mga tanong tungkol sa Facebook, Instagram, TikTok, Google at Shopee ads, maibibigay ko ang contact details, o makapagtatakda ako ng appointment sa mga founder. Ano ang nais mong malaman?'
  },
  services: {
    en: 'Prime Scale runs Facebook, Instagram, TikTok and Shopee ads, and Reymark also manages Google Ads. That covers strategy and planning, campaign setup and targeting, creative coordination, landing pages, ongoing optimization, and detailed reporting. Ask me how any of these platforms work, or about our results.',
    tgl: 'Nagpapatakbo ang Prime Scale ng Facebook, Instagram, TikTok at Shopee ads, at si Reymark ay nagma-manage rin ng Google Ads. Kasama rito ang strategy at planning, campaign setup at targeting, creative coordination, landing pages, tuloy-tuloy na optimization, at detalyadong reporting. Itanong mo kung paano gumagana ang alinman sa mga platform na ito, o ang results namin.',
    tl: 'Nagpapatakbo ang Prime Scale ng Facebook, Instagram, TikTok at Shopee ads, at si Reymark ay namamahala rin ng Google Ads. Saklaw nito ang estratehiya at pagpaplano, pag-set up ng campaign at pag-target, pag-aayos ng creative, landing page, tuloy-tuloy na pag-optimize, at detalyadong ulat. Itanong mo kung paano gumagana ang alinman sa mga platform na ito, o ang aming mga resulta.'
  },
  results: {
    en: 'Here are a few highlights: Athena\'s Car Trading sold 18 cars in one month on about ₱18,000 of ad spend. A school enrolment campaign brought in 2,393 conversations at ₱6.70 each, a hotel campaign 2,022 at ₱5.95, and a travel and tours campaign 938 at ₱3.94. The Results dashboard and Projects sections have the Ads Manager screenshots. These are past results, not guarantees.',
    tgl: 'Ito ang ilang highlights: ang Athena\'s Car Trading ay nakabenta ng 18 cars sa isang buwan sa halos ₱18,000 na ad spend. Ang school enrolment campaign ay nakakuha ng 2,393 conversations sa ₱6.70 bawat isa, ang hotel campaign ay 2,022 sa ₱5.95, at ang travel and tours campaign ay 938 sa ₱3.94. Nasa Results dashboard at Projects sections ang Ads Manager screenshots. Past results ito, hindi guarantee.',
    tl: 'Narito ang ilang tampok: ang Athena\'s Car Trading ay nakabenta ng 18 kotse sa loob ng isang buwan sa halos ₱18,000 na gastos sa ads. Ang campaign ng isang paaralan ay nakakuha ng 2,393 usapan sa ₱6.70 bawat isa, ang campaign ng hotel ay 2,022 sa ₱5.95, at ang campaign ng travel and tours ay 938 sa ₱3.94. Nasa seksyon ng Results dashboard at Projects ang mga screenshot mula sa Ads Manager. Mga nakaraang resulta ang mga ito, hindi garantiya.'
  },
  pricing: {
    en: 'We don\'t publish fixed packages. Pricing depends on your business, goals and ad budget, so it\'s best discussed on a short call with the founders. Want me to book one?',
    tgl: 'Wala kaming fixed packages na naka-publish. Depende ang presyo sa business, goals at ad budget mo, kaya mas okay na pag-usapan sa maikling call kasama ang founders. Gusto mo bang i-book kita?',
    tl: 'Wala kaming nakapaskil na takdang package. Nakadepende ang presyo sa iyong negosyo, layunin at budget sa ads, kaya mas mainam itong pag-usapan sa maikling tawag kasama ang mga founder. Gusto mo bang ipa-book kita?'
  },
  founders: {
    en: 'Prime Scale was founded by Reymark Dulutan (Ads Manager, over 2 years running Facebook, TikTok and Shopee ads) and D\'Lanor Romanes (social media ads specialist and multi-award-winning advertiser). Both handle campaigns hands-on.',
    tgl: 'Ang Prime Scale ay itinatag nina Reymark Dulutan (Ads Manager, mahigit 2 taon nang nagpapatakbo ng Facebook, TikTok at Shopee ads) at D\'Lanor Romanes (social media ads specialist at multi-award-winning advertiser). Pareho silang hands-on sa campaigns.',
    tl: 'Itinatag ang Prime Scale nina Reymark Dulutan (Ads Manager, mahigit 2 taon nang nagpapatakbo ng Facebook, TikTok at Shopee ads) at D\'Lanor Romanes (social media ads specialist at ilang ulit nang pinarangalan na advertiser). Pareho silang direktang humahawak ng mga campaign.'
  },
  contact: {
    en: CONTACT_LINES + '\nFacebook links are in the Contact Info section.',
    tgl: 'Ito ang contact details namin:\n' + CONTACT_LINES + '\nNasa Contact Info section ang Facebook links.',
    tl: 'Narito ang aming contact details:\n' + CONTACT_LINES + '\nNasa seksyon ng Contact Info ang mga link sa Facebook.'
  },
  tools: {
    en: 'We work with Meta Ads Manager, Canva, CapCut and Webcake (landing pages), plus AI assistants like ChatGPT, Claude and Gemini, and everyday tools like Excel, Google Docs, Zoom and Viber. The Tools We Use section shows them all.',
    tgl: 'Gamit namin ang Meta Ads Manager, Canva, CapCut at Webcake (para sa landing pages), pati AI assistants gaya ng ChatGPT, Claude at Gemini, at everyday tools tulad ng Excel, Google Docs, Zoom at Viber. Nasa Tools We Use section ang lahat.',
    tl: 'Ginagamit namin ang Meta Ads Manager, Canva, CapCut at Webcake (para sa landing page), pati mga AI assistant tulad ng ChatGPT, Claude at Gemini, at pang-araw-araw na kagamitan tulad ng Excel, Google Docs, Zoom at Viber. Makikita ang lahat sa seksyong Tools We Use.'
  },
  awards: {
    en: 'D\'Lanor has won The Peak Performer (Dec 2024), Top Advertiser of the Month (June 2024), the Revival Award, the DAV Boho Pioneer Luminary Award and the Mt. Kalatungan Award. Reymark was Employee of the Month (Ads Manager, May 2026). The certificates are in the Awards section.',
    tgl: 'Si D\'Lanor ay nanalo ng The Peak Performer (Dec 2024), Top Advertiser of the Month (June 2024), Revival Award, DAV Boho Pioneer Luminary Award at Mt. Kalatungan Award. Si Reymark naman ay naging Employee of the Month (Ads Manager, May 2026). Nasa Awards section ang mga certificate.',
    tl: 'Si D\'Lanor ay nagwagi ng The Peak Performer (Dis 2024), Top Advertiser of the Month (Hunyo 2024), Revival Award, DAV Boho Pioneer Luminary Award at Mt. Kalatungan Award. Si Reymark naman ay naging Employee of the Month (Ads Manager, Mayo 2026). Nasa seksyon ng Awards ang mga sertipiko.'
  },
  mv: {
    en: 'Our mission: to turn every advertising opportunity into a pathway for growth by combining strategic thinking, creative execution, and data-driven decisions that connect businesses with the right customers.\n\nOur vision: to become the growth partner behind businesses that dare to scale, where advertising goes beyond visibility to create meaningful connections, measurable progress, and lasting business impact.',
    tgl: 'Ang mission namin: gawing daan ng growth ang bawat advertising opportunity sa pamamagitan ng strategic thinking, creative execution, at data-driven decisions na nag-uugnay sa businesses at sa tamang customers.\n\nAng vision namin: maging growth partner ng mga business na handang mag-scale, kung saan ang advertising ay higit pa sa visibility at lumilikha ng meaningful connections, measurable progress, at pangmatagalang business impact.',
    tl: 'Ang aming misyon: gawing daan tungo sa paglago ang bawat pagkakataon sa advertising sa pamamagitan ng estratehikong pag-iisip, malikhaing pagsasagawa at mga desisyong batay sa datos na nag-uugnay sa mga negosyo at sa tamang mga customer.\n\nAng aming bisyon: maging katuwang sa paglago ng mga negosyong handang lumaki, kung saan ang advertising ay higit pa sa pagkakita, at lumilikha ng makabuluhang ugnayan, nasusukat na pag-unlad at pangmatagalang epekto sa negosyo.'
  },
  thanks: {
    en: 'You\'re welcome! Anything else I can help with?',
    tgl: 'Walang anuman! May iba ka pa bang gustong itanong?',
    tl: 'Walang anuman! May iba ka pa bang nais itanong?'
  },
  human: {
    en: 'Understood. I\'ve notified the Prime Scale team and someone will reply here as soon as they can. In the meantime I can still answer questions or book an appointment for you.',
    tgl: 'Sige, na-notify ko na ang Prime Scale team at may magre-reply dito as soon as possible. Habang naghihintay, pwede pa rin akong sumagot ng tanong o mag-book ng appointment para sa iyo.',
    tl: 'Sige, naipaalam ko na sa Prime Scale team at may sasagot dito sa lalong madaling panahon. Samantala, maaari pa rin akong sumagot ng tanong o magpa-book ng appointment para sa iyo.'
  },
  fallback: {
    en: 'I\'m not sure I have that detail. I can tell you about our services, results, tools and contact info, explain how Facebook, Instagram, TikTok, Google and Shopee ads work, or set up an appointment so the founders can answer directly.',
    tgl: 'Hindi ako sigurado kung meron akong detalye tungkol diyan. Pwede kong i-explain ang services, results, tools at contact info namin, kung paano gumagana ang Facebook, Instagram, TikTok, Google at Shopee ads, o mag-set ng appointment para ang founders na ang sumagot.',
    tl: 'Hindi ako sigurado kung mayroon akong detalye tungkol diyan. Maipapaliwanag ko ang aming serbisyo, resulta, kagamitan at contact info, kung paano gumagana ang Facebook, Instagram, TikTok, Google at Shopee ads, o makapagtatakda ako ng appointment upang ang mga founder na mismo ang sumagot.'
  }
};

function rule(text, lang) {
  const t = String(text || '').trim();
  const L = lang || 'en';
  const out = (k) => pick(A[k], L);
  const g = t.match(re.greeting);
  if (g && t.slice(g[0].length).replace(/[^a-z]/gi, '').length <= 8) return out('greeting'); /* a greeting plus a real question is answered as the question */
  if (re.mv.test(t)) return out('mv');
  const m = ads.match(t);
  if (m) return ads.answer(m, L);
  if (re.pricing.test(t)) return out('pricing');
  if (re.awards.test(t)) return out('awards');
  if (re.tools.test(t)) return out('tools');
  if (re.contact.test(t)) return out('contact');
  if (re.results.test(t)) return out('results');
  if (re.services.test(t)) return out('services');
  if (re.founders.test(t)) return out('founders');
  if (re.thanks.test(t)) return out('thanks');
  return out('fallback');
}

module.exports = {
  QUICK, quick, FACTS, SYSTEM_PROMPT, A, rule,
  say: (key, lang) => pick(A[key], lang),
  isHuman: (t) => re.human.test(t),
  isBooking: (t) => re.booking.test(t)
};
