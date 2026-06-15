'use strict';
const fs = require('fs');
const path = require('path');

const sites = ['site_grove', 'site_dock', 'site_quay'];
const cats = ['Starter', 'Main', 'Dessert', 'Lunch', 'Side', 'Sauce', 'Breakfast'];

const NAMES = [
  'Classic Beef Lasagne','Wild Mushroom Risotto','Tomato & Basil Soup','Sticky Toffee Pudding','Falafel Wrap',
  'Chicken Tikka Masala','Beer-Battered Fish & Chips','Caesar Salad','Margherita Pizza','Beef Bourguignon',
  'Thai Green Curry','Greek Salad','Chocolate Brownies','Eggs Benedict','Shepherd\'s Pie',
  'Prawn Cocktail','Vegetable Stir Fry','Lamb Rogan Josh','Minestrone Soup','Tiramisu',
  'Full English Breakfast','BLT Sandwich','Beef Stroganoff','Pad Thai','Hummus & Warm Pita',
  'Apple Crumble','Chicken Korma','Smoked Salmon Bagel','Bangers & Mash','Quiche Lorraine',
  'Miso Soup','Gourmet Beef Burger','Vanilla Panna Cotta','Chicken Caesar Wrap','Red Lentil Dahl',
  'Scotch Egg','Pork Belly Bao Buns','Eton Mess','Chicken Noodle Soup','Spaghetti Carbonara',
  'Veggie Bean Burger','Crème Brûlée','Classic Fish Pie','Shakshuka','Onion Bhaji',
  'Pork & Apple Sausages','Caprese Salad','Lemon Posset','Chicken Satay Skewers','Cottage Pie',
  'Teriyaki Salmon Bowl','Chocolate Profiteroles','Ham & Cheese Toastie','Seafood Paella','Banana Bread',
  'Chicken & Leek Pie','Tofu Buddha Bowl','Bread & Butter Pudding','Jerk Chicken Thighs','Chilled Gazpacho',
  'Sticky Soy Chicken Wings','Roast Chicken & Gravy','Dark Chocolate Mousse','Beef Tacos','Lentil & Carrot Soup',
  'Victoria Sponge Cake','Pork Chops with Apple','Kimchi Fried Rice','Honey Baklava','Chicken Fajitas',
  'Waldorf Salad','New York Cheesecake','Braised Lamb Shank','Tonkotsu-Style Ramen','Seasonal Fruit Salad',
  'Steak Frites','Greek Moussaka','American Pancake Stack','Crab Cakes with Lime','Burrito Bowl',
  'Lemon Drizzle Cake','Confit Duck Leg','Classic Coleslaw','Mac & Cheese','Scones with Jam & Cream',
  'Pan-Seared Sea Bass','Pho-Style Beef Broth','Traditional Trifle','Chicken Shawarma Plate','Ratatouille',
  'Yorkshire Puddings','Lobster Roll','Falafel Salad Bowl','Pork Ramen','Chocolate Chip Cookies',
  'Vietnamese Beef Pho','Grilled Halloumi Salad','Classic Apple Pie','Chicken Teriyaki Rice','Sunday Roast Vegetables',
  'Mushroom Wellington','Thai Beef Salad','Butternut Squash Soup','Chocolate Lava Cake','Club Sandwich',
  'Beef & Ale Pie','Coconut Prawn Curry','Eggs Florentine','Garlic Flatbread','Sticky Rice Mango',
  'Moroccan Lamb Tagine','Avocado Toast','Pea & Mint Soup','Banoffee Pie','Chicken Schnitzel',
  'Beetroot & Goat Cheese Salad','Pulled Pork Buns','Risotto Primavera','Affogato','Fish Tacos',
  'Spinach & Ricotta Cannelloni','Mushroom Soup','Pavlova','Chicken Laksa','Garlic Prawns',
  'Beef Brisket Sliders','Roasted Vegetable Tart','Chilli Con Carne','Banana Split','Smoked Haddock Chowder',
];

