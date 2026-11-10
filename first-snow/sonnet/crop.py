# usage: python3 crop.py in.png out.png x y w h [zoom]
import sys
from PIL import Image
a=sys.argv
im=Image.open(a[1]); x,y,w,h=map(int,a[3:7]); z=float(a[7]) if len(a)>7 else 1
c=im.crop((x,y,x+w,y+h))
if z!=1: c=c.resize((int(w*z),int(h*z)),Image.LANCZOS)
c.save(a[2])
