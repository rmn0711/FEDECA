import type { ArtKey } from "@/lib/types";

type Pt = [number, number];
interface J { h: Pt; n: Pt; p: Pt; k1: Pt; a1: Pt; k2: Pt; a2: Pt; e: Pt; w: Pt }
type Prop = [number, number, number, number, ("wall" | "bench" | "band" | "box" | "bar")?];

const STAND: J = { h: [50, 13], n: [50, 20], p: [50, 43], k1: [51, 58], a1: [51, 72], k2: [48, 58], a2: [48, 72], e: [53, 32], w: [53, 43] };
const LYING: J = { h: [10, 60], n: [17, 62], p: [45, 62], k1: [63, 62], a1: [82, 62], k2: [60, 49], a2: [68, 62], e: [30, 63], w: [40, 63] };
const SEAT: J = { h: [38, 14], n: [38, 22], p: [38, 50], k1: [62, 50], a1: [62, 70], k2: [58, 50], a2: [58, 70], e: [46, 38], w: [58, 38] };
const QUAD: J = { h: [74, 36], n: [66, 40], p: [34, 44], k1: [34, 66], a1: [22, 68], k2: [38, 66], a2: [26, 68], e: [66, 54], w: [66, 68] };
const m = (b: J, o: Partial<J>): J => ({ ...b, ...o });

const BRIDGE_UP = m(LYING, { p: [45, 46], n: [17, 61], k1: [63, 46], a1: [67, 62], k2: [63, 46], a2: [67, 62] });
const LYING_BENT = m(LYING, { k1: [62, 49], a1: [68, 62] });
const SQUAT_WALL = m(STAND, { h: [36, 22], n: [36, 29], p: [37, 52], k1: [58, 52], a1: [58, 71], k2: [56, 52], a2: [56, 71], e: [46, 40], w: [56, 38] });
const REC = m(SEAT, { h: [20, 30], n: [27, 36], p: [32, 52], k1: [50, 42], a1: [66, 32], k2: [48, 44], a2: [64, 34], e: [40, 40], w: [48, 36] });

