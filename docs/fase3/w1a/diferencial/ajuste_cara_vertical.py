import sys, json, copy, random, subprocess, os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "verification/harness"))
import cslope
from to_cslope import ogs_to_cslope
from collections import Counter
OGS=str(ROOT / "target/release/ogs")
POLY=[[0,0],[0,30],[20,30],[20,20],[30,20],[40,26],[50,26],[50,0]]   # vertical face 20: 30->20, then a bench and a ramp up
def ground(x, side="left"):
    if x<20: return 30.0
    if x==20: return 20.0 if side=="right" else 30.0
    if x<=30: return 20.0
    if x<=40: return 20+0.6*(x-30)
    return 26.0
def model(direction):
    return {"format":"opengeoslide","version":"0.1","meta":{"id":"W","title":"wall"},"units":"SI",
     "materials":[{"id":"s","name":"s","model":"mohr_coulomb","unit_weight":19.0,"cohesion":8.0,"friction_angle":25.0}],
     "regions":[{"material":"s","polygon":POLY}],"slope":{"direction":direction},
     "analysis":{"methods":["bishop"],"slices":200,"tolerance":1e-6,"max_iterations":500,"min_m_alpha":0.2,
        "surface":{"type":"circle","xc":10,"yc":60,"r":45}}}
OPT = dict(slices=200, tolerance=1e-6, maxIterations=500, searchMethod="circular", compositeSurfaces=False, compositeBase=False, nonCircularOptimization=False, bothDirections=False)
def cs(points,direction):
    m=model(direction)
    D = ogs_to_cslope(m, {"method": "bishop", "kind": "fixed", "options": {"slices": 200}}).document["definition"]
    D.pop("customSearchPlanes",None); D["customSurfaces"]=[{"points":points}]
    try:
        r = cslope.analyse(D, dict(OPT, method="Morgenstern-Price", intersliceFunction="constant"))
    except Exception as e: return ("exc",str(e))
    s=r["criticalSurface"]; return ("ok",r["minFOS"],s["entryPoint"],s["exitPoint"])
def og(points,direction):
    m=model(direction); m["version"]="0.3"; m["analysis"]["methods"]=["spencer"]; m["analysis"]["surface"]={"type":"polyline","points":points}
    p=f"{os.environ['TMPDIR']}/dwall.json"; json.dump(m,open(p,"w"))
    r=subprocess.run([OGS,"analyze",p],capture_output=True,text=True)
    if r.returncode!=0: return ("err",r.stderr.strip()[:120])
    res=json.loads(r.stdout)["results"][0]; pts=res["surface"]["points"]
    return (res["status"],res["fos"],pts[0],pts[-1],res["warnings"])
random.seed(int(sys.argv[1])); N=int(sys.argv[2]); c=Counter()
for it in range(N):
    direction=random.choice(["left_to_right","right_to_left"])
    m=random.randint(2,6)
    x0=random.uniform(2,30); x1=random.uniform(x0+6,48)
    xs=sorted(random.uniform(x0,x1) for _ in range(m))
    pts=[]
    for i,x in enumerate(xs):
        end=i in (0,m-1)
        depth=random.uniform(-2.5,4) if end else random.uniform(0.3,9)
        g=ground(x,"left") if x<20 else ground(x)
        pts.append([round(x,6),round(g-depth,6)])
    if any(pts[i+1][0]-pts[i][0]<1e-3 for i in range(len(pts)-1)): continue
    a=cs(pts,direction); b=og(pts,direction)
    cs_ok=a[0]=="ok"; og_fit = b[0]!="err" and not (b[0]=="invalid" and any(w.startswith("polyline_") for w in b[4]))
    c[(cs_ok,og_fit)]+=1
    if cs_ok and og_fit:
        e=abs(a[2][0]-b[3][0])+abs(a[2][1]-b[3][1])+abs(a[3][0]-b[2][0])+abs(a[3][1]-b[2][1])
        # direction may reverse which end is entry; compare as sets
        e2=abs(a[2][0]-b[2][0])+abs(a[2][1]-b[2][1])+abs(a[3][0]-b[3][0])+abs(a[3][1]-b[3][1])
        if min(e,e2)>1e-6: print("ENDS",direction,pts,a[2:4],b[2:4]); c["endsbad"]+=1
        if b[0]=="converged":
            d=abs(a[1]-b[1])/a[1]; c["maxrel"]=max(c["maxrel"],d)
            if d>1e-3: print("FS",direction,pts,a[1],b[1],b[4])
    elif cs_ok and not og_fit: print("COSLOPE-ONLY",direction,pts,a,b)
    elif og_fit and not cs_ok:
        msg=a[1].split("Custom surface 1:")[-1].strip()[:50]
        c[("ogs-only",msg)]+=1
print(c)
