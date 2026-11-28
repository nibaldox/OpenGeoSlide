import json,subprocess,copy,os,time
from pathlib import Path
ROOT = str(Path(__file__).resolve().parents[4])
def load(n):
    return json.load(open(f'{ROOT}/verification/cases/{n}.json'))['model']
def run(model, ogs=None, t=False):
    ogs=ogs or f'{ROOT}/target/release/ogs'
    t0=time.time()
    p=subprocess.run([ogs,'analyze','/dev/stdin'],input=json.dumps(model),capture_output=True,text=True)
    dt=time.time()-t0
    if p.returncode: return {'rc':p.returncode,'err':p.stderr[:200]}
    o=json.loads(p.stdout)
    return (o,dt) if t else o
def fs(model, ogs=None, method='bishop'):
    m=copy.deepcopy(model); m['analysis']['methods']=[method]
    o=run(m,ogs)
    if 'rc' in o: return None
    r=o['results'][0] if 'results' in o else o
    return o

def anchor(id,x1,y1,x2,y2,T,app='passive',typ='anchor',**kw):
    d={"id":id,"type":typ,"x1":x1,"y1":y1,"x2":x2,"y2":y2,"application":app,"tensile_capacity":T,"direction":"axial","end1_capacity":0.0,"end2_capacity":0.0,"spacing":1.0}
    d.update(kw); return d
def with_search(m, entry=None, exit=None, n=(20,20,20), method='bishop', refine=True, reinf=None, version='0.4'):
    m=copy.deepcopy(m); m['version']=version
    a=m['analysis']; a['methods']=[method]; a.pop('surface',None)
    s={"type":"circular_entry_exit","n_entry":n[0],"n_exit":n[1],"n_radius":n[2],"max_radius_factor":5.0,"min_width":None,"refine":refine}
    if entry: s['entry']=entry
    if exit: s['exit']=exit
    a['search']=s
    if reinf is not None: m['reinforcements']=reinf
    return m
def summ(m, ogs=None):
    o,dt=run(m,ogs,t=True) if True else None
    return o,dt
def best(m, ogs=None):
    r=run(m,ogs,t=True)
    if isinstance(r,dict): return {'err':r}
    o,dt=r; x=o['results'][0]
    return {'fos':x['fos'],'status':x['status'],'surf':x['surface'],'n_cross':len(x.get('reinforcement_forces',[])),'warn':x.get('warnings'),'search':x.get('search'),'t':dt,'forces':[(f.get('id'),f.get('status'),round(f.get('fx',0),2)) for f in x.get('reinforcement_forces',[])]}

def scen_core():
    base=load('V047a'); sc={}
    sc['S1_2pas']=with_search(base,[42,68],[22,38],reinf=[anchor('A1',31,25.5,56,25.5,400),anchor('A2',40,30,65,30,400)])
    sc['S2_act']=with_search(base,[45,65],[22,35],reinf=[anchor('A1',33,26.5,48,26.5,300,'active')])
    sc['S3_1anc']=with_search(base,None,None,reinf=[anchor('A1',36,28,52,28,100,'active')])
    return sc
def fine(m,n=(60,60,40)):
    s=m['analysis']['search']
    return with_search(m,s.get('entry'),s.get('exit'),n=n,method=m['analysis']['methods'][0],reinf=m['reinforcements'],version=m['version'])

import math
def geom(m, ogs=None):
    r=run(m,ogs,t=True)
    o,dt=r; x=o['results'][0]; s=x['surface']; sl=x['slices']
    soil=[q for q in sl if q['weight']>0]
    xs_=[q['x_left'] for q in sl]+[q['x_right'] for q in sl]
    xl=min(xs_); xr=max(xs_)
    out={'fos':x['fos'],'circle':s,'x_extent':(xl,xr),'R':s['r']}
    out['dist']={}
    for rf in m.get('reinforcements',[]):
        for nm,(px,py) in (('head',(rf['x1'],rf['y1'])),('tip',(rf['x2'],rf['y2']))):
            out['dist'][rf['id']+nm]=round(math.hypot(px-s['xc'],py-s['yc'])-s['r'],4)  # >0 outside circle
    return out

def ground_y(m,x):
    ys=[]
    for r in m['regions']:
        p=r['polygon']
        for i in range(len(p)):
            (a,b),(c,d)=p[i],p[(i+1)%len(p)]
            if a==c: 
                if abs(x-a)<1e-9: ys+= [b,d]
                continue
            if min(a,c)-1e-12<=x<=max(a,c)+1e-12:
                ys.append(b+(d-b)*(x-a)/(c-a))
    return max(ys) if ys else None
def xr(m):
    xs=[q[0] for r in m['regions'] for q in r['polygon']]; return min(xs),max(xs)
def case_search(name, frac=0.3, method=None, n=(20,20,20)):
    c=load(name); m=copy.deepcopy(c); a=m['analysis']; s=a.get('surface')
    lo,hi=xr(m)
    if s and s['type']=='circle':
        xc,yc,r=s['xc'],s['yc'],s['r']
        pts=[]
        for x in [lo+(hi-lo)*i/4000 for i in range(4001)]:
            g=ground_y(m,x)
            if g is None: continue
            pts.append((x, math.hypot(x-xc,g-yc)-r))
        roots=[pts[i][0] for i in range(len(pts)-1) if pts[i][1]*pts[i+1][1]<=0 and pts[i][1]!=pts[i+1][1]]
        if len(roots)<2: return None
        xa,xb=min(roots),max(roots)
    elif s:
        xa,xb=s['points'][0][0],s['points'][-1][0]
        xa,xb=min(xa,xb),max(xa,xb)
    else:
        return None
    w=xb-xa; d=frac*w
    left=[max(lo,xa-d),min(hi,xa+d)]; right=[max(lo,xb-d),min(hi,xb+d)]
    # direction from model
    meth=method or ('bishop' if 'bishop' in a['methods'] else a['methods'][0])
    if meth.startswith('janbu') or meth=='morgenstern_price': meth='bishop'
    mm=with_search(m,left if True else None,right,n=n,method=meth,reinf=m['reinforcements'],version='0.4')
    return mm

import random
def rand_scen(seed):
    rnd=random.Random(seed); base=load('V047a')
    k=rnd.choice([1,2,2,3,4]); reinf=[]
    for i in range(k):
        typ=rnd.choice(['anchor','nail','geosynthetic']); app=rnd.choice(['active','passive','passive'])
        xh=rnd.uniform(30,49); yh=25+(xh-30)/2
        if rnd.random()<0.3: yh-=rnd.uniform(0,3)
        ang=math.radians(rnd.uniform(-25,15)); L=rnd.uniform(6,26)
        reinf.append(anchor(f'R{i+1}',xh,yh,xh+L*math.cos(ang),yh+L*math.sin(ang),rnd.choice([60,100,200,300,400,600]),app,typ))
    e=rnd.choice([None,[42,68],[45,65]]); x=rnd.choice([None,[22,38],[22,35],[25,45]])
    m=with_search(base,e,x,reinf=reinf,method=rnd.choice(['bishop','bishop','spencer']))
    return m