const ING = {
  Main: ['500 g main protein','1 onion, diced','2 garlic cloves','400 g chopped tomatoes','2 tbsp olive oil','500 ml stock','Salt & pepper'],
  Starter: ['300 g base ingredient','1 onion','2 tbsp olive oil','700 ml stock','Fresh herbs','Salt & pepper'],
  Dessert: ['200 g flour','150 g sugar','3 eggs','100 g butter','200 ml cream','1 tsp vanilla'],
  Lunch: ['4 bread wraps or rolls','300 g filling protein','100 g salad leaves','2 tbsp sauce','1 tomato','Salt & pepper'],
  Side: ['500 g vegetables','2 tbsp olive oil','1 garlic clove','Fresh herbs','Salt & pepper'],
  Sauce: ['50 g butter','50 g flour','500 ml milk or stock','Salt & pepper','Fresh herbs'],
  Breakfast: ['4 eggs','4 slices bread','200 g protein','1 tomato','100 g mushrooms','Salt & pepper'],
};

const METHOD = {
  Main: ['Prep ingredients and heat oil in a heavy pan.','Cook base aromatics until soft, then add protein and brown well.','Add tomatoes and stock; simmer until tender and sauce thickens.','Check seasoning, rest briefly and serve hot with sides.'],
  Starter: ['Soften onion in oil without colouring.','Add main ingredient and stock; simmer until tender.','Blend or serve as required; finish with herbs.','Season and serve immediately.'],
  Dessert: ['Cream butter and sugar, beat in eggs.','Fold dry ingredients gently until combined.','Bake or chill according to recipe until set.','Serve with sauce or cream.'],
  Lunch: ['Cook filling protein and warm bread.','Layer salad, protein and sauce on bread or wrap.','Roll or assemble and cut in half.','Serve immediately.'],
  Side: ['Prep vegetables to even size.','Toss with oil, garlic and seasoning.','Roast or sauté until tender and golden.','Finish with herbs and serve.'],
  Sauce: ['Melt butter, stir in flour to make a roux.','Whisk in liquid gradually until smooth.','Simmer until thickened; season well.','Keep warm until needed.'],
  Breakfast: ['Cook protein and mushrooms in a pan.','Toast bread and poach or fry eggs.','Warm plates and assemble components.','Serve immediately with seasoning.'],
};

const ALLERGEN_MAP = {
  dairy: ['Milk'], gluten: ['Cereals containing gluten'], egg: ['Eggs'], fish: ['Fish'],
  crust: ['Crustaceans'], nut: ['Tree nuts'], sesame: ['Sesame'], soy: ['Soybeans'],
  celery: ['Celery'], mustard: ['Mustard'], sulph: ['Sulphur dioxide & sulphites'],
};

