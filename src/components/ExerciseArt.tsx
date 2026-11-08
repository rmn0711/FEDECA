// Ilustraciones de ejercicios: figura esquemática con proporciones reales (cinemática directa/inversa),
// equipo dibujado, músculo trabajado resaltado, posición final "fantasma" y flecha de movimiento.
// Todo propio y en SVG: sin fotos de personas.
import type { ArtKey } from "@/lib/types";

type Pt = [number, number];
type Limb = { to: Pt; side?: Pt } | { th: number; sh: number };

interface Pose {
  hip: Pt;
  /** ángulo del torso desde la cadera hacia el hombro (0 = abajo, 90 = derecha, 180 = arriba) */
  t: number;
  /** giro extra de la cabeza */
  hd?: number;
  leg1: Limb;
  leg2: Limb;
  arm: Limb;
  ft1?: number;
  ft2?: number;
}

type JointKey = "hip" | "sho" | "head" | "k1" | "a1" | "t1" | "k2" | "a2" | "t2" | "e" | "w";
type Joints = Record<JointKey, Pt>;

const LEN = { torso: 18, head: 7, th: 15, sh: 14.5, ft: 6, ua: 11, fa: 10.5 };
const FL = 71; // y del tobillo con el pie apoyado
const dir = (a: number): Pt => [Math.sin((a * Math.PI) / 180), Math.cos((a * Math.PI) / 180)];
const add = (p: Pt, d: Pt, l: number): Pt => [p[0] + d[0] * l, p[1] + d[1] * l];

/** Dos segmentos con extremo objetivo; `side` elige hacia qué lado dobla la articulación. */
function ik(a: Pt, b: Pt, l1: number, l2: number, side: Pt): [Pt, Pt] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d0 = Math.hypot(dx, dy) || 0.001;
  const d = Math.min(d0, l1 + l2 - 0.01);
  const ux = dx / d0;
  const uy = dy / d0;
  const aa = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - aa * aa));
  const base: Pt = [a[0] + ux * aa, a[1] + uy * aa];
  const c1: Pt = [base[0] - uy * h, base[1] + ux * h];
  const c2: Pt = [base[0] + uy * h, base[1] - ux * h];
  const dot = (c: Pt) => (c[0] - base[0]) * side[0] + (c[1] - base[1]) * side[1];
  const mid = dot(c1) >= dot(c2) ? c1 : c2;
  return [mid, [a[0] + ux * d, a[1] + uy * d]];
}

function limb(root: Pt, l: Limb, l1: number, l2: number, defSide: Pt): [Pt, Pt] {
  if ("to" in l) return ik(root, l.to, l1, l2, l.side ?? defSide);
  const m = add(root, dir(l.th), l1);
  return [m, add(m, dir(l.sh), l2)];
}

function joints(p: Pose): Joints {
  const sho = add(p.hip, dir(p.t), LEN.torso);
  const head = add(sho, dir(p.t + (p.hd ?? 0)), LEN.head);
  const [k1, a1] = limb(p.hip, p.leg1, LEN.th, LEN.sh, [1, 0]);
  const [k2, a2] = limb(p.hip, p.leg2, LEN.th, LEN.sh, [1, 0]);
  const [e, w] = limb(sho, p.arm, LEN.ua, LEN.fa, [-0.4, 1]);
  return { hip: p.hip, sho, head, k1, a1, t1: add(a1, dir(p.ft1 ?? 90), LEN.ft), k2, a2, t2: add(a2, dir(p.ft2 ?? 90), LEN.ft), e, w };
}

/* ───────────── Props (equipo) ───────────── */
type PropColor = "seat" | "metal" | "wall" | "box" | "band" | "pad" | "water";
const PCOL: Record<PropColor, string> = { seat: "#cdbf99", metal: "#98a39d", wall: "#d6d0bc", box: "#c9b98e", band: "#b4502c", pad: "#8aa29a", water: "#bcd4e6" };
type Prop =
  | { k: "rect"; x: number; y: number; w: number; h: number; c: PropColor; r?: number; move?: JointKey }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; c: PropColor; w?: number; dash?: boolean; move?: JointKey }
  | { k: "circle"; x: number; y: number; r: number; c: PropColor; move?: JointKey }
  | { k: "bandj"; from: JointKey; to: Pt; dash?: boolean }
  | { k: "link"; a: JointKey; b: JointKey }
  | { k: "arrow2"; x: number; y: number };

