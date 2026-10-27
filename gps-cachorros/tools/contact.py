import sys, re
from PIL import Image, ImageDraw
out=sys.argv[1]; cols=int(sys.argv[2]); files=sys.argv[3:]
ims=[Image.open(f).convert('RGB') for f in files]
w,h=ims[0].size
rows=(len(ims)+cols-1)//cols
o=Image.new('RGB',(cols*w,rows*h)); d=ImageDraw.Draw(o)
for i,(im,f) in enumerate(zip(ims,files)):
    x,y=(i%cols)*w,(i//cols)*h; o.paste(im,(x,y))
    m=re.search(r'_(\d+(?:_\d+)?)\.png$',f); lab=m.group(1).replace('_','.') if m else str(i)
    d.rectangle([x,y,x+60,y+22],fill=(0,0,0)); d.text((x+4,y+4),lab+'s',fill=(255,255,0))
o.save(out); print(out,o.size)