function pickAllergens(name, cat) {
  const n = name.toLowerCase();
  const a = new Set();
  if (/lasagne|pasta|spaghetti|pizza|bread|burger|wrap|toast|sandwich|pie|cake|scone|pancake|muffin|wellington|carbonara|mac|flatbread|bao|taco|burrito|cookie|brownie|sponge|crumble|pudding|quiche|fish and chips|fish pie|schnitzel|club|bagel|moussaka|cannelloni|yorkshire|profiteroles|baklava|trifle|banoffee|pavlova|affogato|ramen|pho|noodle|dumpling|spring roll|crouton|muffin|benedict|florentine|sticky toffee|banana bread|lemon drizzle|chocolate chip|bread & butter|victoria|eton mess|cheesecake|crème|creme br|panna cotta|tiramisu|lava cake|banana split|apple pie|lemon posset|chocolate mousse|profiteroles|scones/i.test(n)) a.add('Cereals containing gluten');
  if (/cheese|cream|milk|butter|parmesan|mozzarella|feta|halloumi|ricotta|béchamel|bechamel|mac & cheese|panna cotta|cheesecake|quiche|carbonara|risotto|stroganoff|korma|lasagne|fish pie|bread & butter|scones|affogato|crème|creme br|sticky toffee|banoffee|eton mess|profiteroles|mousse|hollandaise|benedict|florentine|panna|mac |gratin|beurre|moussaka|cannelloni|tagine sauce|satay peanut/i.test(n) || /cheese|cream|milk|butter|yoghurt/i.test(n)) a.add('Milk');
  if (/egg|benedict|florentine|quiche|carbonara|carbonara|scotch|mayo|caesar|brownie|sponge|pancake|tiramisu|crème|creme br|wellington|fish pie|schnitzel|club|carbonara|sticky toffee|bread & butter|profiteroles|cheesecake|banoffee|pavlova|omelette|full english|shakshuka|carbonara|carbonara|carbonara/i.test(n)) a.add('Eggs');
  if (/fish|salmon|haddock|cod|sea bass|tuna|smoked salmon|fish pie|fish and chips|crab|lobster|chowder|fish taco|sushi|ramen broth/i.test(n)) a.add('Fish');
  if (/prawn|shrimp|crab|lobster|paella|cocktail|garlic prawn|laksa|curry prawn/i.test(n)) a.add('Crustaceans');
  if (/scallop|mussel|oyster|paella/i.test(n)) a.add('Molluscs');
  if (/almond|walnut|cashew|hazelnut|baklava|satay|brownie/i.test(n)) a.add('Tree nuts');
  if (/sesame|hummus|tahini|shawarma|bao/i.test(n)) a.add('Sesame');
  if (/soy|tofu|miso|teriyaki|ramen|stir fry|pad thai|kimchi|laksa/i.test(n)) a.add('Soybeans');
  if (/celery|minestrone|stock|soup|chowder|bouillon/i.test(n) && /soup|minestrone|chowder|stock/i.test(n)) a.add('Celery');
  if (/mustard|caesar|benedict/i.test(n)) a.add('Mustard');
  if (/wine|bourguignon|tagine|gravy|stock cube|vinegar|tiramisu|affogato/i.test(n)) a.add('Sulphur dioxide & sulphites');
  if (/falafel|hummus|dahl|lentil|veggie|tofu|ratatouille|gazpacho|salad bowl|buddha|avocado toast|kimchi fried rice|vegetable/i.test(n) && !a.has('Cereals containing gluten') && !a.has('Milk') && !a.has('Eggs') && !a.has('Fish')) { /* often vegan-ish */ }
  return [...a];
}

function categoryFromName(name) {
  const n = name.toLowerCase();
  if (/breakfast|benedict|florentine|english|pancake|shakshuka|avocado toast/i.test(n)) return 'Breakfast';
  if (/sandwich|wrap|toastie|bagel|blt|club|bao bun|taco|burrito|lobster roll|slider|fajita|shawarma/i.test(n)) return 'Lunch';
  if (/soup|salad|cocktail|bhaji|gazpacho|hummus|miso soup|bruschetta|flatbread|coleslaw|fruit salad|halloumi salad|waldorf|caprese|greek salad|caesar|ratatouille|yorkshire|roast vegetables|toast(?!ie)/i.test(n)) return /coleslaw|yorkshire|ratatouille|roast vegetables|fruit salad/i.test(n) ? 'Side' : (/flatbread/i.test(n) ? 'Side' : 'Starter');
  if (/cake|pie|pudding|brownie|cheesecake|crumble|mousse|tiramisu|panna cotta|brûlée|brulee|posset|profiteroles|scones|cookies|baklava|trifle|eton mess|banoffee|pavlova|affogato|banana split|drizzle|sponge|banana bread|sticky toffee|bread & butter|lava cake|sticky rice mango|banana split/i.test(n)) return 'Dessert';
  if (/gravy|hollandaise/i.test(n) && !/roast chicken/i.test(n)) return 'Sauce';
  return 'Main';
}

