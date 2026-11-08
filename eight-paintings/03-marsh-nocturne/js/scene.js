// Marsh Nocturne: the plan (a tonal study in GLSL) and the painting campaign (the layers, in order).
// A coastal salt marsh at dusk turning to night, in the manner of American Tonalism: low horizon, a vast veiled sky
// with the last afterglow low on the right, a thin moon rising in the dusk on the left, a tidal creek meandering
// toward the glow, a moored skiff, salt-hay stacks and a stand of cedars, mist lying on the water.
(function (G) {
  'use strict';
  const R = G.RNG;

  const PLAN = `
const float YH = 0.632;            // horizon (fraction of height)
const vec2 MOON = vec2(560., 520.); // design px
const float MOONR = 30.;
vec3 lin(vec3 c){ return pow(max(c, 0.), vec3(2.2)); }
float lum(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }

// ---- the creek: a meandering S through the marsh. Centre line (fraction of width) at depth d (0 horizon, 1 bottom)
float creekX(float d){
  float P[8] = float[8](0.555, 0.51, 0.37, 0.52, 0.64, 0.66, 0.575, 0.47);
  float t = clamp(d, 0., 1.) * 7.; int i = int(min(floor(t), 6.)); float f = t - float(i);
  float p0 = P[max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[min(i + 2, 7)];
  float x = 0.5 * ((2. * p1) + (-p0 + p2) * f + (2. * p0 - 5. * p1 + 4. * p2 - p3) * f * f + (-p0 + 3. * p1 - 3. * p2 + p3) * f * f * f);
  // far meanders, compressed by perspective
  float z = 1. / (d + 0.05);
  return x + (d + 0.03) * 0.55 * sin(z * 0.85 + 0.6) * smoothstep(0.38, 0.06, d);
}
float creekHW(float d){
  return (0.0035 + 0.12 * pow(d, 1.2)) * (0.55 + 0.9 * vnoise(vec2(d * 9., 2.5))) + 0.06 * exp(-d / 0.022);
}
float creekSlope(float d){ // dX/dY in pixels
  float dd = 0.01;
  return (creekX(min(d + dd, 1.)) - creekX(max(d - dd, 0.))) * 2160. / ((min(d + dd, 1.) - max(d - dd, 0.)) * (1. - YH) * 2700.);
}
// signed distance-ish to open water (negative inside): creek, a lagoon under the glow, a side channel
float waterD(float X, float Y, float d){
  float cx = creekX(d), hw = creekHW(d);
  float sl = creekSlope(d);
  float edgeN = (fbm(vec2(Y * 260., X * 3.), 4) - .5) * (0.003 + 0.02 * d);
  float wc = abs(X - cx) - hw * sqrt(1. + 0.6 * sl * sl) - edgeN;
  // the lagoon: a long sheet under the glow, deepening under the cedars on its far shore
  float lx0 = 0.44 + 0.03 * (fbm(vec2(Y * 400., 2.), 3) - .5), lx1 = 0.945 + 0.02 * (fbm(vec2(Y * 300., 6.), 3) - .5);
  float top = YH + 0.0035;
  float bot = YH + 0.0105 + 0.007 * fbm(vec2(X * 14., 3.), 4) + 0.004 * sin(X * 40.)
            + 0.009 * smoothstep(0.74, 0.77, X) * (1. - smoothstep(0.93, 0.95, X)) * (0.6 + 0.8 * fbm(vec2(X * 80., 9.), 4));
  float wb = max(max(top - Y, Y - bot) * 2.5, max(lx0 - X, X - lx1) * 0.4);
  if (X > 0.62 && X < 0.69) wb = max(wb, -(abs(Y - (YH + 0.006 + 0.002 * sin(X * 30.))) - 0.0008) * 2.5);
  // a side channel winding off to the left toward the pannes
  float cx3 = creekX(0.25);
  float tx = clamp((X - 0.12) / (cx3 - 0.12), 0., 1.);
  float tY = YH + (1. - YH) * (0.11 + 0.14 * pow(tx, 1.6) + 0.012 * sin(tx * 9.));
  float tw = (abs(Y - tY) * 2700. / 2160. - (0.0010 + 0.0028 * tx) * (0.6 + 0.8 * vnoise(vec2(X * 40., 1.)))) * 1.5;
  tw = X < 0.12 || X > cx3 ? 1. : tw;
  return min(min(wc, wb), tw);
}
// ---- the cedars on the lagoon's far shore (also used, mirrored, for their reflections)
float cedarTree(int i, float X, float Y, bool mirror, out vec3 cc, out vec2 cdir){
  float fi = float(i);
  float bx = i == 0 ? 0.805 : i == 1 ? 0.842 : i == 2 ? 0.872 : 0.925;
  float by = YH + 0.0042 + 0.0006 * fi;
  float ht = (i == 0 ? 0.118 : i == 1 ? 0.088 : i == 2 ? 0.104 : 0.058) * 0.92;
  float wd2 = ht * (i == 1 ? 0.30 : 0.24);
  float t = mirror ? (Y - by) / ht : (by - Y) / ht;
  cc = vec3(0.); cdir = vec2(0., 1.);
  if (t <= -0.01 || t >= 0.995) return 0.;
  float tt = clamp(t, 0., 1.);
  float prof = wd2 * pow(sin(3.1416 * clamp(tt * 0.75 + 0.25, 0., 1.)), 0.55) * (1. - 0.35 * tt);
  prof *= 0.62 + 0.75 * fbm(vec2(tt * ht * 2700. / 55., fi * 3.), 4);
  float lean = 0.05 * ht * tt * tt;
  float sx = (X - bx - lean) * 2160. / 2700.;
  prof *= 0.85 + 0.3 * smoothstep(-1., 1., sign(sx)) * fbm(vec2(tt * 9., fi + 20.), 3);
  float ax = abs(sx);
  vec2 fp = vec2(sx * 2700., (by - tt * ht) * 2700.);
  float clump = fbm(fp / 34. + fi * 13., 4) - .5;
  float fringe = fbm(fp / 7. + fi * 5., 3) - .5;
  float rr = ax / max(prof, 1e-5) + 0.55 * clump + 0.30 * fringe;
  float tr = (1. - smoothstep(0.86, 1.0, rr)) * smoothstep(-0.01, 0.05, t);
  cc = vec3(.08,.078,.064);
  float lit = smoothstep(.1, .45, clump + 0.25 * sx / max(prof, 1e-4)) * (0.4 + 0.6 * tt);
  cc = mix(cc, vec3(.15,.14,.10), lit * .55);
  cc *= 0.85 + 0.3 * smoothstep(-.2, .3, fringe);
  float mst = exp(-max(t, 0.) / 0.15) * 0.65;
  cc = mix(cc, vec3(.42,.40,.37), mst);
  float a = 6.2832 * fbm(fp / 40. + 3., 3);
  cdir = normalize(vec2(cos(a), sin(a)) + vec2(0., 0.6));
  return tr * (1. - 0.3 * exp(-max(t, 0.) / 0.06));
}
// ---- sky
vec3 skyCol(vec2 q, vec2 p, out float cloud){
  float e = clamp((YH - q.y) / YH, 0., 1.);
  float x = q.x;
  // vertical ramp: muted gold at the horizon, olive, grey, smoky violet into the night
  vec3 c0 = vec3(.88,.72,.45), c1 = vec3(.75,.63,.44), c2 = vec3(.50,.47,.39), c3 = vec3(.34,.33,.32), c4 = vec3(.245,.23,.265), c5 = vec3(.165,.155,.19);
  vec3 c = mix(c0, c1, smoothstep(0., .06, e));
  c = mix(c, c2, smoothstep(.04, .22, e));
  c = mix(c, c3, smoothstep(.16, .44, e));
  c = mix(c, c4, smoothstep(.38, .74, e));
  c = mix(c, c5, smoothstep(.68, 1.05, e));
  // afterglow centred low on the right; cooler and dimmer away from it
  float gx = 0.60, dx = x - gx;
  float glow = exp(-dx*dx / 0.075);
  float low = exp(-e / 0.20);
  c = mix(c, c * vec3(.80,.82,.93), (1. - glow) * low * 0.55);
  c += vec3(.10,.07,.025) * glow * exp(-e / 0.05);
  c += vec3(.07,.05,.02) * exp(-dx*dx / 0.012) * exp(-e / 0.03);
  c = mix(c, c * vec3(1.03, 1.0, .9), glow * low * .4);
  // vaporous upper masses (barely there: value and hue drift)
  vec2 wq = vec2(x * 2.0, e * 4.2);
  wq += 0.5 * vec2(fbm(wq * 1.3 + 4., 4), fbm(wq * 1.3 + 9., 4));
  float m = fbm(wq, 5);
  c *= 0.86 + 0.30 * m * smoothstep(.05, .3, e);
  // a paler rift of vapour drifting down from the moon toward the glow
  float rift = exp(-pow((e - 0.52 - 0.45 * (x - 0.25)) / 0.07, 2.)) * smoothstep(.35, .7, fbm(vec2(x * 3. + 2., e * 7.), 4));
  c = mix(c, c * vec3(1.16, 1.12, 1.08), rift * smoothstep(.2, .45, e));
  c = mix(c, c * vec3(.94, .92, 1.06), smoothstep(.45, .7, m) * smoothstep(.2, .6, e) * .8);
  // long stratus bars across the glow: soft, tapering, wavering
  cloud = 0.;
  float bars = 0., rim = 0.;
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    float xc = 0.55 + 0.35 * sin(fi * 2.1 + 1.);
    float span = 0.35 + 0.18 * fi;
    float along = (x - xc) / span;
    float ce = 0.05 + fi * 0.068 + 0.012 * sin(fi * 2.3) + along * (0.012 - 0.006 * fi);
    ce += 0.02 * (fbm(vec2(x * 1.6 + fi * 7.1, fi), 4) - .5);
    float taper = 1. - smoothstep(0.55, 1.15, abs(along) + 0.25 * fbm(vec2(x * 3. + fi, fi * 9.), 3));
    float th = (0.005 + 0.007 * fi) * taper * (0.5 + 1.0 * fbm(vec2(x * 3.0 + fi * 3.3, fi * 5.), 4));
    float b = (1. - smoothstep(th * .25, th * 1.4 + 0.004, abs(e - ce))) * smoothstep(0.05, 0.3, taper);
    bars = max(bars, b);
    rim = max(rim, (1. - smoothstep(0., th * 1.6 + 0.004, abs(e - (ce - th * 1.0)))) * taper * (1. - b * .7));
  }
  vec3 barCol = mix(vec3(.47,.41,.36), vec3(.31,.29,.31), smoothstep(.05, .26, e));
  barCol = mix(barCol, barCol * vec3(.86,.87,.96), 1. - glow);
  c = mix(c, barCol, bars * .85);
  c += vec3(.10,.075,.03) * rim * glow * exp(-e / .16);
  cloud = bars;
  // a veil of darker vapour drifting high on the right
  float veil = smoothstep(.45, .75, fbm(vec2(x * 1.4 + 3., e * 2.6), 5)) * smoothstep(.25, .55, e);
  c = mix(c, c * vec3(.86,.85,.88), veil * .7);
  // the moon: a thin crescent, lit toward the vanished sun, with a soft halo
  float d = length(p - MOON);
  float halo = exp(-d / 170.) * 0.07 + exp(-d / 50.) * 0.09;
  c += vec3(.75,.72,.62) * halo;
  return c;
}
vec3 moonCol(vec2 p, out float a){
  float d = length(p - MOON);
  float disc = 1. - smoothstep(MOONR - 1.2, MOONR + 1.2, d);
  vec2 off = normalize(vec2(-0.62, -0.78)) * MOONR * 0.36;
  float dark = 1. - smoothstep(MOONR * 1.02 - 1.2, MOONR * 1.02 + 1.2, length(p - MOON - off));
  float lit = disc * (1. - dark);
  a = disc;
  vec3 earthshine = vec3(.27,.26,.29);
  return mix(earthshine, vec3(.95,.90,.74), lit);
}

void plan(vec2 p, out vec4 o0, out vec4 o1, out vec4 o2){
  vec2 q = p / vec2(2160., 2700.);
  float X = q.x, Y = q.y;
  vec3 c; vec2 dir = vec2(1., 0.); float size = 1.3, mat = 0., imp = 1., follow = 0.15, cross = 1., mistAmt = 0.;
  float cloud;
  vec3 sky = skyCol(q, p, cloud);
  // ---------------------------------------------------------------- sky and far treeline
  // far woods: low groves with fuzzy crowns, gaps over open marsh
  float grove = smoothstep(.40, .62, fbm(vec2(X * 6.5, 3.), 4));
  float tl = YH - (0.0025 + 0.004 * fbm(vec2(X * 30., 1.), 3) + 0.0085 * grove * (0.55 + 0.45 * fbm(vec2(X * 140., 7.), 3)));
  tl -= 0.006 * smoothstep(0.10, 0.0, X) * (0.6 + 0.6 * fbm(vec2(X * 160., 5.), 3));
  tl -= 0.0025 * (fbm(vec2(X * 420., 9.), 2) - .5) * (0.3 + grove);
  tl = mix(tl, YH - 0.0012, smoothstep(0.49, 0.52, X) * (1. - smoothstep(0.66, 0.70, X)) * 0.9);
  if (Y < YH) {
    c = sky;
    mat = cloud > .4 ? 1. : 0.;
    dir = normalize(vec2(1., 0.10 * (fbm(q * vec2(3., 6.), 3) - .5)));
    size = mat > .5 ? 0.9 : 1.35;
    float ma; vec3 mc = moonCol(p, ma);
    if (ma > 0.) { c = mix(c, c * 1.12 + vec3(.012), ma * 0.6); }
    if (Y > tl) {
      // far woods: soft, a little lighter than the near marsh, veiled in mist toward their feet
      float k = smoothstep(tl, tl + 0.004, Y);
      vec3 tc = mix(vec3(.23,.215,.21), vec3(.205,.18,.15), exp(-pow((X - .6) / .2, 2.)));
      tc = mix(tc, sky * 0.7, 0.18);
      c = mix(c, tc, k);
      if (k > .5) { mat = 3.; size = 0.5; dir = vec2(1., 0.); follow = 0.5; cross = 1.; }
    }
  } else {
    // ---------------------------------------------------------------- the marsh
    float d = (Y - YH) / (1. - YH);
    float z = 1. / (d + 0.05);
    vec3 nearC = vec3(.125,.112,.082), farC = vec3(.31,.285,.235);
    vec3 land = mix(farC, nearC, pow(smoothstep(0., 1., d), 0.55));
    // bands of spartina and salt hay, compressed by perspective
    float band = fbm(vec2(X * 5. * (0.3 + 0.7 * z * .08) , z * 1.6), 5);
    float band2 = fbm(vec2(X * 22. / (d + 0.3), z * 5.), 3);
    land *= 0.80 + 0.32 * band + 0.10 * (band2 - .5);
    // last light on the tops of the grass toward the glow (warm olive-ochre), fading into the foreground
    float warm = smoothstep(.45, .7, band) * exp(-d / .45) * exp(-pow((X - .58) / .35, 2.));
    land = mix(land, land * vec3(1.32, 1.16, .80), warm * .9);
    c = land; mat = 5.; size = 0.45 + 0.8 * d; dir = vec2(1., 0.04 * (band - .5)); follow = 0.35; cross = 1.;
    imp = 0.6;
    // salt pannes: small pools in the middle distance holding the sky
    float pn = fbm(vec2(X * 9. * z * 0.18, z * 2.6) + 30., 4);
    float pan = smoothstep(.70, .76, pn) * smoothstep(.06, .12, d) * (1. - smoothstep(.3, .42, d));
    c = mix(c, c * 1.35 + vec3(.02,.015,.0), smoothstep(.66, .71, pn) * smoothstep(.06, .12, d) * (1. - smoothstep(.3, .42, d)) * (1. - pan) * .6);
    vec3 rq = skyCol(vec2(X, YH - (Y - YH) * 0.9), p, cloud) * 0.7;
    c = mix(c, rq * vec3(1.05,1.0,.92), pan * .9);
    // the creek
    float cx = creekX(d), hw = creekHW(d);
    float mudW = 0.0016 + 0.009 * d;
    float wd = waterD(X, Y, d);
    float slope = creekSlope(d);
    if (wd < mudW) {
      // soft wet mud banks, holding a little of the sky, with a glint at the water's lip
      float mk = smoothstep(mudW, mudW * 0.3, wd);
      vec3 mud = mix(c * 1.05, rq * .7, 0.35 * (1. - 0.6 * smoothstep(0.45, 0.95, d))) * (0.85 + 0.3 * fbm(vec2(X * 80., Y * 300.), 3));
      c = mix(c, mud, mk * 0.85);
      float lip = (1. - smoothstep(0., mudW * 0.35, abs(wd))) * smoothstep(.45, .75, fbm(vec2(X * 60., Y * 400.), 3));
      c += vec3(.16,.12,.07) * lip * 0.4 * exp(-d / 0.3) * exp(-pow((X - .6) / .3, 2.));
      if (mk > .5) { mat = 7.; size = 0.25 + 0.4 * d; follow = 0.5; dir = normalize(vec2(slope, 1.)); }
    }
    if (wd < 0.) {
      // water: the sky mirrored (olive and violet), darker and deeper toward us
      vec2 rqp = vec2(X, YH - (Y - YH) * 0.97);
      float cl; vec3 refl = skyCol(rqp, vec2(rqp.x * 2160., rqp.y * 2700.), cl);
      refl = mix(refl, refl * 0.5, cl * 0.85);
      refl *= mix(0.95, 0.40, pow(d, 0.6));
      refl = mix(refl, refl * vec3(.94, .96, 1.05), smoothstep(.3, 1., d));
      // the afterglow laid down the water as a broken column of light
      float colX = exp(-pow((X - 0.60) / (0.035 + 0.05 * d), 2.));
      float streak = smoothstep(0.42, 0.78, fbm(vec2(X * 30. / (d + 0.15), Y * 2700. / (2.5 + 7. * d)), 3));
      refl += vec3(.30,.22,.10) * colX * streak * exp(-d / 0.5) * 0.7;
      // calm reaches mirror, ruffled ones go dull
      float ruff = smoothstep(.48, .72, fbm(vec2(X * 7., Y * 2700. / (25. + 80. * d)) + 11., 4));
      refl = mix(refl, refl * vec3(.62,.62,.66) + vec3(.008), ruff * 0.5);
      float rl = smoothstep(0.55, 0.95, noise1(Y * 2700. / (2.5 + 10. * d) + 4. * vnoise(vec2(X * 30., Y * 50.))));
      refl *= 0.96 + 0.08 * rl;
      // reflected banks: the dark of the far bank's grasses, broken into blades
      float grassRef = 0.5 + 0.5 * noise1(X * 2160. / (2. + 4. * d) + 3.);
      float bankDark = smoothstep(-0.0025 - 0.04 * d * grassRef, 0., wd);
      float cut = 0.35 + 0.65 * smoothstep(0.3, 0.65, vnoise(vec2(d * 18., (X > cx ? 7. : 1.))));
      refl = mix(refl, refl * 0.55, bankDark * cut * mix(0.5, 0.55, smoothstep(0.1, 0.5, d)));
      // the far bank mirrored at the top edge of each reach
      float kk = (0.0025 + 0.016 * d) * (0.6 + 0.8 * noise1(X * 2160. / (3. + 5. * d)));
      float dAbove = (Y - kk - YH) / (1. - YH);
      float above = step(0., waterD(X, Y - kk, max(dAbove, 0.)));
      refl = mix(refl, refl * 0.5 + vec3(.012,.010,.006), above * smoothstep(0.03, 0.08, d) * 0.75);
      // the cedars hanging upside down in the lagoon
      for (int i = 0; i < 4; i++){
        vec3 rc; vec2 rd; float rt = cedarTree(i, X + 0.0015 * sin(Y * 900.), Y, true, rc, rd);
        rt *= 0.65 + 0.35 * smoothstep(.3, .6, fbm(vec2(X * 300., Y * 2700. / 3.), 2));
        refl = mix(refl, rc * 0.7 + refl * 0.12, rt * 0.8);
      }
      c = refl; mat = 6.; size = 0.4 + 0.8 * d; dir = vec2(1., 0.); follow = 0.45; imp = 0.8;
    }
    // mist lying on the marsh and on the water
    float mz = exp(-pow((Y - (YH + 0.012)) / 0.022, 2.)) * 0.62;
    float mist2 = smoothstep(.42, .8, fbm(vec2(X * 3.2, Y * 46.) + 3., 5)) * exp(-d / 0.25) * 0.6;
    float mist3 = smoothstep(.55, .85, fbm(vec2(X * 2.4 + 7., Y * 26.), 4)) * smoothstep(.15, .3, d) * exp(-d / .5) * 0.45 * (1. - smoothstep(0., .04, wd));
    float mist = clamp(mz + mist2 + mist3, 0., .8);
    mistAmt = mist;
    vec3 mistCol = mix(vec3(.42,.41,.42), vec3(.60,.55,.46), exp(-pow((X - .58) / .25, 2.)));
    c = mix(c, mistCol, mist * (0.6 + 0.4 * (1. - d)) * (wd < 0. && d < 0.12 ? 0.2 : 1.));
    if (mist > .35 && mat == 5.) { cross = 1.; follow = 0.1; }
    // salt-hay stacks raised on staddles: peaked, uneven, one standing in the mist, warm on the side of the glow
    for (int i = 0; i < 4; i++){
      float fi = float(i);
      vec2 hb = i == 0 ? vec2(0.088, YH + 0.036) : i == 1 ? vec2(0.205, YH + 0.022) : i == 2 ? vec2(0.247, YH + 0.0175) : vec2(0.385, YH + 0.0085);
      float hwid = i == 0 ? 0.031 : i == 1 ? 0.019 : i == 2 ? 0.0135 : 0.0085;
      float hh = hwid * (i == 1 ? 2.2 : i == 2 ? 1.8 : 1.95) * 2160. / 2700.;
      float stad = hh * 0.05;                    // the staddle lifts the stack off the wet ground
      float base = hb.y - stad;
      float ty = (base - Y) / hh;
      float lean = (i == 1 ? 0.12 : i == 2 ? -0.08 : 0.04) * hwid;
      float tyc = clamp(ty, 0., 1.);
      float prof = hwid * sqrt(max(1. - pow(tyc, 1.5), 0.)) * (1. - 0.42 * tyc) * (1. + 0.12 * sin(3.1416 * tyc)) * (1. + 0.07 * (fbm(vec2(Y * 900., fi * 4.), 3) - .5));
      float axc = X - hb.x - lean * ty;
      float sh = (1. - smoothstep(prof * 0.88, prof * 1.02, abs(axc))) * step(-0.01, ty) * step(ty, 1.0);
      // a little twisted top-knot
      float knot = (1. - smoothstep(hwid * 0.05, hwid * 0.10, abs(axc))) * step(0.95, ty) * step(ty, 1.10);
      sh = max(sh, knot);
      // staddle posts and the dark gap beneath
      float under = step(base, Y) * step(Y, hb.y) * (1. - smoothstep(hwid * 0.75, hwid * 0.85, abs(X - hb.x)));
      float posts = under * (1. - smoothstep(0.12, 0.3, abs(fract((X - hb.x) / (hwid * 0.6) + 0.5) - 0.5) * 2.2));
      c = mix(c, c * 0.7, under * 0.5);
      c = mix(c, c * 0.6, posts * 0.35);
      float pool = (1. - smoothstep(0.7, 1.2, length(vec2((X - hb.x) / (hwid * 1.3), (Y - hb.y - 0.0012) / 0.0022))));
      c = mix(c, c * 0.6, pool * 0.6);
      if (sh > 0.) {
        float side = axc / max(prof, 1e-4);
        vec3 hc = mix(vec3(.10,.083,.060), vec3(.20,.155,.10), smoothstep(-0.4, 0.9, side) * 0.6);
        hc *= 0.85 + 0.3 * fbm(vec2(X * 140., Y * 70.), 3);
        // warm edge light from the afterglow on the right flank
        hc = mix(hc, vec3(.46,.35,.19), smoothstep(0.55, 0.97, side) * (0.35 + 0.65 * ty) * 0.6);
        float misted = i == 2 ? 0.62 : i == 3 ? 0.55 : 0.25;
        hc = mix(hc, mistCol, misted * exp(-ty / (i >= 2 ? 0.6 : 0.2)));
        c = mix(c, hc, sh);
        if (sh > .5) { mat = 9.; size = i == 3 ? 0.18 : 0.28; dir = normalize(vec2(side * 0.5, 1.)); follow = 0.6; cross = 0.; imp = 0.8; }
      }
    }
    // grasses breaking the edges of the creek in the middle distance
    if (d > 0.15 && abs(wd) < 0.004 + 0.02 * d) {
      float gy = Y * 2700. / (14. + 60. * d);
      float gx = X * 2160. / (2.5 + 3. * d);
      float blade = smoothstep(0.68, 0.84, vnoise(vec2(gx, gy))) * (1. - smoothstep(0., 0.004 + 0.02 * d, abs(wd))) * smoothstep(0.35, 0.6, vnoise(vec2(X * 30., Y * 60.)));
      c = mix(c, c * 0.6, blade * 0.6);
    }
    // the near marsh: dark and quiet, but alive: clumps of spartina with tips in the last light, pools holding the sky
    if (d > 0.42) {
      float fz = smoothstep(0.42, 0.75, d);
      // warm darks drifting between umber and olive
      float hue = fbm(vec2(X * 3., Y * 6.) + 21., 4);
      c = mix(c, c * mix(vec3(1.10, .98, .80), vec3(.92, 1.0, .95), hue), fz * 0.8);
      // pools holding the sky
      vec2 pp = vec2(X * 6., (Y - YH) * 2700. / 2160. * 6. * 4.5);
      float pn2 = fbm(pp + 50., 4);
      float pool2 = smoothstep(.665, .695, pn2) * fz * step(0.006, wd);
      vec3 prq = skyCol(vec2(X, YH - (Y - YH) * 0.55), p, cloud) * 0.40 * vec3(1.04, 1.0, .9);
      float prim = smoothstep(.635, .665, pn2) * (1. - pool2) * fz * step(0.006, wd);
      c = mix(c, c * 0.65, prim);
      c = mix(c, prq * vec3(1.0, .97, 1.03) * (0.9 + 0.2 * fbm(vec2(X * 40., Y * 400.), 2)), pool2 * 0.92);
      if (pool2 > .5) { mat = 11.; size = 0.35; dir = vec2(1., 0.); follow = 0.6; cross = 1.; }
      // spartina clumps: tufts of upright blades, their tops catching the last light
      vec2 cq = vec2(X * 9., Y * 20.) + 7.;
      float clumpM = smoothstep(.45, .66, fbm(cq, 4)) * fz * (1. - pool2) * smoothstep(-0.001, 0.004, wd);
      float clumpUp = smoothstep(.45, .66, fbm(cq - vec2(0., 20. * 0.007), 4));
      float topEdge = clamp((smoothstep(.45, .66, fbm(cq, 4)) - clumpUp) * 2.5, 0., 1.);
      float gy = Y * 2700. / (40. + 70. * d);
      float lean = 0.3 * (vnoise(vec2(X * 8., 4.)) - .5);
      float gx = X * 2160. / (4. + 2. * d) + 0.7 * vnoise(vec2(X * 40., Y * 25.));
      float bl = vnoise(vec2(gx, gy));
      float blade = smoothstep(0.58, 0.76, bl) * clumpM;
      c = mix(c, c * 0.45, blade * 0.8);
      float tipB = smoothstep(0.55, 0.8, vnoise(vec2(gx * 1.2 + 9., gy * 0.5)));
      vec3 tipC = mix(vec3(.24,.20,.13), vec3(.33,.26,.15), smoothstep(.2, .8, X));
      c = mix(c, tipC, topEdge * tipB * fz * (1. - pool2) * 0.5);
      if (clumpM > .35 && pool2 < .5) { dir = normalize(vec2(lean, 1.)); mat = 10.; size = 0.5; follow = 0.05; }
    }
  }
  // ---------------------------------------------------------------- cedars on the far shore of the lagoon
  for (int i = 0; i < 4; i++){
    vec3 cc; vec2 cd; float tr = cedarTree(i, X, Y, false, cc, cd);
    if (tr > 0.) { c = mix(c, cc, tr); if (tr > .5) { mat = 4.; size = 0.26; dir = cd; follow = 0.3; cross = 0.; imp = 0.6; } }
  }
  // ---------------------------------------------------------------- the skiff, moored across the current
  {
    // a hull seen obliquely from a little above: stern S (nearer, right) to bow B (further, left)
    float db = 0.655;
    vec2 ctr = vec2((creekX(db) - creekHW(db) * 0.15) * 2160., (YH + db * (1. - YH)) * 2700.);
    vec2 S = ctr + vec2(150., 34.), A = vec2(-305., -62.);
    float al = (p.x - S.x) / A.x;              // 0 stern .. 1 bow
    float u = al * 2. - 1.;
    float y0 = S.y + al * A.y;                 // waterline on the keel line
    float bow = pow(max(u, 0.), 2.3), st = pow(max(-u, 0.), 3.);
    float beam = 21. * max(1. - bow, 0.) * (1. - 0.3 * st);     // half beam, foreshortened
    float shr = 24. + 15. * u * u + 12. * bow;                  // freeboard, rising to the bow
    float nWL = y0 + beam, nG = nWL - shr, fG = y0 - beam - shr;
    float inside = step(0., al) * step(al, 1.);
    float endS = smoothstep(-0.003, 0.012, al), endB = 1. - smoothstep(0.985, 1.0, al);
    float side = smoothstep(nG - 0.8, nG + 0.8, p.y) * (1. - smoothstep(nWL - 1.2, nWL + 1.2, p.y)) * endS * endB * inside;
    float inner = smoothstep(fG - 0.8, fG + 0.8, p.y) * (1. - smoothstep(nG - 0.6, nG + 0.6, p.y)) * endS * endB * inside * step(1.5, beam);
    // soft reflection beneath the near side, wavering
    float wv = 3. * sin(p.y * 0.35 + p.x * 0.02);
    float alr = (p.x + wv - S.x) / A.x;
    float y0r = S.y + alr * A.y;
    float ur = alr * 2. - 1.;
    float bowr = pow(max(ur, 0.), 2.3);
    float nWLr = y0r + 21. * max(1. - bowr, 0.);
    float shrr = 24. + 15. * ur * ur + 12. * bowr;
    float rf = step(0., alr) * step(alr, 1.) * smoothstep(nWLr - 1., nWLr + 2., p.y) * (1. - smoothstep(nWLr + shrr * 0.6, nWLr + shrr * 1.0, p.y));
    rf *= 0.6 + 0.4 * smoothstep(.3, .6, fbm(vec2(p.x * 0.04, p.y * 0.45), 2));
    if (rf > 0.) c = mix(c, c * 0.38, rf * 0.8);
    vec2 adir = normalize(A);
    if (inner > 0.) {
      // the inside: the far side's planking takes a little sky, the bottom boards are dark; two thwarts
      float k = (p.y - fG) / max(nG - fG, 1.);
      vec3 ic = mix(vec3(.17,.145,.11), vec3(.085,.075,.06), smoothstep(0.15, 0.75, k));
      float thw = max(1. - smoothstep(0.02, 0.035, abs(u - 0.18)), 1. - smoothstep(0.02, 0.035, abs(u + 0.42)));
      float thwY = smoothstep(0.25, 0.35, k) * (1. - smoothstep(0.7, 0.8, k));
      ic = mix(ic, vec3(.19,.165,.125), thw * thwY * 0.7);
      float fgun = 1. - smoothstep(0., 2.2, p.y - fG);
      ic = mix(ic, vec3(.24,.21,.16), fgun * 0.5);
      c = mix(c, ic, inner);
      if (inner > .5) { mat = 8.; size = 0.1; dir = adir; follow = 0.8; cross = 0.; imp = 0.7; }
    }
    if (side > 0.) {
      // the near side: dark planking, a lighter top strake, the sheer line catching the last light
      float k = (p.y - nG) / max(nWL - nG, 1.);
      vec3 hc = mix(vec3(.12,.10,.08), vec3(.065,.058,.05), smoothstep(0.15, 0.5, k));
      float gun = 1. - smoothstep(0., 2.6, p.y - nG);
      hc = mix(hc, vec3(.40,.33,.22), gun * (0.45 + 0.35 * smoothstep(-0.6, 0.9, u)));
      float seam = (1. - smoothstep(0., 1.2, abs(k - 0.42))) * 0.25;
      hc = mix(hc, vec3(.14,.12,.095), seam);
      c = mix(c, hc, side);
      if (side > .5) { mat = 8.; size = 0.1; dir = adir; follow = 0.8; cross = 0.; imp = 0.6; }
    }
    // the painter (mooring line) from the bow to a stake upstream
    vec2 bowP = S + A + vec2(4., -shr * 0. - 36.);
    vec2 sp = bowP + vec2(-95., -30.);
    float sx = p.x - sp.x + (p.y - sp.y) * 0.06;
    float stake = (1. - smoothstep(1.5, 3.2, abs(sx))) * step(sp.y - 150., p.y) * step(p.y, sp.y + 4.);
    float rstake = (1. - smoothstep(1.8, 4.2, abs(sx - 2.5 * sin(p.y * 0.18)))) * step(sp.y + 4., p.y) * step(p.y, sp.y + 110.) * (1. - (p.y - sp.y) / 110.);
    c = mix(c, c * 0.45, rstake * 0.6);
    vec2 lp = sp + vec2(0., -95.);
    float tl2 = clamp((p.x - bowP.x) / (lp.x - bowP.x), 0., 1.);
    float ly = mix(bowP.y, lp.y, tl2) + 16. * sin(3.1416 * tl2);
    float line = (1. - smoothstep(0.5, 1.4, abs(p.y - ly))) * step(lp.x, p.x) * step(p.x, bowP.x);
    c = mix(c, vec3(.11,.10,.08), line * 0.7);
    vec3 stc = mix(vec3(.11,.10,.085), vec3(.24,.20,.15), smoothstep(-1., 2.5, sx) * 0.6);
    if (stake > 0.) { c = mix(c, stc, stake * 0.92); mat = 8.; size = 0.1; dir = vec2(0., 1.); follow = 0.9; cross = 0.; }
  }
  imp *= 0.45 + 1.6 * sqrt(lum(c));
  if (mat == 2.) imp = 3.0;
  o0 = vec4(lin(c), 1.);
  o1 = vec4(dir, size, mat);
  o2 = vec4(imp, follow, cross, mat == 4. || mat == 8. || mat == 9. ? 0. : mistAmt);
}
`;

  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  // underpainting: a warm umber "dead colouring" that keeps only the values
  const umber = (c) => {
    const l = Math.pow(Math.max(lum(c), 0), 1 / 2.2);
    const v = Math.pow(R.clamp(l * 1.05, 0, 1), 2.2);
    return [v * 1.15 + 0.004, v * 0.92 + 0.003, v * 0.62 + 0.002];
  };

  const DW = 2160, DH = 2700, YH = 0.632 * DH, MOON = [560, 520], MOONR = 30;
  const matAt = (M, x, y) => Math.round(M.B[M.idx(x, y) * 4 + 3]);
  const lumAt = (M, x, y) => { const c = M.colour(x, y); return lum(c); };
  // does a brush of radius r at (x,y) touch a protected shape (cedars, stacks, skiff)?
  const clipped = (M, x, y, r) => { for (const [ox, oy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const j = M.idx(x + ox, y + oy); if (M.C[j * 4 + 2] < 0.5) return true; } return false; };

  const layers = [
    // 1. imprimatura: a transparent raw-umber toning rubbed over the white ground
    { name: 'imprimatura', kind: 'glaze', R: [150, 260], len: [3, 7], spacing: 0.8, alpha: 0.55, thick: 0.02, tol: 9, cross: true, useSize: false,
      angJit: 0.5, colour: (c, x, y, m, rng) => [0.72 + 0.06 * rng.gauss(), 0.66 + 0.05 * rng.gauss(), 0.58 + 0.05 * rng.gauss()], dry: 0.2, load: 1.2, pool: 0.8 },
    // 2. dead colouring in umber: the value structure, scrubbed thin
    { name: 'dead-colouring', R: [42, 80], len: [2, 6], spacing: 0.85, alpha: 0.82, thick: 0.08, tol: 0.10, smear: 0.3, dry: 0.9, load: 1.05,
      colour: (c) => umber(c), jitV: 0.08, jitH: 0.0, tooth: 0.25, angJit: 0.25, mix: 0.3, ridge: 0.1, furrow: 0.7 },
    // 3. lay-in of colour, big brushes, wet into wet
    { name: 'lay-in', R: [30, 56], len: [2.5, 8], spacing: 0.8, alpha: 0.9, thick: 0.2, tol: 0.07, smear: 0.4, dry: 0.55, fid: 0.12, jitV: 0.06, jitH: 0.035, lumThick: 0.5, ridge: 0.25 },
    // 4. body: medium brushes where the lay-in is not enough
    { name: 'body', R: [14, 26], len: [2.5, 9], spacing: 0.8, thr: 0.012, alpha: 0.9, thick: 0.28, tol: 0.055, smear: 0.35, dry: 0.6, fid: 0.18, jitV: 0.05, jitH: 0.03, lumThick: 0.6 },
    // 5. drawing: small brushes on edges and features
    { name: 'drawing', R: [6, 11], len: [2, 8], spacing: 0.8, thr: 0.03, alpha: 0.93, thick: 0.32, tol: 0.05, smear: 0.25, dry: 0.55, fid: 0.25, jitV: 0.04, jitH: 0.025, lumThick: 0.7 },
    // 6. glazes: deepen and warm the near marsh, veil the top of the sky
    { name: 'glaze-veils', kind: 'glaze', pool: 0.7, generate({ rng, add }) {
      for (let y = YH + 120; y < DH + 60; y += 55) for (let x = -100; x < DW + 100; x += 140 + 80 * rng()) {
        const d = (y - YH) / (DH - YH);
        const a = 0.22 * R.sstep(0.3, 1.0, d);
        if (a < 0.02) continue;
        const L = R.mix(250, 500, rng()), yy = y + 25 * rng.gauss(), dy = 0.04 * rng.gauss();
        add({ pts: [[x, yy], [x + L * 0.5, yy + L * dy * 0.5], [x + L, yy + L * dy]], r: R.mix(60, 110, rng()), col: [0.56 + 0.04 * rng.gauss(), 0.48 + 0.03 * rng.gauss(), 0.36 + 0.02 * rng.gauss()], alpha: a * R.mix(0.7, 1, rng()), thick: 0.0, dry: 0.3, load: 1.3 });
      }
      for (let y = -60; y < DH * 0.38; y += 60) for (let x = -100; x < DW + 100; x += 160 + 80 * rng()) {
        const a = 0.28 * (1 - R.sstep(0, DH * 0.38, y)) * (0.6 + 0.4 * Math.abs(x / DW - 0.55) * 2);
        const L = R.mix(250, 520, rng()), yy = y + 25 * rng.gauss(), dy = 0.08 * rng.gauss();
        add({ pts: [[x, yy], [x + L * 0.5, yy + L * dy * 0.5], [x + L, yy + L * dy]], r: R.mix(70, 120, rng()), col: [0.80, 0.76, 0.86], alpha: a * R.mix(0.7, 1, rng()), thick: 0.0, dry: 0.3, load: 1.3 });
      }
    } },
    // 7. mist: a thin light scumble dragged across the low marsh and the water; it catches on the tooth
    { name: 'mist-scumble', kind: 'scumble', tooth: 0.8, ridge: 0.15, furrow: 0.6, generate({ rng, add, maps: M }) {
      for (let y = YH - 30; y < DH; y += 10) for (let x = -60; x < DW + 60; x += 25 + 35 * rng()) {
        const xx = R.clamp(x, 0, DW - 1), yy = R.clamp(y + 8 * rng.gauss(), 0, DH - 1);
        const i = M.idx(xx, yy);
        const mist = M.C[i * 4 + 3];
        if (mist < 0.12 || rng() > mist * 1.3) continue;
        const d = Math.max(0, (yy - YH) / (DH - YH));
        const c = M.colour(xx, yy);
        const mc = [c[0] * 1.10 + 0.012, c[1] * 1.08 + 0.011, c[2] * 1.06 + 0.012];
        const L = R.mix(60, 220, rng()) * (0.5 + d), dy = 0.015 * rng.gauss();
        const r = R.mix(10, 26, rng()) * (0.5 + 1.2 * d);
        if (x < -50) continue;
        // stop short of anything standing out of the mist (cedars, stacks, the skiff)
        const pts = [[xx, yy]];
        for (let k = 1; k <= 8; k++) {
          const px = xx + L * k / 8, py = yy + L * dy * k / 8;
          let ok = true;
          for (const o of [-1.1, 0, 1.1]) { const j = M.idx(px, py + o * r); if (M.C[j * 4 + 2] < 0.5) ok = false; }
          if (!ok) break;
          pts.push([px, py]);
        }
        if (pts.length < 3) continue;
        { const j0 = M.idx(xx, yy - r * 1.1), j1 = M.idx(xx, yy + r * 1.1); if (M.C[j0 * 4 + 2] < 0.5 || M.C[j1 * 4 + 2] < 0.5) continue; }
        add({ pts, r, col: mc, alpha: R.mix(0.25, 0.5, rng()) * Math.min(1, mist * 1.6), thick: 0.12, dry: 0.9, load: 0.95, smear: 0.3, mix: 0.1 });
      }
    } },
    // 8. rigger: the finest touches
    { name: 'rigger', R: [2.2, 4.5], len: [2, 9], spacing: 0.85, thr: 0.06, alpha: 0.95, thick: 0.36, tol: 0.045, smear: 0.15, dry: 0.5, fid: 0.35, jitV: 0.03, jitH: 0.02, lumThick: 0.7, ridge: 0.45 },
    // 9. last touches in thick paint: the moon, the core of the afterglow, glints on the water, the gunwale
    { name: 'accents', ridge: 0.6, furrow: 0.5, generate({ rng, add, maps: M }) {
      // moon: the old moon's faint disc, then two loaded strokes following the lit limb
      const th0 = Math.atan2(0.78, 0.62);
      { const c = M.colour(MOON[0] - 10, MOON[1] - 10); add({ pts: [[MOON[0] - 12, MOON[1] - 6], [MOON[0] + 8, MOON[1] - 2]], r: MOONR * 0.62, col: c.map((v) => v * 1.06 + 0.004), alpha: 0.5, thick: 0.15, dry: 0.4, load: 1.1, fid: 0, smear: 0.4 }); }
      // the lit lens between the moon's limb and the shadow circle, filled with thin strokes that run horn to horn
      const off = [-0.62 * MOONR * 0.36, -0.78 * MOONR * 0.36], R2 = MOONR * 1.02;
      const tIn = (th) => { const ux = Math.cos(th), uy = Math.sin(th); const b = ux * off[0] + uy * off[1]; const disc = b * b - (off[0] * off[0] + off[1] * off[1]) + R2 * R2; return disc < 0 ? 0 : b + Math.sqrt(disc); };
      const ths = [];
      for (let k = 0; k <= 720; k++) { const th = th0 - Math.PI + 2 * Math.PI * k / 720; if (tIn(th) < MOONR - 0.4) ths.push(th); }
      for (let k = 0; k < 8; k++) {
        const sIn = 0.06 + 0.86 * k / 7;
        const pts = [];
        for (let j = 0; j < ths.length; j += 6) { const th = ths[j], rr = MOONR + sIn * (tIn(th) - MOONR) - 0.6; pts.push([MOON[0] + Math.cos(th) * rr, MOON[1] + Math.sin(th) * rr]); }
        const col = k < 3 ? [0.94, 0.88, 0.67] : k < 6 ? [0.90, 0.83, 0.61] : [0.82, 0.75, 0.54];
        add({ pts, r: 1.5 + (k === 0 ? 0.3 : 0), col, alpha: 0.95, thick: 1.8, dry: 0.0, load: 1.6, fid: 0 });
      }
      // afterglow core: horizontal loaded strokes, broken by the drag of the brush
      for (let k = 0; k < 70; k++) {
        const x = DW * (0.6 + 0.16 * rng.gauss()), y = YH - R.mix(8, 150, Math.pow(rng(), 1.6));
        if (x < 0 || x > DW || matAt(M, x, y) !== 0) continue;
        const c = M.colour(x, y); if (lum(c) < 0.28) continue;
        const L = R.mix(40, 160, rng()), rr = R.mix(3, 7, rng());
        const pts = [[x, y]];
        for (let j = 1; j <= 6; j++) { const px = x + L * j / 6, py = y + 2 * rng.gauss(); if (clipped(M, px, py, rr * 2.2)) break; pts.push([px, py]); }
        if (pts.length < 2 || clipped(M, x - rr * 1.5, y, rr * 2.2)) continue;
        add({ pts, r: rr, col: c.map((v) => v * 1.07), alpha: 0.8, thick: 0.9, dry: 0.85, load: 1.0, fid: 0.4 });
      }
      // glints on the water
      for (let k = 0; k < 900; k++) {
        const x = DW * rng(), y = YH + (DH - YH) * Math.pow(rng(), 1.8);
        if (matAt(M, x, y) !== 6) continue;
        const c = M.colour(x, y); const l = lum(c);
        const d = (y - YH) / (DH - YH);
        if (l < 0.10 || rng() > l * 2.5 * Math.exp(-d / 0.35)) continue;
        const L = R.mix(10, 50, rng()) * (0.4 + 1.5 * d);
        const gr = R.mix(1.4, 3.2, rng()) * (0.6 + d);
        { let bad = false; for (let j = 0; j <= 6; j++) if (clipped(M, x + L * j / 6, y, gr * 2)) bad = true; if (bad) continue; }
        const pts = [[x, y], [x + L, y + rng.gauss()]];
        add({ pts, r: gr, col: c.map((v) => v * 1.18 + 0.01), alpha: 0.75, thick: 0.7, dry: 0.9, load: 1.0, fid: 0.3 });
      }
    } },
  ];

  G.SCENE = {
    seed: 'marsh-nocturne-1',
    planGLSL: PLAN,
    primer: [0.20, 0.155, 0.10], // the white ground already toned with a thin raw-umber imprimatura
    weavePitch: 4.2,
    planRes: 0.5,
    edgeRef: 0.004,
    layers,
    // painting order within a layer, by material: sky, clouds, far woods, land, water, mud, grass, hay, cedars, skiff, moon
    order: { 0: 0, 1: 1, 3: 2, 5: 3, 6: 4, 11: 4, 7: 5, 10: 6, 9: 7, 4: 8, 8: 9, 2: 10 },
    finish: { light: [-0.55, 0.5, 0.68], hk: 0.55, wk: 0.16, tau: 0.12, kd: 0.45, ks: 0.05, shin: 24, varnish: [1.0, 0.975, 0.91], crack: 0.0, crackScale: 55 },
    finishGLSL: 'vec3 finishColour(vec3 c, vec2 uv){ return c; }',
  };
})(typeof window !== 'undefined' ? window : globalThis);
