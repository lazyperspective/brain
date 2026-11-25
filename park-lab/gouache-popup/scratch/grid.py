import sys
from PIL import Image
fs=sys.argv[2:]; n=len(fs); im=Image.new('RGB',(540*2,540*((n+1)//2)))
for i,f in enumerate(fs): im.paste(Image.open(f).resize((540,540)),((i%2)*540,(i//2)*540))
im.save(sys.argv[1])
