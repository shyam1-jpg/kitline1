'use strict';

/**
 * Small intent table. Add a new skill by pushing { name, match, reply }.
 * `match` receives the normalised inbound text; `reply` receives { text, name, from }.
 */
const INTENTS = [
  {
    name: 'hello',
    match: (text) => /^(hi|hello|hey|yo|howdy|good\s+(morning|afternoon|evening))[\s!.,]*$/i.test(text),
    reply: ({ name, botName }) =>
      `Hi ${name}! I'm ${botName}. Message me from your phone any time.\n\n` +
      `Try *help* to see what I can do so far.`,
  },
  {
    name: 'help',
    match: (text) => /^(help|menu|commands|\?|what can you do)[\s!.,]*$/i.test(text),
    reply: ({ botName }) =>
      `Here's what *${botName}* can do right now:\n\n` +
      `• *hello* — a greeting\n` +
      `• *help* — this list\n` +
      `• *ping* — check that I'm awake\n\n` +
      `That's the starter kit. New skills can be added in \`src/bot.js\` when we know the real use case.`,
  },
  {
    name: 'ping',
    match: (text) => /^(ping|pong|test)[\s!.,]*$/i.test(text),
    reply: () => 'Pong — I received your WhatsApp message.',
  },
];

function displayName(contactName) {
  const name = String(contactName || '').trim();
  return name || 'there';
}

function replyFor(text, context = {}) {
  const raw = String(text || '').trim();
  const name = displayName(context.name);
  const botName = context.botName || 'Kiteline Assistant';

  if (!raw) {
    return {
      intent: 'empty',
      text: `Hi ${name} — I got a blank message. Send *hello* or *help* to get started.`,
    };
  }

  const intent = INTENTS.find((item) => item.match(raw));
  if (intent) {
    return { intent: intent.name, text: intent.reply({ text: raw, name, botName, from: context.from }) };
  }

  return {
    intent: 'unknown',
    text:
      `Thanks ${name}, I heard: “${raw.slice(0, 160)}”\n\n` +
      `I don't have a skill for that yet. Send *help* for what I can do, or tell us what this bot should handle next.`,
  };
}

function replyForNonText(type, context = {}) {
  const name = displayName(context.name);
  const kind = type || 'that';
  return {
    intent: 'unsupported',
    text: `Hi ${name} — I can only read text messages for now (I got ${kind}). Send *hello* or *help*.`,
  };
}

module.exports = { INTENTS, replyFor, replyForNonText, displayName };
