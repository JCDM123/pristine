// Output validators for published HTML/JSON.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'polyline', 'line', 'polygon', 'ellipse', 'stop', 'use']);
const CHECK = ['html', 'head', 'body', 'div', 'section', 'article', 'aside', 'nav', 'header', 'footer', 'main', 'ul', 'ol', 'li', 'a', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure', 'figcaption', 'button', 'form', 'table', 'tr', 'td', 'blockquote', 'details', 'summary', 'svg', 'select', 'label', 'textarea', 'script', 'style', 'sup', 'strong', 'em', 'cite'];

// Stack-free per-tag counting (robust to optional-close quirks), after removing comments, scripts and styles bodies.
function tagBalance(html) {
  let s = html.replace(/<!--[\s\S]*?-->/g, '');
  const counts = {};
  // strip script/style content but count the tags
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (m, t) => { t = t.toLowerCase(); counts[t] = counts[t] || { open: 0, close: 0 }; counts[t].open++; counts[t].close++; return ''; });
  const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const tag = m[1].toLowerCase();
    if (VOID.has(tag) || m[2] === '/') continue;
    if (!CHECK.includes(tag)) continue;
    counts[tag] = counts[tag] || { open: 0, close: 0 };
    if (m[0][1] === '/') counts[tag].close++; else counts[tag].open++;
  }
  const mismatches = {};
  for (const [t, c] of Object.entries(counts)) if (c.open !== c.close) mismatches[t] = c.open - c.close;
  return { counts, mismatches };
}

function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    if (/\bsrc=/.test(attrs)) continue;
    out.push({ attrs: attrs.trim(), code: m[2], json: /ld\+json|application\/json/.test(attrs) });
  }
  return out;
}

function checkScripts(html, label) {
  const res = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chk-'));
  inlineScripts(html).forEach((s, i) => {
    if (s.json) {
      try { JSON.parse(s.code); res.push({ i, ok: true, json: true }); } catch (e) { res.push({ i, ok: false, json: true, error: e.message }); }
      return;
    }
    const f = path.join(tmp, label.replace(/[^a-z0-9]/gi, '_') + '_' + i + '.js');
    fs.writeFileSync(f, s.code);
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); res.push({ i, ok: true }); }
    catch (e) { res.push({ i, ok: false, error: String(e.stderr || e.message).split('\n').slice(0, 6).join(' | ') }); }
  });
  return res;
}

function contentChecks(html) {
  const lines = html.split('\n');
  const find = (re) => { const hits = []; lines.forEach((l, i) => { if (re.test(l)) hits.push({ line: i + 1, text: l.trim().slice(0, 160) }); }); return hits; };
  return {
    emDash: find(/—/),
    enDash: find(/–/),
    placeholders: find(/ARTICLE_[A-Z0-9]+|AUTHOR_SIG_PLACEHOLDER|AUTHOR_BIO|AUTHOR_NAME|AUTHOR_ROLE|RELATED_CARDS_PLACEHOLDER|RECIPE_TITLE_PLACEHOLDER|placeholder\.jpg|Forest Bathing/),
    ogImage: /<meta\s+property="og:image"/i.test(html),
    ogTitle: /<meta\s+property="og:title"/i.test(html),
    metaDescription: /<meta\s+name="description"/i.test(html),
    cfBeacon: /static\.cloudflareinsights\.com\/beacon\.min\.js/.test(html),
    mainNav: /class="[^"]*\bmain-nav\b/.test(html) || /id="main-nav"/.test(html),
    deprecatedColour: find(/#8A9B6E/i),
    base64Images: (html.match(/src="data:image\//g) || []).length,
    mojibake: (html.match(/Ã/g) || []).length,
    titleTag: (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || null,
    titleCount: (html.match(/<title>/g) || []).length
  };
}

function validateHtml(html, label) {
  return { label, size: html.length, balance: tagBalance(html).mismatches, scripts: checkScripts(html, label), checks: contentChecks(html) };
}

module.exports = { tagBalance, checkScripts, contentChecks, validateHtml, inlineScripts };
