'use strict';

const OPENAI_KEY = (process.env.OPENAI_API_KEY || '').trim();
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const CHAT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';
const ENABLED = process.env.RECIPE_AI_ENABLED === 'true';

function configured() {
  return ENABLED && !!OPENAI_KEY;
}

function clientOpts(apiKey) {
  const key = (apiKey || OPENAI_KEY || '').trim();
  if (!key) throw new Error('No OpenAI API key');
  return { apiKey: key, base: OPENAI_BASE, chatModel: CHAT_MODEL, imageModel: IMAGE_MODEL };
}

async function openaiJson(messages, apiKey) {
  const c = clientOpts(apiKey);
  const res = await fetch(`${c.base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: c.chatModel,
      messages,
      temperature: 0.65,
      response_format: { type: 'json_object' },
    }),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || res.statusText || 'OpenAI request failed';
    throw new Error(msg);
  }
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error('Empty AI response');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('AI returned invalid JSON');
  }
}

function normalizeIngredient(item) {
  const name = String(item.name || item.ingredient || '').trim();
  if (!name) return null;
  let qty = String(item.qty || item.quantity || '').trim();
  let unit = String(item.unit || 'g').trim() || 'g';
  if (!qty && item.baseQty) {
    const m = String(item.baseQty).match(/^([\d./]+)\s*(\S+)?$/);
    if (m) { qty = m[1]; unit = m[2] || unit; }
  }
  return {
    name,
    qty: qty || '1',
    unit,
    notes: String(item.notes || item.note || '').trim(),
  };
}

function normalizeIngredients(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeIngredient).filter(Boolean);
}

const SYSTEM = `You are a professional chef and food-safety expert helping UK commercial kitchens write standardised recipe cards for Kiteline.
Use metric units (g, kg, ml, l, tsp, tbsp). Quantities must suit the requested servings.
Return valid JSON only — no markdown.`;

async function suggestIngredients(payload, apiKey) {
  const { name, category, servings, description } = payload;
  const dish = String(name || '').trim();
  if (!dish) throw new Error('Recipe name required');
  const data = await openaiJson([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Suggest ingredients for a professional kitchen recipe.
Name: ${dish}
Category: ${category || 'Main'}
Servings: ${Math.max(1, Number(servings) || 4)}
${description ? `Notes: ${description}` : ''}

Return JSON: {"ingredients":[{"name":"...","qty":"200","unit":"g","notes":""}]}`,
    },
  ], apiKey);
  return { ingredients: normalizeIngredients(data.ingredients) };
}

async function parseIngredients(payload, apiKey) {
  const { text, name, servings } = payload;
  const blob = String(text || '').trim();
  if (!blob) throw new Error('Paste ingredient text first');
  const data = await openaiJson([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Parse this ingredient list into structured lines for ${Math.max(1, Number(servings) || 4)} servings${name ? ` of "${name}"` : ''}.
Text: ${blob}

Return JSON: {"ingredients":[{"name":"...","qty":"...","unit":"g|kg|ml|l|tsp|tbsp|each|pinch","notes":""}]}`,
    },
  ], apiKey);
  return { ingredients: normalizeIngredients(data.ingredients) };
}

async function generateMethod(payload, apiKey) {
  const { name, category, servings, ingredients, description } = payload;
  const dish = String(name || '').trim();
  if (!dish) throw new Error('Recipe name required');
  const lines = (ingredients || []).map((i) => {
    const q = i.qty && i.unit ? `${i.qty} ${i.unit}` : (i.qty || i.baseQty || '');
    return q ? `${q} ${i.name}`.trim() : i.name;
  }).filter(Boolean);
  if (!lines.length) throw new Error('Add at least one ingredient first');
  const data = await openaiJson([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Write a complete professional recipe card.
Name: ${dish}
Category: ${category || 'Main'}
Servings: ${Math.max(1, Number(servings) || 4)}
${description ? `Notes: ${description}` : ''}
Ingredients:
${lines.map((l) => `- ${l}`).join('\n')}

Return JSON:
{
  "subtitle": "short tagline or empty string",
  "prepMins": number,
  "cookMins": number,
  "method": ["one clear step per line for line cooks"],
  "proMethod": ["chef-level steps with temps, holding, allergen cross-contact checks"],
  "chefNotes": "scaling, seasoning, service tips"
}`,
    },
  ], apiKey);
  return {
    subtitle: String(data.subtitle || '').trim(),
    prepMins: Math.max(0, Math.round(Number(data.prepMins) || 0)),
    cookMins: Math.max(0, Math.round(Number(data.cookMins) || 0)),
    method: Array.isArray(data.method) ? data.method.map((s) => String(s).trim()).filter(Boolean) : [],
    proMethod: Array.isArray(data.proMethod) ? data.proMethod.map((s) => String(s).trim()).filter(Boolean) : [],
    chefNotes: String(data.chefNotes || '').trim(),
  };
}

async function fetchImageAsDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download AI image');
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type') || 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function generateImage(payload, apiKey) {
  const { name, category, description } = payload;
  const c = clientOpts(apiKey);
  const dish = String(name || '').trim();
  if (!dish) throw new Error('Recipe name required');
  const prompt = `Professional food photography of "${dish}"${category ? ` (${category})` : ''}, plated beautifully for a high-end UK restaurant menu. Natural lighting, shallow depth of field, appetising, no text, no watermark, no people.${description ? ` Style: ${description}.` : ''}`;
  const res = await fetch(`${c.base}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: c.imageModel,
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    }),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || res.statusText || 'Image generation failed';
    throw new Error(msg);
  }
  const url = data.data && data.data[0] && data.data[0].url;
  if (!url) throw new Error('No image URL returned');
  const image = await fetchImageAsDataUrl(url);
  return { image };
}

module.exports = {
  configured,
  suggestIngredients,
  parseIngredients,
  generateMethod,
  generateImage,
};