const seat = (hx: number, top: number): Prop[] => [
  { k: "line", x1: hx - 3, y1: top + 4, x2: hx - 3, y2: 74, c: "metal", w: 3 },
  { k: "line", x1: hx - 14, y1: 73.5, x2: hx + 12, y2: 73.5, c: "metal", w: 2.5 },
  { k: "rect", x: hx - 9, y: top - 32, w: 4, h: 34, c: "pad", r: 2 },
  { k: "rect", x: hx - 12, y: top, w: 26, h: 4, c: "seat", r: 2 },
];
const bench = (x1: number, x2: number, y: number): Prop[] => [
  { k: "line", x1: x1 + 3, y1: y + 4, x2: x1 + 3, y2: 74, c: "metal", w: 2.5 },
  { k: "line", x1: x2 - 3, y1: y + 4, x2: x2 - 3, y2: 74, c: "metal", w: 2.5 },
  { k: "rect", x: x1, y, w: x2 - x1, h: 4.5, c: "seat", r: 2 },
];

/* ───────────── Poses base ───────────── */
const stand = (x = 50): Pose => ({ hip: [x, 41.5], t: 180, leg1: { to: [x + 1, FL] }, leg2: { to: [x - 3, FL] }, arm: { th: 4, sh: 4 } });
const sup: Pose = { hip: [40, 69.5], t: -90, leg1: { to: [70, 70.5] }, leg2: { to: [58, 70], side: [0, -1] }, arm: { th: 90, sh: 90 }, ft1: 165 };
const sitP = (hx: number, top: number, o: Partial<Pose> = {}): Pose => ({ hip: [hx, top - 4], t: 181, leg1: { th: 90, sh: 0 }, leg2: { th: 90, sh: 0 }, arm: { to: [hx + 14, top - 17] }, ...o });
const quad = (o: Partial<Pose> = {}): Pose => ({ hip: [34, 56], t: 108, leg1: { th: 0, sh: -90 }, leg2: { th: 0, sh: -90 }, arm: { to: [52, FL] }, ...o });

type Hl = "thigh1" | "thigh2" | "shin1" | "torso" | "arm" | "hip";
interface Art {
  a: Pose;
  b: Pose;
  props?: Prop[];
  hl?: Hl[];
  mv?: JointKey;
  db?: boolean;
}

const wallProp: Prop = { k: "rect", x: 19, y: 4, w: 6, h: 70, c: "wall", r: 1 };