const DETAILED = {
  'Classic Beef Lasagne': { category:'Main', site:'site_grove', servings:8, prepMins:40, cookMins:60, cost:14.5, price:12.95, sold:86,
    allergens:['Cereals containing gluten','Milk','Eggs'],
    ingredients:['500 g beef mince','1 onion, finely diced','2 garlic cloves, crushed','800 g chopped tomatoes','2 tbsp tomato purée','250 g lasagne sheets','50 g butter','50 g plain flour','500 ml milk','100 g parmesan, grated'],
    method:['Brown the mince, then add onion and garlic until soft.','Stir in tomatoes and purée; simmer 30 minutes.','Make a roux with butter and flour, whisk in milk to a smooth béchamel.','Layer ragù, pasta sheets and béchamel, repeating to fill the dish.','Top with parmesan and bake at 180°C for 40 minutes until golden.'],
    proMethod:['Weigh all components; ragù and béchamel can be prepped day ahead (chill below 5°C).','Brown mince in batches for colour; drain excess fat before adding tomatoes.','Simmer ragù 30 min minimum until thick — sauce should coat the back of a spoon.','Béchamel: whisk constantly; pass through sieve if lumpy. Season with nutmeg.','Layer in GN tray: ragù → pasta → béchamel × 3. Top with parmesan.','Bake 180°C fan until core reaches 75°C and top is golden (~40 min).','Portion with hot hold above 63°C; cool surplus within 90 min for refrigeration.'] },
  'Wild Mushroom Risotto': { category:'Main', site:'site_grove', servings:4, prepMins:15, cookMins:30, cost:9, price:13.5, sold:54,
    allergens:['Milk','Sulphur dioxide & sulphites'],
    ingredients:['300 g arborio rice','400 g mixed wild mushrooms','1 onion, diced','150 ml white wine','1 L hot vegetable stock','40 g butter','50 g parmesan','Olive oil, salt & pepper'],
    method:['Sauté mushrooms in oil, set aside.','Soften onion, add rice and toast 1 minute.','Add wine and let it absorb.','Add stock a ladle at a time, stirring, until creamy (~18 min).','Fold through mushrooms, butter and parmesan; season and serve.'],
    proMethod:['Stock kept at simmer in bain-marie — cold stock stops the risotto.','Sauté mushrooms hard in batches; drain on cloth to avoid grey risotto.','Toast rice 1 min until edges translucent before wine.','Add stock one ladle at a time; stir continuously — all\'onda texture at ~18 min.','Mount with cold butter and parmesan off heat (mantecatura). Serve immediately on hot plates.'] },
  'Tomato & Basil Soup': { category:'Starter', site:'site_grove', servings:6, prepMins:10, cookMins:25, cost:5.5, price:6.5, sold:120,
    allergens:['Celery'],
    ingredients:['1 kg ripe tomatoes','1 onion','2 celery sticks','2 garlic cloves','700 ml vegetable stock','Handful fresh basil','Olive oil, salt & pepper'],
    method:['Soften onion, celery and garlic in oil.','Add tomatoes and stock; simmer 20 minutes.','Blend until smooth.','Stir through torn basil, season and serve.'],
    proMethod:['Wash and chop veg to uniform size for even cooking.','Sweat without colour — lid on, low heat 8 min.','Simmer 20 min; blend on high until silky, pass if required.','Basil added off heat only — retains colour and aroma.','Hold hot above 63°C or chill below 5°C within 90 min of cooking.'] },
  'Sticky Toffee Pudding': { category:'Dessert', site:'site_grove', servings:8, prepMins:20, cookMins:35, cost:7.2, price:7.25, sold:95,
    allergens:['Cereals containing gluten','Eggs','Milk'],
    ingredients:['200 g pitted dates','250 ml boiling water','1 tsp bicarbonate of soda','175 g self-raising flour','150 g brown sugar','2 eggs','75 g butter','300 ml double cream','100 g toffee sauce'],
    method:['Soak dates in boiling water with bicarb for 10 minutes.','Cream butter and sugar, beat in eggs.','Fold in flour and the date mixture.','Bake at 180°C for 30–35 minutes.','Serve warm with toffee sauce and cream.'],
    proMethod:['Dates must be fully softened — blend soaking liquid smooth before adding to batter.','Do not over-mix once flour is added; sponge should be light.','Bake 180°C until skewer clean (~30 min). Core above 75°C.','Rest 10 min before saucing. Warm toffee sauce separately.','Serve warm; hold covered max 30 min. Chill surplus below 5°C.'] },
  'Falafel Wrap': { category:'Lunch', site:'site_dock', servings:4, prepMins:20, cookMins:10, cost:4.8, price:8.95, sold:140,
    allergens:['Cereals containing gluten','Sesame','Soybeans'],
    ingredients:['400 g chickpeas','1 onion','2 garlic cloves','Handful parsley & coriander','1 tsp cumin','4 flatbreads','Hummus & pickles to serve','Oil for frying'],
    method:['Blitz chickpeas, onion, garlic, herbs and spices to a coarse paste.','Shape into balls and chill 15 minutes.','Shallow fry until golden and cooked through.','Spread flatbread with hummus, add falafel and pickles, wrap and serve.'],
    proMethod:['Use soaked dried chickpeas — tinned chickpeas make wet falafel.','Pulse to coarse crumb, not purée; test fry one ball for seasoning.','Chill shaped falafel 15 min minimum — improves structure.','Fry at 175°C until deep golden; drain on rack, not paper (stays crisp).','Build wrap to order; confirm sesame allergen on flatbread and hummus.'] },
  'Yorkshire Puddings': { category:'Side', site:'site_grove', servings:8, prepMins:10, cookMins:25, cost:2.8, price:4.95, sold:210,
    allergens:['Cereals containing gluten','Eggs','Milk'],
    ingredients:['140 g plain flour','4 eggs','200 ml milk','4 tbsp vegetable oil or beef dripping','Pinch of salt'],
    method:['Sift flour and salt into a bowl. Make a well, add eggs and half the milk; whisk until smooth.','Whisk in remaining milk to a pouring batter. Rest at least 30 minutes.','Heat oven to 220°C. Add 1 tbsp oil to each hole of a muffin or Yorkshire tin; heat in oven 10 minutes until smoking hot.','Pour batter quickly into the hot oil — fill each hole two-thirds full.','Bake 20–25 minutes without opening the door until risen, golden and crisp. Serve immediately.'],
    proMethod:['Weigh flour, eggs and milk separately — batter ratio controls rise.','Rest batter 30–120 minutes (refrigerated OK); bring to room temperature before baking.','Oven 220°C fan. Preheat oil in tin until smoking — 10 minutes minimum.','Fill each hole two-thirds full. Do not open the oven for the first 15 minutes.','Batch for service: hold in warm pass up to 20 minutes; re-crisp 2 minutes at 200°C if soft.'],
    stepByStep: true,
    steps: stepsFromMethod(['Sift flour and salt into a bowl. Make a well, add eggs and half the milk; whisk until smooth.','Whisk in remaining milk to a pouring batter. Rest at least 30 minutes.','Heat oven to 220°C. Add 1 tbsp oil to each hole of a muffin or Yorkshire tin; heat in oven 10 minutes until smoking hot.','Pour batter quickly into the hot oil — fill each hole two-thirds full.','Bake 20–25 minutes without opening the door until risen, golden and crisp. Serve immediately.']) },
};

