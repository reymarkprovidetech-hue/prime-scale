'use strict';
/* What the Prime Scale assistant knows. Edit this file to change what the chat says. */

const QUICK = ['What do you offer?', 'Show me results', 'Book an appointment', 'Contact the team'];

const FACTS = `
ABOUT PRIME SCALE
- Prime Scale (logo: "Prime Scale Ads", tagline "We scale brands. You grow.") is a social media ads agency founded by two social media ads specialists: Reymark Dulutan and D'Lanor Romanes.
- Platforms: Facebook and Instagram (Meta), TikTok, Shopee and other social platforms.
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

const SYSTEM_PROMPT = `You are the Prime Scale Assistant, the website chat for Prime Scale, a social media ads agency.
Your jobs: explain what is on this website, answer questions about Prime Scale, and help visitors set an appointment.

Rules:
- Use ONLY the facts below. If something is not covered (for example prices, guarantees, availability), say you don't have that and offer to book a call with the founders. Never invent numbers, clients, prices or promises.
- Be warm, clear and brief: usually 1 to 4 short sentences. Plain text only, no markdown, no bullet symbols.
- Reply in the visitor's language (English, Filipino or Taglish).
- To book an appointment, tell the visitor to say "book an appointment" and you will take their details here. Do not collect booking details yourself.
- You are an AI assistant, not a human. If the visitor wants a person, say the team has been notified.
- Results are examples of past campaigns, not guarantees of future results.

FACTS:
${FACTS}`;

const re = {
  human: /\b(human|real person|live agent|agent|representative|staff|team member|someone from|talk to (a |the )?(person|someone|owner|founder)|speak (to|with)|tao)\b/i,
  booking: /\b(book|booking|appointment|schedule|reserve|meeting|consultation|consult|set (up )?(a )?(call|meet)|magpa-?book)\b/i,
  greeting: /^(hi|hello|hey|yo|good (morning|afternoon|evening)|kumusta|musta|hola)\b/i,
  thanks: /\b(thanks|thank you|salamat|ty)\b/i,
  pricing: /\b(price|pricing|cost|rate|rates|fee|fees|how much|package|packages|magkano|budget)\b/i,
  services: /\b(service|services|offer|what do you do|do you do|help (me|with)|manage|handle|ads management|run ads|facebook ads|tiktok|shopee|instagram ads|meta)\b/i,
  results: /\b(result|results|proof|portfolio|case study|cases|projects?|sales|sold|worked|success|performance|conversations?|clients?)\b/i,
  founders: /\b(who|founder|founders|reymark|dlanor|d'lanor|owner|owners|about|team)\b/i,
  contact: /\b(contact|email|phone|number|call|whatsapp|facebook|instagram|ig|messenger|reach)\b/i,
  tools: /\b(tool|tools|software|canva|capcut|webcake|platform|platforms)\b/i,
  awards: /\b(award|awards|recognition|certificate|certificates|achievement|achievements)\b/i,
  mv: /\b(mission|vision|values|purpose)\b/i
};

const A = {
  greeting: 'Hi! I\'m the Prime Scale Assistant. I can explain our services and results, share contact details, or set up an appointment with the founders. What would you like to know?',
  services: 'Prime Scale runs Facebook, Instagram, TikTok and Shopee ads. That covers strategy and planning, campaign setup and targeting, creative coordination, landing pages, ongoing optimization, and detailed reporting.',
  results: 'Here are a few highlights: Athena\'s Car Trading sold 18 cars in one month on about ₱18,000 of ad spend. A school enrolment campaign brought in 2,393 conversations at ₱6.70 each, a hotel campaign 2,022 at ₱5.95, and a travel and tours campaign 938 at ₱3.94. The Projects section has the Ads Manager screenshots. These are past results, not guarantees.',
  pricing: 'We don\'t publish fixed packages. Pricing depends on your business, goals and ad budget, so it\'s best discussed on a short call with the founders. Want me to book one?',
  founders: 'Prime Scale was founded by Reymark Dulutan (Ads Manager, over 2 years running Facebook, TikTok and Shopee ads) and D\'Lanor Romanes (social media ads specialist and multi-award-winning advertiser). Both handle campaigns hands-on.',
  contact: 'Reymark Dulutan: reymarkbdulutan@gmail.com, +63 991 297 0369 (phone and WhatsApp).\nD\'Lanor Romanes: dlanorromanes15@gmail.com, 0949 329 5303 (phone and WhatsApp).\nInstagram: @primescale.19. Facebook links are in the Contact Info section.',
  tools: 'We work with Meta Ads Manager, Canva, CapCut and Webcake (landing pages), plus AI assistants like ChatGPT, Claude and Gemini, and everyday tools like Excel, Google Docs, Zoom and Viber. The Tools We Use section shows them all.',
  awards: 'D\'Lanor has won The Peak Performer (Dec 2024), Top Advertiser of the Month (June 2024), the Revival Award, the DAV Boho Pioneer Luminary Award and the Mt. Kalatungan Award. Reymark was Employee of the Month (Ads Manager, May 2026). The certificates are in the Awards section.',
  mv: 'Our mission: to turn every advertising opportunity into a pathway for growth by combining strategic thinking, creative execution, and data-driven decisions that connect businesses with the right customers.\n\nOur vision: to become the growth partner behind businesses that dare to scale, where advertising goes beyond visibility to create meaningful connections, measurable progress, and lasting business impact.',
  thanks: 'You\'re welcome! Anything else I can help with?',
  human: 'Understood. I\'ve notified the Prime Scale team and someone will reply here as soon as they can. In the meantime I can still answer questions or book an appointment for you.',
  fallback: 'I\'m not sure I have that detail. I can tell you about our services, results, tools and contact info, or set up an appointment so the founders can answer directly.'
};

function rule(text) {
  const t = String(text || '').trim();
  if (t.length < 28 && re.greeting.test(t)) return A.greeting;
  if (re.mv.test(t)) return A.mv;
  if (re.pricing.test(t)) return A.pricing;
  if (re.awards.test(t)) return A.awards;
  if (re.tools.test(t)) return A.tools;
  if (re.contact.test(t)) return A.contact;
  if (re.results.test(t)) return A.results;
  if (re.services.test(t)) return A.services;
  if (re.founders.test(t)) return A.founders;
  if (re.thanks.test(t)) return A.thanks;
  return A.fallback;
}

module.exports = {
  QUICK, FACTS, SYSTEM_PROMPT, A, rule,
  isHuman: (t) => re.human.test(t),
  isBooking: (t) => re.booking.test(t)
};
