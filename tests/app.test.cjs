const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const screenshots = path.join(root, 'test-output');
fs.mkdirSync(screenshots, {recursive:true});
const deck = JSON.parse(fs.readFileSync(path.join(root, 'decks/lesson1.json')));
const sourceWords = {
  lesson1: '以为 像 长 身高 米 瘦 接 行李 丢 箱子 号码 好像 重要 着急 护照 服务台 应该 站 中间 短 头发 年轻 发现 不见 带 帮助 照片',
  lesson2: '菜单 又 饿 渴 客气 饮料 好久 服务 员 双 筷子 勺子 碗 马上 热情 尝 记 用 鸡 张 不用 选 外卖 方便 蛋糕 只 方便面 简单',
  lesson3: '初中 咱们 换 房子 小区 环境 挺 空调 洗衣机 层 花园 灯 关 冰箱 卫生间 打扫 搬家 办 信用卡 还 听说 银行 才 纸 搬 需要',
  lesson4: '假期 海 草原 主意 骑 马 羊 月亮 一定 刻 起飞 宾馆 特别 别的 一样 牛 相机 欢迎 司机 晚点 久 除了 以外 先 一直 干净 满意',
  lesson5: '总是 终于 爬 山 锻炼 照 鞋 大衣 拍照 感兴趣 照相 难看 比较 水平 太阳 树 干 电 收到 封 邮件 难过 哈哈 音乐 兴趣 会 结束'
};
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'decks/catalog.json')));
const available = catalog.sections[0].lessons.filter(l => l.available);
assert.equal(catalog.sections[0].lessons.length, 18);
assert.deepEqual(available.map(l => l.id), Object.keys(sourceWords));
const decks = {};
for (const lesson of available) {
  const data = JSON.parse(fs.readFileSync(path.join(root, `decks/${lesson.id}.json`)));
  decks[lesson.id] = data;
  assert.deepEqual(data.words.map(w => w.hanzi), sourceWords[lesson.id].split(' '), lesson.id);
  assert.equal(new Set(data.words.map(w => w.id)).size, data.words.length);
  assert.equal(lesson.wordCount, data.words.length);
  const ids = new Set(data.words.map(w => w.id));
  for (const w of data.words) {
    for (const field of ['id', 'hanzi', 'pinyin', 'ru', 'sentence', 'sentencePinyin', 'sentenceRu']) assert.ok(w[field]?.trim(), `${lesson.id}/${w.id}: ${field}`);
    assert.match(w.id, /^[a-z0-9_-]+$/);
    assert.equal(w.sentence.split('___').length, 2);
    assert.ok(!w.sentencePinyin.includes('___'));
    assert.ok(!w.sentenceRu.includes('___'));
    for (const id of w.quizExcludes || []) assert.ok(ids.has(id) && id !== w.id, `${lesson.id}/${w.id}: bad exclusion ${id}`);
    assert.ok(data.words.filter(x => x.id !== w.id && !(w.quizExcludes || []).includes(x.id)).length >= 3);
    if (w.audioText) assert.ok(w.audioNote, `${lesson.id}/${w.id}: missing audio explanation`);
  }
}
// Explicit synonym groups: neither may be an incorrect answer for the other.
for (const id of ['paizhao','zhaoxiang']) {
  const w = decks.lesson5.words.find(w => w.id === id);
  assert.ok(w.quizExcludes.includes(id === 'paizhao' ? 'zhaoxiang' : 'paizhao'));
  assert.ok(w.quizExcludes.includes('zhao'));
}
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
    assert.equal(await page.locator('#sections button').innerText(), 'HSK-3\n新HSK教程 3 · 18 уроков\nДоступно 5 из 18 уроков →');
    await page.locator('#sections button').click(); await visible('lessons');
    assert.equal(await page.locator('#lessons button').count(), 18);
    assert.equal(await page.locator('#lessons button:disabled').count(), 13);
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
    await page.goto(base+'/?deck=lesson6'); await visible('lesson');
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
    // Complete every new deck through the same menu a learner uses.
    for (const lesson of available.slice(1)) {
      const data = decks[lesson.id];
      await page.goto(base);
      await page.locator('#btn-start').click();
      await page.locator('#sections button').click();
      await page.getByRole('button', {name:`${lesson.title} ${lesson.wordCount} слов · карточки и тест`,exact:true}).click();
      await page.locator('#btn-begin').click(); await visible('cards');
      const seen = new Set();
      for (let i=0;i<data.words.length;i++) {
        const hanzi = await page.locator('#front-hanzi').innerText();
        const w = data.words.find(w => w.hanzi === hanzi);
        assert.ok(w, `${lesson.id}: unexpected ${hanzi}`);
        seen.add(hanzi);
        // Reveal every card and verify translations, full examples, pronunciation notes and audio paths.
        await page.locator('#btn-no').click();
        assert.equal(await page.locator('#back-ru').innerText(), w.ru);
        assert.equal((await page.locator('#back-ex-zh').innerText()).replace(/\s/g,''), w.sentence.replace('___',w.hanzi).replace(/\s/g,''));
        const notes = [w.audioNote,w.note].filter(Boolean).join(' ');
        assert.equal(await page.locator('#audio-note').textContent(), notes);
        await page.locator('#btn-audio-ex').click();
        assert.deepEqual(await page.evaluate(() => window.played.slice(-2)), [`audio/${lesson.id}/${w.id}.mp3`,`audio/${lesson.id}/${w.id}_s.mp3`]);
        if(i===0) await page.screenshot({path:path.join(screenshots,`${lesson.id}-card.png`)});
        await page.locator('#btn-next').click(); await tick();
      }
      assert.equal(seen.size,data.words.length);
      // All cards return once, then mark every word learned.
      for (let i=0;i<data.words.length;i++) {
        await page.locator('#btn-yes').evaluate(b => b.click()); await tick();
      }
      await visible('test');
      for (let i=0;i<data.words.length;i++) {
        const text = await page.locator('#q-sentence').innerText();
        const w = data.words.find(w => text.replace(/\s/g,'')===w.sentence.replace('___','').replace(/\s/g,''));
        assert.ok(w, `${lesson.id}: unexpected question ${text}`);
        const options = await page.locator('#options button').evaluateAll(bs => bs.map(b => b.dataset.id));
        assert.equal(options.length,4);
        assert.equal(new Set(options).size,4);
        assert.ok(options.includes(w.id));
        for(const excluded of w.quizExcludes || []) assert.ok(!options.includes(excluded), `${w.id}: ambiguous answer ${excluded}`);
        await page.locator(`#options button[data-id="${w.id}"]`).click();
        await page.locator('#btn-test-next').click();
      }
      await visible('result');
      assert.equal(await page.locator('#score-num').innerText(), `${data.words.length}/${data.words.length}`);
      await page.locator('#btn-share').click();
      assert.ok((await page.evaluate(() => window.shared)).text.includes(data.title));
      await page.locator('#btn-result-lessons').click(); await visible('lessons');
    }
    // Telegram start_param takes priority over browser query.
    await page.addInitScript(() => { window.Telegram={WebApp:{initData:'test',initDataUnsafe:{start_param:'lesson1'},ready(){},expand(){}}}; });
    await page.goto(base+'/?deck=lesson2'); await visible('lesson');
    await page.waitForFunction(() => !document.getElementById('btn-begin').disabled);
    assert.equal(await page.locator('#deck-title').innerText(), 'HSK-3 · Урок 1');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: source vocabulary, 18-lesson catalog, mobile navigation, all 135 cards across lessons 1–5, synonym exclusions, audio URLs, repetitions, quiz, duplicate-click guards, report, deep links and fetch retry.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode=1; server.close(); });
