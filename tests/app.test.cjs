const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const screenshots = path.join(root, 'test-output');
fs.mkdirSync(screenshots, {recursive:true});
const deck = JSON.parse(fs.readFileSync(path.join(root, 'decks/lesson1.json')));
const expected = '以为 像 长 身高 米 瘦 接 行李 丢 箱子 号码 好像 重要 着急 护照 服务台 应该 站 中间 短 头发 年轻 发现 不见 带 帮助 照片'.split(' ');
assert.deepEqual(deck.words.map(w => w.hanzi), expected);
assert.equal(new Set(deck.words.map(w => w.id)).size, 27);
for (const w of deck.words) {
  for (const field of ['id', 'hanzi', 'pinyin', 'ru', 'sentence', 'sentencePinyin', 'sentenceRu']) assert.ok(w[field]?.trim(), `${w.id}: ${field}`);
  assert.match(w.id, /^[a-z0-9_-]+$/);
  assert.equal(w.sentence.split('___').length, 2);
}
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'decks/catalog.json')));
assert.equal(catalog.sections[0].lessons.length, 18);
assert.equal(catalog.sections[0].lessons.filter(l => l.available).length, 1);
assert.equal(catalog.sections[0].lessons[0].wordCount, deck.words.length);
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, name === '/' ? 'index.html' : name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const type = {'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'}[path.extname(file)];
    res.writeHead(200, {'Content-Type':type || 'application/octet-stream'}).end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
  const errors = [];
  const page = await browser.newPage({ viewport:{width:390,height:844}, reducedMotion:'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(() => {
    const original = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) => original(fn, ms === 280 ? 0 : ms, ...args);
    document.addEventListener('DOMContentLoaded', () => {
      const style=document.createElement('style');
      style.textContent='*, *::before, *::after { animation: none !important; transition: none !important; }';
      document.head.appendChild(style);
    });
    window.played = [];
    window.Audio = class { constructor(src) { this.src = src; } pause() {} addEventListener() {} play() { window.played.push(this.src); return Promise.resolve(); } };
    Object.defineProperty(navigator, 'share', {value: async data => { window.shared = data; }});
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const visible = id => page.locator(`#screen-${id}`).waitFor({state:'visible'});
  const tick = () => page.waitForTimeout(15);
  try {
    await page.goto(base);
    await page.locator('#btn-start').click(); await visible('sections');
    assert.equal(await page.locator('#sections button').innerText(), 'HSK-3\n新HSK教程 3 · 18 уроков\nДоступно 1 из 18 уроков →');
    await page.locator('#sections button').click(); await visible('lessons');
    assert.equal(await page.locator('#lessons button').count(), 18);
    assert.equal(await page.locator('#lessons button:disabled').count(), 17);
    await page.screenshot({path:path.join(screenshots,'hsk3-lessons.png')});
    await page.locator('#lessons button').first().click(); await visible('lesson');
    await page.locator('#btn-begin').click(); await visible('cards');
    // First unknown card: reveal all fields and check both audio routes.
    const first = await page.locator('#front-hanzi').innerText();
    const firstWord = deck.words.find(w => w.hanzi === first);
    await page.locator('#btn-no').click();
    assert.equal(await page.locator('#back-ru').innerText(), firstWord.ru);
    await page.locator('#btn-audio-ex').click();
    assert.deepEqual(await page.evaluate(() => window.played), [`audio/lesson1/${firstWord.id}.mp3`, `audio/lesson1/${firstWord.id}_s.mp3`]);
    await page.screenshot({path:path.join(screenshots,'hsk3-card.png')});
    await page.locator('#btn-next').click(); await tick();
    // Remaining initial cards + repeated card: learn every word.
    const seen = new Set([first]);
    for (let i=0;i<27;i++) {
      seen.add(await page.locator('#front-hanzi').innerText());
      await page.locator('#btn-yes').evaluate(b => { b.click(); b.click(); }); await tick();
    }
    assert.equal(seen.size, 27); await visible('test');
    // Answer all questions, intentionally get the first wrong; double clicks count once.
    for (let i=0;i<27;i++) {
      const displayed = await page.locator('#q-sentence').innerText();
      const w = deck.words.find(w => displayed.replace(/\s/g,'') === w.sentence.replace('___','').replace(/\s/g,''));
      assert.ok(w, displayed);
      const selector = i===0 ? `#options button:not([data-id="${w.id}"])` : `#options button[data-id="${w.id}"]`;
      await page.locator(selector).first().evaluate(b => { b.click(); b.click(); });
      assert.equal(await page.locator('#options button:disabled').count(), 4);
      await page.locator('#btn-test-next').evaluate(b => { b.click(); b.click(); });
    }
    await visible('result');
    assert.equal(await page.locator('#score-num').innerText(), '26/27');
    assert.match(await page.locator('#stats').innerText(), /26\s+знал сразу\s+1\s+выучил\s+0\s+не выучил/);
    await page.locator('#btn-share').click();
    assert.match((await page.evaluate(() => window.shared)).text, /HSK-3 · Урок 1/);
    await page.locator('#btn-result-lessons').click(); await visible('lessons');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // Direct links, unavailable/unknown lessons and retry on a failed fetch.
    await page.goto(base+'/?deck=lesson2'); await visible('lesson');
    assert.match(await page.locator('#deck-info').innerText(), /ещё готовится/);
    assert.equal(await page.locator('#btn-begin').isDisabled(), true);
    await page.goto(base+'/?deck=missing'); await visible('lesson');
    assert.match(await page.locator('#deck-info').innerText(), /Такого урока нет/);
    let fail=true;
    await page.route('**/decks/lesson1.json', route => fail ? route.fulfill({status:503,body:''}) : route.continue());
    await page.goto(base+'/?deck=lesson1'); await page.locator('#btn-deck-retry').waitFor({state:'visible'});
    fail=false; await page.locator('#btn-deck-retry').click();
    await page.waitForFunction(() => !document.getElementById('btn-begin').disabled);
    await page.locator('#btn-begin').click();
    // Three misses retire each word; when none learned the test still covers all 27.
    for(let i=0;i<81;i++) { await page.locator('#btn-no').click(); await page.locator('#btn-next').click(); await tick(); }
    await visible('test'); assert.match(await page.locator('#test-text').innerText(), /из 27/);
    // Telegram start_param takes priority over browser query.
    await page.addInitScript(() => { window.Telegram={WebApp:{initData:'test',initDataUnsafe:{start_param:'lesson1'},ready(){},expand(){}}}; });
    await page.goto(base+'/?deck=lesson2'); await visible('lesson');
    await page.waitForFunction(() => !document.getElementById('btn-begin').disabled);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: source vocabulary, 18-lesson catalog, mobile navigation, all 27 cards, audio URLs, repetitions, quiz, duplicate-click guards, report, deep links and fetch retry.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode=1; server.close(); });
