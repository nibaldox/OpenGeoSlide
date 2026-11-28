#!/usr/bin/env python3
"""Medición de 40 modelos X37; ejecutar en el entorno de cSlope 0.1.0."""
import argparse, copy, importlib.util, json, statistics, subprocess, sys, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[1];sys.path.insert(0,str(ROOT/'verification/harness'))
import cslope, to_cslope

def entries():
    out=[];checks=json.loads((HERE/'models/checks.json').read_text())
    for name in ('V036c','V036d','V039','V041a','V041b','V051','V053','V098'):
        out.append(dict(id=name,model=json.loads((HERE/'models'/f'{name}.json').read_text()),checks=checks[name],group='published'))
    for name in ('V002-nc','V001-nc','V026-nc','V033-nc','V034a-nc','V034b-nc'):
        d=json.loads((ROOT/('verification/pending/F3B' if name=='V002-nc' else 'verification/cases')/f'{name}.json').read_text());out.append(dict(id=name,model=d['model'],checks=d['checks'],group='published'))
    for name in ('S1','S2'):out.append(dict(id=name,model=json.loads((HERE/'models'/f'{name}.json').read_text()),checks=[],group='synthetic'))
    spec=importlib.util.spec_from_file_location('x37models',ROOT/'docs/cm/exploracion/X37_proto/models.py');x=importlib.util.module_from_spec(spec);spec.loader.exec_module(x);out.extend(x.sweep())
    assert len(out)==40 and len({e['id'] for e in out})==40
    return out

def execute(binary,model):
    t=time.perf_counter();p=subprocess.run([str(binary),'analyze','/dev/stdin'],input=json.dumps(model),text=True,capture_output=True)
    elapsed=time.perf_counter()-t
    if p.returncode:raise RuntimeError(p.stderr)
    return p.stdout,json.loads(p.stdout)['results'][0],elapsed

def measure(e,binary,parallel):
    out=dict(id=e['id'],group=e['group'],checks=e['checks'])
    for label in ('circular','refinement','global'):
        m=copy.deepcopy(e['model']);m['version']='0.7' if label=='global' else '0.6';s=m['analysis']['search'];s.pop('non_circular',None)
        if label!='circular':s['non_circular']={'seeds':3,'max_vertices':33}
        if label=='global':s['non_circular']['global']={}
        runs=[execute(binary,m) for _ in range(3)];text,r,_=runs[0]
        out[label]=dict(fos=r['fos'],status=r['status'],warnings=r['warnings'],surface=r['surface'],stats=r['search'].get('non_circular',{}).get('global'),seconds=[x[2] for x in runs],deterministic=all(x[0]==text for x in runs))
        if label=='global' and parallel:out[label]['parallel_identical']=execute(parallel,m)[0]==text
    return out

def oracle(e,r):
    stats=r['global']['stats'] or {}
    if stats.get('winner')!='global':return None
    m=copy.deepcopy(e['model']);m['version']='0.6';m['analysis'].pop('search',None);m['analysis']['surface']={'type':'polyline','points':r['global']['surface']['points']}
    try:
        check={'method':'spencer','kind':'fixed','options':{'slices':m['analysis'].get('slices',50)}};o=cslope.analyse(to_cslope.ogs_to_cslope(m,check).document)
        return dict(fos=o.get('minFOS'),converged=(o.get('criticalSurface') or {}).get('converged'),error=None)
    except Exception as ex:return dict(fos=None,converged=False,error=str(ex))

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--bin',type=Path,required=True);ap.add_argument('--parallel-bin',type=Path);ap.add_argument('--jobs',type=int,default=2);a=ap.parse_args();es=entries();rows=[]
    def job(e):
        try:return measure(e,a.bin,a.parallel_bin)
        except Exception as ex:return dict(id=e['id'],error=str(ex))
    with ThreadPoolExecutor(max_workers=a.jobs) as pool,(HERE/'measurements.jsonl').open('w') as file:
        for r in pool.map(job,es):rows.append(r);file.write(json.dumps(r)+'\n');file.flush();print(r['id'],r.get('error','ok'),flush=True)
    emap={e['id']:e for e in es};valid=[r for r in rows if 'error' not in r]
    for r in valid:r['oracle']=oracle(emap[r['id']],r)
    ratios=[statistics.median(r['global']['seconds'])/statistics.median(r['circular']['seconds']) for r in valid];checks=[]
    for r in valid:
        for c in r['checks']:
            if c.get('kind')=='search' and c.get('published') is not None:checks.append(dict(id=r['id'],published=c['published'],tolerance=c['tolerance'],fos=r['global']['fos'],passed=r['global']['fos']<=c['published']*(1+c['tolerance'])))
    result=dict(models=rows,checks=checks,ratios=dict(median=statistics.median(ratios) if ratios else None,maximum=max(ratios) if ratios else None),incomplete=['A2b: robustez separada','A7: WASM Chrome pendiente','A9: prototipo pendiente'])
    (HERE/'REPORT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    lines=['# Medición global (40 modelos)','',f"Completados: {len(valid)}/40; errores: {40-len(valid)}.",f"Costo global/circular: mediana {result['ratios']['median']}; máximo {result['ratios']['maximum']}. Tres repeticiones.",f"Checks publicados de un lado: {sum(c['passed'] for c in checks)}/{len(checks)}.",'','| Modelo | Circular | Sin global | Global | Ganador | Evaluaciones | cSlope |','|---|---:|---:|---:|---|---:|---:|']
    for r in rows:
        if 'error' in r:lines.append(f"| {r['id']} | ERROR | {r['error']} | | | | |");continue
        g=r['global'];s=g['stats'] or {};o=r['oracle'] or {};lines.append(f"| {r['id']} | {r['circular']['fos']:.6f} | {r['refinement']['fos']:.6f} | {g['fos']:.6f} | {s.get('winner','—')} | {s.get('evaluated','—')} | {o.get('fos','—')} |")
    lines+=['','Pendiente: '+'; '.join(result['incomplete'])];(HERE/'REPORT.md').write_text('\n'.join(lines)+'\n');return int(len(valid)!=40 or any(not c['passed'] for c in checks))
if __name__=='__main__':sys.exit(main())