const ART: Record<ArtKey, { a: J; b: J; props?: Prop[] }> = {
  quad_set: { a: LYING, b: m(LYING, { k1: [63, 60], a1: [82, 58] }), props: [[58, 66, 68, 66, "bar"]] },
  slr: { a: m(LYING, { k2: [60, 49], a2: [68, 62] }), b: m(LYING, { k1: [63, 52], a1: [82, 40] }) },
  tke: { a: m(STAND, { k1: [55, 58], a1: [51, 72], k2: [52, 58] }), b: STAND, props: [[51, 58, 92, 50, "band"]] },
  wall_sit: { a: SQUAT_WALL, b: m(SQUAT_WALL, { p: [37, 50], k1: [58, 50], k2: [56, 50] }), props: [[28, 8, 28, 72, "wall"]] },
  bridge: { a: LYING_BENT, b: BRIDGE_UP },
  hip_thrust: { a: m(BRIDGE_UP, { p: [44, 62], n: [22, 52], h: [14, 48], k1: [62, 50], k2: [62, 50] }), b: m(BRIDGE_UP, { p: [44, 50], n: [22, 52], h: [14, 48], k1: [64, 50], k2: [64, 50] }), props: [[8, 56, 30, 56, "bench"]] },
  clamshell: { a: m(LYING, { h: [12, 56], n: [20, 58], p: [46, 60], k1: [64, 50], a1: [78, 60], k2: [64, 54], a2: [78, 62], e: [30, 58], w: [38, 62] }), b: m(LYING, { h: [12, 56], n: [20, 58], p: [46, 60], k1: [64, 50], a1: [78, 60], k2: [64, 40], a2: [78, 56], e: [30, 58], w: [38, 62] }), props: [[60, 52, 68, 52, "band"]] },
  side_walk: { a: m(STAND, { k1: [56, 58], a1: [60, 72], k2: [44, 58], a2: [40, 72] }), b: m(STAND, { k1: [60, 58], a1: [68, 72], k2: [44, 58], a2: [40, 72] }), props: [[56, 58, 46, 58, "band"]] },
  calf_raise: { a: STAND, b: m(STAND, { h: [50, 8], n: [50, 15], p: [50, 38], k1: [51, 54], a1: [51, 68], k2: [48, 54], a2: [48, 68], e: [53, 28], w: [53, 38] }), props: [[44, 72, 58, 72, "bar"]] },
  single_leg_balance: { a: STAND, b: m(STAND, { k2: [58, 54], a2: [52, 62] }), props: [[76, 10, 76, 72, "wall"]] },
  sit_to_stand: { a: m(SEAT, { p: [34, 50], n: [36, 22], h: [38, 14], k1: [58, 50], a1: [58, 70], k2: [56, 50], a2: [56, 70], e: [46, 36], w: [54, 34] }), b: m(STAND, { e: [56, 34], w: [60, 34], p: [46, 43] }), props: [[18, 52, 44, 52, "bench"]] },
  leg_press: { a: m(REC, { k1: [46, 42], a1: [56, 52], k2: [44, 44], a2: [54, 54] }), b: m(REC, { k1: [58, 38], a1: [76, 30], k2: [56, 40], a2: [74, 32] }), props: [[10, 62, 50, 24, "bench"], [78, 20, 78, 46, "bar"]] },
  leg_curl: { a: m(SEAT, { a1: [64, 70], a2: [60, 70] }), b: m(SEAT, { a1: [46, 66], a2: [44, 66] }), props: [[22, 52, 54, 52, "bench"]] },
  leg_extension: { a: SEAT, b: m(SEAT, { k1: [62, 50], a1: [84, 52], k2: [60, 50], a2: [82, 54] }), props: [[22, 52, 62, 52, "bench"]] },
  hip_adduction: { a: m(SEAT, { k1: [64, 50], a1: [72, 68] }), b: m(SEAT, { k1: [62, 50], a1: [62, 70] }), props: [[22, 52, 62, 52, "bench"]] },
  hip_abduction: { a: m(SEAT, { k1: [62, 50], a1: [62, 70] }), b: m(SEAT, { k1: [66, 50], a1: [78, 68] }), props: [[22, 52, 62, 52, "bench"]] },
  step_up: { a: m(STAND, { k1: [60, 56], a1: [66, 62], p: [48, 43] }), b: m(STAND, { h: [58, 5], n: [58, 12], p: [58, 34], k1: [58, 48], a1: [60, 62], k2: [56, 50], a2: [54, 56], e: [60, 24], w: [60, 34] }), props: [[56, 62, 76, 62, "box"]] },
  rdl: { a: STAND, b: m(STAND, { h: [76, 31], n: [68, 34], p: [42, 42], k1: [44, 57], a1: [45, 72], k2: [41, 57], a2: [42, 72], e: [70, 46], w: [70, 58] }), props: [[64, 60, 84, 60, "bar"]] },
  single_leg_bridge: { a: BRIDGE_UP, b: m(BRIDGE_UP, { k2: [62, 40], a2: [82, 34] }) },
  spanish_squat: { a: SQUAT_WALL, b: m(SQUAT_WALL, { p: [37, 50], k1: [58, 50], k2: [56, 50] }), props: [[28, 8, 28, 72, "wall"], [56, 60, 20, 60, "band"]] },
  chest_press: { a: m(SEAT, { e: [46, 36], w: [50, 36] }), b: m(SEAT, { e: [56, 34], w: [72, 34] }), props: [[24, 8, 24, 52, "bench"]] },
  seated_row: { a: m(SEAT, { e: [58, 36], w: [74, 36], k1: [70, 50], a1: [72, 68], k2: [68, 50], a2: [70, 68] }), b: m(SEAT, { e: [40, 38], w: [58, 36], k1: [70, 50], a1: [72, 68], k2: [68, 50], a2: [70, 68] }), props: [[74, 36, 94, 36, "band"]] },
  shoulder_press: { a: m(SEAT, { e: [46, 32], w: [46, 20] }), b: m(SEAT, { e: [42, 16], w: [42, 2] }), props: [[24, 8, 24, 52, "bench"]] },
  biceps_curl: { a: m(SEAT, { e: [42, 40], w: [44, 58] }), b: m(SEAT, { e: [42, 40], w: [54, 30] }) },
  lat_pulldown: { a: m(SEAT, { e: [44, 12], w: [46, 0] }), b: m(SEAT, { e: [36, 34], w: [46, 24] }), props: [[46, 0, 46, 0, "bar"]] },
  incline_press: { a: m(REC, { e: [38, 36], w: [42, 32] }), b: m(REC, { e: [48, 26], w: [52, 12] }), props: [[10, 62, 36, 38, "bench"]] },
  db_row: { a: m(STAND, { h: [74, 26], n: [66, 30], p: [40, 38], k1: [44, 56], a1: [44, 72], k2: [30, 52], a2: [26, 62], e: [66, 50], w: [66, 62] }), b: m(STAND, { h: [74, 26], n: [66, 30], p: [40, 38], k1: [44, 56], a1: [44, 72], k2: [30, 52], a2: [26, 62], e: [54, 40], w: [62, 52] }), props: [[18, 54, 40, 54, "bench"]] },
  triceps_ext: { a: m(SEAT, { e: [42, 8], w: [34, 22] }), b: m(SEAT, { e: [42, 8], w: [42, -4] }) },
  dead_bug: { a: m(LYING, { k1: [56, 44], a1: [66, 44], k2: [56, 46], a2: [66, 46], e: [30, 48], w: [30, 36] }), b: m(LYING, { k1: [63, 60], a1: [82, 62], k2: [56, 46], a2: [66, 46], e: [30, 48], w: [30, 36] }) },
  bird_dog: { a: QUAD, b: m(QUAD, { k2: [22, 44], a2: [6, 44], e: [78, 36], w: [92, 36] }) },
  incline_plank: { a: { h: [82, 30], n: [76, 34], p: [46, 46], k1: [30, 55], a1: [14, 64], k2: [30, 56], a2: [14, 66], e: [72, 48], w: [80, 48] }, b: { h: [82, 31], n: [76, 35], p: [46, 45], k1: [30, 54], a1: [14, 64], k2: [30, 55], a2: [14, 66], e: [72, 48], w: [80, 48] }, props: [[66, 52, 90, 52, "bench"]] },
  pallof: { a: m(STAND, { e: [56, 33], w: [56, 30] }), b: m(STAND, { e: [64, 31], w: [76, 30] }), props: [[56, 30, 6, 30, "band"]] },
  bike: { a: m(SEAT, { h: [34, 12], n: [40, 20], p: [34, 48], k1: [56, 50], a1: [52, 70], k2: [58, 40], a2: [66, 62], e: [54, 30], w: [66, 36] }), b: m(SEAT, { h: [34, 12], n: [40, 20], p: [34, 48], k1: [58, 40], a1: [66, 62], k2: [56, 50], a2: [52, 70], e: [54, 30], w: [66, 36] }), props: [[30, 50, 30, 60, "bar"], [52, 70, 66, 62, "bar"]] },
  elliptical: { a: m(STAND, { k1: [54, 58], a1: [60, 72], k2: [46, 58], a2: [38, 70], e: [60, 32], w: [66, 26] }), b: m(STAND, { k1: [46, 58], a1: [38, 70], k2: [54, 58], a2: [60, 72], e: [44, 32], w: [38, 38] }), props: [[68, 20, 68, 60, "bar"]] },
  walk: { a: m(STAND, { k1: [56, 58], a1: [62, 72], k2: [44, 58], a2: [38, 72], e: [44, 33], w: [40, 42] }), b: m(STAND, { k1: [44, 58], a1: [38, 72], k2: [56, 58], a2: [62, 72], e: [58, 33], w: [62, 42] }) },
  swim: { a: { h: [78, 40], n: [70, 42], p: [40, 44], k1: [22, 46], a1: [6, 48], k2: [22, 44], a2: [8, 42], e: [82, 36], w: [92, 40] }, b: { h: [78, 40], n: [70, 42], p: [40, 44], k1: [22, 44], a1: [6, 40], k2: [22, 46], a2: [8, 50], e: [60, 56], w: [48, 60] }, props: [[0, 48, 100, 48, "wall"]] },
  stretch_quad: { a: m(STAND, { k2: [50, 58], a2: [52, 66] }), b: m(STAND, { k2: [50, 60], a2: [44, 46], e: [48, 44], w: [46, 46] }), props: [[76, 10, 76, 72, "wall"]] },
  stretch_ham: { a: m(SEAT, { h: [34, 14], n: [36, 22], p: [36, 58], k1: [62, 58], a1: [86, 58], k2: [50, 62], a2: [40, 66], e: [48, 40], w: [60, 50] }), b: m(SEAT, { h: [58, 28], n: [54, 32], p: [36, 58], k1: [62, 58], a1: [86, 58], k2: [50, 62], a2: [40, 66], e: [70, 48], w: [82, 56] }) },
  stretch_calf: { a: m(STAND, { h: [40, 14], n: [42, 21], p: [46, 44], k1: [58, 56], a1: [66, 72], k2: [38, 60], a2: [26, 72], e: [60, 30], w: [74, 30] }), b: m(STAND, { h: [44, 16], n: [46, 23], p: [48, 44], k1: [60, 56], a1: [68, 72], k2: [38, 60], a2: [26, 72], e: [62, 30], w: [74, 30] }), props: [[76, 8, 76, 72, "wall"]] },
  stretch_hip_flexor: { a: m(STAND, { h: [44, 14], n: [45, 21], p: [45, 46], k1: [62, 52], a1: [62, 72], k2: [30, 64], a2: [16, 68], e: [50, 34], w: [56, 44] }), b: m(STAND, { h: [48, 14], n: [48, 21], p: [49, 48], k1: [66, 52], a1: [64, 72], k2: [32, 66], a2: [16, 68], e: [52, 34], w: [58, 44] }) },
  stretch_glute: { a: m(LYING, { k1: [60, 48], a1: [64, 62], k2: [56, 42], a2: [64, 48] }), b: m(LYING, { k1: [54, 42], a1: [60, 56], k2: [56, 38], a2: [66, 46] }) },
  mobility_hip: { a: m(SEAT, { k1: [62, 50], a1: [66, 66], k2: [58, 60], a2: [38, 66] }), b: m(SEAT, { k1: [64, 54], a1: [70, 66], k2: [56, 62], a2: [36, 66] }) },
  mobility_ankle: { a: m(SEAT, { a1: [62, 70], a2: [58, 70] }), b: m(SEAT, { a1: [70, 66], a2: [58, 70] }) },
  cat_cow: { a: m(QUAD, { h: [76, 32], n: [66, 36], p: [34, 40] }), b: m(QUAD, { h: [76, 46], n: [66, 44], p: [34, 48] }) },
  generic: { a: m(STAND, { e: [56, 44], w: [58, 54] }), b: m(STAND, { e: [58, 22], w: [60, 8] }) },
};

