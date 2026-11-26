import sys,os; sys.path.insert(0,'.')
from bench_set import *
cache=json.load(open('ref_cache.json')); sc=scenarios()
T=os.environ['TMPDIR']+'/r11c/'
bins={'base':BASE,'A_through_only':T+'ablA-target/release/ogs','B_seeds_only':T+'ablB-target/release/ogs','full':NEW}
keys=['S1_2pas','S2_act','r0','r22','r27','r34','r5','r12','r38','V037b','V084a']
print('| escenario | '+' | '.join(bins)+' |'); print('|---|'+'---|'*len(bins))
tt={k:0 for k in bins}; worst={k:-9 for k in bins}
for k in keys:
    row=[]
    for n,b in bins.items():
        d=best(sc[k],b); g=100*(d['fos']/cache[k]['fine']-1); row.append(f"{g:+.2f} %"); tt[n]+=d['t']; worst[n]=max(worst[n],g)
    print(f'| {k} | '+' | '.join(row)+' |',flush=True)
print('| peor brecha | '+' | '.join(f"{worst[n]:+.2f} %" for n in bins)+' |'); print('| tiempo total s | '+' | '.join(f"{tt[n]:.2f}" for n in bins)+' |')
