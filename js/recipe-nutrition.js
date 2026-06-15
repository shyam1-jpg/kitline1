/* Kiteline — recipe ingredient nutrition + allergen analysis (per 100 g guide values) */
(function () {
  'use strict';

  const ALLERGENS = [
    'Celery', 'Cereals containing gluten', 'Crustaceans', 'Eggs', 'Fish', 'Lupin',
    'Milk', 'Molluscs', 'Mustard', 'Peanuts', 'Sesame', 'Soybeans',
    'Sulphur dioxide & sulphites', 'Tree nuts',
  ];

  /** Guide nutrition per 100 g + default allergens when name matches */
  const FOOD_DB = [
    { keys: ['beef mince', 'mince', 'beef'], per100g: { kcal: 250, protein: 26, carbs: 0, fat: 17, fibre: 0, salt: 0.15 }, allergens: [] },
    { keys: ['onion', 'garlic'], per100g: { kcal: 40, protein: 1.1, carbs: 9, fat: 0.1, fibre: 1.7, salt: 0.01 }, allergens: [] },
    { keys: ['tomato', 'chopped tomatoes', 'tomato purée', 'tomato puree'], per100g: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fibre: 1.2, salt: 0.02 }, allergens: [] },
    { keys: ['lasagne sheet', 'lasagne', 'pasta', 'spaghetti', 'flour', 'plain flour', 'self-raising', 'breadcrumb', 'bread', 'baguette', 'flatbread'], per100g: { kcal: 350, protein: 11, carbs: 70, fat: 1.5, fibre: 3, salt: 0.01 }, allergens: ['Cereals containing gluten'] },
    { keys: ['butter'], per100g: { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, fibre: 0, salt: 0.02 }, allergens: ['Milk'] },
    { keys: ['milk', 'whole milk'], per100g: { kcal: 64, protein: 3.4, carbs: 4.7, fat: 3.6, fibre: 0, salt: 0.1 }, allergens: ['Milk'] },
    { keys: ['parmesan', 'cheese', 'mozzarella', 'feta', 'cream', 'double cream', 'béchamel'], per100g: { kcal: 350, protein: 22, carbs: 2, fat: 28, fibre: 0, salt: 1.2 }, allergens: ['Milk'] },
    { keys: ['egg', 'eggs'], per100g: { kcal: 155, protein: 13, carbs: 1.1, fat: 11, fibre: 0, salt: 0.35 }, allergens: ['Eggs'] },
    { keys: ['arborio', 'rice'], per100g: { kcal: 360, protein: 6.7, carbs: 79, fat: 0.6, fibre: 1, salt: 0.01 }, allergens: [] },
    { keys: ['mushroom', 'wild mushroom'], per100g: { kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fibre: 1, salt: 0.01 }, allergens: [] },
    { keys: ['wine', 'white wine'], per100g: { kcal: 82, protein: 0.1, carbs: 2.6, fat: 0, fibre: 0, salt: 0.01 }, allergens: ['Sulphur dioxide & sulphites'] },
    { keys: ['stock', 'vegetable stock', 'celery'], per100g: { kcal: 5, protein: 0.3, carbs: 0.8, fat: 0.1, fibre: 0.5, salt: 0.8 }, allergens: ['Celery'] },
    { keys: ['basil', 'parsley', 'herb', 'thyme', 'chive'], per100g: { kcal: 23, protein: 3, carbs: 2.7, fat: 0.6, fibre: 1.6, salt: 0.04 }, allergens: [] },
    { keys: ['date', 'dates'], per100g: { kcal: 282, protein: 2.5, carbs: 75, fat: 0.4, fibre: 8, salt: 0.02 }, allergens: [] },
    { keys: ['sugar', 'brown sugar'], per100g: { kcal: 400, protein: 0, carbs: 100, fat: 0, fibre: 0, salt: 0 }, allergens: [] },
    { keys: ['bicarbonate', 'baking powder'], per100g: { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, salt: 0.6 }, allergens: [] },
    { keys: ['chickpea', 'chickpeas'], per100g: { kcal: 164, protein: 8.9, carbs: 27, fat: 2.6, fibre: 7.6, salt: 0.01 }, allergens: [] },
    { keys: ['hummus'], per100g: { kcal: 166, protein: 8, carbs: 14, fat: 9.6, fibre: 6, salt: 0.7 }, allergens: ['Sesame'] },
    { keys: ['tahini', 'sesame'], per100g: { kcal: 595, protein: 17, carbs: 21, fat: 53, fibre: 9.3, salt: 0.05 }, allergens: ['Sesame'] },
    { keys: ['tofu', 'soy', 'tamari', 'soy sauce'], per100g: { kcal: 76, protein: 8, carbs: 1.9, fat: 4.8, fibre: 0.3, salt: 0.5 }, allergens: ['Soybeans'] },
    { keys: ['mayonnaise', 'mayo', 'vegan mayonnaise'], per100g: { kcal: 680, protein: 1, carbs: 3, fat: 75, fibre: 0, salt: 1 }, allergens: ['Eggs'] },
    { keys: ['grape', 'grapes'], per100g: { kcal: 69, protein: 0.7, carbs: 18, fat: 0.2, fibre: 0.9, salt: 0.01 }, allergens: [] },
    { keys: ['almond', 'almonds'], per100g: { kcal: 579, protein: 21, carbs: 22, fat: 49, fibre: 12.5, salt: 0.01 }, allergens: ['Tree nuts'] },
    { keys: ['mustard', 'dijon'], per100g: { kcal: 66, protein: 4.4, carbs: 5, fat: 3.7, fibre: 3.3, salt: 2.5 }, allergens: ['Mustard'] },
    { keys: ['vinegar'], per100g: { kcal: 18, protein: 0, carbs: 0.9, fat: 0, fibre: 0, salt: 0.01 }, allergens: ['Sulphur dioxide & sulphites'] },
    { keys: ['oil', 'olive oil', 'canola', 'rapeseed'], per100g: { kcal: 884, protein: 0, carbs: 0, fat: 100, fibre: 0, salt: 0 }, allergens: [] },
    { keys: ['salmon', 'fish', 'smoked salmon', 'sea bass', 'cod'], per100g: { kcal: 208, protein: 20, carbs: 0, fat: 13, fibre: 0, salt: 0.06 }, allergens: ['Fish'] },
    { keys: ['prawn', 'shrimp', 'scallop', 'crab'], per100g: { kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, fibre: 0, salt: 0.4 }, allergens: ['Crustaceans', 'Molluscs'] },
    { keys: ['peanut', 'peanuts'], per100g: { kcal: 567, protein: 26, carbs: 16, fat: 49, fibre: 8.5, salt: 0.01 }, allergens: ['Peanuts'] },
    { keys: ['walnut', 'cashew', 'hazelnut', 'tree nut', 'nuts'], per100g: { kcal: 654, protein: 15, carbs: 14, fat: 65, fibre: 6.7, salt: 0.01 }, allergens: ['Tree nuts'] },
    { keys: ['lupin'], per100g: { kcal: 371, protein: 36, carbs: 40, fat: 10, fibre: 18, salt: 0.02 }, allergens: ['Lupin'] },
    { keys: ['salt', 'pepper'], per100g: { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, salt: 38 }, allergens: [] },
    { keys: ['potato', 'potatoes'], per100g: { kcal: 77, protein: 2, carbs: 17, fat: 0.1, fibre: 2.2, salt: 0.01 }, allergens: [] },
    { keys: ['carrot'], per100g: { kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, fibre: 2.8, salt: 0.07 }, allergens: [] },
  ];

  const ALLERGEN_HINTS = [
    ['gluten', 'Cereals containing gluten'], ['wheat', 'Cereals containing gluten'], ['flour', 'Cereals containing gluten'],
    ['bread', 'Cereals containing gluten'], ['pasta', 'Cereals containing gluten'], ['lasagne', 'Cereals containing gluten'],
    ['milk', 'Milk'], ['cream', 'Milk'], ['cheese', 'Milk'], ['butter', 'Milk'], ['yoghurt', 'Milk'], ['yogurt', 'Milk'],
    ['egg', 'Eggs'], ['mayonnaise', 'Eggs'], ['mayo', 'Eggs'],
    ['fish', 'Fish'], ['salmon', 'Fish'], ['cod', 'Fish'], ['anchovy', 'Fish'],
    ['prawn', 'Crustaceans'], ['shrimp', 'Crustaceans'], ['crab', 'Crustaceans'], ['lobster', 'Crustaceans'],
    ['scallop', 'Molluscs'], ['mussel', 'Molluscs'], ['oyster', 'Molluscs'],
    ['soy', 'Soybeans'], ['tofu', 'Soybeans'], ['tamari', 'Soybeans'],
    ['sesame', 'Sesame'], ['tahini', 'Sesame'], ['hummus', 'Sesame'],
    ['peanut', 'Peanuts'], ['almond', 'Tree nuts'], ['walnut', 'Tree nuts'], ['cashew', 'Tree nuts'], ['hazelnut', 'Tree nuts'],
    ['mustard', 'Mustard'], ['celery', 'Celery'], ['lupin', 'Lupin'],
    ['wine', 'Sulphur dioxide & sulphites'], ['vinegar', 'Sulphur dioxide & sulphites'], ['stock cube', 'Sulphur dioxide & sulphites'],
  ];

  function parseFraction(s) {
    s = String(s).trim();
    if (s.includes('/')) {
      const [a, b] = s.split('/').map(Number);
      return b ? a / b : Number(a) || 0;
    }
    return parseFloat(s) || 0;
  }

  function parseQtyToGrams(qtyStr, unitHint) {
    if (!qtyStr || qtyStr === '—' || /^to taste$/i.test(qtyStr)) return 0;
    const s = String(qtyStr).trim().toLowerCase();
    if (unitHint === 'kg') return parseFraction(s) * 1000;
    if (unitHint === 'g') return parseFraction(s);
    if (unitHint === 'ml' || unitHint === 'l') {
      const n = parseFraction(s);
      return unitHint === 'l' ? n * 1000 : n;
    }
    const m = s.match(/^([\d./]+)\s*(kg|g|ml|l|cl|tsp|tbsp|oz|lb|cup|cups|each|pinch|bunch)?/i);
    if (!m) return 0;
    const n = parseFraction(m[1]);
    const u = (m[2] || unitHint || 'g').toLowerCase();
    if (u === 'kg') return n * 1000;
    if (u === 'g') return n;
    if (u === 'l') return n * 1000;
    if (u === 'ml' || u === 'cl') return n * (u === 'cl' ? 10 : 1);
    if (u === 'tsp') return n * 5;
    if (u === 'tbsp') return n * 15;
    if (u === 'cup' || u === 'cups') return n * 240;
    if (u === 'oz') return n * 28;
    if (u === 'lb') return n * 454;
    if (u === 'each') return n * 100;
    if (u === 'pinch') return n * 1;
    if (u === 'bunch') return n * 30;
    return n;
  }

  function lookupFood(name) {
    const n = (name || '').toLowerCase();
    let best = null;
    let bestLen = 0;
    FOOD_DB.forEach((row) => {
      row.keys.forEach((k) => {
        if (n.includes(k) && k.length > bestLen) { best = row; bestLen = k.length; }
      });
    });
    return best;
  }

  function detectAllergens(name, manual) {
    const set = new Set(manual || []);
    const n = (name || '').toLowerCase();
    ALLERGEN_HINTS.forEach(([hint, allergen]) => {
      if (n.includes(hint)) set.add(allergen);
    });
    const food = lookupFood(name);
    if (food && food.allergens) food.allergens.forEach((a) => set.add(a));
    return [...set].filter((a) => ALLERGENS.includes(a));
  }

  function scaleNut(per100g, grams) {
    if (!grams || !per100g) return { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, salt: 0 };
    const f = grams / 100;
    return {
      kcal: +(per100g.kcal * f).toFixed(1),
      protein: +(per100g.protein * f).toFixed(1),
      carbs: +(per100g.carbs * f).toFixed(1),
      fat: +(per100g.fat * f).toFixed(1),
      fibre: +(per100g.fibre * f).toFixed(1),
      salt: +(per100g.salt * f).toFixed(2),
    };
  }

  function addNut(a, b) {
    return {
      kcal: +(a.kcal + b.kcal).toFixed(1),
      protein: +(a.protein + b.protein).toFixed(1),
      carbs: +(a.carbs + b.carbs).toFixed(1),
      fat: +(a.fat + b.fat).toFixed(1),
      fibre: +(a.fibre + b.fibre).toFixed(1),
      salt: +(a.salt + b.salt).toFixed(2),
    };
  }

  function emptyNut() {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, salt: 0 };
  }

  function parseLegacyLine(line) {
    line = (line || '').trim();
    if (!line) return null;
    if (typeof line === 'object' && line.name) return line;
    if (line.includes('|')) {
      const p = line.split('|').map((s) => s.trim());
      const grams = parseQtyToGrams(p[1] || '');
      return { name: p[0], qty: p[1], unit: '', baseQty: p[1] || '—', notes: p[2] || p[1] || '—', grams, manualAllergens: [] };
    }
    const m = line.match(/^([\d./]+\s*(?:g|kg|ml|l|cl|tsp|tbsp|oz|lb|cup|cups|each|pinch|bunch|mm)?)\s+(.+)$/i)
      || line.match(/^([\d./]+)\s*(g|kg|ml|l|tsp|tbsp|oz|lb|each|cups?)\s+(.+)$/i);
    if (m) {
      const baseQty = m[3] ? `${m[1]} ${m[2]}`.trim() : m[1].trim();
      const name = (m[3] || m[2] || '').trim();
      return { name, qty: baseQty, unit: '', baseQty, notes: baseQty, grams: parseQtyToGrams(baseQty), manualAllergens: [] };
    }
    return { name: line, qty: '—', unit: '', baseQty: '—', notes: '—', grams: 100, manualAllergens: [] };
  }

  function normalizeItem(raw) {
    const base = typeof raw === 'string' ? parseLegacyLine(raw) : Object.assign({}, raw);
    if (!base || !base.name) return null;
    if (!base.grams && base.qty) base.grams = parseQtyToGrams(base.qty, base.unit);
    if (!base.baseQty) base.baseQty = base.qty ? `${base.qty}${base.unit ? ' ' + base.unit : ''}` : '—';
    const food = lookupFood(base.name);
    const per100g = food ? food.per100g : { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, salt: 0 };
    base.allergens = detectAllergens(base.name, base.manualAllergens || base.allergens || []);
    base.nutrition = scaleNut(per100g, base.grams || 0);
    base._estimated = !!food;
    return base;
  }

  function getItems(recipe) {
    if (recipe && Array.isArray(recipe.ingredientItems) && recipe.ingredientItems.length) {
      return recipe.ingredientItems.map(normalizeItem).filter(Boolean);
    }
    return (recipe && recipe.ingredients || []).map(parseLegacyLine).map(normalizeItem).filter(Boolean);
  }

  function mergeAllergens(items, recipeAllergens) {
    const set = new Set(recipeAllergens || []);
    items.forEach((it) => (it.allergens || []).forEach((a) => set.add(a)));
    return [...set].sort();
  }

  function analyzeRecipe(recipe, targetServings) {
    const base = recipe.servings || 1;
    const target = Math.max(1, Number(targetServings) || base);
    const factor = target / base;
    const items = getItems(recipe).map((it) => {
      const scaledGrams = (it.grams || 0) * factor;
      const food = lookupFood(it.name);
      const per100g = food ? food.per100g : emptyNut();
      return Object.assign({}, it, {
        scaledGrams,
        scaledQty: scaleQtyDisplay(it.baseQty, factor),
        nutrition: scaleNut(food ? food.per100g : emptyNut(), scaledGrams),
        allergens: it.allergens || [],
      });
    });
    let total = emptyNut();
    items.forEach((it) => { total = addNut(total, it.nutrition); });
    const perServing = {
      kcal: +(total.kcal / target).toFixed(1),
      protein: +(total.protein / target).toFixed(1),
      carbs: +(total.carbs / target).toFixed(1),
      fat: +(total.fat / target).toFixed(1),
      fibre: +(total.fibre / target).toFixed(1),
      salt: +(total.salt / target).toFixed(2),
    };
    return {
      items,
      total,
      perServing,
      servings: target,
      allergens: mergeAllergens(items, recipe.allergens),
    };
  }

  function scaleQtyDisplay(qty, factor) {
    if (!qty || qty === '—' || /^to taste$/i.test(qty)) return qty;
    const m = String(qty).match(/^([\d./]+)\s*(.*)$/i);
    if (!m) return qty;
    const n = Math.round(parseFraction(m[1]) * factor * 1000) / 1000;
    const shown = Number.isInteger(n) ? String(n) : String(+n.toFixed(2));
    return m[2] ? `${shown} ${m[2]}`.trim() : shown;
  }

  function formatNutLine(n) {
    return formatNutShort(n);
  }

  function formatNutShort(n) {
    if (!n || !n.kcal) return '—';
    return `${n.kcal} kcal`;
  }

  function formatNutPanel(total, perServing, servings) {
    if (!perServing || !perServing.kcal) return 'Add quantities to calculate kcal';
    return `${perServing.kcal} kcal per portion · ${total.kcal} kcal total (${servings} portions)`;
  }

  const ALLERGEN_ICON = {
    'Celery': { abbr: 'Ce', cls: 'al-icon--celery' },
    'Cereals containing gluten': { abbr: 'G', cls: 'al-icon--gluten' },
    'Crustaceans': { abbr: 'Cr', cls: 'al-icon--crust' },
    'Eggs': { abbr: 'E', cls: 'al-icon--eggs' },
    'Fish': { abbr: 'Fi', cls: 'al-icon--fish' },
    'Lupin': { abbr: 'Lu', cls: 'al-icon--lupin' },
    'Milk': { abbr: 'D', cls: 'al-icon--dairy' },
    'Molluscs': { abbr: 'Mo', cls: 'al-icon--moll' },
    'Mustard': { abbr: 'Mu', cls: 'al-icon--mustard' },
    'Peanuts': { abbr: 'P', cls: 'al-icon--peanut' },
    'Sesame': { abbr: 'Se', cls: 'al-icon--sesame' },
    'Soybeans': { abbr: 'So', cls: 'al-icon--soy' },
    'Sulphur dioxide & sulphites': { abbr: 'Su', cls: 'al-icon--sulph' },
    'Tree nuts': { abbr: 'N', cls: 'al-icon--nuts' },
  };

  const ANIMAL_HINTS = /\b(beef|chicken|pork|lamb|mince|bacon|ham|salmon|cod|prawn|shrimp|crab|scallop|honey|gelatin|anchovy|turkey|duck|sausage|prosciutto)\b/i;
  const DAIRY_HINTS = /\b(milk|cream|cheese|butter|yoghurt|yogurt|parmesan|mozzarella|feta|béchamel|bechamel|whey|ghee)\b/i;
  const LOW_SALT_PER100G = 0.12;
  const LOW_SALT_PER_PORTION = 0.3;

  function renderAllergenIcons(allergens, emptyHtml) {
    if (!allergens || !allergens.length) {
      return emptyHtml || '<span class="al-icon al-icon--none" title="No allergens">✓</span>';
    }
    return allergens.map((a) => {
      const ic = ALLERGEN_ICON[a] || { abbr: a.slice(0, 2), cls: 'al-icon--other' };
      return `<span class="al-icon ${ic.cls}" title="${a}">${ic.abbr}</span>`;
    }).join('');
  }

  function allergenShortCodes(allergens) {
    if (!allergens || !allergens.length) return 'None';
    return allergens.map((a) => (ALLERGEN_ICON[a] || { abbr: a.slice(0, 2) }).abbr).join(', ');
  }

  function deriveDietaryFlags(recipe, analysis) {
    const allergens = analysis.allergens || [];
    const items = analysis.items || [];
    const names = items.map((it) => (it.name || '').toLowerCase()).join(' ');
    const hasGluten = allergens.includes('Cereals containing gluten');
    const hasDairy = allergens.includes('Milk') || DAIRY_HINTS.test(names);
    const hasAnimal = allergens.some((a) => ['Milk', 'Eggs', 'Fish', 'Crustaceans', 'Molluscs'].includes(a))
      || ANIMAL_HINTS.test(names);
    const hasItems = items.length > 0;
    const vegan = hasItems && !hasAnimal;
    const glutenFree = hasItems && !hasGluten;
    const dairy = hasDairy;
    const perPortionSalt = analysis.perServing ? analysis.perServing.salt : 0;
    const allKnownLowSalt = hasItems && items.every((it) => {
      const food = lookupFood(it.name);
      return food && food.per100g.salt <= LOW_SALT_PER100G;
    });
    const lowSalt = hasItems && (perPortionSalt <= LOW_SALT_PER_PORTION || allKnownLowSalt);
    return { vegan, glutenFree, dairy, lowSalt };
  }

  function renderDietaryBadges(flags) {
    if (!flags) return '';
    const pills = [];
    if (flags.vegan) pills.push('<span class="diet-flag diet-flag--vegan">Vegan</span>');
    if (flags.glutenFree) pills.push('<span class="diet-flag diet-flag--gf">Gluten free</span>');
    if (flags.dairy) pills.push('<span class="diet-flag diet-flag--dairy">Dairy</span>');
    if (flags.lowSalt) pills.push('<span class="diet-flag diet-flag--salt">Low salt</span>');
    return pills.join('');
  }

  function renderRecipeTopFlags(analysis, recipe) {
    if (!analysis) return '';
    const flags = deriveDietaryFlags(recipe, analysis);
    const diet = renderDietaryBadges(flags);
    const icons = renderAllergenIcons(analysis.allergens);
    const kcal = analysis.perServing && analysis.perServing.kcal
      ? `<span class="recipe-kcal-chip">${formatNutShort(analysis.perServing)} / portion</span>` : '';
    return `<div class="recipe-top-flags">${diet ? `<div class="recipe-top-flags__diet">${diet}</div>` : ''}<div class="recipe-top-flags__row">${icons}${kcal}</div></div>`;
  }

  function allergenTags(allergens, emptyLabel) {
    if (!allergens || !allergens.length) return emptyLabel || 'None';
    return allergens.join(', ');
  }

  function itemsToLegacyLines(items) {
    return items.map((it) => {
      if (it.notes && it.notes !== it.baseQty) return `${it.name} | ${it.baseQty} | ${it.notes}`;
      if (it.baseQty && it.baseQty !== '—') return `${it.baseQty} ${it.name}`.trim();
      const q = it.qty && it.unit ? `${it.qty} ${it.unit}` : (it.qty || it.baseQty || '');
      return q ? `${q} ${it.name}`.trim() : it.name;
    });
  }

  function serializeItemsFromForm(rows) {
    return rows.map((r) => ({
      name: r.name.trim(),
      qty: r.qty,
      unit: r.unit,
      baseQty: r.qty ? `${r.qty}${r.unit ? ' ' + r.unit : ''}`.trim() : '—',
      notes: r.notes || '',
      grams: parseQtyToGrams(r.qty, r.unit),
      manualAllergens: r.manualAllergens || [],
    })).filter((r) => r.name).map(normalizeItem);
  }

  window.RecipeNutrition = {
    ALLERGENS,
    ALLERGEN_ICON,
    getItems,
    analyzeRecipe,
    normalizeItem,
    parseLegacyLine,
    parseQtyToGrams,
    detectAllergens,
    formatNutLine,
    formatNutShort,
    formatNutPanel,
    allergenTags,
    allergenShortCodes,
    renderAllergenIcons,
    renderDietaryBadges,
    renderRecipeTopFlags,
    deriveDietaryFlags,
    itemsToLegacyLines,
    serializeItemsFromForm,
    scaleQtyDisplay,
    mergeAllergens,
  };
})();
