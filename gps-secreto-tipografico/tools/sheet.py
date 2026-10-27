import sys
from PIL import Image
out=sys.argv[1]; files=sys.argv[2:]
ims=[Image.open(f).convert('RGB') for f in files]
w,h=ims[0].size
c=Image.new('RGB',(w*len(ims),h))
for i,im in enumerate(ims): c.paste(im,(i*w,0))
c.save(out)
