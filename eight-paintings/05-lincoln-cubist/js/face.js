// The likeness, drawn the way a painter blocks in a head: a stack of flat planes of light and shadow (no
// photograph, no names). Lincoln in the 1860s Brady/Gardner studio likeness: long gaunt face turned a few degrees to
// his right, heavy brow over deep-set hooded eyes, long nose, high cheekbones over hollow cheeks, clean-shaven upper
// lip over a full lower lip, the chin-curtain beard along the jaw, the mole by the right corner of the mouth, dark
// unruly hair parted on his right and heaped over large ears, high white collar, black bow tie, black coat.
// Local units: origin between the eyes, x right, y down, ~1 px of the 2160 x 2700 design.
(function (G) {
  'use strict';
  const R = G.R, V = G.V;
  const C = {
    lit: R.hex('#e2c896'), lit2: R.hex('#cdb07e'), mid: R.hex('#b39265'), mid2: R.hex('#957a58'),
    shade: R.hex('#6f604e'), shade2: R.hex('#4f463c'), deep: R.hex('#2c241e'), socket: R.hex('#231c18'),
    slate: R.hex('#5a6b7c'), slateL: R.hex('#8c9aa6'), slateD: R.hex('#2f3a46'),
    hair: R.hex('#1b1716'), hairL: R.hex('#3a3430'), hairM: R.hex('#2a2522'), beard: R.hex('#1f1814'), beardL: R.hex('#46382c'),
    white: R.hex('#e7dfcb'), whiteS: R.hex('#a9a497'), black: R.hex('#141213'), coatL: R.hex('#23262c'),
    lip: R.hex('#4e3328'), lipL: R.hex('#755444'), mole: R.hex('#2a1a14'), eyeW: R.hex('#cfc4ad'), iris: R.hex('#2a2a2c'),
    red: R.hex('#93453a'), hatL: R.hex('#3c434c'), hatD: R.hex('#16161a'), hatS: R.hex('#6c7682'), band: R.hex('#232226'), tieS: R.hex('#33343a'), profile: R.hex('#c2b394'),
  };
  function face(cx, cy, S) {
    const sxAt = (y) => 0.88 + 0.12 * R.sstep(620, 780, y);
    const T = (p) => { const x = cx + S * p[0] * sxAt(p[1]), y = cy + S * p[1]; return p[2] ? [x, y, 1] : [x, y]; };
    const shapes = [];
    const add = (name, kind, pts, col, o) => {
      o = o || {};
      const poly = o.smooth ? V.path(pts.map(T), true, 4) : pts.map(T);
      const sh = { name, kind, poly, col, col2: o.col2 || null, g: o.g ? [cx + S * o.g[0] * sxAt(o.g[1]), cy + S * o.g[1], cx + S * o.g[2] * sxAt(o.g[3]), cy + S * o.g[3]] : null, dir: o.dir, feat: !!o.feat };
      shapes.push(sh);
      return sh;
    };
    const E = (x, y, rx, ry, rot) => V.ellipse(0, 0, rx, ry, rot || 0, 40).map((p) => [x + p[0], y + p[1]]);

    // coat and shirt
    add('coatL', 'cloth', [[-180, 700], [-420, 790], [-600, 880], [-720, 1010], [-790, 1250], [-800, 1720], [10, 1720], [10, 1160]], C.black, { col2: C.coatL, g: [-650, 900, -200, 1400], dir: 70 });
    add('coatR', 'cloth', [[180, 700], [420, 785], [600, 875], [720, 1000], [790, 1240], [800, 1720], [-10, 1720], [-10, 1160]], C.black, { col2: C.coatL, g: [650, 900, 200, 1400], dir: 110 });
    add('shirt', 'white', [[-150, 760, 1], [150, 760, 1], [95, 1000, 1], [0, 1180, 1], [-95, 1000, 1]], C.white, { col2: C.whiteS, g: [-100, 800, 100, 1100], dir: 90 });
    add('lapelL', 'cloth', [[-150, 760, 1], [-95, 1000, 1], [0, 1180, 1], [-60, 1300, 1], [-250, 1000, 1], [-215, 880, 1], [-270, 860, 1]], C.coatL, { col2: C.black, g: [-200, 850, -60, 1250], dir: 60 });
    add('lapelR', 'cloth', [[150, 760, 1], [95, 1000, 1], [0, 1180, 1], [60, 1300, 1], [250, 1000, 1], [215, 880, 1], [270, 860, 1]], C.black, { col2: C.coatL, g: [200, 850, 60, 1250], dir: 120 });
    // neck in shadow under the beard
    add('neck', 'skin', [[-125, 560, 1], [125, 560, 1], [140, 760, 1], [-140, 760, 1]], C.shade2, { col2: C.mid2, g: [80, 600, -100, 740], dir: 90 });
    // high collar: band and two wing tips
    add('collar', 'white', [[-175, 690, 1], [-90, 720], [0, 728], [90, 720], [175, 690, 1], [168, 790, 1], [0, 805, 1], [-168, 790, 1]], C.white, { col2: C.whiteS, g: [-160, 700, 160, 780], dir: 0 });
    add('wingL', 'white', [[-60, 735, 1], [-8, 790, 1], [-70, 838, 1], [-130, 800, 1]], C.white, { col2: C.whiteS, g: [-120, 760, -20, 830], dir: 30 });
    add('wingR', 'white', [[60, 735, 1], [8, 790, 1], [70, 838, 1], [130, 800, 1]], C.whiteS, { col2: C.white, g: [120, 760, 20, 830], dir: 150 });
    // bow tie
    add('tieL', 'black', [[-16, 790], [-70, 760], [-140, 742], [-170, 772], [-176, 806], [-160, 846], [-110, 838], [-50, 818], [-16, 808]], C.black, { col2: C.tieS, g: [-170, 760, -30, 820], dir: 10 });
    add('tieR', 'black', [[16, 790], [70, 762], [140, 746], [168, 778], [172, 810], [154, 848], [104, 838], [50, 818], [16, 808]], C.black, { col2: C.black, g: [150, 760, 30, 840], dir: 170 });
    add('knot', 'black', [[-20, 782], [20, 782], [22, 818], [-22, 818]], C.tieS, { col2: C.black, g: [-20, 780, 20, 820], dir: 90 });

    // hair mass behind the head (heaped over the ears)
    add('hairBack', 'hair', [[-300, 235], [-360, 215], [-405, 150], [-446, 40], [-506, -60], [-528, -170], [-500, -290], [-440, -390], [-350, -460], [-250, -505], [-130, -528], [0, -536], [130, -546], [260, -530], [370, -480], [452, -400], [515, -300], [545, -180], [524, -60], [478, 40], [440, 150], [380, 225], [300, 265], [0, 0]], C.hair, { col2: C.hairM, g: [-300, -500, 300, 200], dir: 100 });
    add('lockL1', 'hairlight', [[-480, -60], [-470, -200], [-420, -300], [-380, -200], [-400, -90], [-440, 20]], C.hairL, { col2: C.hairM, g: [-460, -250, -400, 0], dir: 105 });
    add('lockR1', 'hairlight', [[490, -260], [515, -160], [496, -50], [460, 40], [440, -60], [450, -170]], C.hairM, { col2: C.slateD, g: [500, -220, 450, 20], dir: 80 });
    add('lockR2', 'hairlight', [[300, -540], [400, -480], [470, -380], [495, -290], [430, -350], [360, -450]], C.hairL, { col2: C.hairM, g: [320, -520, 480, -320], dir: 50 });
    // ears
    add('earL', 'skin', [[-300, -90], [-370, -135], [-430, -100], [-450, 10], [-434, 140], [-392, 240], [-330, 248], [-300, 180]], C.mid, { smooth: 1, col2: C.lit2, g: [-430, -60, -330, 200], dir: 95 });
    add('earLin', 'shade', [[-322, -70], [-372, -100], [-410, -40], [-412, 70], [-388, 170], [-345, 150], [-335, 40]], C.shade2, { smooth: 1, col2: C.shade, g: [-390, -40, -340, 150], dir: 95 });
    add('earR', 'skin', [[322, -100], [392, -145], [458, -108], [478, 10], [462, 150], [416, 250], [350, 252], [326, 170]], C.mid, { smooth: 1, col2: C.mid2, g: [340, -80, 470, 200], dir: 85 });
    add('earRin', 'shade', [[346, -75], [400, -110], [440, -50], [440, 70], [420, 170], [372, 190], [358, 60]], C.shade2, { smooth: 1, col2: C.deep, g: [370, -60, 420, 170], dir: 85 });
    // the face: long, gaunt, narrowing to a strong jaw under the beard
    add('face', 'skin', [[-292, -330], [-318, -180], [-322, -40], [-326, 80], [-312, 220], [-276, 370], [-205, 500], [-90, 585], [10, 600], [118, 578], [228, 490], [296, 360], [334, 210], [350, 70], [350, -60], [340, -200], [312, -340], [210, -430], [40, -452], [-140, -432]], C.mid, { col2: C.mid2, g: [-200, -300, 250, 300], dir: 90 });
    // forehead: lit plane (left/front) and turning shadow plane (right temple)
    add('forehead', 'skin', [[-250, -345], [-120, -372], [0, -380], [130, -372], [240, -340], [262, -250], [250, -150], [240, -110], [60, -100], [-120, -110], [-270, -120], [-268, -240]], C.lit, { col2: C.lit2, g: [-200, -350, 220, -120], dir: 0 });
    add('templeR', 'skin', [[230, -330], [312, -320], [342, -180], [346, -40], [300, -60], [262, -150]], C.shade, { col2: C.mid2, g: [330, -200, 250, -150], dir: 80 });
    add('templeL', 'skin', [[-270, -310], [-302, -300], [-318, -150], [-316, -30], [-270, -50], [-262, -160]], C.mid, { col2: C.mid2, g: [-310, -150, -260, -150], dir: 95 });
    // brow ridge (strong) and the deep sockets beneath
    add('browRidge', 'skin', [[-268, -122], [-150, -128], [-40, -112], [0, -95], [40, -112], [150, -130], [262, -112], [270, -60], [150, -66], [40, -55], [0, -40], [-40, -55], [-150, -62], [-265, -55]], C.lit2, { col2: C.mid, g: [-200, -120, 250, -60], dir: 0 });
    add('socketL', 'shade', [[-252, -50], [-150, -66], [-52, -52], [-28, -5], [-40, 50], [-135, 62], [-230, 48], [-262, 5]], C.shade, { col2: C.deep, g: [-250, 30, -60, -40], dir: 160 });
    add('socketR', 'shade', [[255, -55], [150, -70], [50, -55], [28, -5], [42, 48], [140, 60], [240, 46], [275, 0]], C.deep, { col2: C.shade2, g: [60, -40, 250, 40], dir: 20 });
    // hooded upper lids (lit wedge under the brow)
    add('lidL', 'skin', [[-220, -8], [-150, -40], [-74, -34], [-52, -4], [-112, -12], [-170, -10]], C.mid2, { col2: C.mid, g: [-200, -30, -70, -20], dir: 0, feat: true });
    add('lidR', 'skin', [[210, -10], [150, -42], [72, -34], [52, -6], [112, -14], [170, -12]], C.shade2, { col2: C.mid2, g: [200, -30, 70, -20], dir: 0, feat: true });
    // eyes: almond, upper lid low over the iris (the hooded, melancholy look)
    add('eyeL', 'eye', [[-208, 4], [-170, -14], [-120, -17], [-72, -4], [-95, 12], [-150, 18], [-190, 14]], C.eyeW, { smooth: 1, col2: C.whiteS, g: [-200, 0, -80, 0], dir: 0, feat: true });
    add('irisL', 'eye', E(-142, 3, 24, 19).filter((p) => p[1] > -12).concat([[-120, -12], [-164, -12]]), C.iris, { smooth: 1, feat: true, dir: 0 });
    add('eyeR', 'eye', [[200, 0], [162, -16], [114, -18], [70, -6], [92, 10], [146, 16], [184, 12]], C.whiteS, { smooth: 1, col2: C.shade, g: [80, 0, 200, 0], dir: 0, feat: true });
    add('irisR', 'eye', E(130, 1, 23, 19).filter((p) => p[1] > -13).concat([[152, -13], [108, -13]]), C.iris, { smooth: 1, feat: true, dir: 0 });
    add('lashL', 'deep', [[-212, 6, 1], [-172, -10], [-118, -12], [-66, -2, 1], [-118, -4], [-170, -2]], C.socket, { smooth: 1, feat: true, dir: 0 });
    add('lashR', 'deep', [[204, 2, 1], [162, -12], [112, -13], [64, -4, 1], [112, -5], [162, -4]], C.socket, { smooth: 1, feat: true, dir: 0 });
    // brows: heavy, low, the outer ends drooping
    add('browL', 'hair', [[-252, -36, 1], [-215, -78], [-150, -96], [-80, -92], [-38, -70, 1], [-86, -72], [-150, -74], [-210, -58]], C.hairM, { col2: C.hairL, g: [-250, -60, -40, -80], dir: 0, feat: true });
    add('browR', 'hair', [[38, -74, 1], [82, -98], [150, -102], [214, -84], [262, -40, 1], [210, -62], [150, -78], [86, -78]], C.hair, { col2: C.hairM, g: [40, -80, 260, -50], dir: 0, feat: true });
    // cheekbones (lit) and hollow cheeks beneath them
    add('cheekboneL', 'skin', [[-312, 40], [-240, 52], [-160, 68], [-118, 108], [-170, 150], [-262, 170], [-310, 150]], C.lit, { col2: C.lit2, g: [-300, 60, -140, 140], dir: 160 });
    add('cheekboneR', 'skin', [[338, 40], [262, 50], [180, 66], [140, 110], [190, 150], [282, 165], [334, 140]], C.lit2, { col2: C.mid, g: [320, 60, 160, 130], dir: 20 });
    add('hollowL', 'shade', [[-312, 172], [-236, 176], [-160, 172], [-128, 214], [-196, 250], [-250, 330], [-290, 300]], C.deep, { col2: C.shade2, g: [-200, 180, -230, 320], dir: 110 });
    add('hollowR', 'shade', [[336, 166], [262, 170], [184, 168], [140, 216], [210, 250], [262, 320], [310, 286]], C.deep, { col2: C.shade2, g: [230, 175, 250, 310], dir: 70 });
    // nose: long, lit plane on the left, shadow plane on the right, cast shadow down-right
    add('noseCast', 'shade', [[40, 120], [95, 210], [125, 290], [80, 300], [52, 262]], C.shade2, { col2: C.shade, g: [60, 160, 110, 290], dir: 60 });
    add('noseShadow', 'shade', [[6, -48], [36, -30], [48, 80], [70, 200], [86, 250], [62, 282], [18, 286], [6, 200]], C.shade, { col2: C.shade2, g: [20, 0, 70, 260], dir: 85, feat: true });
    add('noseLit', 'skin', [[-34, -48], [6, -50], [6, 120], [10, 230], [-12, 262], [-58, 262], [-74, 220], [-48, 130]], C.lit, { col2: C.lit2, g: [-20, -40, -40, 250], dir: 95, feat: true });
    add('noseTip', 'skin', [[-62, 205], [-18, 190], [26, 215], [32, 258], [0, 280], [-48, 276], [-72, 250]], C.lit2, { col2: C.mid, g: [-50, 200, 20, 270], dir: 0, feat: true });
    add('wingL', 'shade', [[-72, 222], [-98, 232], [-108, 262], [-88, 285], [-50, 282], [-66, 258]], C.mid2, { col2: C.shade, g: [-100, 240, -60, 280], dir: 70, feat: true });
    add('wingR', 'shade', [[40, 225], [74, 236], [86, 266], [64, 290], [28, 285], [44, 260]], C.shade2, { col2: C.deep, g: [40, 240, 80, 280], dir: 110, feat: true });
    // simultaneity: the nose also seen in profile, a pale wedge thrust out over the shadowed cheek
    add('noseProfile', 'skin', [[26, -52], [46, -30], [92, 80], [134, 190], [160, 236], [146, 262], [104, 282], [62, 290], [38, 268], [40, 150]], C.profile, { col2: C.lit2, g: [40, -40, 140, 260], dir: 70, feat: true });
    add('nostrilL', 'deep', [[-64, 276], [-40, 268], [-20, 280], [-44, 290]], C.socket, { feat: true, dir: 0 });
    add('nostrilR', 'deep', [[46, 276], [24, 270], [6, 282], [28, 291]], C.socket, { feat: true, dir: 0 });
    // the clean upper lip, mouth and the full lower lip
    add('upperLip', 'skin', [[-112, 290], [-40, 296], [0, 302], [40, 296], [104, 292], [110, 372], [70, 392], [0, 386], [-80, 394], [-120, 372]], C.mid, { col2: C.mid2, g: [-80, 300, 90, 380], dir: 90 });
    add('philtrumL', 'skin', [[-20, 298], [-6, 300], [-10, 378], [-34, 384]], C.lit2, { feat: true, dir: 92 });
    add('nasolabialL', 'shade', [[-104, 262, 1], [-84, 300], [-110, 380], [-150, 448, 1], [-130, 380], [-118, 300]], C.shade2, { feat: true, dir: 105 });
    add('nasolabialR', 'shade', [[84, 266, 1], [100, 300], [122, 378], [150, 440, 1], [138, 372], [114, 300]], C.deep, { feat: true, dir: 75 });
    add('mouth', 'deep', [[-96, 396, 1], [-50, 388], [0, 392], [50, 386], [94, 392, 1], [50, 402], [0, 404], [-50, 404]], C.deep, { smooth: 1, feat: true, dir: 0 });
    add('lowerLip', 'lip', [[-80, 402], [-36, 404], [0, 406], [40, 402], [78, 400], [58, 428], [0, 440], [-58, 430]], C.lipL, { smooth: 1, col2: C.lip, g: [0, 405, 0, 448], dir: 0, feat: true });
    add('underLip', 'shade', [[-70, 440], [0, 452], [66, 436], [56, 472], [0, 482], [-58, 474]], C.shade2, { col2: C.deep, g: [0, 445, 0, 480], dir: 0 });
    // the chin-curtain beard: jaw and chin, cheeks and upper lip bare
    add('beard', 'beard', [[-342, 100], [-318, 200], [-286, 300], [-240, 392], [-170, 452], [-100, 474], [-46, 486], [0, 492], [52, 484], [110, 470], [180, 440], [246, 380], [296, 290], [330, 190], [356, 92], [386, 180], [386, 300], [352, 420], [296, 520], [210, 612], [110, 684], [20, 716], [-80, 704], [-180, 642], [-268, 548], [-330, 430], [-364, 300], [-376, 190]], C.beard, { col2: C.beardL, g: [-300, 300, 200, 650], dir: 95 });
    add('beardLit', 'beard', [[-340, 230], [-300, 310], [-258, 392], [-210, 440], [-196, 520], [-262, 540], [-320, 450], [-350, 340]], C.beardL, { col2: C.hairM, g: [-330, 300, -230, 520], dir: 105 });
    add('beardChin', 'beard', [[-76, 515], [0, 508], [80, 512], [60, 610], [0, 640], [-58, 612]], C.hairL, { col2: C.beard, g: [0, 520, 0, 640], dir: 90 });
    // sideburns joining hair to beard in front of the ears
    // the mole, by the right corner of the mouth, above the beard line
    add('mole', 'mole', E(-168, 326, 13, 12), C.mole, { smooth: 1, feat: true, dir: 0 });
    // front hair: heavy, dark, parted on his right, swept across and falling at the temples
    add('hairTopL', 'hair', [[-300, -150], [-350, -260], [-340, -380], [-270, -455], [-190, -488], [-160, -450], [-200, -400], [-240, -330], [-262, -220]], C.hairM, { col2: C.hair, g: [-300, -400, -200, -200], dir: 105 });
    add('hairSweep', 'hair', [[-160, -450], [-80, -520], [40, -520], [140, -540], [262, -500], [370, -430], [410, -320], [392, -200], [350, -130], [310, -230], [236, -300], [130, -350], [30, -372], [-80, -400], [-160, -420]], C.hair, { col2: C.hairL, g: [-120, -500, 300, -280], dir: 15 });
    add('lockR', 'hair', [[170, -384], [262, -360], [318, -310], [340, -210], [300, -246], [246, -300], [170, -336]], C.hairL, { col2: C.hairM, g: [180, -360, 320, -230], dir: 40 });

    // the stovepipe: a tall silk crown rising out of the picture, its band, the brim curling up at the sides, and
    // the shadow it throws across the top of the forehead
    add('brimShadow', 'shade', [[-290, -404], [0, -416], [300, -406], [306, -366], [150, -346], [0, -334], [-150, -344], [-292, -358]], C.shade2, { col2: C.mid2, g: [0, -404, 0, -334], dir: 0 });
    add('templeHairL', 'hair', [[-340, -404], [-250, -412], [-232, -360], [-246, -290], [-280, -220], [-318, -200]], C.hair, { col2: C.hairM, g: [-300, -400, -260, -220], dir: 100 });
    add('templeHairR', 'hair', [[352, -404], [262, -414], [246, -360], [262, -290], [296, -220], [334, -200]], C.hair, { col2: C.hairM, g: [300, -400, 280, -220], dir: 80 });
    add('crownL', 'hat', [[-318, -470, 1], [-332, -1500, 1], [-160, -1500, 1], [-150, -470, 1]], C.hatL, { col2: C.hatD, g: [-330, -800, -150, -800], dir: 92 });
    add('crownM', 'hat', [[-150, -470, 1], [-160, -1500, 1], [170, -1500, 1], [160, -470, 1]], C.black, { col2: C.hatD, g: [-150, -800, 160, -800], dir: 90 });
    add('crownR', 'hat', [[160, -470, 1], [170, -1500, 1], [384, -1500, 1], [372, -470, 1]], C.hatD, { col2: C.black, g: [160, -800, 380, -800], dir: 88 });
    add('sheen', 'hatlight', [[-268, -560, 1], [-280, -1500, 1], [-230, -1500, 1], [-222, -560, 1]], C.hatS, { col2: C.hatL, g: [-270, -600, -270, -1200], dir: 91 });
    add('band', 'hat', [[-320, -455, 1], [-321, -600, 1], [373, -600, 1], [373, -455, 1]], C.band, { col2: C.black, g: [-320, -520, 373, -520], dir: 0 });
    add('brim', 'hat', [[-492, -478], [-420, -452], [-300, -462], [0, -472], [300, -462], [420, -452], [500, -484], [486, -436], [300, -410], [0, -400], [-300, -410], [-478, -432]], C.hatD, { col2: C.hatL, g: [400, -440, -400, -440], dir: 0 });
    return { shapes, C };
  }
  G.FACE = { face };
})(typeof window !== 'undefined' ? window : globalThis);
