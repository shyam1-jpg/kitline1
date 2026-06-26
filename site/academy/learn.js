/* Kiteline Academy - learning module (hub, player, progress) */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'ka_progress';
  const API = '/api/academy';
  const CERT_COURSE_ID = 'ai-world-starter';

  let progress = { courses: {} };
  let enrolledIds = ['ai-world-starter', 'html-starter', 'css-starter', 'js-starter', 'python-starter'];
  let player = { courseId: null, lessonIndex: 0 };
  function isLearnPage() {
    return !!(global.document && global.document.body && global.document.body.classList.contains('learn-page'));
  }

  function wrapHtmlDoc(code) {
    const t = (code || '').trim();
    if (!t) return '<!DOCTYPE html><html><body></body></html>';
    if (/^\s*<!DOCTYPE/i.test(t) || /^\s*<html/i.test(t)) return t;
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + t + '</body></html>';
  }

  function mountCodeEditor(lesson) {
    const lpTryIt = $('lpTryIt');
    if (!lpTryIt) return;
    const ed = lesson.editor;
    if (!ed || !ed.starter) {
      if (lesson.tryIt) {
        lpTryIt.style.display = 'block';
        lpTryIt.innerHTML = '<h4>Try it</h4><p>' + lesson.tryIt + '</p>';
      } else {
        lpTryIt.style.display = 'none';
        lpTryIt.innerHTML = '';
      }
      return;
    }
    const lang = ed.lang || 'html';
    lpTryIt.style.display = 'block';
    lpTryIt.innerHTML = '<div class="lp-editor-wrap"><h4>Try it Yourself</h4>' +
      (lesson.tryIt ? '<p class="lp-try-desc">' + lesson.tryIt + '</p>' : '') +
      '<div class="lp-editor-grid">' +
      '<div class="lp-editor-pane"><label for="lpCodeInput">Code</label><textarea id="lpCodeInput" spellcheck="false"></textarea></div>' +
      (lang === 'html'
        ? '<div class="lp-editor-pane"><label>Result</label><iframe id="lpCodeFrame" title="Preview" sandbox="allow-scripts allow-same-origin"></iframe></div>'
        : '<div class="lp-editor-pane"><label>Output</label><pre id="lpCodeOut" class="lp-code-out"></pre></div>') +
      '</div><div class="lp-editor-actions"><button type="button" class="btn" id="lpRunCode">Run code</button>' +
      '<button type="button" class="btn secondary" id="lpResetCode">Reset</button></div></div>';
    const input = $('lpCodeInput');
    if (input) input.value = ed.starter;
    function run() {
      const code = input ? input.value : '';
      if (lang === 'html') {
        const frame = $('lpCodeFrame');
        if (frame) frame.srcdoc = wrapHtmlDoc(code);
      } else {
        const out = $('lpCodeOut');
        if (out) out.textContent = 'Copy this into python.org/shell or your local Python:\n\n' + code;
      }
    }
    const runBtn = $('lpRunCode');
    const resetBtn = $('lpResetCode');
    if (runBtn) runBtn.onclick = run;
    if (resetBtn) resetBtn.onclick = function () { if (input) input.value = ed.starter; run(); };
    run();
  }

  function mountExercise(lesson) {
    const box = $('lpExercise');
    if (!box) return;
    if (lesson.exercise) {
      box.style.display = 'block';
      box.innerHTML = '<h4>Exercise</h4><p>' + lesson.exercise + '</p>';
    } else {
      box.style.display = 'none';
      box.innerHTML = '';
    }
  }


  function $(id) {
    return global.document && global.document.getElementById(id);
  }

  function curriculum() {
    return global.KA_CURRICULUM || null;
  }

  function toast(msg) {
    if (typeof global.toast === 'function') global.toast(msg);
  }

  function signedIn() {
    return typeof global.isSignedIn === 'function' && global.isSignedIn();
  }

  function user() {
    return typeof global.getUser === 'function' ? global.getUser() : null;
  }

  function enrollments() {
    return global.serverEnrollments || [];
  }

  function isPaidUser() {
    if (typeof global.isPaidUser === 'function') return global.isPaidUser();
    return enrollments().length > 0;
  }

  function normalizeProgress(raw) {
    const out = { courses: {} };
    if (!raw || typeof raw !== 'object') return out;
    const courses = raw.courses || raw;
    if (courses && typeof courses === 'object') {
      Object.keys(courses).forEach(function (cid) {
        const cp = courses[cid] || {};
        out.courses[cid] = {
          completed: Array.isArray(cp.completed) ? cp.completed.slice() : [],
          quizScores: cp.quizScores && typeof cp.quizScores === 'object' ? Object.assign({}, cp.quizScores) : {},
        };
      });
    }
    return out;
  }

  function mergeProgress(a, b) {
    const merged = normalizeProgress(a);
    const add = normalizeProgress(b);
    Object.keys(add.courses).forEach(function (cid) {
      const dst = merged.courses[cid] || { completed: [], quizScores: {} };
      const src = add.courses[cid];
      src.completed.forEach(function (lid) {
        if (dst.completed.indexOf(lid) < 0) dst.completed.push(lid);
      });
      Object.assign(dst.quizScores, src.quizScores);
      merged.courses[cid] = dst;
    });
    return merged;
  }

  function courseProgress(courseId) {
    if (!progress.courses[courseId]) {
      progress.courses[courseId] = { completed: [], quizScores: {} };
    }
    return progress.courses[courseId];
  }

  function getCourse(courseId) {
    const CC = curriculum();
    return CC && CC.getCourse ? CC.getCourse(courseId) : null;
  }

  function lessonIndexById(course, lessonId) {
    if (!course || !course.lessons || !lessonId) return -1;
    for (let i = 0; i < course.lessons.length; i++) {
      if (course.lessons[i].id === lessonId) return i;
    }
    return -1;
  }

  function canAccessLesson(courseId, lessonIndex) {
    const CC = curriculum();
    const course = getCourse(courseId);
    if (!course) return false;
    if (CC && CC.FREE_COURSE_IDS && CC.FREE_COURSE_IDS.indexOf(courseId) >= 0) return true;
    if (course.tier === 'free') return true;
    if (CC && CC.lessonAccess) {
      return CC.lessonAccess(course, lessonIndex, enrollments(), isPaidUser());
    }
    return lessonIndex === 0;
  }

  function completedCount(courseId) {
    const course = getCourse(courseId);
    if (!course || !course.lessons) return 0;
    const cp = courseProgress(courseId);
    return course.lessons.filter(function (l) {
      return cp.completed.indexOf(l.id) >= 0;
    }).length;
  }

  function percentComplete(courseId) {
    const course = getCourse(courseId);
    if (!course || !course.lessons || !course.lessons.length) return 0;
    return Math.round((completedCount(courseId) / course.lessons.length) * 100);
  }

  function persistLocal() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) { /* ignore */ }
  }

  function loadLocal() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) progress = mergeProgress(progress, JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }

  async function saveProgress(courseId) {
    persistLocal();
    if (!signedIn() || !courseId) return;
    const course = getCourse(courseId);
    if (!course) return;
    const cp = courseProgress(courseId);
    try {
      const r = await fetch(API + '/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          courseId: courseId,
          lessonId: course.lessons[player.lessonIndex] ? course.lessons[player.lessonIndex].id : '',
          completed: cp.completed,
          quizScores: cp.quizScores,
        }),
      });
      const data = await r.json().catch(function () { return {}; });
      if (r.ok && data.progress) {
        progress = mergeProgress(progress, data.progress);
        persistLocal();
        if (data.enrolled) enrolledIds = data.enrolled;
      }
    } catch (e) { /* offline */ }
  }

  async function loadProgress() {
    loadLocal();
    if (!signedIn()) {
      persistLocal();
      return progress;
    }
    try {
      const r = await fetch(API + '/progress', { method: 'GET', credentials: 'include' });
      const data = await r.json().catch(function () { return {}; });
      if (r.ok) {
        if (data.progress) progress = mergeProgress(progress, data.progress);
        if (data.enrolled) enrolledIds = data.enrolled;
        persistLocal();
      }
    } catch (e) { /* offline */ }
    return progress;
  }

  function toolById(id) {
    const CC = curriculum();
    if (!CC || !CC.AI_TOOLS) return null;
    for (let i = 0; i < CC.AI_TOOLS.length; i++) {
      if (CC.AI_TOOLS[i].id === id) return CC.AI_TOOLS[i];
    }
    return null;
  }

  function quizQuestions(lesson) {
    if (!lesson || !lesson.quiz) return [];
    if (Array.isArray(lesson.quiz)) return lesson.quiz;
    if (lesson.quiz.questions && Array.isArray(lesson.quiz.questions)) return lesson.quiz.questions;
    return [];
  }

  function setLessonHash(courseId, lesson) {
    if (!global.location || !lesson) return;
    try {
      global.location.hash = 'learn/' + courseId + '/' + lesson.id;
    } catch (e) { /* ignore */ }
  }

  function renderLessonNotFound(message) {
    const modal = $('lessonPlayer');
    if (modal) modal.classList.add('open');
    if (global.document && global.document.body) global.document.body.style.overflow = 'hidden';
    const lpTitle = $('lpTitle');
    const lpMeta = $('lpMeta');
    const lpBody = $('lpBody');
    const lpTryIt = $('lpTryIt');
    const lpSources = $('lpSources');
    const lpQuiz = $('lpQuiz');
    if (lpTitle) lpTitle.textContent = 'Kiteline Academy';
    if (lpMeta) lpMeta.textContent = '';
    if (lpBody) {
      lpBody.innerHTML = '<h3 class="lp-lesson-heading">' + (message || 'Lesson not found') + '</h3>' +
        '<p>The course or lesson could not be loaded. Return to the <a href="#learn-hub">Learning Hub</a>.</p>';
    }
    if (lpTryIt) { lpTryIt.style.display = 'none'; lpTryIt.innerHTML = ''; }
    if (lpSources) { lpSources.style.display = 'none'; lpSources.innerHTML = ''; }
    if (lpQuiz) { lpQuiz.style.display = 'none'; lpQuiz.innerHTML = ''; }
    const sidebar = $('lpSidebar');
    if (sidebar) sidebar.innerHTML = '';
  }

  function renderLessonPlayer() {
    const course = getCourse(player.courseId);
    if (!course) {
      renderLessonNotFound('Lesson not found');
      return;
    }
    const idx = player.lessonIndex;
    const lesson = course.lessons[idx];
    if (!lesson) {
      renderLessonNotFound('Lesson not found');
      return;
    }

    const lpTitle = $('lpTitle');
    const lpMeta = $('lpMeta');
    const lpBody = $('lpBody');
    const lpTryIt = $('lpTryIt');
    const lpSources = $('lpSources');
    const lpQuiz = $('lpQuiz');
    const lpPrev = $('lpPrev');
    const lpNext = $('lpNext');
    const lpComplete = $('lpComplete');

    if (lpTitle) lpTitle.textContent = course.title;
    if (lpMeta) {
      const teacher = course.teacher ? ' · ' + course.teacher : '';
      lpMeta.textContent = 'Lesson ' + (idx + 1) + ' of ' + course.lessons.length + ' · ' + (lesson.duration || '') + (lesson.type ? ' · ' + lesson.type : '') + teacher;
    }
    if (lpBody) {
      let html = '<h3 class="lp-lesson-heading">' + lesson.title + '</h3>';
      if (lesson.objective) {
        html += '<div class="lp-objective"><h4>Objective</h4><p>' + lesson.objective + '</p></div>';
      }
      html += lesson.content || '';
      lpBody.innerHTML = html;
    }

    mountCodeEditor(lesson);
    mountExercise(lesson);

    if (lpSources) {
      const tools = lesson.tools || [];
      const sources = lesson.sources || [];
      if (tools.length || sources.length) {
        lpSources.style.display = 'block';
        let html = '<h4>Tools & sources</h4>';
        if (tools.length) {
          html += '<div class="lp-tools">';
          tools.forEach(function (tid) {
            const t = toolById(tid);
            if (t) {
              html += '<a class="lp-tool-chip" href="' + t.url + '" target="_blank" rel="noopener">' + t.name + '</a>';
            } else {
              html += '<span class="lp-tool-chip">' + tid + '</span>';
            }
          });
          html += '</div>';
        }
        if (sources.length) {
          html += '<ul class="lp-src-list">';
          sources.forEach(function (s) {
            if (!s) return;
            const title = s.title || s.name || 'Source';
            const url = s.url || '#';
            html += '<li><a href="' + url + '" target="_blank" rel="noopener">' + title + '</a>' + (s.desc ? ' — ' + s.desc : '') + '</li>';
          });
          html += '</ul>';
        }
        lpSources.innerHTML = html;
      } else {
        lpSources.style.display = 'none';
        lpSources.innerHTML = '';
      }
    }

    const questions = quizQuestions(lesson);
    if (lpQuiz) {
      if (questions.length) {
        lpQuiz.style.display = 'block';
        let qhtml = '<h4>Quick quiz</h4>';
        questions.forEach(function (q, qi) {
          qhtml += '<div class="lp-quiz-q" data-q="' + qi + '"><b>' + (qi + 1) + '. ' + q.q + '</b>';
          (q.options || []).forEach(function (opt, oi) {
            qhtml += '<label class="lp-quiz-opt"><input type="radio" name="lpq' + qi + '" value="' + oi + '"> ' + opt + '</label>';
          });
          qhtml += '</div>';
        });
        qhtml += '<button type="button" class="btn secondary" id="lpQuizSubmit">Check answers</button>';
        lpQuiz.innerHTML = qhtml;
        const submit = $('lpQuizSubmit');
        if (submit) {
          submit.onclick = function () {
            let correct = 0;
            questions.forEach(function (q, qi) {
              const picked = lpQuiz.querySelector('input[name="lpq' + qi + '"]:checked');
              if (picked && Number(picked.value) === q.correct) correct++;
            });
            const total = questions.length;
            const cp = courseProgress(player.courseId);
            cp.quizScores[lesson.id] = { correct: correct, total: total, at: new Date().toISOString() };
            saveProgress(player.courseId);
            toast('Quiz: ' + correct + '/' + total + ' correct');
          };
        }
      } else {
        lpQuiz.style.display = 'none';
        lpQuiz.innerHTML = '';
      }
    }

    // Downloads panel — show PDFs for html-css-full course
    var lpDownloads = $('lpDownloads');
    if (lpDownloads) {
      if (course.id === 'html-css-full') {
        var lessonNum = String(idx + 1).padStart(2, '0');
        var lessonSlug = lesson.id + '-' + lesson.title.replace(/[^a-zA-Z0-9]+/g, '-');
        var lessonPdf = 'downloads/Lesson-' + lessonNum + '-' + lessonSlug + '.pdf';
        var dlHtml = '<h4>&#8595; Downloads</h4>'
          + '<div class="lp-downloads">'
          + '<a class="lp-dl-btn" href="' + lessonPdf + '" download>&#128196; This lesson PDF</a>'
          + '<a class="lp-dl-btn" href="downloads/HTML-CSS-Worksheets.pdf" download>&#9999; Worksheets (all lessons)</a>'
          + '<a class="lp-dl-btn" href="downloads/HTML-CSS-Cheat-Sheet.pdf" download>&#128203; HTML &amp; CSS cheat sheet</a>'
          + '</div>';
        lpDownloads.style.display = 'block';
        lpDownloads.innerHTML = dlHtml;
      } else {
        lpDownloads.style.display = 'none';
        lpDownloads.innerHTML = '';
      }
    }

    renderPlayerSidebar();
    const scrollEl = $('lpScroll') || (global.document && global.document.querySelector('.lp-scroll'));
    if (scrollEl) scrollEl.scrollTop = 0;

    const done = courseProgress(player.courseId).completed.indexOf(lesson.id) >= 0;
    if (lpComplete) lpComplete.textContent = done ? 'Completed ✓' : 'Mark complete';
    if (lpPrev) lpPrev.disabled = idx <= 0;
    if (lpNext) lpNext.disabled = idx >= course.lessons.length - 1;
  }

  function renderPlayerSidebar() {
    const sidebar = $('lpSidebar');
    const course = getCourse(player.courseId);
    if (!sidebar || !course) return;
    let html = '<h3>Lessons</h3>';
    course.lessons.forEach(function (lesson, i) {
      const access = canAccessLesson(player.courseId, i);
      const done = courseProgress(player.courseId).completed.indexOf(lesson.id) >= 0;
      let cls = 'lp-lesson';
      if (i === player.lessonIndex) cls += ' active';
      if (done) cls += ' done';
      if (!access) cls += ' locked';
      const mark = done ? '✓' : i + 1;
      html += '<button type="button" class="' + cls + '" data-idx="' + i + '"' + (access ? '' : ' disabled') + '><span class="lp-num">' + mark + '</span><span>' + lesson.title + '</span></button>';
    });
    sidebar.innerHTML = html;
    sidebar.querySelectorAll('.lp-lesson[data-idx]').forEach(function (btn) {
      btn.onclick = function () {
        const i = Number(btn.getAttribute('data-idx'));
        goToLesson(i);
      };
    });
  }

  function goToLesson(index) {
    const course = getCourse(player.courseId);
    if (!course) return;
    if (index < 0 || index >= course.lessons.length) return;
    if (!canAccessLesson(player.courseId, index)) {
      toast('This module preview only — lesson 1 is available. Full chapters are on free starter courses.');
      /* learn flow: no checkout prompts */
      return;
    }
    player.lessonIndex = index;
    setLessonHash(player.courseId, course.lessons[index]);
    renderLessonPlayer();
  }

  function openLessonPlayer(courseId, lessonIndex) {
    const course = getCourse(courseId);
    if (!course) {
      player.courseId = courseId;
      renderLessonNotFound('Lesson not found');
      return;
    }
    const idx = typeof lessonIndex === 'number' ? lessonIndex : 0;
    if (!canAccessLesson(courseId, idx)) {
      toast('This module preview only — lesson 1 is available. Full chapters are on free starter courses.');
      /* learn flow: no checkout prompts */
      return;
    }
    if (!isLearnPage()) {
      const lesson = course.lessons[idx];
      const lid = lesson && lesson.id ? lesson.id : idx;
      global.location.href = 'learn.html#learn/' + courseId + '/' + lid;
      return;
    }
    player.courseId = courseId;
    player.lessonIndex = idx;
    renderLessonPlayer();
    setLessonHash(courseId, course.lessons[idx]);
  }

  function closeLessonPlayer() {
    if (isLearnPage()) {
      global.location.href = 'index.html#learn-hub';
      return;
    }
    const modal = $('lessonPlayer');
    if (modal) modal.classList.remove('open');
    if (global.document && global.document.body) global.document.body.style.overflow = '';
    player.courseId = null;
    const hash = (global.location && global.location.hash) || '';
    if (hash.indexOf('lesson/') === 1 || hash.indexOf('learn/') === 1) {
      try {
        global.history.replaceState(null, '', global.location.pathname + global.location.search + '#learn-hub');
      } catch (e) { /* ignore */ }
    }
  }

  function renderLearnHub() {
    const CC = curriculum();
    if (!CC) return;

    const tracksEl = $('learnTracks');
    if (tracksEl && CC.TRACKS) {
      tracksEl.innerHTML = Object.keys(CC.TRACKS).map(function (key) {
        const t = CC.TRACKS[key];
        return '<div class="learn-track-card" style="--track-color:' + (t.color || '#36e6ff') + '"><div class="learn-track-badge">' + (t.badge || key) + '</div><h3>' + t.title + '</h3><p>' + t.desc + '</p></div>';
      }).join('');
    }

    const cardsEl = $('learnCourseCards');
    if (cardsEl && CC.listCourses) {
      const courses = CC.listCourses();
      cardsEl.innerHTML = courses.map(function (c) {
        const pct = percentComplete(c.id);
        const free = CC.FREE_COURSE_IDS && CC.FREE_COURSE_IDS.indexOf(c.id) >= 0;
        return '<article class="card learn-course-card"><div class="learn-course-icon">' + (c.icon || '📘') + '</div><h3>' + c.title + '</h3><p style="color:var(--muted);font-size:14px;line-height:1.55">' + (c.desc || '') + '</p><p class="learn-progress-text">' + completedCount(c.id) + '/' + (c.lessons ? c.lessons.length : c.lessonCount || 0) + ' lessons · ' + pct + '%</p><div class="learn-progress-bar"><span style="width:' + pct + '%"></span></div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" data-open-course="' + c.id + '">' + (free ? 'Start free' : 'Open course') + '</button></div></article>';
      }).join('');
      cardsEl.querySelectorAll('[data-open-course]').forEach(function (btn) {
        btn.onclick = function () {
          openLessonPlayer(btn.getAttribute('data-open-course'), 0);
        };
      });
    }

    const toolsEl = $('aiToolsGrid');
    if (toolsEl && CC.AI_TOOLS) {
      toolsEl.innerHTML = CC.AI_TOOLS.map(function (t) {
        return '<div class="ai-tool-card"><div class="ai-tool-head"><b>' + t.name + '</b><span>' + (t.maker || '') + ' · ' + (t.tier || 'free') + '</span></div><p class="ai-tool-for"><b>Best for:</b> ' + (t.bestFor || '') + '</p><p class="ai-tool-how">' + (t.howItWorks || '') + '</p><p class="ai-tool-try"><b>Try:</b> ' + (t.tryPrompt || '') + '</p><a class="btn secondary ai-tool-link" href="' + (t.url || '#') + '" target="_blank" rel="noopener">Open ' + t.name + '</a></div>';
      }).join('');
    }

    const srcEl = $('learnSourcesList');
    if (srcEl && CC.SOURCES) {
      srcEl.innerHTML = CC.SOURCES.map(function (s) {
        return '<li><a href="' + s.url + '" target="_blank" rel="noopener">' + s.title + '</a>' + (s.desc ? ' — ' + s.desc : '') + '</li>';
      }).join('');
    }
  }

  function listEnrolledCourses() {
    const CC = curriculum();
    const ids = new Set();
    (CC && CC.FREE_COURSE_IDS ? CC.FREE_COURSE_IDS : ['ai-world-starter', 'html-starter']).forEach(function (id) { ids.add(id); });
    enrolledIds.forEach(function (id) { ids.add(id); });
    enrollments().forEach(function (title) {
      if (!CC || !CC.COURSES) return;
      Object.keys(CC.COURSES).forEach(function (cid) {
        const c = CC.COURSES[cid];
        if (c.title === title || cid === title) ids.add(cid);
      });
    });
    return Array.from(ids).map(getCourse).filter(Boolean);
  }

  function renderDashboardCourses() {
    const myEl = $('myCourses');
    const rowsEl = $('lessonRows');
    const u = user();
    const courses = listEnrolledCourses();
    let html = '';
    if (u && signedIn()) {
      html += '<div class="account-badge">Signed in as <b style="color:#fff">' + (u.name || u.email || 'Student') + '</b></div>';
    }
    if (courses.length) {
      html += courses.map(function (c) {
        const pct = percentComplete(c.id);
        return '<div class="row"><span>' + c.title + '<br><small>' + completedCount(c.id) + '/' + (c.lessons ? c.lessons.length : 0) + ' lessons · ' + pct + '%</small></span><button type="button" class="btn secondary" data-dash-open="' + c.id + '">Continue</button></div>';
      }).join('');
    } else {
      html += '<p style="color:var(--muted)">Pick a free starter course below — all lessons are ready to learn.</p>';
    }
    if (myEl) {
      myEl.innerHTML = html;
      myEl.querySelectorAll('[data-dash-open]').forEach(function (btn) {
        btn.onclick = function () { openLessonPlayer(btn.getAttribute('data-dash-open'), 0); };
      });
    }

    const focus = getCourse(CERT_COURSE_ID) || courses[0];
    if (rowsEl && focus && focus.lessons) {
      const cp = courseProgress(focus.id);
      rowsEl.innerHTML = focus.lessons.map(function (lesson, i) {
        const done = cp.completed.indexOf(lesson.id) >= 0;
        const access = canAccessLesson(focus.id, i);
        const action = done
          ? '✓'
          : (access
            ? '<button type="button" class="btn secondary" data-lesson-row="' + focus.id + '" data-lesson-idx="' + i + '">Open</button>'
            : '🔒');
        return '<div class="row"><span>' + (i + 1) + '. ' + lesson.title + '<br><small>' + (done ? 'Completed' : 'Not completed') + '</small></span>' + action + '</div>';
      }).join('');
      rowsEl.querySelectorAll('[data-lesson-row]').forEach(function (btn) {
        btn.onclick = function () {
          openLessonPlayer(btn.getAttribute('data-lesson-row'), Number(btn.getAttribute('data-lesson-idx')));
        };
      });
    }

    if (typeof global.renderStudent === 'function') {
      try { global.renderStudent(); } catch (e) { /* optional hook */ }
    }
    checkCertificate();
  }

  function checkCertificate() {
    const course = getCourse(CERT_COURSE_ID);
    const box = $('certBox');
    if (!course || !box) return;
    const total = course.lessons ? course.lessons.length : 10;
    const done = completedCount(CERT_COURSE_ID);
    const name = (user() && (user().name || user().firstName)) || (global.localStorage && global.localStorage.getItem('kit_name')) || 'Student';
    box.style.display = 'block';
    if (done >= total) {
      box.innerHTML = '<b>Certificate ready</b><br>' + name + ' — Kiteline Academy AI World Starter Certificate (' + done + '/' + total + ' lessons).';
    } else {
      box.innerHTML = 'Complete all ' + total + ' lessons in <b>AI World — Free Starter</b> to unlock your certificate. Progress: ' + done + '/' + total + '.';
    }
  }

  function openFreeLessonLegacy(key) {
    const map = { ai: 'ai-world-starter', html: 'html-starter', chatgpt: 'ai-world-starter', website: 'html-starter' };
    openLessonPlayer(map[key] || 'ai-world-starter', 0);
  }

  function handleHashRoute() {
    const hash = (global.location && global.location.hash) || '';

    const learnMatch = hash.match(/^#learn\/([^/]+)\/([^/]+)$/);
    if (learnMatch) {
      const courseId = learnMatch[1];
      const course = getCourse(courseId);
      if (!course) {
        renderLessonNotFound('Lesson not found');
        return;
      }
      const idx = lessonIndexById(course, learnMatch[2]);
      if (idx < 0) {
        renderLessonNotFound('Lesson not found');
        return;
      }
      player.courseId = courseId;
      player.lessonIndex = idx;
      if (!isLearnPage()) {
        global.location.href = 'learn.html' + (global.location.hash || '');
        return;
      }
      if (canAccessLesson(courseId, idx)) {
        renderLessonPlayer();
      } else {
        toast('This module preview only — lesson 1 is available. Full chapters are on free starter courses.');
        renderLessonPlayer();
      }
      return;
    }

    const legacyMatch = hash.match(/^#lesson\/([^/]+)\/(\d+)$/);
    if (legacyMatch) {
      openLessonPlayer(legacyMatch[1], Number(legacyMatch[2]));
      return;
    }

    if (hash === '#learn-hub' || hash === '#ai-tools') {
      renderLearnHub();
    }
  }

  function markCurrentComplete() {
    const course = getCourse(player.courseId);
    if (!course) return;
    const lesson = course.lessons[player.lessonIndex];
    if (!lesson) return;
    const cp = courseProgress(player.courseId);
    if (cp.completed.indexOf(lesson.id) < 0) cp.completed.push(lesson.id);
    saveProgress(player.courseId);
    toast('Lesson marked complete');
    renderLessonPlayer();
    renderLearnHub();
    if (player.courseId === CERT_COURSE_ID) checkCertificate();
  }

  function init() {
    loadLocal();
    const lpPrev = $('lpPrev');
    const lpNext = $('lpNext');
    const lpComplete = $('lpComplete');
    if (lpPrev) lpPrev.onclick = function () { goToLesson(player.lessonIndex - 1); };
    if (lpNext) lpNext.onclick = function () { goToLesson(player.lessonIndex + 1); };
    if (lpComplete) lpComplete.onclick = markCurrentComplete;
    if (global.addEventListener) {
      global.addEventListener('hashchange', handleHashRoute);
    }
    handleHashRoute();
  }

  function openLearnPage(courseId, lessonId) {
    const url = 'learn.html#learn/' + courseId + '/' + (lessonId || '');
    global.location.href = url;
  }

  global.KA_LEARN = {
    init: init,
    loadProgress: loadProgress,
    openLessonPlayer: openLessonPlayer,
    closeLessonPlayer: closeLessonPlayer,
    renderLearnHub: renderLearnHub,
    renderDashboardCourses: renderDashboardCourses,
    checkCertificate: checkCertificate,
    openFreeLessonLegacy: openFreeLessonLegacy,
    openLearnPage: openLearnPage,
    handleHashRoute: handleHashRoute,
    renderLessonPlayer: renderLessonPlayer,
    percentComplete: percentComplete,
    completedCount: completedCount,
    canAccessLesson: canAccessLesson,
  };
})(typeof window !== 'undefined' ? window : global);