function buildProMethod(name, cat, method, prepMins, cookMins, detail) {
  if (detail && detail.proMethod) return detail.proMethod;
  const n = name.toLowerCase();
  const lines = [`Mise en place complete in ${prepMins} min — scales, boards and allergen matrix checked.`];
  if (/chicken|turkey|poultry|sausage|pork|beef|lamb|mince|burger|pie|lasagne|shepherd|cottage|stroganoff|curry|tagine|schnitzel|brisket|chilli|fajita|shawarma|ramen|pho|satay|jerk|wings|roast chicken/i.test(n))
    lines.push('CCP: cook minced meat and poultry to 75°C core; log probe temperature on batch sheet.');
  if (/fish|salmon|haddock|cod|sea bass|tuna|smoked salmon|fish pie|fish and chips|crab|lobster|chowder|prawn|scallop|paella|laksa|tacos/i.test(n))
    lines.push('CCP: fish to 63°C core; shellfish until opaque throughout.');
  if (/soup|broth|stock|curry|sauce|ragù|gravy|risotto|dahl|stew|bourguignon/i.test(n))
    lines.push('Simmer to correct consistency; skim fat, adjust seasoning before service.');
  if (/bake|cake|pie|pudding|bread|scone|brownie|muffin|pizza|wellington|quiche|tart|cookie|crumble|cheesecake|pavlova|profiteroles|mousse|tiramisu|panna|brûlée|brulee|posset|sponge|drizzle|banoffee|baklava|trifle|eton|affogato|split|crème|creme|mac & cheese|flatbread|yorkshire/i.test(n))
    lines.push(`Oven preheated — cook phase ${cookMins} min; rotate trays if colour uneven.`);
  if (cat === 'Dessert' || /cream|custard|cheesecake|mousse|panna|trifle|eton/i.test(n))
    lines.push('Chill below 5°C until service; label with prep date if stored.');
  if (/salad|gazpacho|ceviche|cold/i.test(n) && cat !== 'Main')
    lines.push('Keep cold chain below 5°C; prep as close to service as possible.');
  method.forEach((step, i) => {
    if (/hold hot|63°c/i.test(step)) lines.push('Hot hold above 63°C in pass; discard after 2 hours if unused.');
    else if (/serve/i.test(step)) lines.push(step + ' — wipe plate rims, check garnish spec.');
    else lines.push(step);
  });
  lines.push('Final taste check before pass. Plate to standard; log batch reference if required.');
  return lines;
}