const ART: Record<ArtKey, Art> = {
  quad_set: { a: { ...sup, leg1: { to: [69, 67] } }, b: { ...sup }, hl: ["thigh1"], props: [{ k: "circle", x: 55, y: 72, r: 2.8, c: "box" }] },
  slr: { a: sup, b: { ...sup, leg1: { to: [62.6, 50.5] }, ft1: 140 }, hl: ["thigh1"], mv: "a1" },
  tke: { a: { ...stand(48), hip: [48, 43], leg1: { to: [50, FL] }, leg2: { to: [46, FL] }, arm: { to: [56, 40] } }, b: { ...stand(48), arm: { to: [56, 40] } }, hl: ["thigh1"], props: [{ k: "line", x1: 92, y1: 40, x2: 92, y2: 74, c: "metal", w: 3 }, { k: "bandj", from: "k1", to: [92, 57] }] },
  wall_sit: { a: { hip: [31, 43.5], t: 180, leg1: { to: [50, FL] }, leg2: { to: [48, FL] }, arm: { to: [44, 38] } }, b: { hip: [31, 47], t: 180, leg1: { to: [50, FL] }, leg2: { to: [48, FL] }, arm: { to: [44, 40] } }, hl: ["thigh1"], props: [wallProp], mv: "hip" },
  bridge: { a: { hip: [44, 69.5], t: -90, leg1: { to: [64, 70], side: [0, -1] }, leg2: { to: [61, 70], side: [0, -1] }, arm: { th: 90, sh: 90 } }, b: { hip: [44, 58], t: -64, leg1: { to: [64, 70], side: [0, -1] }, leg2: { to: [61, 70], side: [0, -1] }, arm: { th: 90, sh: 90 } }, hl: ["hip", "thigh1"], mv: "hip" },
  hip_thrust: { a: { hip: [42, 68], t: -114, leg1: { to: [60, 70], side: [0, -1] }, leg2: { to: [57, 70], side: [0, -1] }, arm: { th: 90, sh: 90 } }, b: { hip: [42, 56], t: -71, leg1: { to: [60, 70], side: [0, -1] }, leg2: { to: [57, 70], side: [0, -1] }, arm: { th: 90, sh: 90 } }, hl: ["hip", "thigh1"], props: bench(6, 30, 62), mv: "hip" },
  clamshell: { a: { hip: [40, 69], t: -90, leg1: { th: 120, sh: 60 }, leg2: { th: 120, sh: 60 }, arm: { th: 90, sh: 90 }, ft1: 150, ft2: 150 }, b: { hip: [40, 69], t: -90, leg1: { th: 120, sh: 60 }, leg2: { to: [65.6, 69.3], side: [0, -1] }, arm: { th: 90, sh: 90 }, ft1: 150, ft2: 150 }, hl: ["hip"], props: [{ k: "link", a: "k1", b: "k2" }], mv: "k2" },
  side_walk: { a: { hip: [50, 41.5], t: 180, leg1: { to: [45, FL] }, leg2: { to: [55, FL] }, arm: { th: 6, sh: 6 } }, b: { hip: [50, 45], t: 180, leg1: { to: [36, FL] }, leg2: { to: [64, FL] }, arm: { th: 6, sh: 6 } }, hl: ["hip"], props: [{ k: "link", a: "a1", b: "a2" }], mv: "a2" },
  calf_raise: { a: stand(), b: { hip: [50, 37.5], t: 180, leg1: { to: [51, 67] }, leg2: { to: [47, 67] }, arm: { th: 4, sh: 4 }, ft1: 50, ft2: 50 }, hl: ["shin1"], mv: "hip" },
  single_leg_balance: { a: { ...stand(58), arm: { to: [74, 36] } }, b: { ...stand(58), leg2: { to: [66, 58], side: [1, 0] }, arm: { to: [74, 36] } }, hl: ["hip"], props: [{ k: "rect", x: 76, y: 6, w: 5, h: 68, c: "wall", r: 1 }], mv: "a2" },
  sit_to_stand: { a: { hip: [33, 49], t: 162, leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [50, 38] } }, b: { hip: [46, 41.5], t: 172, leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [56, 36] } }, hl: ["thigh1"], props: bench(16, 38, 53), mv: "hip" },
  leg_press: { a: { hip: [30, 56], t: -145, leg1: { to: [55.9, 43.9], side: [0, -1] }, leg2: { to: [54.9, 45], side: [0, -1] }, arm: { to: [34, 50] }, ft1: 160, ft2: 160 }, b: { hip: [30, 56], t: -145, leg1: { to: [59.5, 42.2], side: [0, -1] }, leg2: { to: [58.5, 43], side: [0, -1] }, arm: { to: [34, 50] }, ft1: 160, ft2: 160 }, hl: ["thigh1"], props: [{ k: "line", x1: 8, y1: 73, x2: 56, y2: 73, c: "metal", w: 2.5 }, { k: "line", x1: 34, y1: 62, x2: 14, y2: 35, c: "seat", w: 5 }, { k: "line", x1: 33, y1: 60, x2: 41, y2: 61, c: "seat", w: 4 }, { k: "line", x1: 63, y1: 30, x2: 65, y2: 58, c: "pad", w: 3.5, move: "a1" }], mv: "a1" },
  leg_curl: { a: { ...sitP(32, 53), leg1: { to: [66, 62] }, leg2: { to: [65, 63] }, arm: { to: [44, 54] } }, b: { ...sitP(32, 53), leg1: { to: [41, 70] }, leg2: { to: [40, 70] }, arm: { to: [44, 54] } }, hl: ["thigh1"], props: [...seat(32, 53), { k: "circle", x: 62, y: 62, r: 3.2, c: "pad", move: "a1" }], mv: "a1" },
  leg_extension: { a: { ...sitP(32, 53), leg1: { th: 90, sh: 0 }, leg2: { th: 90, sh: 0 }, arm: { to: [44, 54] } }, b: { ...sitP(32, 53), leg1: { th: 90, sh: 45 }, leg2: { th: 90, sh: 45 }, arm: { to: [44, 54] } }, hl: ["thigh1"], props: [...seat(32, 53), { k: "circle", x: 48, y: 62, r: 3.2, c: "pad", move: "a1" }], mv: "a1" },
  hip_adduction: { a: { hip: [50, 49], t: 180, leg1: { to: [33, FL], side: [0, -1] }, leg2: { to: [67, FL], side: [0, -1] }, arm: { to: [56, 52] } }, b: { hip: [50, 49], t: 180, leg1: { to: [45, FL], side: [0, -1] }, leg2: { to: [55, FL], side: [0, -1] }, arm: { to: [56, 52] } }, hl: ["thigh1"], props: [...seat(52, 53), { k: "arrow2", x: 50, y: 36 }], mv: "a1" },
  hip_abduction: { a: { hip: [50, 49], t: 180, leg1: { to: [45, FL], side: [0, -1] }, leg2: { to: [55, FL], side: [0, -1] }, arm: { to: [56, 52] } }, b: { hip: [50, 49], t: 180, leg1: { to: [33, FL], side: [0, -1] }, leg2: { to: [67, FL], side: [0, -1] }, arm: { to: [56, 52] } }, hl: ["hip"], props: [...seat(52, 53), { k: "arrow2", x: 50, y: 36 }], mv: "a1" },
  step_up: { a: { hip: [54, 41.5], t: 182, leg1: { to: [67, 62] }, leg2: { to: [52, FL] }, arm: { to: [58, 46] } }, b: { hip: [67, 32], t: 180, leg1: { to: [67, 62] }, leg2: { to: [62, 55], side: [1, 0] }, arm: { to: [72, 38] } }, hl: ["thigh1"], props: [{ k: "rect", x: 56, y: 64, w: 26, h: 10, c: "box", r: 1.5 }], mv: "hip" },
  rdl: { a: { ...stand(46), arm: { th: 5, sh: 5 } }, b: { hip: [40, 43], t: 125, leg1: { to: [46, FL], side: [1, 0] }, leg2: { to: [43, FL] }, arm: { to: [54.5, 58] } }, hl: ["thigh1", "hip"], db: true, mv: "w" },
  single_leg_bridge: { a: { hip: [44, 69.5], t: -90, leg1: { to: [64, 70], side: [0, -1] }, leg2: { to: [68, 48] }, arm: { th: 90, sh: 90 } }, b: { hip: [44, 58], t: -64, leg1: { to: [64, 70], side: [0, -1] }, leg2: { to: [68, 37] }, arm: { th: 90, sh: 90 } }, hl: ["hip", "thigh1"], mv: "hip" },
  spanish_squat: { a: { hip: [38, 45], t: 188, leg1: { to: [44, FL] }, leg2: { to: [41, FL] }, arm: { to: [48, 36] } }, b: { hip: [36, 50], t: 188, leg1: { to: [44, FL] }, leg2: { to: [41, FL] }, arm: { to: [48, 40] } }, hl: ["thigh1"], props: [{ k: "line", x1: 10, y1: 40, x2: 10, y2: 74, c: "metal", w: 4 }, { k: "bandj", from: "k1", to: [10, 58] }], mv: "hip" },
  chest_press: { a: { ...sitP(30, 53), leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [40, 36], side: [0, 1] } }, b: { ...sitP(30, 53), leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [57, 34] } }, hl: ["torso"], props: [...seat(30, 53), { k: "circle", x: 40, y: 36, r: 2.4, c: "metal", move: "w" }], mv: "w" },
  seated_row: { a: { ...sitP(30, 53), leg1: { to: [58, 68] }, leg2: { to: [57, 69] }, arm: { to: [54, 34] } }, b: { ...sitP(30, 53), leg1: { to: [58, 68] }, leg2: { to: [57, 69] }, arm: { to: [38, 38], side: [-1, 0.5] } }, hl: ["torso"], props: [...seat(30, 53), { k: "rect", x: 60, y: 60, w: 3, h: 14, c: "pad", r: 1 }, { k: "line", x1: 88, y1: 34, x2: 90, y2: 74, c: "metal", w: 3 }, { k: "bandj", from: "w", to: [88, 34] }], mv: "w" },
  shoulder_press: { a: { ...sitP(30, 53), leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [38, 23], side: [0, 1] } }, b: { ...sitP(30, 53), leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [32, 9] } }, hl: ["arm"], props: seat(30, 53), db: true, mv: "w" },
  biceps_curl: { a: { ...sitP(30, 53), leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [32, 52] } }, b: { ...sitP(30, 53), leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [44, 31], side: [-0.2, 1] } }, hl: ["arm"], props: seat(30, 53), db: true, mv: "w" },
  lat_pulldown: { a: { ...sitP(30, 53), leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [40, 6] } }, b: { ...sitP(30, 53), leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [36, 30], side: [-1, 0.6] } }, hl: ["torso"], props: [...seat(30, 53), { k: "rect", x: 38, y: 43, w: 14, h: 4, c: "pad", r: 2 }, { k: "line", x1: 30, y1: 2, x2: 52, y2: 2, c: "metal", w: 3 }, { k: "bandj", from: "w", to: [40, 2] }], mv: "w" },
  incline_press: { a: { hip: [32, 56], t: -148, leg1: { to: [50, FL], side: [1, -0.4] }, leg2: { to: [47, FL], side: [1, -0.4] }, arm: { to: [30, 40], side: [0, 1] } }, b: { hip: [32, 56], t: -148, leg1: { to: [50, FL], side: [1, -0.4] }, leg2: { to: [47, FL], side: [1, -0.4] }, arm: { to: [24, 22] } }, hl: ["torso"], props: [{ k: "line", x1: 33, y1: 61, x2: 12, y2: 33, c: "seat", w: 5.5 }, { k: "line", x1: 34, y1: 62, x2: 34, y2: 74, c: "metal", w: 2.5 }], db: true, mv: "w" },
  db_row: { a: { hip: [38, 44], t: 100, leg1: { to: [40, FL] }, leg2: { to: [18, 59], side: [1, 0.3] }, arm: { to: [56, 62] } }, b: { hip: [38, 44], t: 100, leg1: { to: [40, FL] }, leg2: { to: [18, 59], side: [1, 0.3] }, arm: { to: [48, 44], side: [-0.3, 1] } }, hl: ["torso", "arm"], props: bench(6, 32, 59), db: true, mv: "w" },
  triceps_ext: { a: { ...sitP(30, 53), leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [24, 30], side: [0, -1] } }, b: { ...sitP(30, 53), leg1: { to: [52, FL] }, leg2: { to: [49, FL] }, arm: { to: [32, 7], side: [0.6, 0] } }, hl: ["arm"], props: seat(30, 53), db: true, mv: "w" },
  dead_bug: { a: { hip: [40, 69.5], t: -90, leg1: { th: 180, sh: 90 }, leg2: { th: 180, sh: 90 }, arm: { to: [22, 50] }, ft1: 160 }, b: { hip: [40, 69.5], t: -90, leg1: { th: 95, sh: 95 }, leg2: { th: 180, sh: 90 }, arm: { to: [6, 66], side: [0, -1] }, ft1: 160 }, hl: ["torso"], mv: "a1" },
  bird_dog: { a: quad(), b: quad({ leg2: { th: -100, sh: -100 }, arm: { th: 95, sh: 95 } }), hl: ["torso", "hip"], mv: "w" },
  incline_plank: { a: { hip: [42, 60], t: 111, leg1: { to: [16, FL] }, leg2: { to: [17, FL] }, arm: { th: 0, sh: 90 }, ft1: 60, ft2: 60 }, b: { hip: [42, 58.5], t: 111, leg1: { to: [16, FL] }, leg2: { to: [17, FL] }, arm: { th: 0, sh: 90 }, ft1: 60, ft2: 60 }, hl: ["torso"], props: [{ k: "rect", x: 60, y: 62, w: 32, h: 12, c: "box", r: 2 }], mv: "hip" },
  pallof: { a: { ...stand(50), arm: { to: [58, 32], side: [0, 1] } }, b: { ...stand(50), arm: { to: [71, 29] } }, hl: ["torso"], props: [{ k: "rect", x: 4, y: 10, w: 3.5, h: 64, c: "metal", r: 1 }, { k: "bandj", from: "w", to: [6, 30] }], mv: "w" },
  bike: { a: { hip: [36, 49], t: 156, leg1: { to: [46, 70], side: [1, -0.2] }, leg2: { to: [46, 56], side: [1, -0.2] }, arm: { to: [60, 38] } }, b: { hip: [36, 49], t: 156, leg1: { to: [46, 56], side: [1, -0.2] }, leg2: { to: [46, 70], side: [1, -0.2] }, arm: { to: [60, 38] } }, hl: ["thigh1"], props: [{ k: "rect", x: 26, y: 47, w: 14, h: 3.5, c: "seat", r: 1.5 }, { k: "line", x1: 33, y1: 50, x2: 44, y2: 64, c: "metal", w: 3 }, { k: "line", x1: 44, y1: 64, x2: 62, y2: 40, c: "metal", w: 3 }, { k: "line", x1: 62, y1: 40, x2: 64, y2: 34, c: "metal", w: 3 }, { k: "line", x1: 30, y1: 73.5, x2: 66, y2: 73.5, c: "metal", w: 3 }, { k: "line", x1: 44, y1: 64, x2: 44, y2: 73, c: "metal", w: 3 }, { k: "circle", x: 46, y: 63, r: 2.5, c: "metal" }] },
  elliptical: { a: { hip: [48, 41.5], t: 180, leg1: { to: [40, 68] }, leg2: { to: [58, 64] }, arm: { to: [62, 34] } }, b: { hip: [48, 41.5], t: 180, leg1: { to: [58, 64] }, leg2: { to: [40, 68] }, arm: { to: [56, 38] } }, hl: ["thigh1"], props: [{ k: "line", x1: 36, y1: 72, x2: 64, y2: 72, c: "metal", w: 3 }, { k: "line", x1: 66, y1: 72, x2: 70, y2: 22, c: "metal", w: 3 }, { k: "rect", x: 66, y: 20, w: 8, h: 3, c: "pad", r: 1.5 }] },
  walk: { a: { hip: [50, 41.5], t: 181, leg1: { to: [58, FL] }, leg2: { to: [41, 70] }, arm: { th: -20, sh: -10 } }, b: { hip: [50, 41.5], t: 181, leg1: { to: [43, 70] }, leg2: { to: [58, FL] }, arm: { th: 25, sh: 35 } }, hl: ["thigh1"], mv: "a1" },
  swim: { a: { hip: [38, 50], t: 90, leg1: { to: [9, 54] }, leg2: { to: [9, 47] }, arm: { to: [78, 48] }, ft1: 270, ft2: 270 }, b: { hip: [38, 50], t: 90, leg1: { to: [9, 47] }, leg2: { to: [9, 54] }, arm: { to: [60, 62] }, ft1: 270, ft2: 270 }, hl: ["torso", "arm"], props: [{ k: "rect", x: 0, y: 44, w: 100, h: 30, c: "water" }], mv: "w" },
  stretch_quad: { a: { ...stand(52), leg2: { to: [48, FL] }, arm: { to: [48, 46] } }, b: { ...stand(52), leg2: { to: [41, 52], side: [1, 0.4] }, arm: { to: [42, 52] } }, hl: ["thigh2"], props: [{ k: "rect", x: 76, y: 6, w: 5, h: 68, c: "wall", r: 1 }], mv: "a2" },
  stretch_ham: { a: { hip: [32, 69], t: 180, leg1: { to: [62, 70.5] }, leg2: { to: [22, 70], side: [0, -1] }, arm: { to: [46, 62] }, ft1: 165 }, b: { hip: [32, 69], t: 108, leg1: { to: [62, 70.5] }, leg2: { to: [22, 70], side: [0, -1] }, arm: { to: [58, 66] }, ft1: 165 }, hl: ["thigh1"], mv: "sho" },
  stretch_calf: { a: { hip: [56, 45], t: 150, leg1: { to: [68, FL] }, leg2: { to: [34, FL] }, arm: { to: [76, 30] } }, b: { hip: [58, 45], t: 143, leg1: { to: [68, FL] }, leg2: { to: [34, FL] }, arm: { to: [76, 30] } }, hl: ["shin1"], props: [{ k: "rect", x: 76, y: 6, w: 5, h: 68, c: "wall", r: 1 }], mv: "hip" },
  stretch_hip_flexor: { a: { hip: [42, 57], t: 180, leg1: { to: [58, FL] }, leg2: { th: -25, sh: -90 }, arm: { to: [46, 44] } }, b: { hip: [45, 58], t: 184, leg1: { to: [58, FL] }, leg2: { th: -30, sh: -90 }, arm: { to: [50, 44] } }, hl: ["thigh2"], mv: "hip" },
  stretch_glute: { a: { hip: [40, 69], t: -90, leg1: { th: 120, sh: 60 }, leg2: { th: 160, sh: 50 }, arm: { th: 90, sh: 90 }, ft1: 150 }, b: { hip: [40, 69], t: -90, leg1: { th: 150, sh: 80 }, leg2: { th: 170, sh: 60 }, arm: { th: 90, sh: 90 }, ft1: 150 }, hl: ["hip"], mv: "k1" },
  mobility_hip: { a: { hip: [40, 68], t: 180, leg1: { to: [64, 70], side: [0, -1] }, leg2: { to: [24, 70], side: [0, -1] }, arm: { to: [50, 58] } }, b: { hip: [40, 68], t: 160, leg1: { to: [64, 70], side: [0, -1] }, leg2: { to: [24, 70], side: [0, -1] }, arm: { to: [58, 62] } }, hl: ["hip"], mv: "sho" },
  mobility_ankle: { a: { ...sitP(30, 53), leg1: { to: [60, 64] }, leg2: { to: [52, FL] }, arm: { to: [44, 54] }, ft1: 40 }, b: { ...sitP(30, 53), leg1: { to: [60, 64] }, leg2: { to: [52, FL] }, arm: { to: [44, 54] }, ft1: 160 }, hl: ["shin1"], props: seat(30, 53), mv: "t1" },
  cat_cow: { a: quad({ hip: [34, 55], t: 99, hd: -70, arm: { to: [52, FL] } }), b: quad({ hip: [34, 58], t: 111, hd: 55, arm: { to: [52, FL] } }), hl: ["torso"], mv: "head" },
  generic: { a: { ...stand(), arm: { th: 20, sh: 25 } }, b: { ...stand(), arm: { th: 160, sh: 170 } }, hl: ["torso"], mv: "w" },
};

