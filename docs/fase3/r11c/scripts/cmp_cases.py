import sys; sys.path.insert(0,'.')
from bench_set import *
import glob,hashlib
rows=[]; same=0; diff=0
files=sorted(glob.glob(ROOT+'/verification/cases/*.json'))+sorted(glob.glob(ROOT+'/verification/pending/*.json'))+sorted(glob.glob(ROOT+'/examples/*.json'))
cs=json.load(open('cases_search.json'))
n=0
for f in files:
    try: d=json.load(open(f))
    except Exception: continue
    m=d.get('model',d)
    if not isinstance(m,dict) or not m.get('reinforcements'): continue
    n+=1; name=os.path.basename(f)[:-5]
    variants={'own':m}
    if name in cs: variants['search']=cs[name]
    for vn,mm in variants.items():
        a=subprocess.run([BASE,'analyze','/dev/stdin'],input=json.dumps(mm),capture_output=True,text=True)
        b=subprocess.run([NEW,'analyze','/dev/stdin'],input=json.dumps(mm),capture_output=True,text=True)
        eq=(a.stdout==b.stdout and a.returncode==b.returncode and a.stderr==b.stderr)
        extra=''
        if not eq and a.returncode==0 and b.returncode==0:
            ra,rb=json.loads(a.stdout)['results'],json.loads(b.stdout)['results']
            extra=' '.join(f"{x['method']}:{x['fos']:.6f}->{y['fos']:.6f}" for x,y in zip(ra,rb))
        elif not eq: extra=f'rc {a.returncode}->{b.returncode}'
        if eq: same+=1
        else: diff+=1
        print(f"{name:8s} {vn:6s} {'IDENTICAL' if eq else 'CHANGED '} {extra}",flush=True)
print('models with reinforcements',n,'runs same',same,'changed',diff)
