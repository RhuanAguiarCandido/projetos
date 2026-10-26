import sys, os, soundfile as sf, numpy as np, json
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.onnx","voices-v1.0.bin")
lines=open('lines.txt').read().splitlines()
speeds=[1,1,1,1.05,1.05,1.05,1,1,1]
plan=[0.5,4.45,8.3,11.95,13.9,15.65,17.95,21.0,22.4]
voice=sys.argv[1]; out=sys.argv[2]; os.makedirs(out,exist_ok=True)
starts=[];prev_end=0
for i,l in enumerate(lines):
    s,sr=k.create(l,voice=voice,speed=speeds[i],lang="pt-br")
    a=np.abs(s); idx=np.where(a>0.008)[0]; s=s[max(idx[0]-480,0):min(len(s),idx[-1]+int(0.25*sr))]
    f=int(0.04*sr); s[-f:]*=np.linspace(1,0,f); s[:120]*=np.linspace(0,1,120)
    sf.write(f"{out}/raw_{i}.wav",s,sr)
    st=max(plan[i],prev_end+0.3); starts.append(round(st,2)); prev_end=st+len(s)/sr-0.25
print(voice,starts,'end',round(prev_end,2))
json.dump(starts,open(f"{out}/starts.json","w"))
