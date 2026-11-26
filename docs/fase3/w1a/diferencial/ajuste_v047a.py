import sys, json, copy, random, subprocess, os, math
sys.path.insert(0, "/home/xodla/archivos/opengeoslide/verification/harness")
import cslope
from to_cslope import ogs_to_cslope
OGS="/home/xodla/archivos/opengeoslide-wt/f3w1a/target/release/ogs"
V = json.load(open("/home/xodla/archivos/opengeoslide/verification/cases/V047a.json"))["model"]
V["analysis"]["surface"] = dict(type="circle", xc=29.54334963719809, yc=53.63784815923435, r=28.641487934160704)
D = ogs_to_cslope(V, {"method": "bishop", "kind": "fixed", "options": {"slices": 50}}).document["definition"]
OPT = dict(slices=200, tolerance=1e-6, maxIterations=500, searchMethod="circular", compositeSurfaces=False,
           compositeBase=False, nonCircularOptimization=False, bothDirections=False)
def ground(x):
    return 25.0 if x<=30 else (25+0.5*(x-30) if x<=50 else 35.0)
def cs(points):
    P = copy.deepcopy(D); P.pop("customSearchPlanes")
    P["customSurfaces"] = [{"points": points}]
    try:
        r = cslope.analyse(P, dict(OPT, method="Morgenstern-Price", intersliceFunction="constant"))
    except Exception as e:
        return ("exc", str(e))
    cs_=r.get("customSurfaces") or []
    if not cs_ or not r.get("allSurfaces"): return ("none", r.get("warnings"))
    s=r["criticalSurface"]
    return ("ok", r["minFOS"], s["entryPoint"], s["exitPoint"], s.get("converged"))
def og(points, direction):
    doc=copy.deepcopy(V); doc["version"]="0.3"
    doc["slope"]={"direction":direction}
    doc["analysis"]={"methods":["spencer"],"slices":200,"tolerance":1e-6,"max_iterations":500,"min_m_alpha":0.2,
        "surface":{"type":"polyline","points":points}}
    p=f"{os.environ['TMPDIR']}/dfit.json"; json.dump(doc,open(p,"w"))
    r=subprocess.run([OGS,"analyze",p],capture_output=True,text=True)
    if r.returncode!=0: return ("err", r.stderr.strip()[:100])
    res=json.loads(r.stdout)["results"][0]
    pts=res["surface"]["points"]
    return (res["status"], res["fos"], pts[0], pts[-1], res["warnings"])

random.seed(int(sys.argv[1])); N=int(sys.argv[2])
from collections import Counter
c=Counter(); bad=0; n=0
for it in range(N):
    m=random.randint(2,6)
    x0=random.uniform(24,44); x1=random.uniform(x0+6,66)
    xs=sorted(random.uniform(x0,x1) for _ in range(m))
    pts=[]
    for i,x in enumerate(xs):
        end = i in (0,m-1)
        depth = random.uniform(-2.5,4) if end else random.uniform(0.3,6)
        pts.append([round(x,6), round(ground(x)-depth,6)])
    if any(pts[i+1][0]-pts[i][0] < 1e-3 for i in range(len(pts)-1)): continue
    n+=1
    a=cs(pts); b=og(pts,"right_to_left")
    cs_ok = a[0]=="ok"
    og_fit = (b[0] not in ("err",)) and not (b[0]=="invalid" and any(w.startswith("polyline_") for w in b[4]))
    if b[0]=="err": og_fit = False
    c[(cs_ok,og_fit)]+=1
    if cs_ok and og_fit:
        e=abs(a[2][0]-b[3][0])+abs(a[2][1]-b[3][1])+abs(a[3][0]-b[2][0])+abs(a[3][1]-b[2][1])
        if e>1e-6: print("ENDS",pts,a[2:4],b[2:4]); bad+=1
        if b[0]=="converged":
            d=abs(a[1]-b[1])/a[1]; c[("fs",d<1e-3)]+=1
            if d>=1e-3: print("FS",pts,"cs",a[1],"og",b[1],b[4])
            c["maxrel"]=max(c["maxrel"],d)
    elif False:
        msg=a[1] if a[0]=="exc" else ""
        reason=msg.split("Custom surface 1:")[-1].strip()[:60]
        c[("reason",reason, og_fit)]+=1
        if "through soil" in reason.lower() or "not cut" in reason.lower() or ("converge" not in reason.lower() and a[0]=="exc") or a[0]!="exc":
            print("ACCEPT cs=",a,"og=",b,pts)
print(c,"ends-bad",bad,"of",n)
