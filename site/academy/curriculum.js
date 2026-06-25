/* Kiteline Academy — curriculum data (tracks, courses, lessons, AI tools) */
(function (global) {
  'use strict';

  const KA_TRACKS = {
    free: {
      id: 'free',
      title: 'Free Starter',
      badge: 'Free',
      desc: 'Start from zero — no card required. Learn what AI is, try top tools, and practise in the Code Lab.',
      color: '#36e6ff',
    },
    beginner: {
      id: 'beginner',
      title: 'Beginner',
      badge: 'Starter plan',
      desc: 'Structured courses with projects, worksheets and email support.',
      color: '#676bff',
    },
    intermediate: {
      id: 'intermediate',
      title: 'Intermediate',
      badge: 'Pro Student',
      desc: 'Prompt engineering, automation, coding with AI, and business workflows.',
      color: '#a855f7',
    },
    advanced: {
      id: 'advanced',
      title: 'Advanced',
      badge: 'Paths & bundles',
      desc: 'Full-stack, ML basics, and career paths for job-ready skills.',
      color: '#ffca6b',
    },
  };

  const KA_AI_TOOLS = [
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      maker: 'OpenAI',
      url: 'https://chat.openai.com',
      tier: 'free',
      bestFor: 'Writing, explanations, coding help, planning, tutoring',
      howItWorks: 'You type a message (prompt). The model predicts helpful text based on patterns learned from books, code and the web. Free tier available; Plus adds faster models and more features.',
      tryPrompt: 'Explain artificial intelligence to a complete beginner in 5 bullet points.',
    },
    {
      id: 'claude',
      name: 'Claude',
      maker: 'Anthropic',
      url: 'https://claude.ai',
      tier: 'free',
      bestFor: 'Long documents, careful reasoning, writing, analysis',
      howItWorks: 'Similar to ChatGPT but tuned for helpful, honest answers. Strong at reading long PDFs and comparing options. Free tier with daily limits.',
      tryPrompt: 'Summarise the pros and cons of using AI for small business owners.',
    },
    {
      id: 'gemini',
      name: 'Gemini',
      maker: 'Google',
      url: 'https://gemini.google.com',
      tier: 'free',
      bestFor: 'Search + AI, Google Workspace, multimodal (text + images)',
      howItWorks: 'Google\'s AI assistant connected to search and Google apps. Good if you already use Gmail, Docs or Android.',
      tryPrompt: 'What are 3 beginner-friendly ways to use AI at work?',
    },
    {
      id: 'copilot',
      name: 'Microsoft Copilot',
      maker: 'Microsoft',
      url: 'https://copilot.microsoft.com',
      tier: 'free',
      bestFor: 'Windows users, Office, web search, everyday tasks',
      howItWorks: 'Built into Windows, Edge and Microsoft 365. Answers questions and can help with Word, Excel and PowerPoint when you have a Microsoft account.',
      tryPrompt: 'Create a simple weekly meal plan table I can paste into Excel.',
    },
    {
      id: 'perplexity',
      name: 'Perplexity',
      maker: 'Perplexity AI',
      url: 'https://perplexity.ai',
      tier: 'free',
      bestFor: 'Research with sources, fact-checking, learning new topics',
      howItWorks: 'AI search — it answers your question and shows links to sources so you can verify facts. Excellent for homework and research.',
      tryPrompt: 'What is machine learning? Include 3 reputable sources.',
    },
    {
      id: 'cursor',
      name: 'Cursor',
      maker: 'Cursor',
      url: 'https://cursor.com',
      tier: 'free',
      bestFor: 'Learning to code, building websites and apps with AI help',
      howItWorks: 'A code editor with AI built in. You describe what you want; it suggests code. Kiteline Academy Code Lab teaches HTML first; Cursor is the next step for real projects.',
      tryPrompt: 'N/A — install Cursor and ask: "Explain this HTML file line by line."',
    },
    {
      id: 'dalle',
      name: 'DALL·E / Image tools',
      maker: 'OpenAI & others',
      url: 'https://openai.com/dall-e-3',
      tier: 'free',
      bestFor: 'Logos, social images, illustrations from text descriptions',
      howItWorks: 'You describe an image in words; the AI generates pictures. Also try Bing Image Creator (free) or Canva AI for marketing graphics.',
      tryPrompt: 'A friendly flat illustration of a student learning AI on a laptop, purple and cyan colours.',
    },
    {
      id: 'notion-ai',
      name: 'Notion AI',
      maker: 'Notion',
      url: 'https://notion.so/product/ai',
      tier: 'paid',
      bestFor: 'Notes, wikis, project planning with AI inside your docs',
      howItWorks: 'AI lives inside Notion pages — summarise notes, draft plans, rewrite text. Good for students and small teams organising work.',
      tryPrompt: 'Turn my messy meeting notes into a clear action list.',
    },
  ];

  const KA_SOURCES = [
    { title: 'OpenAI — ChatGPT', url: 'https://help.openai.com/en/collections/3742473-chatgpt', desc: 'Official help centre for ChatGPT features and safety.' },
    { title: 'Google AI Essentials (Coursera)', url: 'https://grow.google/ai/', desc: 'Free intro course from Google on practical AI skills.' },
    { title: 'Microsoft Learn — AI', url: 'https://learn.microsoft.com/en-us/training/browse/?products=ai-services', desc: 'Free modules on Copilot and Azure AI basics.' },
    { title: 'Anthropic — Claude docs', url: 'https://docs.anthropic.com/', desc: 'How Claude works and responsible use guidelines.' },
    { title: 'MIT — Introduction to Deep Learning', url: 'https://introtodeeplearning.com/', desc: 'University-level videos (advanced, optional).' },
    { title: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Learn', desc: 'Free, trusted HTML/CSS/JavaScript learning (pairs with our web courses).' },
    { title: 'UK ICO — AI guidance', url: 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/', desc: 'Privacy and data protection when using AI (UK).' },
  ];

  function lesson(id, title, mins, body, opts) {
    opts = opts || {};
    return {
      id,
      title,
      duration: mins + ' min',
      type: opts.type || 'read',
      content: body,
      tryIt: opts.tryIt || '',
      sources: opts.sources || [],
      tools: opts.tools || [],
      quiz: opts.quiz || null,
    };
  }

  const KA_COURSES = {
    'ai-world-starter': {
      id: 'ai-world-starter',
      title: 'AI World — Free Starter',
      track: 'free',
      tier: 'free',
      icon: '🤖',
      duration: '2–3 hours',
      lessonCount: 10,
      desc: 'Understand the AI world from zero: what it is, which apps to use, how to prompt safely, and where to learn more.',
      outcomes: [
        'Know what AI is (and what it is not)',
        'Use ChatGPT, Claude, Gemini and Copilot confidently',
        'Write clear prompts for study and work',
        'Find trustworthy sources and stay safe online',
      ],
      lessons: [
        lesson('aw-1', 'What is AI?', 8,
          '<p><b>Artificial Intelligence (AI)</b> means computer systems that can help with tasks humans normally do — writing, research, coding, planning, design and problem-solving.</p>' +
          '<p>Today\'s popular tools (ChatGPT, Claude, Gemini, Copilot) are called <b>large language models (LLMs)</b>. They read your question and generate a helpful reply — like a very fast research assistant.</p>' +
          '<h4>What AI is NOT</h4><ul><li>It is not a human brain — it predicts words, not true understanding</li><li>It can be wrong — always check important facts</li><li>It does not replace learning — it helps you learn faster</li></ul>' +
          '<h4>Why learn AI now?</h4><p>AI is used in jobs, school, business and everyday life. Learning the basics early gives you an advantage — whether you are a student, worker or business owner.</p>',
          { tryIt: 'Open ChatGPT (free at chat.openai.com) and ask: “Explain HTML to a complete beginner in 5 bullet points.”', tools: ['chatgpt'], sources: [KA_SOURCES[0]] }),

        lesson('aw-2', 'How AI tools actually work', 10,
          '<p>AI assistants are trained on huge amounts of text and code from the internet and books. When you send a <b>prompt</b> (your message), the model:</p>' +
          '<ol><li>Reads your words</li><li>Predicts the most helpful reply word by word</li><li>Shows you the answer in seconds</li></ol>' +
          '<p>They do <b>not</b> browse the live web unless the tool has a “search” feature (e.g. Perplexity, Copilot with search).</p>' +
          '<h4>Key terms</h4><ul><li><b>Prompt</b> — what you type to the AI</li><li><b>Model</b> — the brain behind the app (GPT-4, Claude, Gemini, etc.)</li><li><b>Hallucination</b> — when AI sounds confident but invents false facts</li><li><b>Context</b> — extra information you give (paste notes, code, goals)</li></ul>',
          { tryIt: 'Ask ChatGPT: “What is a prompt? Give one good example and one bad example.”', tools: ['chatgpt', 'claude'] }),

        lesson('aw-3', 'ChatGPT — your first AI app', 12,
          '<p><b>ChatGPT</b> by OpenAI is the most popular starting point. Create a free account at <a href="https://chat.openai.com" target="_blank" rel="noopener">chat.openai.com</a>.</p>' +
          '<h4>What to use it for</h4><ul><li>Explain topics in simple language</li><li>Plan essays, emails and projects</li><li>Debug code and learn programming</li><li>Brainstorm business ideas</li></ul>' +
          '<h4>Tips for beginners</h4><ul><li>Be specific — say who you are and what you need</li><li>Ask for bullet points or step-by-step</li><li>Say “explain like I am 12” if something is too hard</li><li>Start a new chat for a new topic</li></ul>',
          { type: 'try', tryIt: 'Prompt: “I am a complete beginner. Teach me 3 things I can do with ChatGPT today for school or work. Use simple English.”', tools: ['chatgpt'] }),

        lesson('aw-4', 'Claude, Gemini & Copilot — pick the right tool', 14,
          '<p>No single app wins every task. Here is a simple guide:</p>' +
          '<table style="width:100%;border-collapse:collapse;font-size:14px"><tr style="border-bottom:1px solid rgba(255,255,255,.15)"><th style="text-align:left;padding:8px">Tool</th><th style="text-align:left;padding:8px">Best when…</th></tr>' +
          '<tr style="border-bottom:1px solid rgba(255,255,255,.1)"><td style="padding:8px"><b>ChatGPT</b></td><td style="padding:8px">General learning, coding, creativity</td></tr>' +
          '<tr style="border-bottom:1px solid rgba(255,255,255,.1)"><td style="padding:8px"><b>Claude</b></td><td style="padding:8px">Long documents, careful writing</td></tr>' +
          '<tr style="border-bottom:1px solid rgba(255,255,255,.1)"><td style="padding:8px"><b>Gemini</b></td><td style="padding:8px">Google apps, Android, search</td></tr>' +
          '<tr><td style="padding:8px"><b>Copilot</b></td><td style="padding:8px">Windows, Word, Excel, Edge browser</td></tr></table>' +
          '<p>Try at least <b>two</b> tools with the same question — you will see different styles of answers.</p>',
          { tryIt: 'Use the same prompt on ChatGPT and Claude: “List 5 ways AI can help a small café owner.” Compare the answers.', tools: ['chatgpt', 'claude', 'gemini', 'copilot'] }),

        lesson('aw-5', 'Perplexity — research with real sources', 10,
          '<p>When you need <b>facts with links</b>, use <a href="https://perplexity.ai" target="_blank" rel="noopener">Perplexity</a>. It searches the web and cites sources — better for homework, news and “is this true?” questions.</p>' +
          '<h4>ChatGPT vs Perplexity</h4><ul><li><b>ChatGPT</b> — great tutor and writer; may not cite sources</li><li><b>Perplexity</b> — great researcher; shows URLs to check</li></ul>' +
          '<p>Professional habit: <b>verify</b> important facts on official sites (gov.uk, NHS, company docs).</p>',
          { tryIt: 'On Perplexity ask: “What is generative AI? Include 3 sources.” Click each source and skim it.', tools: ['perplexity'], sources: [KA_SOURCES[1]] }),

        lesson('aw-6', 'Write prompts that actually work', 15,
          '<p>A weak prompt: <i>“Tell me about marketing.”</i></p>' +
          '<p>A strong prompt: <i>“I run a small bakery in London. List 5 low-cost social media ideas for Instagram. Use bullet points. Beginner-friendly tone.”</i></p>' +
          '<h4>The CLEAR framework</h4><ul><li><b>C</b>ontext — who you are, your situation</li><li><b>L</b>ength — bullets, 200 words, 5 steps</li><li><b>E</b>xamples — “like this sample…”</li><li><b>A</b>udience — beginner, expert, customer</li><li><b>R</b>ole — “act as a patient teacher”</li></ul>' +
          '<p>Save your best prompts in a notes app — reuse them weekly.</p>',
          { type: 'try', tryIt: 'Rewrite this weak prompt using CLEAR: “Help me with my CV.” Then paste your improved version into ChatGPT.', tools: ['chatgpt', 'claude'] }),

        lesson('aw-7', 'AI for learning & study', 12,
          '<p>AI is a <b>tutor</b>, not an answer machine for cheating. Ethical uses:</p>' +
          '<ul><li>Explain a chapter you did not understand</li><li>Quiz yourself before exams</li><li>Turn notes into flashcards</li><li>Plan a study timetable</li></ul>' +
          '<p>Ask your school or college about their AI policy. Kiteline Academy teaches you to <b>learn with AI</b>, not copy without understanding.</p>',
          { tryIt: 'Prompt: “Quiz me with 5 multiple-choice questions on [your topic]. Wait for my answer after each question, then explain if I was wrong.”', tools: ['chatgpt'] }),

        lesson('aw-8', 'AI for coding & the Code Lab', 14,
          '<p>AI coding assistants help you <b>learn</b>, debug and plan projects. They do not replace understanding.</p>' +
          '<ul><li>Ask for explanations in simple language</li><li>Paste error messages and ask what they mean</li><li>Request step-by-step instructions</li><li>Always test code yourself</li></ul>' +
          '<p>On Kiteline Academy, use the <b>Code Lab</b> to practise HTML. Ask AI to explain each line, then type it yourself.</p>',
          { type: 'try', tryIt: 'Go to Code Lab on this site. Ask ChatGPT to explain the default HTML. Change the heading to your name and run it.', tools: ['chatgpt', 'cursor'] }),

        lesson('aw-9', 'Images, voice & multimodal AI', 10,
          '<p>Modern AI is not only text:</p>' +
          '<ul><li><b>Images</b> — DALL·E, Bing Image Creator, Canva AI</li><li><b>Voice</b> — ChatGPT voice mode, phone assistants</li><li><b>Files</b> — upload PDFs to Claude or ChatGPT for summaries</li></ul>' +
          '<p>Always check copyright and school/work rules before using AI images for assignments or branding.</p>',
          { tryIt: 'Describe a simple logo for a fictional café. Generate it in a free image tool or ask ChatGPT to describe colours and layout only.', tools: ['dalle'] }),

        lesson('aw-10', 'Safety, privacy & your AI plan', 12,
          '<p><b>Never share</b> passwords, bank details, private IDs or confidential work secrets with public AI chats.</p>' +
          '<h4>Safe habits</h4><ul><li>Use strong passwords and 2FA on AI accounts</li><li>Turn off chat history if your tool allows (for sensitive work)</li><li>Fact-check health, legal and money advice with professionals</li><li>Label AI-assisted work when required</li></ul>' +
          '<h4>Your next steps</h4><ol><li>Complete this free track</li><li>Practise 3 prompts per week</li><li>Enrol in HTML or Prompt Engineering when ready</li><li>Explore sources below for deeper learning</li></ol>',
          {
            type: 'quiz',
            quiz: {
              questions: [
                { q: 'What is a hallucination in AI?', options: ['A virtual reality game', 'When AI gives false but confident information', 'A type of computer virus', 'A privacy setting'], correct: 1 },
                { q: 'Which tool is best for answers with cited web sources?', options: ['ChatGPT only', 'Perplexity', 'A calculator', 'Microsoft Word'], correct: 1 },
                { q: 'What should you NEVER paste into a public AI chat?', options: ['A homework question', 'Your password or bank details', 'A recipe', 'A coding error message'], correct: 1 },
              ],
            },
            sources: [KA_SOURCES[6]],
          }),
      ],
    },

    'html-starter': {
      id: 'html-starter',
      title: 'Web Basics — Free Starter',
      track: 'free',
      tier: 'free',
      icon: '🌐',
      duration: '1–2 hours',
      lessonCount: 5,
      desc: 'Build your first web page with HTML and practise live in the Code Lab.',
      outcomes: ['Understand HTML tags', 'Create a simple page', 'Use AI to explain code'],
      lessons: [
        lesson('hs-1', 'What is a website?', 8,
          '<p>A website is files (HTML, CSS, JavaScript) stored on a server. Your browser downloads them and shows the page.</p><p>HTML = structure. CSS = style. JavaScript = interactivity.</p>',
          { tryIt: 'Open any website, right-click → View Page Source. Spot tags like &lt;html&gt;, &lt;body&gt;, &lt;h1&gt;.' }),
        lesson('hs-2', 'Your first HTML page', 12,
          '<p>HTML uses <b>tags</b> to mark content:</p>' +
          '<pre style="background:#050814;color:#dff7ff;padding:12px;border-radius:12px;overflow:auto">&lt;!DOCTYPE html&gt;\n&lt;html&gt;\n  &lt;body&gt;\n    &lt;h1&gt;Hello Kiteline Academy&lt;/h1&gt;\n    &lt;p&gt;My first web page.&lt;/p&gt;\n  &lt;/body&gt;\n&lt;/html&gt;</pre>',
          { type: 'try', tryIt: 'Copy this into the Code Lab on this site and change the heading to your name.' }),
        lesson('hs-3', 'Headings, paragraphs & links', 10,
          '<p>Use <code>&lt;h1&gt;</code> to <code>&lt;h6&gt;</code> for headings, <code>&lt;p&gt;</code> for paragraphs, <code>&lt;a href="..."&gt;</code> for links.</p>',
          { tryIt: 'Add a link to kiteline.uk/academy in your Code Lab page.' }),
        lesson('hs-4', 'Lists and images', 10,
          '<p><code>&lt;ul&gt;</code> and <code>&lt;ol&gt;</code> for lists. <code>&lt;img src="..." alt="..."&gt;</code> for images. Always use <b>alt</b> text for accessibility.</p>'),
        lesson('hs-5', 'Ask AI to help you learn HTML', 8,
          '<p>Paste your Code Lab HTML into ChatGPT and ask: “Explain each line and suggest one improvement for a beginner portfolio page.”</p>',
          { tools: ['chatgpt'], tryIt: 'Do the exercise above, then implement one suggested improvement in Code Lab.' }),
      ],
    },

    'prompt-engineering': {
      id: 'prompt-engineering',
      title: 'Prompt Engineering — Beginner',
      track: 'beginner',
      tier: 'paid',
      icon: '✨',
      duration: '4 weeks',
      lessonCount: 12,
      desc: 'Master prompts for business, coding, content and automation. Enrol via Starter or Pro plan.',
      outcomes: ['Advanced CLEAR and chain-of-thought prompts', 'Business and coding workflows', 'Build a personal prompt library'],
      lessons: [
        lesson('pe-1', 'Welcome — unlock with enrolment', 5,
          '<p>This course opens when you enrol in <b>Starter</b> or <b>Pro Student</b>. Email <a href="mailto:contact@kiteline.uk">contact@kiteline.uk</a> or use checkout when available.</p><p>Complete <b>AI World — Free Starter</b> first for the best foundation.</p>'),
      ],
    },
  };

  const FREE_COURSE_IDS = ['ai-world-starter', 'html-starter'];

  function getCourse(id) {
    return KA_COURSES[id] || null;
  }

  function listCourses(filter) {
    return Object.values(KA_COURSES).filter(function (c) {
      if (!filter) return true;
      if (filter.track && c.track !== filter.track) return false;
      if (filter.tier && c.tier !== filter.tier) return false;
      return true;
    });
  }

  function lessonAccess(course, lessonIndex, userEnrollments, isPaidUser) {
    const c = typeof course === 'string' ? getCourse(course) : course;
    if (!c) return false;
    if (c.tier === 'free') return true;
    if (isPaidUser) return true;
    if (userEnrollments && userEnrollments.indexOf(c.title) >= 0) return true;
    if (userEnrollments && userEnrollments.indexOf(c.id) >= 0) return true;
    return lessonIndex === 0;
  }

  global.KA_CURRICULUM = {
    TRACKS: KA_TRACKS,
    AI_TOOLS: KA_AI_TOOLS,
    SOURCES: KA_SOURCES,
    COURSES: KA_COURSES,
    FREE_COURSE_IDS: FREE_COURSE_IDS,
    getCourse: getCourse,
    listCourses: listCourses,
    lessonAccess: lessonAccess,
  };
})(typeof window !== 'undefined' ? window : global);
