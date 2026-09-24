import re, json, glob, html as H, datetime
from html.parser import HTMLParser

def dashfix(t):
    t = re.sub(r'\s*—\s*', ', ', t)
    t = t.replace('–', '-')
    return t

def uncite(h):
    # rendered citation <sup ...><a href="#source-N" ...>[N]</a></sup> back to [N]
    h = re.sub(r'<sup[^>]*>\s*<a[^>]*>\s*\[(\d+)\]\s*</a>\s*</sup>', r'[\1]', h)
    h = re.sub(r'<sup[^>]*>\s*\[(\d+)\]\s*</sup>', r'[\1]', h)
    return h

def inner(s, start_tag_end, tag):
    # return inner html of element whose start tag ends at start_tag_end, balancing same-name tags
    depth = 1; i = start_tag_end
    pat = re.compile(r'<(/?)%s\b[^>]*>' % tag)
    while True:
        m = pat.search(s, i)
        if not m: return s[start_tag_end:], len(s)
        depth += -1 if m.group(1) else 1
        if depth == 0: return s[start_tag_end:m.start()], m.end()
        i = m.end()

def text(h): return H.unescape(re.sub(r'<[^>]+>', '', h)).strip()

out = []
for f in sorted(glob.glob('article-*.html')):
    if 'template' in f: continue
    s = open(f, encoding='utf-8').read()
    d = {'file': f}
    d['title'] = dashfix(text(re.search(r'<h1>(.*?)</h1>', s, re.S).group(1)))
    t = re.search(r'<title>(.*?)</title>', s, re.S).group(1)
    d['seoTitle'] = dashfix(H.unescape(re.sub(r'\s*[|—-]\s*Pristine Wellness.*$', '', t)).strip())
    md = re.search(r'<meta name="description" content="([^"]*)"', s)
    d['metaDesc'] = dashfix(H.unescape(md.group(1))) if md else ''
    d['category'] = text(re.search(r'class="article-cat">(.*?)</span>', s).group(1))
    ds = text(re.search(r'class="article-date">(.*?)</span>', s).group(1))
    d['dateVal'] = datetime.datetime.strptime(ds, '%d %B %Y').strftime('%Y-%m-%d')
    d['readtime'] = text(re.search(r'class="article-rt">(.*?)</span>', s).group(1))
    hero = re.search(r'<div class="article-hero" style="background-image:url\(\'?([^\')]+)\'?\)', s)
    d['heroImage'] = hero.group(1) if hero else ''
    cite = re.search(r'<cite>([^<]*)</cite>', s)
    sig = re.search(r'images/sig-(mr|mrs|jnr)\.svg', s)
    d['author'] = {'mr': 'Mr Wellness', 'mrs': 'Mrs Wellness', 'jnr': 'Wellness Jnr'}[sig.group(1)] if sig else (cite.group(1).strip() if cite else 'Mr Wellness')
    ia = s.find('<p class="article-intro">'); intro, iend = inner(s, ia + len('<p class="article-intro">'), 'p')
    d['intro'] = dashfix(uncite(intro.strip()))
    # content region: from intro end to author-bio / sidebar
    ends = [x for x in (s.find('<div class="author-bio">', iend), s.find('<div class="article-sidebar"', iend)) if x > 0]
    region = s[iend:min(ends)]
    sections = []; images = []; pull = ''; sources = []; pre = []
    pos = 0
    tok = re.compile(r"<(h2|p|img|figure|blockquote|div class=\"article-sources\")(?=[\s>/])[^>]*>", re.S)
    while True:
        m = tok.search(region, pos)
        if not m: break
        tag = m.group(1)
        if tag == 'h2':
            h, pos = inner(region, m.end(), 'h2'); sections.append({'heading': dashfix(uncite(h.strip())), 'paras': []})
        elif tag == 'p':
            h, pos = inner(region, m.end(), 'p'); h = dashfix(uncite(h.strip()))
            if not h: continue
            (sections[-1]['paras'] if sections else pre).append(h)
        elif tag in ('img', 'figure'):
            if tag == 'figure':
                h, pos = inner(region, m.end(), 'figure')
                src = re.search(r'src="([^"]+)"', h); cap = re.search(r'<figcaption[^>]*>(.*?)</figcaption>', h, re.S)
                images.append({'src': src.group(1) if src else '', 'caption': dashfix(text(cap.group(1))) if cap else '', 'afterSection': len(sections) - 1})
            else:
                src = re.search(r'src="([^"]+)"', m.group(0)); pos = m.end()
                images.append({'src': src.group(1) if src else '', 'caption': '', 'afterSection': len(sections) - 1})
        elif tag == 'blockquote':
            h, pos = inner(region, m.end(), 'blockquote'); pull = dashfix(text(h))
        else:
            h, pos = inner(region, m.end(), 'div')
            for li in re.finditer(r'<li id="source-(\d+)"[^>]*>(.*?)</li>', h, re.S):
                a = re.search(r'<a href="([^"]*)"[^>]*>(.*?)</a>', li.group(2), re.S)
                pub = re.search(r'</a>\s*<span[^>]*>\s*(?:,|—|–|-)?\s*(.*?)</span>', li.group(2), re.S)
                sources.append({'num': int(li.group(1)), 'url': a.group(1) if a else '', 'title': dashfix(text(a.group(2))) if a else '', 'publication': dashfix(text(pub.group(1))) if pub else ''})
    closing = ''
    if sections and sections[-1]['paras']:
        closing = sections[-1]['paras'].pop()
    d['pre'] = pre
    d['sections'] = [{'heading': x['heading'], 'content': '\n\n'.join(x['paras'])} for x in sections]
    d['closing'] = closing; d['pullQuote'] = pull; d['sources'] = sources; d['images'] = [i for i in images if i['src']]
    out.append(d)
    print(f[:44].ljust(45), d['dateVal'], d['category'].ljust(16), d['author'].ljust(18), 'sections', len(d['sections']), 'paras', sum(x['content'].count('\n\n') + 1 for x in d['sections'] if x['content']), 'pre', len(pre), 'imgs', len(d['images']), 'sources', len(sources), 'pull', bool(pull), 'hero', d['heroImage'] or '-')
json.dump(out, open('/tmp/claude-0/-home-user-vectorready-site/199614c9-cc93-58c1-99aa-7e90c0837625/scratchpad/restore/articles.json', 'w'), indent=1, ensure_ascii=False)
