(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const E = window.TypeEngine;

  const ICONS = {
    alert: '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17h.01"/></svg>',
    bug: '<svg viewBox="0 0 24 24"><path d="M8 9h8v7a4 4 0 0 1-8 0zM9 5l1.5 2M15 5l-1.5 2M4 12h4M16 12h4M5 18l3-2M19 18l-3-2"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM4 4l16 16"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
    pct: '<svg viewBox="0 0 24 24"><path d="M19 5L5 19M7 8h.01M17 16h.01"/></svg>',
    kb: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M21 6H9l-6 6 6 6h12zM12 9l5 6M17 9l-5 6"/></svg>',
    words: '<svg viewBox="0 0 24 24"><path d="M4 6h16M12 6v13M8 19h8"/></svg>',
    gauge: '<svg viewBox="0 0 24 24"><path d="M12 14l4-4M3.5 16a9 9 0 1 1 17 0"/></svg>',
    target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };

  const state = { minutes: 10, source: '', words: [], started: false, finished: false,
    startTs: 0, endAt: 0, timer: null, keystrokes: 0, backspaces: 0, curIdx: 0 };

  const screens = ['setup', 'test', 'result'];
  function show(name) {
    screens.forEach((s) => $(s).classList.toggle('active', s === name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- setup ---------- */
  const src = $('source');
  try { src.value = localStorage.getItem('tf_text') || ''; } catch (e) {}
  function updInfo() { $('srcInfo').textContent = E.tokenize(src.value).length + ' words'; }
  src.addEventListener('input', updInfo); updInfo();
  $('clearBtn').onclick = () => { src.value = ''; updInfo(); src.focus(); };
  $('durations').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    b.classList.add('active'); state.minutes = +b.dataset.min;
  });
  $('startBtn').onclick = () => {
    const words = E.tokenize(src.value);
    if (words.length < 10) { const m = $('setupErr'); m.textContent = 'Please paste a longer paragraph (at least 10 words).'; m.hidden = false; return; }
    $('setupErr').hidden = true;
    try { localStorage.setItem('tf_text', src.value); } catch (e) {}
    startTest(words);
  };

  /* ---------- test ---------- */
  const typing = $('typing');
  function startTest(words) {
    Object.assign(state, { words: words, started: false, finished: false, keystrokes: 0, backspaces: 0, curIdx: 0, startTs: 0 });
    clearInterval(state.timer);
    $('ref').innerHTML = words.map((w, i) => '<span class="w" id="w' + i + '">' + esc(w) + '</span> ').join('');
    typing.value = ''; typing.disabled = false;
    $('timeLeft').textContent = fmt(state.minutes * 60);
    ['liveWpm', 'liveWords', 'liveBs'].forEach((id) => ($(id).textContent = '0'));
    $('bar').style.width = '0%';
    $('ref').scrollTop = 0;
    paint();
    show('test');
    setTimeout(() => typing.focus(), 200);
  }

  function beginClock() {
    state.started = true; state.startTs = Date.now(); state.endAt = state.startTs + state.minutes * 60000;
    state.timer = setInterval(tick, 250);
  }
  function tick() {
    const now = Date.now(), left = Math.max(0, state.endAt - now), elapsed = (now - state.startTs) / 1000;
    $('timeLeft').textContent = fmt(Math.ceil(left / 1000));
    $('bar').style.width = Math.min(100, (elapsed / (state.minutes * 60)) * 100) + '%';
    $('liveWpm').textContent = Math.round(state.keystrokes / 5 / Math.max(elapsed / 60, 1 / 60));
    $('liveWords').textContent = (state.keystrokes / 5).toFixed(0);
    if (left <= 0) finish(true);
  }

  // block paste / cut / drop so the test stays honest
  ['paste', 'cut', 'drop', 'copy'].forEach((ev) => typing.addEventListener(ev, (e) => e.preventDefault()));
  typing.addEventListener('keydown', (e) => {
    if (state.finished) return;
    if (!state.started && (e.key.length === 1 || e.key === 'Backspace')) beginClock();
    if (e.key === 'Backspace') { state.backspaces++; $('liveBs').textContent = state.backspaces; }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) state.keystrokes++;
  });
  typing.addEventListener('input', () => { paint(); autoComplete(); });

  function paint() {
    const typed = typing.value;
    const parts = typed.split(/\s+/);
    const endsSpace = /\s$/.test(typed);
    const doneCount = endsSpace ? parts.length - 1 : parts.length - 1; // completed words
    state.curIdx = doneCount;
    for (let i = 0; i < state.words.length; i++) {
      const el = $('w' + i); if (!el) continue;
      let cls = 'w';
      if (i < doneCount) cls += parts[i] === state.words[i] ? ' ok' : ' bad';
      else if (i === doneCount) cls += ' cur';
      el.className = cls;
    }
    const cur = $('w' + doneCount);
    if (cur) {
      const box = $('ref'), top = cur.offsetTop - box.offsetTop;
      if (top > box.scrollTop + box.clientHeight - 60 || top < box.scrollTop) box.scrollTop = Math.max(0, top - 60);
    }
  }
  function autoComplete() {
    const t = E.tokenize(typing.value);
    if (t.length >= state.words.length && t[state.words.length - 1].length >= state.words[state.words.length - 1].length) finish(false);
  }
  $('finishBtn').onclick = () => { if (!state.started) { show('setup'); return; } finish(false); };

  /* ---------- finish + result ---------- */
  function finish(timeUp) {
    if (state.finished) return;
    state.finished = true; clearInterval(state.timer); typing.disabled = true;
    const secs = timeUp ? state.minutes * 60 : Math.max(1, Math.round((Date.now() - state.startTs) / 1000));
    const typedWords = E.tokenize(typing.value);
    const d = E.diff(state.words, typedWords);
    const m = E.metrics(state.keystrokes, state.backspaces, d.errors, secs);
    renderResult(m, d);
    show('result');
  }

  function card(i, cls, icon, title, value, desc) {
    return '<div class="stat" style="animation-delay:' + i * 40 + 'ms"><div class="t"><span class="ico ' + cls + '">' + ICONS[icon] +
      '</span>' + title + '</div><div class="n">' + value + '</div><div class="d">' + desc + '</div></div>';
  }
  function renderResult(m, d) {
    const f2 = (n) => n.toFixed(2), f1 = (n) => n.toFixed(1);
    $('grid').innerHTML = [
      card(0, 'c-red', 'alert', 'Full Errors', m.fullErrors, 'Additions, omissions, substitutions, spelling, repetitions, incomplete words'),
      card(1, 'c-pur', 'bug', 'Total Errors', m.totalErrors, 'Full Errors'),
      card(2, 'c-gray', 'eye', 'Ignorable Errors', f2(m.ignorable), '5% of (Total Keystrokes Typed / 5)'),
      card(3, 'c-red', 'minus', 'Penalty', f1(m.penalty), '(Total Errors - Ignorable Errors) × 10'),
      card(4, 'c-red', 'pct', 'Error Percentage', f2(m.errorPct) + '%', 'Total Errors / Total Words Typed × 100'),
      card(5, 'c-blue', 'kb', 'Keystrokes Typed', m.keystrokes, 'Letters, numbers, punctuation, spaces'),
      card(6, 'c-blue', 'back', 'Backspace Pressed', m.backspaces, 'Number of backspace key presses'),
      card(7, 'c-blue', 'words', 'Words Typed', f1(m.wordsTyped), 'Total Keystrokes Typed / 5'),
      card(8, 'c-blue', 'gauge', 'Gross WPM', f2(m.grossWpm) + ' WPM', '(Keystrokes Typed / 5) / Time (min)'),
      card(9, 'c-blue', 'gauge', 'Net WPM', f2(m.netWpm) + ' WPM', '((Keystrokes/5 - Penalty) / Time (min)'),
      card(10, 'c-blue', 'target', 'Accuracy', f2(m.accuracy) + '%', '(Net WPM / Gross WPM) × 100'),
      card(11, 'c-blue', 'clock', 'Test Duration', fmt(m.seconds), 'Time taken for the test')
    ].join('');

    const label = { sub: 'Wrong / spelling', omit: 'Omitted', add: 'Added / repeated' };
    let html = '', rows = '', n = 0;
    d.ops.forEach((o) => {
      if (o.type === 'ok') html += '<span class="w">' + esc(o.ref) + '</span> ';
      else if (o.type === 'sub') { html += '<span class="w sub" title="expected: ' + esc(o.ref) + '">' + esc(o.typed) + '</span> ';
        rows += '<tr><td>' + ++n + '</td><td>' + label.sub + '</td><td>' + esc(o.ref) + '</td><td>' + esc(o.typed) + '</td></tr>'; }
      else if (o.type === 'omit') { html += '<span class="w omit">' + esc(o.ref) + '</span> ';
        rows += '<tr><td>' + ++n + '</td><td>' + label.omit + '</td><td>' + esc(o.ref) + '</td><td class="empty">—</td></tr>'; }
      else { html += '<span class="w add">' + esc(o.typed) + '</span> ';
        rows += '<tr><td>' + ++n + '</td><td>' + label.add + '</td><td class="empty">—</td><td>' + esc(o.typed) + '</td></tr>'; }
    });
    $('diffView').innerHTML = html || 'Nothing typed.';
    $('errTable').querySelector('tbody').innerHTML = rows || '<tr><td colspan="4">🎉 No errors — perfect run!</td></tr>';
  }

  $('retryBtn').onclick = () => startTest(state.words);
  $('newBtn').onclick = () => show('setup');
})();
