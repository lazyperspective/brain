# Cinematic grade looks for the finished Everywhere Claude master.
# Each LOOK_* is an ffmpeg -filter_complex graph from [0:v] to [v].

# 1. Film print: soft S-curve with lifted blacks and rolled-off highlights,
#    cool shadows / warm highlights, gentle red halation, fine grain, light vignette.
LOOK_film="[0:v]format=gbrp,curves=all='0/0.035 0.18/0.15 0.5/0.5 0.82/0.84 1/0.955',
colorbalance=rs=-0.03:gs=0.0:bs=0.035:rm=0.015:bm=-0.015:rh=0.04:gh=0.012:bh=-0.035,
eq=saturation=0.93,split[a0][h0];[a0]format=gbrp[a];[h0]format=gbrp,
curves=all='0/0 0.72/0 1/1',gblur=sigma=14,colorchannelmixer=rr=1:rg=0:rb=0:gr=0.25:gg=0:gb=0:br=0.05:bg=0:bb=0,format=gbrp[hl];
[a][hl]blend=all_mode=screen:all_opacity=0.22,vignette=angle=PI/7,noise=alls=5:allf=t,format=yuv420p[v]"

# 2. Teal & orange, gentle: shadows toward teal, mids/highlights toward amber,
#    a touch more contrast, skies nudged teal, warm tones kept.
LOOK_teal="[0:v]format=gbrp,curves=all='0/0.02 0.25/0.22 0.5/0.5 0.75/0.79 1/0.98',
colorbalance=rs=-0.05:gs=0.0:bs=0.045:rm=0.035:gm=0.0:bm=-0.04:rh=0.03:gh=0.005:bh=-0.03,
selectivecolor=blues='0.12 -0.02 0 0':cyans='0.06 0 0 0':reds='0 -0.04 -0.06 0',
eq=saturation=1.05,vignette=angle=PI/7,noise=alls=4:allf=t,format=yuv420p[v]"

# 3. Alpine matte: cooler, slightly desaturated, matte lifted blacks,
#    soft bloom on bright snow/sky, fine grain.
LOOK_alpine="[0:v]format=gbrp,curves=all='0/0.07 0.25/0.25 0.5/0.5 0.8/0.8 1/0.94',
colorbalance=rs=-0.02:bs=0.025:rm=-0.01:bm=0.015:rh=-0.01:bh=0.02,
eq=saturation=0.82,split[a0][h0];[a0]format=gbrp[a];[h0]format=gbrp,
curves=all='0/0 0.75/0 1/1',gblur=sigma=22,format=gbrp[hl];
[a][hl]blend=all_mode=screen:all_opacity=0.18,vignette=angle=PI/7.5,noise=alls=5:allf=t,format=yuv420p[v]"