const PROP_STYLE: Record<string, string> = { wall: "#c9c3b0", bench: "#bdb7a3", band: "#b4502c", box: "#bdb7a3", bar: "#a39d88" };

// Animación de un atributo (se reemplaza "@" por el nombre).
function A({ attr, a, b }: { attr: string; a: number; b: number }) {
  if (a === b) return null;
  return <animate attributeName={attr} values={`${a};${a};${b};${b};${a}`} keyTimes="0;.12;.5;.62;1" dur="3.2s" repeatCount="indefinite" />;
}

function Seg({ p, q, pa, qa, w, c, o = 1 }: { p: Pt; q: Pt; pa: Pt; qa: Pt; w: number; c: string; o?: number }) {
  return (
    <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={c} strokeWidth={w} strokeLinecap="round" opacity={o}>
      <A attr="x1" a={p[0]} b={pa[0]} />
      <A attr="y1" a={p[1]} b={pa[1]} />
      <A attr="x2" a={q[0]} b={qa[0]} />
      <A attr="y2" a={q[1]} b={qa[1]} />
    </line>
  );
}

export function ExerciseArt({ art, className, label }: { art: ArtKey; className?: string; label?: string }) {
  const { a, b, props = [] } = ART[art] ?? ART.generic;
  const limb = "#2c6a56";
  return (
    <svg viewBox="0 0 100 80" role="img" aria-label={label ?? "Ilustración del ejercicio"} className={className}>
      <rect width="100" height="80" rx="10" fill="#efece3" />
      <line x1="4" y1="74" x2="96" y2="74" stroke="#d9d4c3" strokeWidth="1.5" />
      {props.map((pr, i) => (
        <line key={i} x1={pr[0]} y1={pr[1]} x2={pr[2]} y2={pr[3]} stroke={PROP_STYLE[pr[4] ?? "bar"]} strokeWidth={pr[4] === "band" ? 1.6 : pr[4] === "box" ? 6 : 4} strokeLinecap="round" strokeDasharray={pr[4] === "band" ? "3 2" : undefined} />
      ))}
      <Seg p={a.p} q={a.k2} pa={b.p} qa={b.k2} w={4.2} c={limb} o={0.45} />
      <Seg p={a.k2} q={a.a2} pa={b.k2} qa={b.a2} w={4.2} c={limb} o={0.45} />
      <Seg p={a.n} q={a.p} pa={b.n} qa={b.p} w={6} c="#1d2a24" />
      <Seg p={a.p} q={a.k1} pa={b.p} qa={b.k1} w={4.8} c={limb} />
      <Seg p={a.k1} q={a.a1} pa={b.k1} qa={b.a1} w={4.8} c={limb} />
      <Seg p={a.n} q={a.e} pa={b.n} qa={b.e} w={3.6} c="#1d2a24" />
      <Seg p={a.e} q={a.w} pa={b.e} qa={b.w} w={3.6} c="#1d2a24" />
      <circle cx={a.h[0]} cy={a.h[1]} r="5.2" fill="#1d2a24">
        <A attr="cx" a={a.h[0]} b={b.h[0]} />
        <A attr="cy" a={a.h[1]} b={b.h[1]} />
      </circle>
    </svg>
  );
}