/* ───────────── Dibujo ───────────── */
const C = { shirt: "#2c6a56", short: "#33423b", skin: "#d9a07e", shoe: "#22302a", hair: "#2a2623", hl: "#b4502c", ghost: "#9aa59f" };

function A({ attr, a, b }: { attr: string; a: number; b: number }) {
  if (Math.abs(a - b) < 0.05) return null;
  return <animate attributeName={attr} values={`${a};${a};${b};${b};${a}`} keyTimes="0;.14;.5;.64;1" dur="3.4s" repeatCount="indefinite" />;
}

function Seg({ a, b, p, q, w, c, o = 1 }: { a: Pt; b: Pt; p: Pt; q: Pt; w: number; c: string; o?: number }) {
  // a→b : posición inicial (p, q) ; segunda posición (a2, b2) llega por animate; aquí p,q son final
  return (
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c} strokeWidth={w} strokeLinecap="round" opacity={o}>
      <A attr="x1" a={a[0]} b={p[0]} />
      <A attr="y1" a={a[1]} b={p[1]} />
      <A attr="x2" a={b[0]} b={q[0]} />
      <A attr="y2" a={b[1]} b={q[1]} />
    </line>
  );
}

function Ghost({ j }: { j: Joints }) {
  const L = (p: Pt, q: Pt, w: number, k: string) => <line key={k} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={C.ghost} strokeWidth={w} strokeLinecap="round" />;
  return (
    <g opacity="0.2">
      {L(j.hip, j.k2, 6, "a")}{L(j.k2, j.a2, 4.6, "b")}{L(j.hip, j.sho, 8.5, "c")}{L(j.hip, j.k1, 6, "d")}{L(j.k1, j.a1, 4.6, "e")}{L(j.sho, j.e, 4, "f")}{L(j.e, j.w, 3.4, "g")}
      <circle cx={j.head[0]} cy={j.head[1]} r="4.8" fill={C.ghost} />
    </g>
  );
}

