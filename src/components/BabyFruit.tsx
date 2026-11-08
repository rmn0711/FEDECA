// Ilustraciones propias de las frutas y verduras con las que se compara el tamaño del bebé.
type Shape = "round" | "oval" | "pear" | "long" | "banana" | "bean" | "leafy" | "stripes" | "ribbed" | "tiny" | "corn" | "layers" | "crown";
const ITEMS: Record<string, { shape: Shape; c1: string; c2: string }> = {
  sesamo: { shape: "tiny", c1: "#e8d9b0", c2: "#cdb988" },
  semilla: { shape: "tiny", c1: "#6b4a2f", c2: "#4a321f" },
  lenteja: { shape: "tiny", c1: "#c9a15a", c2: "#a67f3c" },
  arandano: { shape: "round", c1: "#4a5c9c", c2: "#2f3d73" },
  frijol: { shape: "bean", c1: "#a3402f", c2: "#7d2c20" },
  uva: { shape: "round", c1: "#7a4a8a", c2: "#593268" },
  fresa: { shape: "pear", c1: "#d9433b", c2: "#a92f2a" },
  higo: { shape: "pear", c1: "#7b4b6b", c2: "#573449" },
  lima: { shape: "round", c1: "#8ab24a", c2: "#628a2e" },
  durazno: { shape: "round", c1: "#f0a073", c2: "#d97c52" },
  limon: { shape: "oval", c1: "#f1d24a", c2: "#d9b72c" },
  manzana: { shape: "round", c1: "#d4483d", c2: "#a8322a" },
  aguacate: { shape: "pear", c1: "#4f7a3f", c2: "#34552a" },
  pera: { shape: "pear", c1: "#b9c750", c2: "#93a336" },
  camote: { shape: "oval", c1: "#9a5a7a", c2: "#733f5a" },
  mango: { shape: "oval", c1: "#f0a93c", c2: "#d9663a" },
  banano: { shape: "banana", c1: "#f2d34f", c2: "#d9b432" },
  zanahoria: { shape: "long", c1: "#ee8a2e", c2: "#cf6d1b" },
  yuca: { shape: "long", c1: "#a8764a", c2: "#7d5532" },
  toronja: { shape: "round", c1: "#f3a36b", c2: "#e07a4a" },
  maiz: { shape: "corn", c1: "#f2cf4a", c2: "#6a9a45" },
  ahuyama: { shape: "ribbed", c1: "#ec9a3a", c2: "#c97a22" },
  lechuga: { shape: "leafy", c1: "#7fb35a", c2: "#5a9140" },
  repollo: { shape: "layers", c1: "#a8cf7a", c2: "#7fae52" },
  berenjena: { shape: "pear", c1: "#5b3a73", c2: "#3e2650" },
  calabacin: { shape: "long", c1: "#5e9a4a", c2: "#3f7330" },
  pina: { shape: "crown", c1: "#e9bd3c", c2: "#c99a26" },
  coco: { shape: "round", c1: "#7a5a3f", c2: "#553d29" },
  name: { shape: "long", c1: "#a98b66", c2: "#7e6446" },
  melon: { shape: "stripes", c1: "#e8c58a", c2: "#c9a463" },
  sandia: { shape: "stripes", c1: "#5aa04a", c2: "#2f6e32" },
};

