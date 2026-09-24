import json,glob,os
SP=os.path.dirname(os.path.abspath(__file__))
arts=json.load(open(os.path.join(SP,'..','restore','articles.json')))
by={a['file']:a for a in arts}; used=[]
for f in sorted(glob.glob(os.path.join(SP,'*.json'))):
    n=json.load(open(f)); a=by[n['file']]
    for k in ['seoTitle','metaDesc','intro','sections','closing','pullQuote','author']:
        if k in n: a[k]=n[k]
    used.append(os.path.basename(f))
json.dump(arts,open(os.path.join(SP,'..','restore','articles-final.json'),'w'),indent=1,ensure_ascii=False)
print('merged',len(used),used)