const HLSEG: Record<Hl, [JointKey, JointKey, number][]> = {
  thigh1: [["hip", "k1", 7.4]],
  thigh2: [["hip", "k2", 7.4]],
  shin1: [["k1", "a1", 6]],
  torso: [["hip", "sho", 9.6]],
  arm: [["sho", "e", 5.2], ["e", "w", 4.2]],
  hip: [],
};

function PropEl({ p, ja, jb }: { p: Prop; ja: Joints; jb: Joints }) {
  switch (p.k) {
    case "rect": {
      const d = p.move ? [jb[p.move][0] - ja[p.move][0], jb[p.move][1] - ja[p.move][1]] : null;
      return (
        <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r ?? 0} fill={PCOL[p.c]} opacity={p.c === "water" ? 0.45 : 1}>
          {d && <animateTransform attributeName="transform" type="translate" values={`0 0;0 0;${d[0]} ${d[1]};${d[0]} ${d[1]};0 0`} keyTimes="0;.14;.5;.64;1" dur="3.4s" repeatCount="indefinite" />}
        </rect>
      );
    }
    case "line": {
      const d = p.move ? [jb[p.move][0] - ja[p.move][0], jb[p.move][1] - ja[p.move][1]] : null;
      return (
        <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={PCOL[p.c]} strokeWidth={p.w ?? 3} strokeLinecap="round" strokeDasharray={p.dash ? "3 2" : undefined}>
          {d && <animateTransform attributeName="transform" type="translate" values={`0 0;0 0;${d[0]} ${d[1]};${d[0]} ${d[1]};0 0`} keyTimes="0;.14;.5;.64;1" dur="3.4s" repeatCount="indefinite" />}
        </line>
      );
    }
    case "circle": {
      const d = p.move ? [jb[p.move][0] - ja[p.move][0], jb[p.move][1] - ja[p.move][1]] : null;
      return (
        <circle cx={p.x} cy={p.y} r={p.r} fill={PCOL[p.c]}>
          {d && <animateTransform attributeName="transform" type="translate" values={`0 0;0 0;${d[0]} ${d[1]};${d[0]} ${d[1]};0 0`} keyTimes="0;.14;.5;.64;1" dur="3.4s" repeatCount="indefinite" />}
        </circle>
      );
    }
    case "bandj": {
      const a = ja[p.from];
      const b = jb[p.from];
      return (
        <g>
          <line x1={a[0]} y1={a[1]} x2={p.to[0]} y2={p.to[1]} stroke={PCOL.band} strokeWidth="1.8" strokeDasharray="3 2" strokeLinecap="round">
            <A attr="x1" a={a[0]} b={b[0]} />
            <A attr="y1" a={a[1]} b={b[1]} />
          </line>
          <circle cx={p.to[0]} cy={p.to[1]} r="2" fill={PCOL.band} />
        </g>
      );
    }
    case "link": {
      const a1 = ja[p.a], a2 = ja[p.b], b1 = jb[p.a], b2 = jb[p.b];
      return (
        <line x1={a1[0]} y1={a1[1]} x2={a2[0]} y2={a2[1]} stroke={PCOL.band} strokeWidth="2.2" strokeDasharray="3 2" strokeLinecap="round">
          <A attr="x1" a={a1[0]} b={b1[0]} /><A attr="y1" a={a1[1]} b={b1[1]} /><A attr="x2" a={a2[0]} b={b2[0]} /><A attr="y2" a={a2[1]} b={b2[1]} />
        </line>
      );
    }
    case "arrow2":
      return (
        <g stroke={C.hl} strokeWidth="1.8" strokeLinecap="round" fill="none">
          <line x1={p.x - 10} y1={p.y} x2={p.x + 10} y2={p.y} />
          <path d={`M${p.x - 10} ${p.y} l3 -2.5 M${p.x - 10} ${p.y} l3 2.5 M${p.x + 10} ${p.y} l-3 -2.5 M${p.x + 10} ${p.y} l-3 2.5`} />
        </g>
      );
  }
}

