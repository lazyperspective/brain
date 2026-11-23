import cv2, numpy as np, sys, os
src, out, step = sys.argv[1], sys.argv[2], float(sys.argv[3])
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
frames=[]; i=0; nxt=0.0
while True:
    ok, f = cap.read()
    if not ok: break
    t=i/fps
    if t+1e-6>=nxt:
        th=cv2.resize(f,(216,384),interpolation=cv2.INTER_AREA)
        cv2.rectangle(th,(0,0),(70,22),(0,0,0),-1)
        cv2.putText(th,f"{t:4.1f}s",(4,16),cv2.FONT_HERSHEY_SIMPLEX,0.5,(255,255,255),1,cv2.LINE_AA)
        frames.append(th); nxt+=step
    i+=1
cols=10; rows=(len(frames)+cols-1)//cols
sheet=np.full((rows*388,cols*220,3),30,np.uint8)
for k,th in enumerate(frames):
    r,c=divmod(k,cols); sheet[r*388+2:r*388+386,c*220+2:c*220+218]=th
cv2.imwrite(out,sheet,[cv2.IMWRITE_JPEG_QUALITY,85]); print(out,len(frames),sheet.shape)
