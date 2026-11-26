import sys; sys.path.insert(0,'.')
from lib import *
import json,os
BASE=os.environ['TMPDIR']+'/r11c/base-target/release/ogs'
NEW=ROOT+'/target/release/ogs'
def scenarios():
    sc=scen_core()
    v=load('V037'); sc['V037b']=with_search(v,v['analysis']['search']['entry'],v['analysis']['search']['exit'],reinf=v['reinforcements'])
    sc['V037s']=with_search(v,v['analysis']['search']['entry'],v['analysis']['search']['exit'],reinf=v['reinforcements'],method='spencer')
    cs=json.load(open('cases_search.json'))
    for k in ('V011a','V012','V016b','V035a','V084a','V084e'): sc[k]=cs[k]
    for s in range(0,40): sc[f'r{s}']=rand_scen(s)
    return sc
if __name__=='__main__':
    cache=json.load(open('ref_cache.json')) if os.path.exists('ref_cache.json') else {}
    sc=scenarios(); rows={}
    for k,m in sc.items():
        if k not in cache:
            f=best(fine(m),BASE); b=best(m,BASE)
            cache[k]={'fine':f.get('fos'),'tf':f.get('t'),'base':b.get('fos'),'tb':b.get('t')}
            json.dump(cache,open('ref_cache.json','w'))
        c=cache[k]; n=best(m,NEW); 
        nf=best(fine(m),NEW) if len(sys.argv)>1 and sys.argv[1]=='full' else {}
        g0=100*(c['base']/c['fine']-1); g1=100*(n['fos']/c['fine']-1)
        rows[k]=dict(g0=g0,g1=g1,tb=c['tb'],tn=n['t'],fn=n['fos'],ff=c['fine'],fb=c['base'],ev=n['search'],nf=nf.get('fos'))
        print(f"{k:8s} base {c['base']:.4f} fine {c['fine']:.4f} new {n['fos']:.4f} gap_base {g0:+.3f}% gap_new {g1:+.3f}%  t {c['tb']:.2f}->{n['t']:.2f}"+(f" newfine {nf['fos']:.4f}" if nf else ''),flush=True)
    json.dump(rows,open(sys.argv[2] if len(sys.argv)>2 else 'rows.json','w'))