function Arrow({ from, to }: { from: Pt; to: Pt }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const d = Math.hypot(dx, dy);
  if (d < 4) return null;
  const ux = dx / d, uy = dy / d;
  const s: Pt = [from[0] + ux * 2, from[1] + uy * 2];
  const e: Pt = [to[0] - ux * 2, to[1] - uy * 2];
  const h1: Pt = [e[0] - ux * 3.2 - uy * 2.2, e[1] - uy * 3.2 + ux * 2.2];
  const h2: Pt = [e[0] - ux * 3.2 + uy * 2.2, e[1] - uy * 3.2 - ux * 2.2];
  return (
    <g stroke={C.hl} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2.5 2" fill="none" opacity="0.9">
      <line x1={s[0]} y1={s[1]} x2={e[0]} y2={e[1]} />
      <path d={`M${h1[0]} ${h1[1]} L${e[0]} ${e[1]} L${h2[0]} ${h2[1]}`} strokeDasharray="none" />
    </g>
  );
}

export function ExerciseArt({ art, className, label }: { art: ArtKey; className?: string; label?: string }) {
  const def = ART[art] ?? ART.generic;
  const ja = joints(def.a);
  const jb = joints(def.b);
  const sw = (a: Pt, b: Pt, p: Pt, q: Pt, w: number, c: string, o = 1) => <Seg a={a} b={b} p={p} q={q} w={w} c={c} o={o} />;
  const hlSegs = (def.hl ?? []).flatMap((h) => HLSEG[h]);
  const wristA = ja.w, wristB = jb.w;
  return (
    <svg viewBox="0 0 100 80" role="img" aria-label={label ?? "Ilustración del ejercicio"} className={className}>
      <rect width="100" height="80" rx="10" fill="#efece3" />
      <rect y="74" width="100" height="6" fill="#e2ddcd" />
      {(def.props ?? []).filter((p) => !(p.k === "bandj" || p.k === "link" || p.k === "arrow2")).map((p, i) => <PropEl key={i} p={p} ja={ja} jb={jb} />)}
      <Ghost j={jb} />
      {/* pierna lejana */}
      {sw(ja.hip, ja.k2, jb.hip, jb.k2, 6.4, C.short, 0.55)}
      {sw(ja.k2, ja.a2, jb.k2, jb.a2, 4.8, C.skin, 0.55)}
      {sw(ja.a2, ja.t2, jb.a2, jb.t2, 3.8, C.shoe, 0.55)}
      {/* torso */}
      {sw(ja.hip, ja.sho, jb.hip, jb.sho, 9, C.shirt)}
      {/* pierna cercana */}
      {sw(ja.hip, ja.k1, jb.hip, jb.k1, 7, C.short)}
      {sw(ja.k1, ja.a1, jb.k1, jb.a1, 5.2, C.skin)}
      {sw(ja.a1, ja.t1, jb.a1, jb.t1, 4, C.shoe)}
      {/* brazo */}
      {sw(ja.sho, ja.e, jb.sho, jb.e, 4.6, C.shirt)}
      {sw(ja.e, ja.w, jb.e, jb.w, 3.8, C.skin)}
      {/* músculo trabajado */}
      {hlSegs.map(([p, q, w], i) => <g key={i}>{sw(ja[p], ja[q], jb[p], jb[q], w, C.hl, w > 9 ? 0.5 : 0.78)}</g>)}
      {(def.hl ?? []).includes("hip") && (
        <circle cx={ja.hip[0]} cy={ja.hip[1]} r="5" fill={C.hl} opacity="0.8">
          <A attr="cx" a={ja.hip[0]} b={jb.hip[0]} /><A attr="cy" a={ja.hip[1]} b={jb.hip[1]} />
        </circle>
      )}
      {def.db && (
        <g transform={`translate(${wristA[0]} ${wristA[1]})`}>
          <g>
            <rect x="-4.2" y="-1.1" width="8.4" height="2.2" rx="1" fill="#3a4741" />
            <rect x="-5" y="-3" width="2.6" height="6" rx="1" fill="#26312c" />
            <rect x="2.4" y="-3" width="2.6" height="6" rx="1" fill="#26312c" />
            <animateTransform attributeName="transform" additive="sum" type="translate" values={`0 0;0 0;${wristB[0] - wristA[0]} ${wristB[1] - wristA[1]};${wristB[0] - wristA[0]} ${wristB[1] - wristA[1]};0 0`} keyTimes="0;.14;.5;.64;1" dur="3.4s" repeatCount="indefinite" />
          </g>
        </g>
      )}
      {(def.props ?? []).filter((p) => p.k === "bandj" || p.k === "link" || p.k === "arrow2").map((p, i) => <PropEl key={`b${i}`} p={p} ja={ja} jb={jb} />)}
      {/* cabeza */}
      <circle cx={ja.head[0]} cy={ja.head[1]} r="4.8" fill={C.skin}>
        <A attr="cx" a={ja.head[0]} b={jb.head[0]} /><A attr="cy" a={ja.head[1]} b={jb.head[1]} />
      </circle>
      {def.mv && <Arrow from={ja[def.mv]} to={jb[def.mv]} />}
    </svg>
  );
}

/** Para la hoja de contacto de pruebas. */
export const ART_KEYS = Object.keys(ART) as ArtKey[];