function svgProImage(name, category) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const hue = ((name || 'R').charCodeAt(0) * 7) % 360;
  const title = (name || 'Recipe').length > 34 ? (name || 'Recipe').slice(0, 32) + '…' : (name || 'Recipe');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="400" viewBox="0 0 700 400"><defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue},52%,40%)"/><stop offset="100%" stop-color="hsl(${(hue + 42) % 360},48%,24%)"/></linearGradient></defs><rect width="700" height="400" fill="url(#kg)"/><text x="28" y="48" fill="rgba(255,255,255,.75)" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="2">KITELINE</text><text x="28" y="300" fill="#ffffff" font-family="Georgia,serif" font-size="32" font-weight="700">${esc(title)}</text><text x="28" y="334" fill="#ccfbf1" font-family="Arial,sans-serif" font-size="15" font-weight="700">${esc(category || 'Recipe')}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function stepsFromMethod(method) {
  return (method || []).map((text) => ({ text, image: null, video: null }));
}

function mk(i, name) {
  const detail = DETAILED[name];
  const cat = detail ? detail.category : categoryFromName(name);
  const site = detail ? detail.site : sites[i % sites.length];
  const srv = detail ? detail.servings : (4 + (i % 5));
  const prep = detail ? detail.prepMins : (10 + (i % 25));
  const cook = detail ? detail.cookMins : (15 + (i % 40));
  const cost = detail ? detail.cost : +(4 + (i % 12) + (i % 7) * 0.5).toFixed(1);
  const price = detail ? detail.price : +(cost * (1.8 + (i % 5) * 0.1)).toFixed(2);
  const sold = detail ? detail.sold : (30 + (i * 7) % 170);
  const allergens = detail ? detail.allergens : pickAllergens(name, cat);
  const ingredients = detail ? detail.ingredients : ING[cat].map((x) => x.replace('main protein', name.split(' ').slice(-2).join(' ').toLowerCase()).replace('base ingredient', name.split(' ')[0].toLowerCase()).replace('filling protein', name.split(' ')[0].toLowerCase()));
  const method = detail ? detail.method : METHOD[cat].slice();
  const proMethod = buildProMethod(name, cat, method, prep, cook, detail);
  const proImage = svgProImage(name, cat);
  const stepByStep = !!(detail && detail.stepByStep);
  const steps = detail && detail.steps ? detail.steps : [];
  return {
    id: 'r' + (i + 1),
    name, category: cat, site, servings: srv, prepMins: prep, cookMins: cook,
    allergens, image: null, proImage, cost, price, sold,
    ingredients, method, proMethod, stepByStep, steps,
  };
}

const recipes = NAMES.slice(0, 100).map((name, i) => mk(i, name));
const out = `/* Kiteline — 100 demo recipes (auto-generated seed) */
(function () {
  'use strict';
  window.RecipeSeeds = ${JSON.stringify(recipes, null, 2)};
})();
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'recipe-seeds.js'), out, 'utf8');
console.log('Wrote', recipes.length, 'recipes to js/recipe-seeds.js');