export function BabyFruit({ item, className }: { item: string; className?: string }) {
  const it = ITEMS[item] ?? ITEMS.manzana;
  const { c1, c2 } = it;
  const leaf = <path d="M60 24c6-10 16-12 22-8-4 8-14 12-22 8z" fill="#5a9140" />;
  let body: React.ReactNode;
  switch (it.shape) {
    case "tiny":
      body = <ellipse cx="60" cy="56" rx="7" ry="4.5" fill={c1} stroke={c2} strokeWidth="1.5" />;
      break;
    case "round":
      body = (<><circle cx="60" cy="56" r="30" fill={c1} /><path d="M40 44c6-10 18-14 28-10" stroke="#fff" strokeOpacity=".35" strokeWidth="5" strokeLinecap="round" fill="none" /><path d="M60 26v-6" stroke={c2} strokeWidth="3" strokeLinecap="round" />{leaf}</>);
      break;
    case "oval":
      body = (<><ellipse cx="60" cy="56" rx="34" ry="24" fill={c1} transform="rotate(-18 60 56)" /><path d="M38 52c8-10 22-14 34-10" stroke="#fff" strokeOpacity=".35" strokeWidth="5" strokeLinecap="round" fill="none" /><ellipse cx="60" cy="56" rx="34" ry="24" fill="none" stroke={c2} strokeWidth="2" transform="rotate(-18 60 56)" /></>);
      break;
    case "pear":
      body = (<><path d="M60 24c10 0 14 10 16 20 3 8 14 14 12 28-2 12-14 18-28 18s-26-6-28-18c-2-14 9-20 12-28 2-10 6-20 16-20z" fill={c1} /><path d="M44 66c0-10 6-18 14-22" stroke="#fff" strokeOpacity=".3" strokeWidth="5" strokeLinecap="round" fill="none" /><path d="M60 24v-8" stroke={c2} strokeWidth="3" strokeLinecap="round" />{item === "aguacate" && <ellipse cx="60" cy="72" rx="9" ry="10" fill="#8a5a36" />}{leaf}</>);
      break;
    case "long":
      body = (<><path d="M30 38c8-6 30-4 62 14 6 4 4 10-4 12-28 6-50-2-60-14-4-5-3-9 2-12z" fill={c1} transform="rotate(-10 60 56)" /><path d="M96 46l10-12M100 52l12-4" stroke="#5a9140" strokeWidth="4" strokeLinecap="round" /><path d="M44 52c10 2 20 4 30 8" stroke={c2} strokeWidth="2" strokeLinecap="round" fill="none" opacity=".7" /></>);
      break;
    case "banana":
      body = (<><path d="M22 38c10 36 50 50 88 22-30 8-58 0-74-30z" fill={c1} stroke={c2} strokeWidth="2.5" strokeLinejoin="round" /><path d="M22 38l-4-8" stroke="#6a5a2f" strokeWidth="4" strokeLinecap="round" /></>);
      break;
    case "bean":
      body = <path d="M36 44c10-14 40-16 52 0 8 12 2 28-14 32-14 4-22-6-34-8-10-2-12-14-4-24z" fill={c1} />;
      break;
    case "leafy":
      body = (<><circle cx="60" cy="58" r="28" fill={c2} /><path d="M60 28c-14 6-20 22-14 36 6-8 10-20 14-36zM60 28c14 6 20 22 14 36-6-8-10-20-14-36z" fill={c1} /><path d="M32 58c4 14 16 24 28 24V50c-12 0-22 2-28 8z" fill={c1} /><path d="M88 58c-4 14-16 24-28 24V50c12 0 22 2 28 8z" fill={c1} opacity=".9" /></>);
      break;
    case "layers":
      body = (<><circle cx="60" cy="56" r="30" fill={c1} /><path d="M60 26c-16 10-16 50 0 60M60 26c16 10 16 50 0 60M32 50c20 6 36 6 56 0" stroke={c2} strokeWidth="2.5" fill="none" strokeLinecap="round" /></>);
      break;
    case "stripes":
      body = (<><ellipse cx="60" cy="56" rx="36" ry="28" fill={c1} /><path d="M60 28c-14 10-14 46 0 56M60 28c14 10 14 46 0 56M60 28c-26 8-30 48 0 56M60 28c26 8 30 48 0 56" stroke={c2} strokeWidth="3" fill="none" opacity=".85" strokeLinecap="round" /></>);
      break;
    case "ribbed":
      body = (<><ellipse cx="60" cy="58" rx="36" ry="28" fill={c1} /><path d="M60 30c-12 8-12 48 0 56M60 30c12 8 12 48 0 56M38 36c-8 14-6 34 4 46M82 36c8 14 6 34-4 46" stroke={c2} strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M60 30v-8" stroke="#5a7a33" strokeWidth="4" strokeLinecap="round" /></>);
      break;
    case "corn":
      body = (<><path d="M60 20c14 0 22 18 22 40s-8 40-22 40-22-18-22-40 8-40 22-40z" fill={c1} /><g stroke="#c9a432" strokeWidth="1.5" opacity=".7"><path d="M44 36h32M42 48h36M42 60h36M42 72h36M44 84h32M52 24v70M60 22v74M68 24v70" /></g><path d="M38 70c-6-20 6-46 22-52-14 14-12 38-4 62zM82 70c6-20-6-46-22-52 14 14 12 38 4 62z" fill={c2} /></>);
      break;
    case "crown":
      body = (<><ellipse cx="60" cy="66" rx="26" ry="30" fill={c1} /><path d="M40 52l40 28M80 52L40 80M34 66h52" stroke={c2} strokeWidth="2" opacity=".7" /><path d="M60 38l-14-20 10 6 4-12 4 12 10-6z" fill="#5a9140" /></>);
      break;
  }
  return (
    <svg viewBox="0 0 120 100" role="img" aria-label={`Ilustración: ${item}`} className={className}>
      {body}
    </svg>
  );
}
