"""Pop-up mechanics.

Everything here is real paper engineering driven by ONE degree of freedom: the
opening angle theta between the two pages of the spread (0 = closed, pi = flat).

* V-fold: two wings glued to the pages along lines that leave the gutter at angle
  ALPHA; their shared crease stays in the bisector plane of the spread.
* Parallel layers ("layers on tabs"): a card hinged to one page on a line parallel
  to a V-fold wing and tied to it with floor-parallel tabs is a parallelogram
  linkage, so it keeps the wing's orientation at every theta.
* Because every card of the scene belongs to the same chevron family they are all
  mutually parallel per side; they can never clip through each other.
* validate() checks the classic rule that nothing may poke out of the closed book.
"""
from dataclasses import dataclass, field
import numpy as np
from .geom import v3, norm

G = v3(0, -1, 0)            # gutter direction, pointing at the viewer
YF = v3(0, 1, 0)


@dataclass
class Card:
    id: str
    side: str                 # 'L' or 'R'
    y0: float                 # hinge line origin in page coords (a0 along page, y0 along gutter)
    a0: float = 0.0
    u0: float = 0.0           # art extent in card coords (u screen-right, t up)
    u1: float = 1.0
    t1: float = 1.0
    level: str = ''           # scene level the art comes from
    vfold: bool = False       # wing of a true V-fold (shares its crease with the mirror wing)
    lock: float = 0.0         # order in which it "locks open" (seconds after landing)
    sway: float = 0.0         # life: how much the paper trembles
    tabs: list = field(default_factory=list)   # (u, t, width) tabs tying it to the layer behind
    tab_len: float = 0.0
    shapes: list = field(default_factory=list)
    extra: dict = field(default_factory=dict)


class Mechanism:
    def __init__(self, W=1.0, H=1.55, alpha_deg=62.0):
        self.W, self.H = W, H
        self.alpha = np.radians(alpha_deg)
        self.sa, self.ca = np.sin(self.alpha), np.cos(self.alpha)

    # -- kinematics -------------------------------------------------------
    def solve(self, theta):
        """Return the frame of the whole chevron family at opening angle theta."""
        th = float(np.clip(theta, 0.0, np.pi))
        pR = v3(1, 0, 0)
        pL = v3(np.cos(th), 0, np.sin(th))
        nb = v3(np.cos(th / 2), 0, np.sin(th / 2))      # bisector "up"
        # crease direction c = cos(u) G + sin(u) nb with c . base = 0 (square-cut wings)
        u = np.arctan2(self.ca, -self.sa * np.cos(th / 2))
        c = np.cos(u) * G + np.sin(u) * nb
        bR = self.ca * G + self.sa * pR
        bL = self.ca * G + self.sa * pL
        fr = {
            'theta': th, 'c': c,
            'R': dict(p=pR, eu=bR, et=c, n=norm(np.cross(bR, c)), back=-self.sa * G + self.ca * pR,
                      pn=v3(0, 0, 1)),
            'L': dict(p=pL, eu=-bL, et=c, n=norm(np.cross(-bL, c)), back=-self.sa * G + self.ca * pL,
                      pn=v3(-np.sin(th), 0, np.cos(th)) * -1.0),
        }
        # page normals: the face that carries the pop-up (verso of the turning board, recto of the base)
        fr['L']['pn'] = v3(np.sin(th), 0, -np.cos(th))
        return fr

    def page_pt(self, fr, side, a, y):
        return v3(0, y, 0) + a * fr[side]['p']

    def bridge_frame(self, fr, card):
        """A flat piece spanning the two wings of a V-fold (creased down its middle).
        Each half is hinged to its wing at |u| = s_att and to its twin on the bisector plane;
        when the spread is flat the bridge is pulled taut and faces the viewer squarely."""
        sd = fr[card.side]
        R, s_att = card.extra['R'], card.extra['s_att']
        O = v3(0, card.y0, 0)
        A = O + (s_att if card.side == 'R' else -s_att) * sd['eu']
        c = fr['c']
        th = fr['theta']
        m = norm(np.cross(G, v3(np.cos(th / 2), 0, np.sin(th / 2))))
        e2 = norm(np.cross(c, m))
        a = float(np.clip(-np.dot(A, m) / R, -1, 1))
        b = np.sqrt(max(1 - a * a, 0.0))
        cands = [A + R * (a * m + sg * b * e2) for sg in (1, -1)]
        F = min(cands, key=lambda q: abs(np.dot(q - O, e2)))
        w = (F - A) / R
        eu = -w if card.side == 'R' else w
        return F, eu, c, norm(np.cross(eu, c))

    def card_frame(self, fr, card, lean=0.0):
        """Origin, u axis, t axis and front normal of a card (lean>0 tips it backwards)."""
        if card.extra.get('bridge'):
            return self.bridge_frame(fr, card)
        s = fr[card.side]
        O = self.page_pt(fr, card.side, card.a0, card.y0)
        eu, et, n = s['eu'], s['et'], s['n']
        if lean:
            et = et * np.cos(lean) - n * np.sin(lean)
            n = norm(np.cross(eu, et))
        return O, eu, et, n

    def key(self, card):
        """Depth key inside the chevron family (bigger = further back)."""
        if 'key' in card.extra:
            return card.extra['key']
        return card.a0 * self.ca + card.y0 * self.sa

    # -- validation -------------------------------------------------------
    def closed_pos(self, card, u, t):
        s = abs(u) if card.a0 == 0 else (u if card.side == 'R' else -u)
        return (card.a0 + s * self.sa + t * self.ca, card.y0 - s * self.ca + t * self.sa)

    def validate(self, cards, margin=0.015):
        """Every card point must stay on its own page when the book is shut, and
        one-sided layers must not cross the gutter. Returns a list of problems."""
        bad = []
        for cd in cards:
            pts = cd.extra.get('outline')
            if pts is None or cd.extra.get('bridge'):
                continue
            for (u, t) in pts:
                a, y = self.closed_pos(cd, u, t)
                s = abs(u) if cd.a0 == 0 else (u if cd.side == 'R' else -u)
                amin = cd.a0 + s * self.sa
                if a > self.W - margin or y > self.H - margin or y < margin or amin < -1e-6:
                    bad.append((cd.id, round(u, 3), round(t, 3), round(a, 3), round(y, 3)))
                    break
        return bad

    def t_limit(self, y0, s, margin=0.02):
        """Tallest legal height of a chevron card at distance s along its base."""
        return min((self.W - margin - s * self.sa) / self.ca, (self.H - margin - y0 + s * self.ca) / self.sa)
