# Uso: python identidad.py <raíz del repo> <binario ogs> <directorio de salida>; escribe SHA.json con los 36 modelos.
# Los modelos de verification/cases/V*.json se extraen de su campo "model". Necesita TMPDIR (escribe ahí los modelos).
import json, glob, os, subprocess, sys, hashlib
root=sys.argv[1]; binary=sys.argv[2]; out=sys.argv[3]
os.makedirs(out, exist_ok=True)
models={}
for f in sorted(glob.glob(f"{root}/verification/cases/V*.json")):
    d=json.load(open(f)); models[os.path.basename(f)]=json.dumps(d["model"]) 
for f in sorted(glob.glob(f"{root}/verification/differential/cases/*.ogs.json")):
    models[os.path.basename(f)]=open(f).read()
models["acads1a.ogs.json"]=open(f"{root}/examples/acads1a.ogs.json").read()
res={}
for name,text in models.items():
    p=f"{os.environ['TMPDIR']}/ident/models/{name}"
    open(p,"w").write(text)
    r=subprocess.run([binary,"analyze",p],capture_output=True)
    blob=r.stdout+b"\n--stderr--\n"+r.stderr+f"\nexit={r.returncode}".encode()
    open(f"{out}/{name}.out","wb").write(blob)
    res[name]=hashlib.sha256(blob).hexdigest()
json.dump(res,open(f"{out}/SHA.json","w"),indent=1)
print(len(res),"models")
