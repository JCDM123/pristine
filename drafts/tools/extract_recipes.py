import re, json, glob, base64, html as H, os
def dashfix(t):
    return re.sub(r'\s*—\s*', ', ', t or '').replace('–', '-')
def text(h): return dashfix(H.unescape(re.sub(r'<[^>]+>', '', h or '')).strip())
def slug(t): return re.sub(r'(^-|-$)', '', re.sub(r'[^a-z0-9]+', '-', t.lower()))
TIMES = {  # prep, cook: fixed where the real value is clear, '0' means leave times off
 'recipe-banana-spelt-choc-chip-muffins.html': ('15 min', '20 min'),
 'recipe-chickpea-curry.html': ('10 min', '25 min'),
 'recipe-creamy-cauliflower-soup.html': ('0', ''),
 'recipe-fermented-overnight-oats-with-raw-honey-.html': ('0', ''),
 'recipe-lamb-liver-p-t-with-sourdough-toast.html': ('1 hour', '20 min'),
 'recipe-no-sugar-banana-choc-chip-muffins.html': ('20 min', '20 min'),
 'recipe-no-wheat-chocolate-mud-cake.html': ('0', ''),
 'recipe-organic-micro-salad.html': ('1 hour', ''),
 'recipe-slow-cooked-beef-bone-broth-ramen.html': ('0', ''),
 'recipe-soaked-slow-cooked-lentil-dal-with-ghee-.html': ('15 min', '30 min'),
 'recipe-spelt-banana-choc-chip-muffins.html': ('15 min', '22 min'),
 'recipe-wheat-free-chocolate-mud-cake.html': ('0', ''),
 'recipe-wild-fermented-beetroot-and-goat-s-chees.html': ('0', ''),
}
def save_data_img(uri, path):
    b = base64.b64decode(uri.split('base64,', 1)[1])
    open(path, 'wb').write(b); return path
out = []
for f in sorted(glob.glob('recipe-*.html')):
    if 'template' in f: continue
    s = open(f, encoding='utf-8').read()
    base = f[len('recipe-'):-5]
    d = {'file': f}
    d['title'] = text(re.search(r'<div class="recipe-hero".*?<h1>(.*?)</h1>', s, re.S).group(1))
    t = re.search(r'<title>(.*?)</title>', s, re.S).group(1)
    d['seoTitle'] = text(re.sub(r'\s*[|—-]\s*Pristine Wellness.*$', '', t))
    md = re.search(r'<meta name="description" content="([^"]*)"', s)
    d['metaDesc'] = dashfix(H.unescape(md.group(1))) if md else ''
    cb = re.search(r'class="recipe-cat-badge">(.*?)</span>', s)
    d['category'] = text(cb.group(1)) if cb else 'Recipes'
    stats = dict((text(a).lower(), text(b)) for a, b in re.findall(r'class="qs-label">(.*?)</span><span class="qs-value"[^>]*>(.*?)</span>', s))
    d['statsOld'] = stats
    d['servings'] = int(re.sub(r'\D', '', stats.get('serves', '4')) or 4)
    d['difficulty'] = stats.get('difficulty', 'Easy') or 'Easy'
    d['prep'], d['cook'] = TIMES[f]
    ab = re.search(r'<div class="recipe-about">\s*<p>(.*?)</p>', s, re.S)
    it = re.search(r'<p class="recipe-intro">(.*?)</p>', s, re.S)
    about = text(ab.group(1)) if ab else ''; intro = text(it.group(1)) if it else ''
    if about and intro and intro not in about and about not in intro: about = about + ' ' + intro
    d['about'] = about or intro
    d['dietary'] = [text(x) for x in re.findall(r'class="dietary-tag">(.*?)</span>', s)]
    chef = serve = ''
    for lab, body in re.findall(r'class="chef-tip-label">(.*?)</span>\s*<p>(.*?)</p>', s, re.S):
        if 'serve' in lab.lower(): serve = text(body)
        else: chef = text(body)
    d['chefNote'], d['servingSuggestion'] = chef, serve
    d['ingredients'] = [{'amount': text(a), 'name': text(n)} for a, n in re.findall(r'<div class="ingredient-item"[^>]*>.*?<span class="ing-amount"[^>]*>(.*?)</span>\s*<span class="ing-name">(.*?)</span>', s, re.S)]
    steps = []
    for m in re.finditer(r'<div class="method-step">(.*?)<p class="step-text">(.*?)</p>', s, re.S):
        st = re.search(r'class="step-title">(.*?)</div>', m.group(1), re.S)
        steps.append({'title': text(st.group(1)), 'text': text(m.group(2))} if st else text(m.group(2)))
    d['steps'] = steps
    imgs = []
    for i, m in enumerate(re.finditer(r'<figure[^>]*>(.*?)</figure>', s, re.S)):
        src = re.search(r'src="([^"]+)"', m.group(1)).group(1)
        cap = re.search(r'<figcaption[^>]*>(.*?)</figcaption>', m.group(1), re.S)
        if src.startswith('data:'): src = save_data_img(src, 'images/%s-step-%d.jpg' % (base, i + 1))
        imgs.append({'src': src, 'caption': text(cap.group(1)) if cap else ''})
    d['images'] = imgs[:3]
    hero = re.search(r'<div class="recipe-hero" style="background-image:url\(\'?([^\')]+)', s)
    hp = hero.group(1) if hero else ''
    if hp.startswith('data:'): hp = save_data_img(hp, 'images/%s-hero.jpg' % base)
    d['heroImage'] = hp
    sig = re.search(r'images/sig-(mr|mrs|jnr)\.svg', s)
    d['author'] = {'mr': 'Mr Wellness', 'mrs': 'Mrs Wellness', 'jnr': 'Wellness Jnr'}[sig.group(1)] if sig else 'Mr Wellness'
    d['slugOK'] = ('recipe-' + slug(d['title'])[:40] + '.html') == f or ('recipe-' + re.sub(r'(^-|-$)','',slug(d['title'])[:40]) + '.html') == f
    out.append(d)
    print(f[:46].ljust(47), d['category'].ljust(10), 'ing', len(d['ingredients']), 'steps', len(steps), 'imgs', len(d['images']), 'serves', d['servings'], d['difficulty'], '| old', stats.get('prep'), '/', stats.get('cook'), '->', d['prep'], '/', d['cook'] or '-', '| slug', 'OK' if d['slugOK'] else 'DIFF ' + slug(d['title'])[:40], '| hero', d['heroImage'] or '-')
json.dump(out, open('/tmp/claude-0/-home-user-vectorready-site/199614c9-cc93-58c1-99aa-7e90c0837625/scratchpad/restore/recipes.json', 'w'), indent=1, ensure_ascii=False)
