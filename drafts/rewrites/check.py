import json,re,html,glob,sys,os
SP=os.path.dirname(os.path.abspath(__file__))
orig={a['file']:a for a in json.load(open(os.path.join(SP,'..','restore','articles.json')))}
def plain(h): return html.unescape(re.sub(r'<[^>]+>','',re.sub(r'\[\d+\]','',h)))
def syl(w):
    w=w.lower(); v=re.findall(r'[aeiouy]+',w); n=len(v)
    if w.endswith('e') and n>1: n-=1
    return max(1,n)
def paras(a): return [a['intro']]+[p for s in a['sections'] for p in s['content'].split('\n\n') if p.strip()]+([a['closing']] if a.get('closing') else [])
def score(a):
    ps=paras(a); txt=' '.join(plain(p) for p in ps); sents=[s for s in re.split(r'(?<=[.!?])\s+',txt) if s.strip()]; words=re.findall(r"[A-Za-z']+",txt)
    wps=len(words)/len(sents); spw=sum(syl(w) for w in words)/len(words)
    longp=[plain(p)[:60] for p in ps if len([s for s in re.split(r'(?<=[.!?])\s+',plain(p).strip()) if s])>4]
    return len(words),round(wps,1),round(0.39*wps+11.8*spw-15.59,1),longp
def cites(a): return sorted(set(re.findall(r'\[(\d+)\]',' '.join(paras(a)))),key=int)
BAD=r'\b(cure[sd]?|heal(s|ed|ing)?\b|heal itself|boost\w*|detox\w*|toxin removal|removes? toxins|immune events|strongly linked|proves?|confirm(s|ed)?|not tentative|reverse[sd]?|fight\w*|stuff|bugs|reckon|delve|unlock|journey|fascinating|crucial|game.changer)\b'
ok_all=True
for f in sorted(glob.glob(os.path.join(SP,'*.json'))):
    n=json.load(open(f)); o=orig[n['file']]; errs=[]
    if n['title']!=o['title']: errs.append('TITLE CHANGED')
    if len(n['sections'])!=len(o['sections']): errs.append('SECTIONS %d vs %d'%(len(n['sections']),len(o['sections'])))
    if cites(n)!=cites(o): errs.append('CITES %s vs %s'%(cites(n),cites(o)))
    t=json.dumps(n,ensure_ascii=False)
    if re.search('[–—]',t): errs.append('DASH')
    w,wps,g,longp=score(n); ow,owps,og,olong=score(o)
    if longp: errs.append('LONG PARAS %d: %s'%(len(longp),longp[:2]))
    bad=sorted(set(m[0].lower() for m in re.findall(BAD,plain(t),re.I)))
    print('%-22s words %4d->%4d  w/s %4.1f->%4.1f  grade %4.1f->%4.1f  flagged:%s  %s'%(os.path.basename(f),ow,w,owps,wps,og,g,bad or '-', ' '.join(errs) or 'OK'))
    if errs: ok_all=False
print('ALL OK' if ok_all else 'SOME FAIL')
