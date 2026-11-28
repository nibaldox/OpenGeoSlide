#!/usr/bin/env python3
"""Barrido reproducible de semilla y costo para una variante compilada de E17b."""
import argparse, copy, json, os, pathlib, statistics, subprocess, time
from concurrent.futures import ThreadPoolExecutor
HERE=pathlib.Path(__file__).resolve().parent

def call(binary,m):
    t=time.perf_counter()
    p=subprocess.run([str(binary),'analyze','/dev/stdin'],input=json.dumps(m),text=True,capture_output=True,check=True)
    r=json.loads(p.stdout)['results'][0]
    return {'fos':r['fos'],'seconds':time.perf_counter()-t,'warnings':r['warnings'],'stats':r['search']['non_circular']['global'] if r['search'].get('non_circular') else None}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--bin',type=pathlib.Path,required=True);ap.add_argument('--variant',required=True);ap.add_argument('--jobs',type=int,default=2);ap.add_argument('--stride',type=int,default=1);a=ap.parse_args()
    models={n:json.loads((HERE/'models'/f'{n}.json').read_text()) for n in ('V053','S2')}
    circ={}
    for n,m in models.items():
        m=copy.deepcopy(m);m['version']='0.6';m['analysis']['search'].pop('non_circular',None)
        circ[n]=[call(a.bin,m)['seconds'] for _ in range(3)]
    def job(item):
        n,seed=item;m=copy.deepcopy(models[n]);m['version']='0.7';m['analysis']['search']['non_circular']={'global':{'seed':seed}};return {'model':n,'seed':seed,**call(a.bin,m)}
    rows=[];out=HERE/(a.variant+'.jsonl');out.write_text('')
    with ThreadPoolExecutor(max_workers=a.jobs) as pool, out.open('a') as f:
        for row in pool.map(job,[(n,s*a.stride) for n in models for s in range(48)]):
            rows.append(row);f.write(json.dumps(row)+'\n');f.flush();print(row['model'],row['seed'],row['fos'],row['seconds'],flush=True)
    report={}
    for n in models:
        group=[r for r in rows if r['model']==n];times=circ[n];fs=[r['fos'] for r in group];ratios=[r['seconds']/statistics.median(times) for r in group]
        report[n]={'n':len(group),'min':min(fs),'median':statistics.median(fs),'max':max(fs),'passed_band':sum(1.01*(1-0.035)<=x<=1.01*(1+0.035) for x in fs) if n=='V053' else None,'seed0':group[0]['fos'],'circular_seconds':times,'ratios_median':statistics.median(ratios),'ratios_max':max(ratios)}
    (HERE/(a.variant+'-summary.json')).write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report,indent=2),flush=True)
if __name__=='__main__':main()
