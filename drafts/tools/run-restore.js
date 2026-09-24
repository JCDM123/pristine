// Publish every existing story through the real studio.html, in a sealed browser with GitHub and the Worker mocked.
const fs = require('fs'), path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const LIB = path.join(__dirname, '..', 'studio-sim2', 'lib');
const { VRepo } = require(path.join(LIB, 'vrepo'));
const { createSandbox } = require(path.join(LIB, 'mocks'));
const REPO = path.join(__dirname, 'repo');
const arts = JSON.parse(fs.readFileSync(path.join(__dirname, 'articles.json'), 'utf8'));
const recs = JSON.parse(fs.readFileSync(path.join(__dirname, 'recipes.json'), 'utf8'));
const CAT_FIX = { 'recipe-slow-cooked-beef-bone-broth-ramen.html': 'Mains', 'recipe-wheat-free-chocolate-mud-cake.html': 'Desserts' };
const LINKED_A = ['article-restorative-sleep-the-ultimate-ancestral.html', 'article-structured-water-and-cellular-hydration-.html', 'article-why-we-melted-down-a-jar-of-beef-tallow-.html', 'article-what-happens-to-your-feet-when-you-take-.html'];
// oldest first; on equal dates the stories already on the site go last so they stay near the top
arts.sort((a, b) => a.dateVal.localeCompare(b.dateVal) || (LINKED_A.indexOf(a.file) - LINKED_A.indexOf(b.file)));
// recipes: unlinked first, then the current Kitchen order (bottom to top), dal last so it stays featured
const K_ORDER = ['recipe-no-sugar-banana-choc-chip-muffins.html', 'recipe-fermented-overnight-oats-with-raw-honey-.html', 'recipe-wheat-free-chocolate-mud-cake.html', 'recipe-organic-micro-salad.html', 'recipe-chickpea-curry.html', 'recipe-soaked-slow-cooked-lentil-dal-with-ghee-.html'];
recs.sort((a, b) => K_ORDER.indexOf(a.file) - K_ORDER.indexOf(b.file));

(async () => {
  const vrepo = new VRepo(REPO);
  const sb = createSandbox(vrepo);
  // AI proofreading of captions and tags must not change anything: make the Worker fail so originals are kept
  sb.addFailure({ label: 'worker off', once: false, match: i => /workers\.dev/.test(i.url || i.host || ''), respond: { status: 500, body: '{"error":"offline"}', contentType: 'application/json' } });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route('**/*', sb.handle);
  await ctx.addInitScript(`localStorage.setItem('gh_token','TEST-FAKE-TOKEN'); window.confirm = () => true; window.alert = m => console.log('ALERT', m);`);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8801/studio.html');
  await page.fill('#pw-input', 'pristine2026'); await page.click('.lock-btn'); await page.waitForSelector('#studio', { state: 'visible' });
  const results = [];
  const wait = async (sel) => { for (let i = 0; i < 200; i++) { const t = await page.$eval(sel, e => e.textContent); if (/Published!|failed|Check the/i.test(t)) return t; await page.waitForTimeout(100); } return 'TIMEOUT'; };

  for (const a of arts) {
    await page.evaluate(a => {
      generatedArticleData = { article: { title: a.title, seoTitle: a.seoTitle, metaDesc: a.metaDesc, intro: a.intro, sections: a.sections, pullQuote: a.pullQuote, closing: a.closing, sources: a.sources },
        topic: a.title, category: a.category, readtime: a.readtime, author: a.author, dateVal: a.dateVal, tagsRaw: '', format: 'standard', useCitations: true };
      articleImagePath = a.heroImage || ''; articleImageBase64 = '';
      articleBodyImages = [null, null, null, null, null, null];
      a.images.slice(0, 6).forEach((im, i) => { articleBodyImages[i] = im.src; const c = document.getElementById('bcaption-' + i); if (c) c.value = im.caption || ''; });
      for (let i = a.images.length; i < 6; i++) { const c = document.getElementById('bcaption-' + i); if (c) c.value = ''; }
      document.getElementById('a-status').textContent = '';
      const b = document.getElementById('a-pub-btn'); b.disabled = false;
    }, a);
    await page.evaluate(() => { publishArticle(); });
    const st = await wait('#a-status');
    results.push(['article', a.file, st]); console.log('ARTICLE', a.dateVal, a.file, '->', st.slice(0, 90));
  }
  await page.evaluate(() => switchTab('recipe'));
  for (const r of recs) {
    const cat = CAT_FIX[r.file] || r.category;
    await page.evaluate(([r, cat]) => {
      document.getElementById('r-category').value = cat;
      generatedRecipeData = { recipe: { title: r.title, intro: r.about, about: r.about, ingredients: r.ingredients, steps: r.steps, chefNote: r.chefNote, servingSuggestion: r.servingSuggestion, seoTitle: r.seoTitle, metaDesc: r.metaDesc },
        name: r.title, about: r.about, category: cat, author: r.author, servings: r.servings, difficulty: r.difficulty, prep: r.prep, cook: r.cook, dietary: r.dietary };
      recipeImagePath = r.heroImage || ''; recipeImageBase64 = '';
      recipeBodyImages = [null, null, null, null, null, null]; selectedRTags = [];
      r.images.slice(0, 3).forEach((im, i) => { recipeBodyImages[i] = im.src; });
      for (let i = 0; i < 3; i++) { const c = document.getElementById('rcaption-' + i); if (c) c.value = (r.images[i] && r.images[i].caption) || ''; }
      document.getElementById('r-status').textContent = '';
      const b = document.getElementById('r-pub-btn'); b.disabled = false;
    }, [r, cat]);
    await page.evaluate(() => { publishRecipe(); });
    const st = await wait('#r-status');
    results.push(['recipe', r.file, st]); console.log('RECIPE', r.file, '->', st.slice(0, 90));
  }
  await browser.close();
  // write back every file the studio created or changed
  const out = path.join(__dirname, 'out'); fs.rmSync(out, { recursive: true, force: true });
  const writes = sb.external.filter(x => (x.method === 'PUT' || x.method === 'DELETE') && x.status < 300);
  const touched = [...new Set(writes.map(w => w.path))];
  for (const p of touched) { const f = vrepo.get(p); if (!f) continue; fs.mkdirSync(path.join(out, path.dirname(p)), { recursive: true }); fs.writeFileSync(path.join(out, p), f.buf); }
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ results, errs, touched, failedWrites: sb.external.filter(x => x.status >= 300 && x.method !== 'GET') }, null, 1));
  console.log('TOUCHED', touched.length, touched.join(' ')); console.log('PAGE ERRORS', errs.length, errs.slice(0, 3).join(' / '));
})();
