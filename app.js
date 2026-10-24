/* Китайские карточки — Telegram Mini App.
 * Работает и в обычном браузере. Без сервера и без токена бота.
 */
(() => {
  'use strict';

  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.initData);

  const MAX_REPEATS = 3;      // сколько раз карточка может вернуться, если «не знаю»
  const SWIPE_THRESHOLD = 90; // пикселей, чтобы засчитать свайп
  const OPTIONS_COUNT = 4;    // вариантов ответа в тесте

  const $ = (id) => document.getElementById(id);

  // ---------- состояние ----------
  let deckId = '';
  let catalog = null;
  let section = null;
  let deckLoadToken = 0;
  let cardBusy = false;
  let answered = false;
  let deck = null;          // { title, words: [...] }
  let queue = [];           // индексы слов, которые ещё надо пройти
  let stats = [];           // по каждому слову: { misses, knownFirst, learned, failed }
  let current = -1;         // индекс текущего слова
  let flipped = false;
  let testItems = [];
  let testPos = 0;
  let testResults = [];     // { word, chosen, ok }

  // ---------- Telegram ----------
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); // чтобы свайп не закрывал приложение
      if (tg.setHeaderColor) tg.setHeaderColor('bg_color');
    } catch (e) { /* старый клиент */ }
  }

  function haptic(kind) {
    try {
      if (!tg || !tg.HapticFeedback) return;
      if (kind === 'ok' || kind === 'error') tg.HapticFeedback.notificationOccurred(kind === 'ok' ? 'success' : 'error');
      else tg.HapticFeedback.impactOccurred('light');
    } catch (e) { /* нет поддержки */ }
  }

  // ---------- утилиты ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const TONES = [
    ['āēīōūǖĀĒĪŌŪǕ', 1],
    ['áéíóúǘÁÉÍÓÚǗ', 2],
    ['ǎěǐǒǔǚǍĚǏǑǓǙ', 3],
    ['àèìòùǜÀÈÌÒÙǛ', 4],
  ];
  function toneOf(syllable) {
    for (const [marks, tone] of TONES) {
      for (const ch of syllable) if (marks.includes(ch)) return tone;
    }
    return 5;
  }
  // «nǐ hǎo» → каждый слог своим цветом тона
  function colorPinyin(pinyin) {
    return pinyin.split(/\s+/).map((s) => `<span class="t${toneOf(s)}">${escapeHtml(s)}</span>`).join(' ');
  }

  function fullSentence(word) {
    return word.sentence.replace('___', word.hanzi);
  }

  function show(screen) {
    ['start', 'sections', 'lessons', 'lesson', 'cards', 'test', 'result'].forEach((name) => {
      $('screen-' + name).classList.toggle('hidden', name !== screen);
    });
    stopAudio();
    window.scrollTo(0, 0);
  }

  // ---------- голос ----------
  // Основной источник — mp3 (их генерирует GitHub Actions). Встроенный синтез браузера
  // только запасной: в Telegram на Android он не работает.
  let currentAudio = null;
  function stopAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }
  function speakFallback(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch (e) { /* нет синтеза */ }
  }
  function play(src, text) {
    stopAudio();
    let fellBack = false;
    const fallback = () => { if (!fellBack && currentAudio === a) { fellBack = true; speakFallback(text); } };
    const a = new Audio(src);
    currentAudio = a;
    a.addEventListener('error', fallback, { once: true });
    const p = a.play();
    if (p && p.catch) p.catch(fallback);
  }
  const wordAudio = (w) => play(`audio/${deckId}/${w.id}.mp3`, w.audioText || w.hanzi);
  const sentenceAudio = (w) => play(`audio/${deckId}/${w.id}_s.mp3`, fullSentence(w));

  // ---------- загрузка колоды ----------
  function pickDeckId() {
    let id = '';
    try { id = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || ''; } catch (e) { /* */ }
    if (!id) id = new URLSearchParams(location.search).get('deck') || '';
    id = id.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return id;
  }

  function lessonLocation(id) {
    for (const group of catalog.sections) {
      const lesson = group.lessons.find((item) => item.id === id);
      if (lesson) return { group, lesson };
    }
    return null;
  }

  function renderSections() {
    const box = $('sections');
    box.replaceChildren();
    catalog.sections.forEach((group) => {
      const button = document.createElement('button');
      button.className = 'catalog-item';
      const ready = group.lessons.filter((lesson) => lesson.available).length;
      button.innerHTML = `<strong>${escapeHtml(group.title)}</strong><span>${escapeHtml(group.description)}</span><small>Доступно ${ready} из ${group.lessons.length} уроков →</small>`;
      button.addEventListener('click', () => openSection(group));
      box.appendChild(button);
    });
    show('sections');
  }

  function openSection(group) {
    section = group;
    $('section-title').textContent = group.title;
    const box = $('lessons');
    box.replaceChildren();
    group.lessons.forEach((lesson) => {
      const button = document.createElement('button');
      button.className = 'catalog-item lesson-item';
      button.disabled = !lesson.available;
      button.innerHTML = `<strong>${escapeHtml(lesson.title)}</strong><small>${lesson.available ? `${lesson.wordCount} слов · карточки и тест` : 'Скоро'}</small>`;
      button.addEventListener('click', () => loadDeck(lesson.id));
      box.appendChild(button);
    });
    show('lessons');
  }

  function returnToLessons() {
    ++deckLoadToken; // ignore a response from a lesson the user has already left
    openSection(section || catalog.sections[0]);
  }

  async function loadCatalog() {
    $('btn-start').disabled = true;
    $('catalog-status').textContent = 'Загрузка разделов…';
    $('btn-catalog-retry').classList.add('hidden');
    try {
      const res = await fetch('decks/catalog.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      catalog = await res.json();
      renderSections();
      show('start');
      $('catalog-status').textContent = 'HSK-3 · уроки 1–18';
      $('btn-start').disabled = false;
      const id = pickDeckId();
      if (id) await loadDeck(id);
    } catch (e) {
      show('start');
      $('catalog-status').textContent = 'Не удалось загрузить разделы. Проверьте соединение.';
      $('btn-catalog-retry').classList.remove('hidden');
    }
  }

  async function loadDeck(id) {
    const token = ++deckLoadToken;
    const selected = lessonLocation(id);
    deck = null;
    deckId = id;
    if (selected) section = selected.group;
    $('deck-title').textContent = selected ? `${selected.group.title} · ${selected.lesson.title}` : 'Урок не найден';
    $('deck-subtitle').textContent = selected ? selected.lesson.subtitle || '' : '';
    $('deck-info').textContent = 'Загрузка слов…';
    $('btn-begin').disabled = true;
    $('btn-deck-retry').classList.add('hidden');
    show('lesson');
    if (!selected || !selected.lesson.available) {
      $('deck-info').textContent = selected ? 'Этот урок ещё готовится. Выберите доступный урок.' : 'Такого урока нет. Вернитесь к выбору уроков.';
      return;
    }
    try {
      const res = await fetch(`decks/${id}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      const loaded = await res.json();
      if (!Array.isArray(loaded.words) || !loaded.words.length) throw new Error('Empty deck');
      if (token !== deckLoadToken) return;
      deck = loaded;
      $('deck-title').textContent = deck.title;
      $('deck-subtitle').textContent = deck.subtitle || '';
      $('deck-info').textContent = `${deck.words.length} слов · озвучка · тест в конце`;
      $('btn-begin').disabled = false;
    } catch (e) {
      if (token !== deckLoadToken) return;
      $('deck-info').textContent = 'Не удалось загрузить слова. Проверьте соединение и попробуйте снова.';
      $('btn-deck-retry').classList.remove('hidden');
    }
  }

  // ---------- карточки ----------
  function startCards() {
    if (!deck) return;
    cardBusy = false;
    $('cards-lesson-title').textContent = deck.title;
    queue = shuffle(deck.words.map((_, i) => i));
    stats = deck.words.map(() => ({ misses: 0, knownFirst: false, learned: false, failed: false }));
    show('cards');
    nextCard();
  }

  function updateProgress() {
    const total = deck.words.length;
    const done = total - queue.length;
    $('progress-fill').style.width = `${(done / total) * 100}%`;
    $('progress-text').textContent = `Пройдено ${done} из ${total}`;
  }

  function resetCardPosition(card) {
    card.classList.remove('animate');
    card.style.transform = '';
    card.style.opacity = '';
    setStamps(0);
  }

  function nextCard() {
    cardBusy = false;
    stopAudio();
    updateProgress();
    if (queue.length === 0) { startTest(); return; }
    current = queue[0];
    const w = deck.words[current];

    const card = $('card');
    // переворачиваем обратно без анимации, чтобы не мелькала обратная сторона
    const inner = card.querySelector('.card-inner');
    inner.style.transition = 'none';
    card.classList.remove('flipped');
    void inner.offsetWidth;
    inner.style.transition = '';
    flipped = false;
    resetCardPosition(card);

    $('front-hanzi').textContent = w.hanzi;
    $('back-hanzi').textContent = w.hanzi;
    $('back-pinyin').innerHTML = colorPinyin(w.pinyin);
    $('back-ru').textContent = w.ru;
    const notes = [w.audioNote, w.note].filter(Boolean).join(' ');
    $('audio-note').textContent = notes;
    $('audio-note').classList.toggle('hidden', !notes);
    $('back-ex-zh').innerHTML = escapeHtml(w.sentence).replace('___', `<b>${escapeHtml(w.hanzi)}</b>`);
    $('back-ex-py').textContent = w.sentencePinyin || '';
    $('back-ex-ru').textContent = w.sentenceRu || '';
    $('strokes').innerHTML = '';
    $('btn-strokes').classList.toggle('hidden', !window.HanziWriter);

    $('actions-front').classList.remove('hidden');
    $('actions-back').classList.add('hidden');
    card.querySelector('.face-front').classList.add('pop');
    setTimeout(() => card.querySelector('.face-front').classList.remove('pop'), 300);
  }

  function know() {
    if (cardBusy || flipped) return;
    cardBusy = true;
    const s = stats[current];
    if (s.misses > 0) s.learned = true; else s.knownFirst = true;
    haptic('ok');
    flyOut(1, () => { queue.shift(); nextCard(); });
  }

  function dontKnow() {
    if (cardBusy || flipped) return;
    stats[current].misses++;
    haptic('error');
    flipped = true;
    resetCardPosition($('card'));
    $('card').classList.add('flipped');
    $('actions-front').classList.add('hidden');
    $('actions-back').classList.remove('hidden');
    $('btn-next').textContent = stats[current].misses >= MAX_REPEATS ? 'Дальше' : 'Дальше — повторю позже';
    wordAudio(deck.words[current]);
  }

  function afterBack(dir) {
    if (cardBusy || !flipped) return;
    cardBusy = true;
    const s = stats[current];
    flyOut(dir || -1, () => {
      queue.shift();
      if (s.misses >= MAX_REPEATS) s.failed = true;
      else queue.push(current); // вернётся в конце колоды
      nextCard();
    });
  }

  function flyOut(dir, done) {
    const card = $('card');
    card.classList.add('animate');
    card.style.transform = `translateX(${dir * window.innerWidth}px) rotate(${dir * 25}deg)`;
    card.style.opacity = '0';
    setTimeout(done, 280);
  }

  function setStamps(dx) {
    const yes = document.querySelector('.stamp-yes');
    const no = document.querySelector('.stamp-no');
    if (flipped) { yes.style.opacity = 0; no.style.opacity = 0; return; }
    yes.style.opacity = Math.max(0, Math.min(1, dx / SWIPE_THRESHOLD));
    no.style.opacity = Math.max(0, Math.min(1, -dx / SWIPE_THRESHOLD));
  }

  function drawStrokes() {
    if (!window.HanziWriter) return;
    const box = $('strokes');
    box.innerHTML = '';
    const chars = [...deck.words[current].hanzi];
    const writers = chars.map((ch) => {
      const el = document.createElement('div');
      box.appendChild(el);
      return HanziWriter.create(el, ch, {
        width: 90, height: 90, padding: 6,
        strokeColor: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#222',
        radicalColor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c8372d',
        showOutline: true, strokeAnimationSpeed: 1.2, delayBetweenStrokes: 180,
        showCharacter: false,
      });
    });
    // анимируем иероглифы по очереди
    (async () => {
      for (const w of writers) {
        try { await w.animateCharacter(); } catch (e) { /* нет данных о чертах */ }
      }
    })();
  }

  // свайпы
  function setupSwipe() {
    const card = $('card');
    let startX = 0, startY = 0, dx = 0, dragging = false, moved = false;

    card.addEventListener('pointerdown', (e) => {
      if (cardBusy || e.target.closest('button')) return;
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY; dx = 0;
      card.classList.remove('animate');
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 6) moved = true;
      if (flipped && Math.abs(dy) > Math.abs(dx)) return; // на обороте можно прокручивать
      card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
      setStamps(dx);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        const dir = dx > 0 ? 1 : -1;
        if (flipped) afterBack(dir);
        else if (dir > 0) know();
        else { card.classList.add('animate'); dontKnow(); }
      } else {
        card.classList.add('animate');
        card.style.transform = '';
        setStamps(0);
      }
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }

  // ---------- тест ----------
  function startTest() {
    let pool = deck.words.filter((_, i) => stats[i].knownFirst || stats[i].learned);
    if (pool.length === 0) pool = deck.words.slice(); // ничего не выучено — тест по всем словам
    testItems = shuffle(pool);
    testPos = 0;
    testResults = [];
    show('test');
    renderQuestion();
  }

  function renderQuestion() {
    answered = false;
    const w = testItems[testPos];
    $('test-fill').style.width = `${(testPos / testItems.length) * 100}%`;
    $('test-text').textContent = `Вопрос ${testPos + 1} из ${testItems.length}`;

    const parts = w.sentence.split('___');
    $('q-sentence').innerHTML = escapeHtml(parts[0]) + '<span class="blank" id="blank">　</span>' + escapeHtml(parts[1] || '');
    $('q-extra').classList.add('hidden');
    $('q-py').textContent = w.sentencePinyin || '';
    $('q-ru').textContent = w.sentenceRu || '';
    $('actions-test').classList.add('hidden');

    const excluded = new Set([w.id, ...(w.quizExcludes || [])]);
    const others = shuffle(deck.words.filter((x) => !excluded.has(x.id))).slice(0, OPTIONS_COUNT - 1);
    const options = shuffle([w, ...others]);
    const box = $('options');
    box.classList.remove('answered');
    box.innerHTML = '';
    options.forEach((opt) => {
      const b = document.createElement('button');
      b.className = 'option pop';
      b.innerHTML = `<span class="o-hanzi">${escapeHtml(opt.hanzi)}</span><span class="o-py">${colorPinyin(opt.pinyin)}</span>`;
      b.addEventListener('click', () => answer(opt, b));
      b.dataset.id = opt.id;
      box.appendChild(b);
    });
  }

  function answer(opt, btn) {
    if (answered) return;
    answered = true;
    $('options').querySelectorAll('button').forEach((button) => { button.disabled = true; });
    const w = testItems[testPos];
    const ok = opt.id === w.id;
    testResults.push({ word: w, chosen: opt, ok });
    haptic(ok ? 'ok' : 'error');

    const box = $('options');
    box.classList.add('answered');
    btn.classList.add(ok ? 'correct' : 'wrong');
    if (!ok) box.querySelector(`[data-id="${w.id}"]`).classList.add('correct');

    const blank = $('blank');
    blank.textContent = w.hanzi;
    blank.classList.add(ok ? 'ok' : 'bad');
    $('q-extra').classList.remove('hidden');
    $('btn-test-next').textContent = testPos + 1 < testItems.length ? 'Дальше' : 'Результат';
    $('actions-test').classList.remove('hidden');
    sentenceAudio(w);
  }

  function nextQuestion() {
    if (!answered) return;
    answered = false;
    testPos++;
    if (testPos < testItems.length) renderQuestion();
    else showResult();
  }

  // ---------- отчёт ----------
  function counts() {
    return {
      knownFirst: stats.filter((s) => s.knownFirst).length,
      learned: stats.filter((s) => s.learned).length,
      failed: stats.filter((s) => s.failed).length,
      correct: testResults.filter((r) => r.ok).length,
      total: testResults.length,
    };
  }

  function showResult() {
    const c = counts();
    const pct = c.total ? Math.round((c.correct / c.total) * 100) : 0;
    show('result');
    $('score-ring').style.setProperty('--p', 0);
    requestAnimationFrame(() => {
      $('score-ring').style.transition = '--p 1s';
      animateRing(pct);
    });
    $('score-num').textContent = `${c.correct}/${c.total}`;
    $('result-title').textContent =
      pct === 100 ? 'Отлично! 太棒了！' : pct >= 70 ? 'Хорошо! 很好！' : 'Есть над чем поработать 加油！';

    $('stats').innerHTML = `
      <div class="stat"><b>${c.knownFirst}</b><span>знал сразу</span></div>
      <div class="stat"><b>${c.learned}</b><span>выучил</span></div>
      <div class="stat"><b>${c.failed}</b><span>не выучил</span></div>`;

    const wrong = testResults.filter((r) => !r.ok);
    const failedWords = deck.words.filter((_, i) => stats[i].failed);
    let html = '';
    if (wrong.length) {
      html += '<h3>Ошибки в тесте</h3>' + wrong.map((r) => row(r.word, `выбрано: ${escapeHtml(r.chosen.hanzi)}`)).join('');
    }
    if (failedWords.length) {
      html += '<h3>Повторить</h3>' + failedWords.map((w) => row(w)).join('');
    }
    $('mistakes').innerHTML = html;
    haptic(pct >= 70 ? 'ok' : 'light');
  }

  function animateRing(pct) {
    const ring = $('score-ring');
    const start = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - start) / 900);
      ring.style.setProperty('--p', pct * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function row(w, extra) {
    return `<div class="m-row"><span class="m-hanzi">${escapeHtml(w.hanzi)}</span>
      <span class="m-info"><span>${colorPinyin(w.pinyin)} — ${escapeHtml(w.ru)}</span>
      ${extra ? `<span class="muted">${extra}</span>` : ''}</span></div>`;
  }

  function reportText() {
    const c = counts();
    let name = '';
    try {
      const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
      if (u) name = [u.first_name, u.last_name].filter(Boolean).join(' ');
    } catch (e) { /* */ }
    const wrong = testResults.filter((r) => !r.ok).map((r) => `${r.word.hanzi} (${r.word.pinyin})`);
    const failed = deck.words.filter((_, i) => stats[i].failed).map((w) => `${w.hanzi} (${w.pinyin})`);
    const lines = [
      `📚 ${deck.title || 'Карточки'}${name ? ' — ' + name : ''}`,
      `Знал сразу: ${c.knownFirst}, выучил: ${c.learned}, не выучил: ${c.failed}`,
      `Тест: ${c.correct}/${c.total}${c.total ? ` (${Math.round((c.correct / c.total) * 100)}%)` : ''}`,
    ];
    if (wrong.length) lines.push(`Ошибки: ${wrong.join(', ')}`);
    if (failed.length) lines.push(`Повторить: ${failed.join(', ')}`);
    return lines.join('\n');
  }

  async function share() {
    const text = reportText();
    const pageUrl = location.origin + location.pathname + '?deck=' + encodeURIComponent(deckId);
    if (inTelegram) {
      // открывает выбор чата: ученик выбирает учителя и отправляет
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`);
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { /* отменили */ return; }
    }
    try {
      await navigator.clipboard.writeText(text);
      alert('Отчёт скопирован — отправь его учителю.');
    } catch (e) {
      prompt('Скопируй отчёт:', text);
    }
  }

  // ---------- кнопки ----------
  $('btn-start').addEventListener('click', renderSections);
  $('btn-catalog-retry').addEventListener('click', loadCatalog);
  $('btn-home').addEventListener('click', () => show('start'));
  $('btn-sections').addEventListener('click', renderSections);
  $('btn-lessons').addEventListener('click', returnToLessons);
  $('btn-result-lessons').addEventListener('click', returnToLessons);
  $('btn-begin').addEventListener('click', startCards);
  $('btn-deck-retry').addEventListener('click', () => loadDeck(deckId));
  $('btn-yes').addEventListener('click', know);
  $('btn-no').addEventListener('click', () => { $('card').classList.add('animate'); dontKnow(); });
  $('btn-next').addEventListener('click', () => afterBack(-1));
  $('btn-audio-front').addEventListener('click', () => wordAudio(deck.words[current]));
  $('btn-audio-back').addEventListener('click', () => wordAudio(deck.words[current]));
  $('btn-audio-ex').addEventListener('click', () => sentenceAudio(deck.words[current]));
  $('btn-strokes').addEventListener('click', drawStrokes);
  $('btn-test-next').addEventListener('click', nextQuestion);
  $('btn-share').addEventListener('click', share);
  $('btn-restart').addEventListener('click', startCards);

  setupSwipe();
  loadCatalog();
})();

