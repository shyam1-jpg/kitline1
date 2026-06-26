#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const OUT = path.join(DIR, 'curriculum.js');

function extractBlock(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('Missing: ' + marker);
  return source.slice(0, start);
}

function extractCourseLessons(source, courseKey) {
  const start = source.indexOf("'" + courseKey + "':");
  if (start < 0) return null;
  const ls = source.indexOf('lessons:', start);
  const open = source.indexOf('[', ls);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '[') depth++;
    else if (source[i] === ']') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

function fmt(id, title, mins, content, opts) {
  opts = opts || {};
  return (
    '        lesson(' +
    JSON.stringify(id) + ', ' +
    JSON.stringify(title) + ', ' +
    mins + ',\n          ' +
    JSON.stringify(content) + ',\n          ' +
    JSON.stringify(opts) + '),\n'
  );
}

function p(parts) {
  return parts.map(function (x) { return '<p>' + x + '</p>'; }).join('');
}

function htmlLessons() {
  const items = [
    { id: 'hs-1', title: 'What is a website?', mins: 8, body: p(['A website is a collection of pages stored on a server and viewed in a browser.', 'HTML provides structure, CSS styling, and JavaScript interactivity.']), tryIt: 'Open any website, right-click → View Page Source, and spot HTML tags.', objective: 'Explain what a website is and how HTML, CSS, and JavaScript work together.' },
    { id: 'hs-2', title: 'Your first HTML page', mins: 12, body: p(['Every HTML document needs <!DOCTYPE html>, <html>, <head>, and <body>.', 'The browser reads tags top to bottom and renders content.']), editor: { lang: 'html', starter: '<!DOCTYPE html>\n<html>\n<head>\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Hello Kiteline Academy</h1>\n  <p>My first web page.</p>\n</body>\n</html>' }, tryIt: 'Change the heading to your name and add a second paragraph.', objective: 'Build and preview a valid HTML document.' },
    { id: 'hs-3', title: 'Headings and paragraphs', mins: 10, body: p(['Use <h1>–<h6> for headings (one main h1 per page).', 'Wrap normal text in <p> paragraphs for readable blocks.']), editor: { lang: 'html', starter: '<h1>Main title</h1>\n<h2>Section</h2>\n<p>First paragraph.</p>\n<p>Second paragraph.</p>' }, exercise: 'Add an h3 subheading and two more paragraphs about a hobby.', objective: 'Use heading hierarchy and paragraphs correctly.' },
    { id: 'hs-4', title: 'Links and navigation', mins: 10, body: p(['Links use <a href="URL">text</a>.', 'Use relative paths for pages in your site and absolute URLs for external sites.', 'Add target="_blank" and rel="noopener" for new tabs safely.']), editor: { lang: 'html', starter: '<h1>My links</h1>\n<p><a href="https://developer.mozilla.org/en-US/docs/Web/HTML">MDN HTML docs</a></p>\n<p><a href="#about">Jump to about</a></p>\n<p id="about">About section</p>' }, objective: 'Create internal and external hyperlinks.' },
    { id: 'hs-5', title: 'Images', mins: 10, body: p(['<img src="photo.jpg" alt="Description"> displays images.', 'Always include meaningful alt text for accessibility and SEO.']), editor: { lang: 'html', starter: '<h1>Gallery</h1>\n<img src="https://via.placeholder.com/200" alt="Placeholder image" width="200">\n<p>Images need alt text.</p>' }, objective: 'Embed images with alt attributes.' },
    { id: 'hs-6', title: 'Lists', mins: 10, body: p(['<ul> unordered lists use bullet points.', '<ol> ordered lists use numbers.', '<li> marks each list item.']), editor: { lang: 'html', starter: '<h2>Shopping list</h2>\n<ul>\n  <li>Milk</li>\n  <li>Bread</li>\n</ul>\n<h2>Steps</h2>\n<ol>\n  <li>Open editor</li>\n  <li>Write HTML</li>\n  <li>Run preview</li>\n</ol>' }, objective: 'Build ordered and unordered lists.' },
    { id: 'hs-7', title: 'Tables', mins: 12, body: p(['Tables use <table>, <tr> rows, <th> headers, and <td> cells.', 'Use tables for tabular data, not page layout.']), editor: { lang: 'html', starter: '<table border="1">\n  <tr><th>Name</th><th>Score</th></tr>\n  <tr><td>Alex</td><td>92</td></tr>\n  <tr><td>Sam</td><td>88</td></tr>\n</table>' }, objective: 'Create a simple data table.' },
    { id: 'hs-8', title: 'Forms basics', mins: 12, body: p(['<form> wraps inputs that collect user data.', 'Common inputs: text, email, password, checkbox, radio, submit.']), editor: { lang: 'html', starter: '<form>\n  <label>Name: <input type="text" name="name"></label><br>\n  <label>Email: <input type="email" name="email"></label><br>\n  <button type="submit">Send</button>\n</form>' }, objective: 'Build a basic HTML form.' },
    { id: 'hs-9', title: 'Input types', mins: 10, body: p(['HTML5 adds date, number, color, range, and more.', 'Choose the input type that matches the data you need.']), editor: { lang: 'html', starter: '<label>Age: <input type="number" min="1" max="120"></label><br>\n<label>Birthday: <input type="date"></label><br>\n<label>Colour: <input type="color"></label>' }, objective: 'Use appropriate HTML input types.' },
    { id: 'hs-10', title: 'Semantic HTML', mins: 12, body: p(['Semantic tags describe meaning: <header>, <nav>, <main>, <article>, <section>, <footer>.', 'They help screen readers and search engines understand your page.']), editor: { lang: 'html', starter: '<header><h1>Site title</h1></header>\n<nav><a href="#">Home</a></nav>\n<main>\n  <article><h2>Post</h2><p>Content here.</p></article>\n</main>\n<footer><p>© 2026</p></footer>' }, objective: 'Structure pages with semantic elements.' },
    { id: 'hs-11', title: 'div and span', mins: 8, body: p(['<div> is a block container with no default meaning.', '<span> is an inline container for small text chunks.']), editor: { lang: 'html', starter: '<div style="border:1px solid #ccc;padding:8px">\n  <p>Block in a <span style="color:blue">coloured span</span>.</p>\n</div>' }, objective: 'Group content with div and span.' },
    { id: 'hs-12', title: 'Attributes', mins: 10, body: p(['Attributes add extra info: id, class, href, src, alt, title.', 'id must be unique; class can repeat on many elements.']), editor: { lang: 'html', starter: '<p id="intro" class="highlight" title="Tooltip">Hover me</p>\n<p class="highlight">Same class</p>' }, objective: 'Apply id, class, and common attributes.' },
    { id: 'hs-13', title: 'Comments and code hygiene', mins: 8, body: p(['<!-- comment --> is ignored by the browser.', 'Use comments to label sections and leave notes for teammates.']), editor: { lang: 'html', starter: '<!-- Header section -->\n<h1>Title</h1>\n<!-- TODO: add nav -->\n<p>Visible text</p>' }, objective: 'Write helpful HTML comments.' },
    { id: 'hs-14', title: 'Block vs inline', mins: 10, body: p(['Block elements start on a new line (div, p, h1, ul).', 'Inline elements flow inside a line (a, span, strong, em).']), editor: { lang: 'html', starter: '<p>Inline <strong>bold</strong> and <em>italic</em>.</p>\n<div>Block one</div>\n<div>Block two</div>' }, objective: 'Distinguish block and inline elements.' },
    { id: 'hs-15', title: 'Text formatting', mins: 8, body: p(['<strong> important text, <em> emphasis, <code> code snippets.', '<br> line break, <hr> horizontal rule.']), editor: { lang: 'html', starter: '<p><strong>Warning:</strong> read <em>carefully</em>.</p>\n<p>Command: <code>npm start</code></p>\n<hr>\n<p>Next section</p>' }, objective: 'Format text with common inline tags.' },
    { id: 'hs-16', title: 'Meta tags and SEO basics', mins: 10, body: p(['<meta charset="UTF-8"> sets character encoding.', '<meta name="viewport" ...> helps mobile layouts.', 'Write a clear <title> and descriptive headings.']), editor: { lang: 'html', starter: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>My SEO-friendly page</title>\n</head>\n<body><h1>Welcome</h1></body>\n</html>' }, objective: 'Add essential meta tags for modern pages.' },
    { id: 'hs-17', title: 'Accessibility (a11y)', mins: 12, body: p(['Use alt text, labels tied to inputs, sufficient colour contrast.', 'Structure headings in order; do not skip levels randomly.']), editor: { lang: 'html', starter: '<label for="email">Email</label>\n<input id="email" type="email" aria-label="Email address">\n<button type="button">Subscribe</button>' }, objective: 'Apply basic accessibility practices.' },
    { id: 'hs-18', title: 'HTML5 media', mins: 10, body: p(['<video> and <audio> embed media with controls attribute.', 'Always provide fallback text inside the tag.']), editor: { lang: 'html', starter: '<video controls width="320" poster="https://via.placeholder.com/320x180">\n  <source src="movie.mp4" type="video/mp4">\n  Your browser does not support video.\n</video>' }, objective: 'Embed video and audio elements.' },
    { id: 'hs-19', title: 'Project: profile page', mins: 20, type: 'try', body: p(['Build a one-page profile with header, about section, skills list, and contact form.', 'Use semantic tags and at least one image with alt text.']), editor: { lang: 'html', starter: '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>My Profile</title></head>\n<body>\n  <header><h1>Your Name</h1><p>Student at Kiteline Academy</p></header>\n  <main>\n    <section><h2>About</h2><p>Write about yourself.</p></section>\n    <section><h2>Skills</h2><ul><li>HTML</li><li>CSS</li></ul></section>\n  </main>\n</body>\n</html>' }, exercise: 'Add a contact form with name, email, and message fields.', objective: 'Combine HTML skills into a profile page project.' },
    { id: 'hs-20', title: 'HTML review quiz', mins: 15, type: 'quiz', body: p(['Test your HTML fundamentals before moving to CSS.']), quiz: { questions: [{ q: 'Which tag defines the main page title shown in the browser tab?', options: ['<title>', '<h1>', '<header>', '<meta>'], correct: 0 }, { q: 'Which attribute is required on <img> for accessibility?', options: ['alt', 'src', 'width', 'class'], correct: 0 }, { q: 'Which element is semantic?', options: ['<article>', '<div>', '<span>', '<b>'], correct: 0 }] }, objective: 'Confirm HTML starter knowledge.' },
  ];
  return items.map(function (it) {
    const opts = { objective: it.objective, tryIt: it.tryIt || '' };
    if (it.editor) opts.editor = it.editor;
    if (it.exercise) opts.exercise = it.exercise;
    if (it.type) opts.type = it.type;
    if (it.quiz) opts.quiz = it.quiz;
    return fmt(it.id, it.title, it.mins, it.body, opts);
  }).join('');
}

function cssLessons() {
  const topics = [
    ['css-1', 'Introduction to CSS', 8, ['CSS styles HTML using selectors and rules.', 'Syntax: selector { property: value; }'], { editor: { lang: 'html', starter: '<style>\np { color: navy; font-size: 18px; }\n</style>\n<p>Styled paragraph</p>' } }],
    ['css-2', 'Selectors', 10, ['Element, class (.name), and id (#name) selectors.', 'Combine selectors for precise targeting.'], { editor: { lang: 'html', starter: '<style>\n.highlight { background: yellow; }\n#main { font-weight: bold; }\n</style>\n<p class="highlight">Highlighted</p>\n<p id="main">Main text</p>' } }],
    ['css-3', 'Colours and backgrounds', 10, ['Use names, hex (#36e6ff), rgb(), and hsl().', 'background-color, background-image, background-size.'], { editor: { lang: 'html', starter: '<style>\nbody { background: #0a1024; color: #f6f8ff; }\n.box { background: linear-gradient(135deg,#676bff,#a855f7); padding: 20px; }\n</style>\n<div class="box">Gradient box</div>' } }],
    ['css-4', 'Typography', 10, ['font-family, font-size, font-weight, line-height, text-align.', 'Use readable sizes and line-height around 1.5–1.7.'], { editor: { lang: 'html', starter: '<style>\nh1 { font-family: Georgia, serif; letter-spacing: -0.02em; }\np { line-height: 1.65; max-width: 60ch; }\n</style>\n<h1>Heading</h1>\n<p>Readable body text with good line height.</p>' } }],
    ['css-5', 'The box model', 12, ['Content, padding, border, margin.', 'box-sizing: border-box keeps width predictable.'], { editor: { lang: 'html', starter: '<style>\n.box { width: 200px; padding: 16px; border: 4px solid #36e6ff; margin: 12px; box-sizing: border-box; background: #111b3d; }\n</style>\n<div class="box">Box model</div>' } }],
    ['css-6', 'Padding and margin', 10, ['Shorthand: padding: 10px 20px;', 'margin: 0 auto; centres block elements.'], { editor: { lang: 'html', starter: '<style>\n.card { padding: 1rem 1.25rem; margin: 1rem auto; max-width: 320px; border: 1px solid #ccc; }\n</style>\n<div class="card">Centred card</div>' } }],
    ['css-7', 'Borders and radius', 8, ['border, border-radius, outline.', 'Rounded corners soften UI design.'], { editor: { lang: 'html', starter: '<style>\n.btn { border: 2px solid #36e6ff; border-radius: 999px; padding: 10px 18px; background: transparent; color: #36e6ff; }\n</style>\n<button class="btn">Pill button</button>' } }],
    ['css-8', 'Display types', 10, ['display: block | inline | inline-block | none.', 'Control how elements flow on the page.'], { editor: { lang: 'html', starter: '<style>\nspan.blocky { display: block; background: #eee; margin: 4px 0; padding: 4px; }\n</style>\n<span class="blocky">Acts like block</span>\n<span class="blocky">Another row</span>' } }],
    ['css-9', 'Flexbox basics', 14, ['display: flex on a container.', 'justify-content, align-items, gap, flex-direction.'], { editor: { lang: 'html', starter: '<style>\n.row { display: flex; gap: 12px; justify-content: center; }\n.item { background: #676bff; color: #fff; padding: 12px; border-radius: 8px; }\n</style>\n<div class="row">\n  <div class="item">A</div>\n  <div class="item">B</div>\n  <div class="item">C</div>\n</div>' } }],
    ['css-10', 'Flexbox layouts', 14, ['Use flex-wrap and flex: 1 for responsive rows.', 'Build nav bars and card rows.'], { editor: { lang: 'html', starter: '<style>\n.nav { display: flex; justify-content: space-between; padding: 12px; background: #111; color: #fff; }\n.nav a { color: #36e6ff; margin-left: 12px; }\n</style>\n<nav class="nav"><strong>Logo</strong><div><a href="#">Home</a><a href="#">About</a></div></nav>' } }],
    ['css-11', 'CSS Grid intro', 14, ['display: grid; grid-template-columns: 1fr 1fr;', 'gap places items in rows and columns.'], { editor: { lang: 'html', starter: '<style>\n.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }\n.cell { background: #a855f7; color: #fff; padding: 20px; text-align: center; }\n</style>\n<div class="grid">\n  <div class="cell">1</div><div class="cell">2</div>\n  <div class="cell">3</div><div class="cell">4</div>\n</div>' } }],
    ['css-12', 'Responsive design', 12, ['Media queries adapt layout to screen size.', '@media (max-width: 600px) { ... }'], { editor: { lang: 'html', starter: '<style>\n.box { padding: 20px; background: #36e6ff; }\n@media (max-width: 500px) { .box { background: #a855f7; color: #fff; } }\n</style>\n<div class="box">Resize the preview window</div>' } }],
    ['css-13', 'Pseudo-classes', 10, [':hover, :focus, :nth-child() add interactive styling.', 'Always style :focus for keyboard users.'], { editor: { lang: 'html', starter: '<style>\na { color: blue; text-decoration: none; }\na:hover { text-decoration: underline; }\na:focus { outline: 2px solid #36e6ff; }\n</style>\n<a href="#">Hover and focus me</a>' } }],
    ['css-14', 'Transitions', 10, ['transition: property duration easing;', 'Smooth hover effects feel polished.'], { editor: { lang: 'html', starter: '<style>\n.box { width: 80px; height: 80px; background: #676bff; transition: transform 0.3s; }\n.box:hover { transform: scale(1.15); }\n</style>\n<div class="box"></div>' } }],
    ['css-15', 'Project: styled portfolio', 20, ['Combine flexbox, colours, and typography into a styled page.', 'Make it readable on mobile using a media query.'], { type: 'try', editor: { lang: 'html', starter: '<style>\nbody { font-family: system-ui; margin: 0; background: #070b18; color: #f6f8ff; }\nheader { padding: 2rem; text-align: center; background: linear-gradient(135deg,#676bff,#a855f7); }\nmain { max-width: 720px; margin: auto; padding: 1.5rem; }\n</style>\n<header><h1>My Portfolio</h1></header>\n<main><p>Your styled content here.</p></main>' }, exercise: 'Add a skills section using flexbox and a hover effect on links.', objective: 'Publish a styled portfolio page with CSS.' }],
  ];
  return topics.map(function (t) {
    const opts = Object.assign({ objective: 'Learn and practice ' + t[1] + '.', tryIt: 'Edit the example and run preview.' }, t[4] || {});
    return fmt(t[0], t[1], t[2], p(t[3]), opts);
  }).join('');
}

function jsLessons() {
  const titles = [
    'JavaScript and the browser', 'Variables let and const', 'Data types', 'Operators', 'Strings and template literals',
    'Conditionals if else', 'Switch statements', 'Loops for and while', 'Arrays basics', 'Array methods map filter',
    'Objects', 'Functions', 'Arrow functions', 'Scope and closures intro', 'DOM selection',
    'Changing text and HTML', 'Event listeners', 'Forms and input values', 'CSS classList toggle', 'Creating elements',
    'Timers setTimeout', 'JSON parse stringify', 'Fetch API intro', 'Async await basics', 'Error handling try catch',
    'Local storage', 'Modules import export intro', 'Debugging with console', 'Mini project: to-do list', 'Mini project: quiz app', 'JS review quiz',
  ];
  return titles.map(function (title, i) {
    const n = i + 1;
    const id = 'js-' + n;
    const isQuiz = n === 31;
    const isProject = n >= 29 && n <= 30;
    const body = p([
      title + ' is a core JavaScript topic for interactive web pages.',
      'Practice in the editor or browser console — small steps build real skills.',
    ]);
    const opts = {
      objective: 'Understand ' + title + ' and use it in a short example.',
      tryIt: isProject ? 'Build the project step by step in the editor.' : 'Run the starter code and change one line to see what happens.',
    };
    if (n <= 5) {
      opts.editor = { lang: 'html', starter: '<script>\n// ' + title + '\nconst message = "Hello Kiteline";\nconsole.log(message);\n</script>\n<p>Open DevTools console to see output.</p>' };
    } else if (n <= 15) {
      opts.editor = { lang: 'html', starter: '<script>\n// ' + title + '\nconst nums = [1, 2, 3];\nconsole.log(nums.map(n => n * 2));\n</script>' };
    } else if (n <= 25) {
      opts.editor = { lang: 'html', starter: '<button id="btn">Click</button>\n<p id="out"></p>\n<script>\nconst btn = document.getElementById("btn");\nconst out = document.getElementById("out");\nbtn.addEventListener("click", () => { out.textContent = "Clicked!"; });\n</script>' };
    } else {
      opts.editor = { lang: 'html', starter: '<ul id="list"></ul>\n<input id="task" placeholder="New task">\n<button id="add">Add</button>\n<script>\nconst list = document.getElementById("list");\ndocument.getElementById("add").onclick = () => {\n  const t = document.getElementById("task").value.trim();\n  if (!t) return;\n  const li = document.createElement("li");\n  li.textContent = t;\n  list.appendChild(li);\n};\n</script>' };
    }
    if (isProject) opts.type = 'try';
    if (isQuiz) {
      opts.type = 'quiz';
      opts.quiz = {
        questions: [
          { q: 'Which keyword declares a block-scoped variable?', options: ['let', 'var', 'function', 'class'], correct: 0 },
          { q: 'Which method selects an element by id?', options: ['getElementById', 'querySelectorAll', 'createElement', 'appendChild'], correct: 0 },
          { q: 'JSON.parse converts a string to…', options: ['A JavaScript value', 'A CSS rule', 'An HTML tag', 'A database'], correct: 0 },
        ],
      };
    }
    return fmt(id, title, isProject ? 20 : isQuiz ? 12 : 10, body, opts);
  }).join('');
}

function pyLessons() {
  const titles = [
    'Why Python?', 'Installing Python', 'print and comments', 'Variables and types', 'Numbers and maths',
    'Strings', 'f-strings', 'Booleans', 'if elif else', 'Comparison operators',
    'while loops', 'for loops', 'Lists', 'List methods', 'Tuples and sets',
    'Dictionaries', 'Functions', 'Parameters and return', 'Modules and pip', 'Reading files',
    'Writing files', 'try except', 'List comprehensions', 'Mini project: guess the number', 'Mini project: contact book',
  ];
  return titles.map(function (title, i) {
    const n = i + 1;
    const id = 'py-' + n;
    const isProject = n >= 24;
    const body = p([title + ' — hands-on Python for beginners.', 'Run code locally or in an online REPL like python.org/shell.']);
    const starters = [
      'print("Hello Kiteline Academy")',
      '# ' + title + '\nname = "Student"\nprint(name)',
      'x = 10\ny = 3\nprint(x + y, x // y, x ** y)',
      'items = ["HTML", "CSS", "Python"]\nfor item in items:\n    print("-", item)',
      'def greet(name):\n    return f"Hello, {name}!"\nprint(greet("Kiteline"))',
    ];
    const opts = {
      objective: 'Learn ' + title + ' with a runnable example.',
      tryIt: 'Copy the code into a Python REPL and experiment.',
      editor: { lang: 'python', starter: starters[Math.min(i, starters.length - 1)] },
    };
    if (isProject) opts.type = 'try';
    return fmt(id, title, isProject ? 18 : 10, body, opts);
  }).join('');
}

function paidOutline(id, prefix, title, track, icon, desc, outcomes, previewTitle) {
  return (
    "    '" + id + "': {\n" +
    "      id: '" + id + "',\n" +
    "      title: '" + title + "',\n" +
    "      track: '" + track + "',\n" +
    "      tier: 'paid',\n" +
    "      teacher: 'Shyam Prasad',\n" +
    "      icon: '" + icon + "',\n" +
    "      duration: 'Self-paced',\n" +
    "      lessonCount: 10,\n" +
    "      desc: '" + desc + "',\n" +
    "      outcomes: " + JSON.stringify(outcomes) + ",\n" +
    "      lessons: [\n" +
    fmt(prefix + '-1', 'Course outline — enrol to unlock', 5,
      p(['This course opens when you enrol in Starter or Pro.', 'Preview lesson 1 shows the syllabus.', 'Email contact@kiteline.uk for help.']),
      { objective: 'Preview the ' + title + ' syllabus.', tryIt: 'Enrol via Starter plan when payments launch — all core web courses are free today.' }
    ) +
    "      ],\n" +
    "    },\n"
  );
}

function main() {
  const current = fs.readFileSync(OUT, 'utf8');
  const preamble = extractBlock(current, 'const KA_COURSES');
  const aiLessons = extractCourseLessons(current, 'ai-world-starter');
  if (!aiLessons) throw new Error('ai-world-starter lessons missing');

  const courses =
    '  const KA_COURSES = {\n' +
    "    'ai-world-starter': {\n" +
    "      id: 'ai-world-starter',\n" +
    "      title: 'AI World — Free Starter',\n" +
    "      track: 'free',\n" +
    "      tier: 'free',\n" +
    "      teacher: 'Shyam Prasad',\n" +
    "      icon: '🤖',\n" +
    "      duration: '≈3 hours',\n" +
    "      lessonCount: 10,\n" +
    "      desc: 'Understand the AI world from zero: what it is, which apps to use, how to prompt safely, and where to learn more.',\n" +
    "      outcomes: ['Know what AI is (and what it is not)', 'Use ChatGPT, Claude, Gemini and Copilot confidently', 'Write clear prompts for study and work', 'Find trustworthy sources and stay safe online'],\n" +
    '      lessons: ' + aiLessons + ',\n' +
    '    },\n' +
    "    'html-starter': {\n" +
    "      id: 'html-starter',\n" +
    "      title: 'Web Basics — Free Starter',\n" +
    "      track: 'free',\n" +
    "      tier: 'free',\n" +
    "      teacher: 'Shyam Prasad',\n" +
    "      icon: '🌐',\n" +
    "      duration: '≈12 hours',\n" +
    "      lessonCount: 20,\n" +
    "      desc: 'Build your first web pages with HTML — structure, links, images, forms, semantics, and a profile project.',\n" +
    "      outcomes: ['Understand HTML tags and document structure', 'Create a simple profile page', 'Use AI to explain code'],\n" +
    '      lessons: [\n' + htmlLessons() + '      ],\n' +
    '    },\n' +
    "    'css-starter': {\n" +
    "      id: 'css-starter',\n" +
    "      title: 'CSS Starter',\n" +
    "      track: 'beginner',\n" +
    "      tier: 'free',\n" +
    "      teacher: 'Shyam Prasad',\n" +
    "      icon: '🎨',\n" +
    "      duration: '≈10 hours',\n" +
    "      lessonCount: 15,\n" +
    "      desc: 'Style web pages with colours, layout, flexbox, grid, and responsive design — live in the editor.',\n" +
    "      outcomes: ['Use selectors and the box model', 'Build flex and grid layouts', 'Publish a styled portfolio page'],\n" +
    '      lessons: [\n' + cssLessons() + '      ],\n' +
    '    },\n' +
    "    'js-starter': {\n" +
    "      id: 'js-starter',\n" +
    "      title: 'JavaScript Starter',\n" +
    "      track: 'beginner',\n" +
    "      tier: 'free',\n" +
    "      teacher: 'Shyam Prasad',\n" +
    "      icon: '⚡',\n" +
    "      duration: '≈20 hours',\n" +
    "      lessonCount: 31,\n" +
    "      desc: 'JavaScript from zero: variables, DOM, events, fetch, async, and two mini projects with Try it Yourself.',\n" +
    "      outcomes: ['Write beginner JavaScript', 'Update the DOM safely', 'Build a to-do list and quiz app'],\n" +
    '      lessons: [\n' + jsLessons() + '      ],\n' +
    '    },\n' +
    "    'python-starter': {\n" +
    "      id: 'python-starter',\n" +
    "      title: 'Python Starter',\n" +
    "      track: 'beginner',\n" +
    "      tier: 'free',\n" +
    "      teacher: 'Shyam Prasad',\n" +
    "      icon: '🐍',\n" +
    "      duration: '≈15 hours',\n" +
    "      lessonCount: 25,\n" +
    "      desc: 'Python fundamentals with runnable examples: types, loops, functions, files, and mini projects.',\n" +
    "      outcomes: ['Run Python scripts', 'Use lists and dictionaries', 'Automate simple tasks'],\n" +
    '      lessons: [\n' + pyLessons() + '      ],\n' +
    '    },\n' +
    paidOutline('excel-starter', 'xls', 'Excel Starter', 'beginner', '📊', 'Spreadsheets for work and study: formulas, tables, charts, and Copilot-assisted reporting.', ['Build clean tables and charts', 'Use SUM, IF, and VLOOKUP-style thinking', 'Ask Copilot to draft formulas safely']) +
    paidOutline('sql-starter', 'sql', 'SQL Starter', 'beginner', '🗄️', 'Query databases with SELECT, WHERE, JOIN, and GROUP BY using real-world examples.', ['Read and write SQL queries', 'Filter and sort data', 'Combine tables with JOINs']) +
    paidOutline('ai-tools-beginners', 'atb', 'AI Tools for Beginners (paid path)', 'free', '🧠', 'Guided path beyond the free AI World track — certificates and teacher support when enrolled.', ['Structured AI tool practice', 'Business and study workflows', 'Responsible AI habits']) +
    paidOutline('react-starter', 'rx', 'React Starter', 'intermediate', '⚛️', 'Components, props, state, hooks, and a small app — unlocks after web fundamentals.', ['Build React components', 'Manage state with hooks', 'Fetch data into a UI']) +
    paidOutline('node-starter', 'nd', 'Node.js Starter', 'intermediate', '🟢', 'Server-side JavaScript: APIs, Express basics, and deployment concepts.', ['Create a simple API', 'Understand npm and modules', 'Connect a frontend to a backend']) +
    '  };\n\n' +
    "  const FREE_COURSE_IDS = ['ai-world-starter', 'html-starter', 'css-starter', 'js-starter', 'python-starter'];\n";

  const footer = current.slice(current.indexOf('function getCourse(id)'));
  const output = preamble + courses + footer;
  fs.writeFileSync(OUT, output, 'utf8');
  console.log('Wrote', OUT, output.length, 'bytes');
}

main();
