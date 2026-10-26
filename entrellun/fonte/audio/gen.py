import sys, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.onnx","voices-v1.0.bin")
lines = ["Toda empresa é feita de encontros.",
"Entre o potencial das pessoas e o futuro do negócio.",
"Quando essas forças se conectam, o crescimento ganha direção.",
"Desenvolvemos lideranças.","Organizamos processos.","Conectamos pessoas e resultados.",
"Assim nasce a Entrellun.","Gente e Gestão.","Conexões que sustentam o crescimento."]
voice=sys.argv[1]; speed=float(sys.argv[2]); out=sys.argv[3]
for i,l in enumerate(lines):
    s,sr=k.create(l,voice=voice,speed=speed,lang="pt-br")
    a=np.abs(s); idx=np.where(a>0.01)[0]; s=s[max(idx[0]-240,0):idx[-1]+2400]
    sf.write(f"{out}/{voice}_{i}.wav",s,sr); print(i, sr, round(len(s)/sr,2), l)
