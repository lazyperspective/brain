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

// ---- the creek: centre line and half width (fractions of width) at depth d (0 horizon, 1 bottom edge)
float creekX(float d){ return 0.55 + (0.010 + 0.34*d) * sin(1.25/(d + 0.13) - 1.25); }
float creekHW(float d){ return (0.004 + 0.15 * pow(d, 1.25)) * (0.45 + 1.1 * vnoise(vec2(1.25 / (d + 0.13) * 1.4, 2.5))); }
// signed distance-ish to open water (negative inside): creek plus a wide pool under the glow
float waterD(float X, float Y, float d){
  float cx = creekX(d), hw = creekHW(d);
  float edgeN = (fbm(vec2(Y * 260., X * 3.), 4) - .5) * (0.003 + 0.022 * d);
  float wc = abs(X - cx) - hw - edgeN;
  // the lagoon under the glow: a long horizontal sheet, straight far shore, ragged near shore and ends
  float lx0 = 0.44 + 0.03 * (fbm(vec2(Y * 400., 2.), 3) - .5), lx1 = 0.80 + 0.05 * (fbm(vec2(Y * 300., 6.), 3) - .5);
  float top = YH + 0.0035;
  float bot = YH + 0.0105 + 0.007 * fbm(vec2(X * 14., 3.), 4) + 0.004 * sin(X * 40.);
  float wb = max(max(top - Y, Y - bot) * 2.5, max(lx0 - X, X - lx1) * 0.4);
  // a spit of reeds across it
  if (X > 0.66 && X < 0.75) wb = max(wb, -(abs(Y - (YH + 0.006 + 0.002 * sin(X * 30.))) - 0.0008) * 2.5);
  // a side channel winding off to the left toward the pannes
  float cx3 = creekX(0.30);
  float tx = clamp((X - 0.16) / (cx3 - 0.16), 0., 1.);
  float tY = YH + (1. - YH) * (0.135 + 0.165 * pow(tx, 1.6) + 0.012 * sin(tx * 9.));
  float tw = (abs(Y - tY) * 2700. / 2160. - (0.0010 + 0.0028 * tx) * (0.6 + 0.8 * vnoise(vec2(X * 40., 1.)))) * 1.5;
  tw = X < 0.16 || X > cx3 ? 1. : tw;
  return min(min(wc, wb), tw);
}
// ---- sky
vec3 skyCol(vec2 q, vec2 p, out float cloud){
  float e = clamp((YH - q.y) / YH, 0., 1.);
  float x = q.x;
  // vertical ramp: muted gold at the horizon, olive, grey, smoky violet into the night
  vec3 c0 = vec3(.84,.69,.43), c1 = vec3(.72,.61,.43), c2 = vec3(.50,.47,.39), c3 = vec3(.34,.33,.32), c4 = vec3(.235,.22,.255), c5 = vec3(.15,.14,.175);
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
  float halo = exp(-d / 150.) * 0.05 + exp(-d / 46.) * 0.07;
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
    if (ma > 0.) { c = mix(c, mc, ma); mat = 2.; size = 0.18; dir = normalize(p - MOON).yx * vec2(-1., 1.); follow = 0.6; cross = 0.; }
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
    vec3 nearC = vec3(.105,.095,.068), farC = vec3(.31,.285,.235);
    vec3 land = mix(farC, nearC, pow(smoothstep(0., 1., d), 0.55));
    // bands of spartina and salt hay, compressed by perspective
    float band = fbm(vec2(X * 5. * (0.3 + 0.7 * z * .08) , z * 1.6), 5);
    float band2 = fbm(vec2(X * 22. / (d + 0.3), z * 5.), 3);
    land *= 0.80 + 0.32 * band + 0.10 * (band2 - .5);
    // last light on the tops of the grass toward the glow (warm olive-ochre), fading into the foreground
    float warm = smoothstep(.45, .7, band) * exp(-d / .45) * exp(-pow((X - .58) / .35, 2.));
    land = mix(land, land * vec3(1.25, 1.12, .82), warm * .7);
    c = land; mat = 5.; size = 0.45 + 0.8 * d; dir = vec2(1., 0.04 * (band - .5)); follow = 0.35; cross = 1.;
    imp = 0.6;
    // salt pannes: small pools in the middle distance holding the sky
    float pn = fbm(vec2(X * 9. * z * 0.18, z * 2.6) + 30., 4);
    float pan = smoothstep(.70, .76, pn) * smoothstep(.06, .12, d) * (1. - smoothstep(.3, .42, d));
    c = mix(c, c * 1.35 + vec3(.02,.015,.0), smoothstep(.66, .71, pn) * smoothstep(.06, .12, d) * (1. - smoothstep(.3, .42, d)) * (1. - pan) * .6);
    vec3 rq = skyCol(vec2(X, YH - (Y - YH) * 0.9), p, cloud) * 0.7;
    c = mix(c, rq * vec3(.95,.92,.88), pan * .85);
    // the creek
    float cx = creekX(d), hw = creekHW(d);
    float mudW = 0.0014 + 0.010 * d;
    float wd = waterD(X, Y, d);
    if (wd < mudW) {
      // wet mud bank: catches the sky
      float mk = smoothstep(mudW, mudW * 0.4, wd);
      vec3 mud = mix(vec3(.24,.205,.155), rq * .6, 0.5) * (0.55 + 0.45 * exp(-d / .3)) * (0.8 + 0.4 * fbm(vec2(X * 80., Y * 300.), 3));
      c = mix(c, mud, mk);
      if (mk > .5) { mat = 7.; size = 0.25 + 0.4 * d; follow = 0.6; }
    }
    if (wd < 0.) {
      // water: the sky reflected, darker toward us, with the dark of the banks at its edges
      vec2 rqp = vec2(X, YH - (Y - YH) * 0.97);
      float cl; vec3 refl = skyCol(rqp, vec2(rqp.x * 2160., rqp.y * 2700.), cl);
      refl = mix(refl, refl * 0.62, cl * 0.6);
      refl *= mix(0.95, 0.56, pow(d, 0.6));
      float rl = smoothstep(0.55, 0.95, noise1(Y * 2700. / (2.5 + 10. * d) + 4. * vnoise(vec2(X * 30., Y * 50.))));
      refl *= 0.90 + 0.22 * rl;
      refl = mix(refl, refl * vec3(.96, .97, 1.02), d);
      float grassRef = 0.6 + 0.4 * noise1(X * 2160. / (2. + 5. * d) + 3.);
      float side = X > cx ? 1. : 0.;
      float cut = smoothstep(0.35, 0.6, vnoise(vec2(d * 14., side * 7. + 1.)));
      float bankDark = smoothstep(-0.003 - 0.055 * d * grassRef, 0., wd) * (abs(X - cx) > hw + 0.01 ? 0.75 : 1.) * (0.25 + 0.75 * cut);
      refl = mix(refl, refl * 0.35, bankDark * 0.85);
      float rip = fbm(vec2(X * 30., Y * 520.), 3);
      refl *= 0.94 + 0.12 * rip;
      float gl2 = smoothstep(.62, .82, fbm(vec2(X * 70. / (d + .2), Y * 1100.), 3)) * exp(-d / 0.3) * (1. - bankDark);
      refl += vec3(.20,.15,.07) * gl2 * 0.5 * exp(-pow((X - .58) / .2, 2.));
      c = refl; mat = 6.; size = 0.4 + 0.8 * d; dir = vec2(1., 0.); follow = 0.2; imp = 0.8;
    }
    // mist lying on the marsh and on the water
    float mz = exp(-pow((Y - (YH + 0.012)) / 0.022, 2.)) * 0.62;
    float mist2 = smoothstep(.42, .8, fbm(vec2(X * 3.2, Y * 46.) + 3., 5)) * exp(-d / 0.25) * 0.6;
    float mist3 = smoothstep(.55, .85, fbm(vec2(X * 2.4 + 7., Y * 26.), 4)) * smoothstep(.15, .3, d) * exp(-d / .5) * 0.45 * (1. - smoothstep(0., .04, wd));
    float mist = clamp(mz + mist2 + mist3, 0., .8);
    mistAmt = mist;
    vec3 mistCol = mix(vec3(.42,.41,.42), vec3(.60,.55,.46), exp(-pow((X - .58) / .25, 2.)));
    c = mix(c, mistCol, mist * (0.6 + 0.4 * (1. - d)) * (wd < 0. && d < 0.08 ? 0.2 : 1.));
    if (mist > .35 && mat == 5.) { cross = 1.; follow = 0.1; }
    // salt-hay stacks on the left, standing out of the mist on a low rise
    for (int i = 0; i < 3; i++){
      float fi = float(i);
      vec2 hb = vec2(i == 0 ? 0.118 : i == 1 ? 0.205 : 0.31, YH + (i == 0 ? 0.026 : i == 1 ? 0.017 : 0.011));
      float hwid = i == 0 ? 0.026 : i == 1 ? 0.019 : 0.012;
      float hh = hwid * 1.3 * 2160. / 2700.;
      float ty = (hb.y - Y) / hh;                // 0 base .. 1 top
      float prof = hwid * sqrt(max(1. - pow(clamp(ty, 0., 1.), 2.4), 0.)) * (1.04 - 0.1 * ty);
      prof *= 1. + 0.08 * (fbm(vec2(Y * 900., fi * 4.), 3) - .5);
      float ax = abs(X - hb.x - 0.0012 * sin(ty * 3.));
      float sh = (1. - smoothstep(prof * 0.9, prof * 1.02, ax)) * step(-0.02, ty) * step(ty, 1.02);
      sh *= 1. - smoothstep(-0.02, 0.0, -ty) * 0.;
      // shadow beneath, on the staddles
      float pool = (1. - smoothstep(0.7, 1.2, length(vec2((X - hb.x) / (hwid * 1.25), (Y - hb.y - 0.0015) / 0.0028))));
      c = mix(c, c * 0.5, pool * 0.75);
      if (sh > 0.) {
        float side = (X - hb.x) / max(prof, 1e-4);
        vec3 hc = mix(vec3(.10,.085,.062), vec3(.25,.19,.12), smoothstep(-0.1, 0.95, side) * (0.5 + 0.5 * ty) * .75);
        hc *= 0.85 + 0.3 * fbm(vec2(X * 140., Y * 70.), 3);
        hc = mix(hc, vec3(.33,.315,.30), 0.45 * exp(-ty / 0.18));
        c = mix(c, hc, sh); if (sh > .5) { mat = 9.; size = 0.3; dir = normalize(vec2(side * 0.5, 1.)); follow = 0.6; cross = 0.; imp = 0.8; }
      }
    }
    // foreground: tall grass at the near banks, dark against the water
    if (d > 0.55) {
      float bladeX = X * 2160. / (3. + 4. * (1. - d));
      float bh = 0.03 + 0.09 * vnoise(vec2(bladeX * 0.05, 3.)) * smoothstep(0.003, 0.02, abs(X - cx) - hw + 0.02);
      float tops = 1. - (1. - d) / (0.45);
      float blade = smoothstep(0.55, 0.75, noise1(bladeX + 0.6 * sin(Y * 40.))) ;
      float grassZone = smoothstep(0.62, 0.95, d) * smoothstep(-0.02, 0.03, wd + 0.03);
      c = mix(c, vec3(.045,.042,.03), blade * grassZone * 0.85);
      float tip = smoothstep(0.8, 0.95, noise1(bladeX * 1.7 + 9.)) * smoothstep(0.5, 0.9, fbm(vec2(X * 6., Y * 30.), 3)) * grassZone;
      c = mix(c, vec3(.17,.15,.11), tip * 0.5);
      if (grassZone > .4) { dir = normalize(vec2(0.15 * (vnoise(vec2(bladeX * .1, 1.)) - .5), 1.)); mat = 10.; size = 0.55; follow = 0.4; }
    }
  }
  // ---------------------------------------------------------------- cedars on the right: dense, ragged, wind-shaped
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    float bx = i == 0 ? 0.805 : i == 1 ? 0.842 : i == 2 ? 0.872 : 0.925;
    float by = YH + (i == 3 ? 0.010 : 0.014 + 0.003 * fi);
    float ht = i == 0 ? 0.118 : i == 1 ? 0.088 : i == 2 ? 0.104 : 0.058;
    float wd2 = ht * (i == 1 ? 0.30 : 0.24);
    float t = (by - Y) / ht;
    if (t > -0.01 && t < 1.08) {
      float tt = clamp(t, 0., 1.);
      float prof = wd2 * pow(sin(3.1416 * clamp(tt * 0.75 + 0.25, 0., 1.)), 0.55) * (1. - 0.35 * tt);
      prof *= 0.62 + 0.75 * fbm(vec2(tt * ht * 2700. / 55., fi * 3.), 4);
      float lean = 0.05 * ht * tt * tt;
      float sx = (X - bx - lean) * 2160. / 2700.;
      prof *= 0.85 + 0.3 * smoothstep(-1., 1., sign(sx)) * fbm(vec2(tt * 9., fi + 20.), 3);
      float ax = abs(sx);
      // foliage in clumps, with a feathered fringe
      vec2 fp = vec2(sx * 2700., Y * 2700.);
      float clump = fbm(fp / 34. + fi * 13., 4) - .5;
      float fringe = fbm(fp / 7. + fi * 5., 3) - .5;
      float rr = ax / max(prof, 1e-5) + 0.55 * clump + 0.30 * fringe;
      float tr = 1. - smoothstep(0.86, 1.0, rr);
      tr *= smoothstep(-0.01, 0.05, t);
      if (tr > 0.) {
        vec3 cc = vec3(.08,.078,.064);
        float lit = smoothstep(.1, .45, clump + 0.25 * sx / max(prof, 1e-4)) * (0.4 + 0.6 * tt);
        cc = mix(cc, vec3(.15,.14,.10), lit * .55);
        cc *= 0.85 + 0.3 * smoothstep(-.2, .3, fringe);
        float mst = exp(-max(t, 0.) / 0.17) * 0.7;
        cc = mix(cc, vec3(.40,.385,.37), mst);
        c = mix(c, cc, tr * (1. - 0.35 * exp(-max(t, 0.) / 0.06)));
        float a = 6.2832 * fbm(fp / 40. + 3., 3);
        if (tr > .5) { mat = 4.; size = 0.26; dir = normalize(vec2(cos(a), sin(a)) + vec2(0., 0.6)); follow = 0.3; cross = 0.; imp = 0.6; }
      }
    }
  }
  // ---------------------------------------------------------------- the moored skiff, its reflection, its line and stake
  {
    float db = 0.355;
    vec2 sc = vec2(creekX(db) - creekHW(db) * 0.30, YH + db * (1. - YH));
    float ang = -0.07;
    vec2 rp = (p - sc * vec2(2160., 2700.));
    rp = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * rp;
    float L = 150.;
    float u = rp.x / L;
    float sheer = -25. - 22. * pow(max(u, 0.), 2.2) - 6. * pow(max(-u, 0.), 2.);
    float bottom = 8. - 6. * u * u;
    float stern = -0.94, bow = 1.0 - 0.10 * smoothstep(-24., 6., rp.y);
    float endT = smoothstep(stern - 0.01, stern + 0.01, u) * (1. - smoothstep(bow - 0.02, bow, u));
    float hull = smoothstep(sheer - 1., sheer + 1., rp.y) * (1. - smoothstep(bottom - 1., bottom + 1., rp.y)) * endT;
    float ry = 2. * 8. - rp.y;
    float rh = smoothstep(sheer - 2., sheer + 2., ry) * (1. - smoothstep(bottom - 2., bottom + 2., ry)) * endT;
    rh *= 0.5 + 0.5 * smoothstep(.3, .6, fbm(vec2(p.x * 0.03, p.y * 0.5), 2));
    if (rh > 0. && rp.y > 8.) { c = mix(c, c * 0.32, rh * 0.85); }
    if (hull > 0.) {
      vec3 hc = vec3(.07,.062,.052);
      float gun = 1. - smoothstep(0., 4., rp.y - sheer);
      hc = mix(hc, vec3(.30,.27,.21), gun * .45 * smoothstep(-0.8, 0.7, u));
      float strake = (1. - smoothstep(0., 1.5, abs(rp.y - mix(sheer, bottom, 0.45)))) * 0.12;
      hc = mix(hc, vec3(.16,.14,.11), strake);
      c = mix(c, hc, hull);
      if (hull > .5) { mat = 8.; size = 0.12; dir = vec2(cos(ang), -sin(ang)); follow = 0.8; cross = 0.; imp = 0.6; }
    }
    // mooring line from the bow to a stake in the water
    vec2 bowP = sc * vec2(2160., 2700.) + vec2(L * 0.98, -44.);
    vec2 sp = bowP + vec2(60., -40.);
    float sx = p.x - sp.x + (p.y - sp.y) * 0.07;
    float stake = (1. - smoothstep(2.2, 3.8, abs(sx))) * step(sp.y - 175., p.y) * step(p.y, sp.y + 4.);
    float rstake = (1. - smoothstep(2.0, 4.5, abs(sx - 2.5 * sin(p.y * 0.18)))) * step(sp.y + 4., p.y) * step(p.y, sp.y + 140.) * (1. - (p.y - sp.y) / 140.);
    c = mix(c, c * 0.4, rstake * 0.7);
    vec2 lp = sp + vec2(0., -120.);
    float tl2 = clamp((p.x - bowP.x) / (lp.x - bowP.x), 0., 1.);
    float ly = mix(bowP.y, lp.y, tl2) + 22. * sin(3.1416 * tl2);
    float line = (1. - smoothstep(0.6, 1.6, abs(p.y - ly))) * step(bowP.x, p.x) * step(p.x, lp.x);
    c = mix(c, vec3(.10,.09,.075), line * 0.8);
    if (stake > 0.) { c = mix(c, vec3(.065,.056,.048), stake); mat = 8.; size = 0.1; dir = vec2(0., 1.); follow = 0.9; cross = 0.; }
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

  const layers = [
    // 1. imprimatura: a transparent raw-umber toning rubbed over the white ground
    { name: 'imprimatura', kind: 'glaze', R: [150, 260], len: [3, 7], spacing: 0.9, alpha: 0.85, thick: 0.02, tol: 9, cross: true, useSize: false,
      angJit: 0.5, colour: (c, x, y, m, rng) => [0.13 + 0.02 * rng.gauss(), 0.095 + 0.015 * rng.gauss(), 0.055 + 0.01 * rng.gauss()], dry: 0.2, load: 1.2, pool: 0.8 },
    // 2. dead colouring in umber: the value structure, scrubbed thin
    { name: 'dead-colouring', R: [42, 80], len: [2, 6], spacing: 0.85, alpha: 0.82, thick: 0.08, tol: 0.10, smear: 0.3, dry: 0.9, load: 1.05,
      colour: (c) => umber(c), jitV: 0.08, jitH: 0.0, tooth: 0.55, angJit: 0.25, mix: 0.3, ridge: 0.1, furrow: 0.7 },
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
        const a = 0.28 * R.sstep(0.3, 1.0, d);
        if (a < 0.02) continue;
        const L = R.mix(250, 500, rng()), yy = y + 25 * rng.gauss(), dy = 0.04 * rng.gauss();
        add({ pts: [[x, yy], [x + L * 0.5, yy + L * dy * 0.5], [x + L, yy + L * dy]], r: R.mix(60, 110, rng()), col: [0.50 + 0.04 * rng.gauss(), 0.40 + 0.03 * rng.gauss(), 0.24 + 0.02 * rng.gauss()], alpha: a * R.mix(0.7, 1, rng()), thick: 0.0, dry: 0.3, load: 1.3 });
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
        add({ pts: [[xx, yy], [xx + L * 0.5, yy + L * dy * 0.5], [xx + L, yy + L * dy]], r, col: mc, alpha: R.mix(0.25, 0.5, rng()) * Math.min(1, mist * 1.6), thick: 0.12, dry: 0.9, load: 0.95, smear: 0.3, mix: 0.1 });
      }
    } },
    // 8. rigger: the finest touches
    { name: 'rigger', R: [2.2, 4.5], len: [2, 9], spacing: 0.85, thr: 0.06, alpha: 0.95, thick: 0.36, tol: 0.045, smear: 0.15, dry: 0.5, fid: 0.35, jitV: 0.03, jitH: 0.02, lumThick: 0.7, ridge: 0.45 },
    // 9. last touches in thick paint: the moon, the core of the afterglow, glints on the water, the gunwale
    { name: 'accents', ridge: 0.6, furrow: 0.5, generate({ rng, add, maps: M }) {
      // the sky closed up around the moon, in short strokes that turn with it
      for (let k = 0; k < 90; k++) {
        const a = rng() * 6.2832, rr = R.mix(MOONR + 9, MOONR + 46, Math.sqrt(rng()));
        const x = MOON[0] + Math.cos(a) * rr, y = MOON[1] + Math.sin(a) * rr;
        const c = M.colour(x, y);
        const pts = []; const span = R.mix(0.2, 0.5, rng());
        for (let j = 0; j <= 4; j++) { const b = a - span / 2 + span * j / 4; pts.push([MOON[0] + Math.cos(b) * rr, MOON[1] + Math.sin(b) * rr]); }
        add({ pts, r: R.mix(4, 8, rng()), col: c.map((v) => v * (1 + 0.04 * rng.gauss())), alpha: 0.85, thick: 0.25, dry: 0.5, load: 1.2, fid: 0.5, smear: 0.2 });
      }
      // moon: two loaded strokes following the lit limb
      const th0 = Math.atan2(0.78, 0.62);
      for (const [rr, span, w, col] of [[MOONR - 4.5, 1.25, 4.6, [0.86, 0.78, 0.55]], [MOONR - 3.2, 0.95, 3.0, [0.93, 0.87, 0.66]]]) {
        const pts = [];
        for (let k = 0; k <= 14; k++) { const a = th0 - span + 2 * span * k / 14; pts.push([MOON[0] + Math.cos(a) * rr, MOON[1] + Math.sin(a) * rr]); }
        add({ pts, r: w, col, alpha: 0.95, thick: 2.2, dry: 0.35, load: 1.4, fid: 0.25 });
      }
      // afterglow core: horizontal loaded strokes, broken by the drag of the brush
      for (let k = 0; k < 70; k++) {
        const x = DW * (0.6 + 0.16 * rng.gauss()), y = YH - R.mix(8, 150, Math.pow(rng(), 1.6));
        if (x < 0 || x > DW || matAt(M, x, y) !== 0) continue;
        const c = M.colour(x, y); if (lum(c) < 0.28) continue;
        const L = R.mix(40, 160, rng());
        const pts = [[x, y], [x + L * 0.5, y + 2 * rng.gauss()], [x + L, y + 3 * rng.gauss()]];
        add({ pts, r: R.mix(3, 7, rng()), col: c.map((v) => v * 1.07), alpha: 0.8, thick: 0.9, dry: 0.85, load: 1.0, fid: 0.4 });
      }
      // glints on the water
      for (let k = 0; k < 900; k++) {
        const x = DW * rng(), y = YH + (DH - YH) * Math.pow(rng(), 1.8);
        if (matAt(M, x, y) !== 6) continue;
        const c = M.colour(x, y); const l = lum(c);
        const d = (y - YH) / (DH - YH);
        if (l < 0.10 || rng() > l * 2.5 * Math.exp(-d / 0.35)) continue;
        const L = R.mix(10, 50, rng()) * (0.4 + 1.5 * d);
        const pts = [[x, y], [x + L, y + rng.gauss()]];
        add({ pts, r: R.mix(1.4, 3.2, rng()) * (0.6 + d), col: c.map((v) => v * 1.18 + 0.01), alpha: 0.75, thick: 0.7, dry: 0.9, load: 1.0, fid: 0.3 });
      }
    } },
  ];

  G.SCENE = {
    seed: 'marsh-nocturne-1',
    planGLSL: PLAN,
    primer: [0.70, 0.66, 0.57],
    weavePitch: 4.2,
    planRes: 0.5,
    edgeRef: 0.004,
    layers,
    // painting order within a layer, by material: sky, clouds, far woods, land, water, mud, grass, hay, cedars, skiff, moon
    order: { 0: 0, 1: 1, 3: 2, 5: 3, 6: 4, 7: 5, 10: 6, 9: 7, 4: 8, 8: 9, 2: 10 },
    finish: { light: [-0.55, 0.5, 0.68], hk: 0.55, wk: 0.16, tau: 0.12, kd: 0.45, ks: 0.05, shin: 24, varnish: [1.0, 0.975, 0.91], crack: 0.0, crackScale: 70 },
    finishGLSL: 'vec3 finishColour(vec3 c, vec2 uv){ return c; }',
  };
})(typeof window !== 'undefined' ? window : globalThis);
