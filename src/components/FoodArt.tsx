// Ilustraciones propias de comida (SVG plano, vista cenital). Sin fotos de personas.
const P = {
  plate: "#fbfaf6", rim: "#e4dfd0", rice: "#f3ecd8", green: "#4c8a62", green2: "#79ab6c", orange: "#d98a3d", brown: "#a8683a", brownD: "#7d4a28",
  pink: "#e29b86", yellow: "#efc760", white: "#fffdf6", cream: "#f1e3bd", red: "#b4502c", blue: "#5b86a8", fish: "#cf8f6a", bean: "#7a4a35", lent: "#b9884a",
};

function Plate({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <>
      <rect width="120" height="90" rx="12" fill={bg} />
      <ellipse cx="60" cy="47" rx="46" ry="38" fill={P.rim} />
      <ellipse cx="60" cy="45" rx="42" ry="34" fill={P.plate} />
      {children}
    </>
  );
}

const Rice = ({ x = 76, y = 52, r = 13 }) => <ellipse cx={x} cy={y} rx={r} ry={r * 0.8} fill={P.rice} />;
const Greens = ({ x = 44, y = 58 }) => (
  <g>
    <circle cx={x} cy={y} r="7" fill={P.green} />
    <circle cx={x + 8} cy={y + 3} r="6" fill={P.green2} />
    <circle cx={x - 6} cy={y + 4} r="5" fill={P.green2} />
  </g>
);
const Carrots = ({ x = 56, y = 66 }) => (
  <g fill={P.orange}>
    <rect x={x} y={y} width="12" height="4" rx="2" />
    <rect x={x + 4} y={y + 5} width="12" height="4" rx="2" />
  </g>
);

export function FoodArt({ art, className, label }: { art: string; className?: string; label?: string }) {
  let body: React.ReactNode;
  let bg = "#d9e9e0";
  switch (art) {
    case "pollo":
      bg = "#f5e9c6";
      body = (<><ellipse cx="46" cy="40" rx="20" ry="12" fill={P.cream} /><path d="M30 38c8-9 28-10 34 0-6 9-26 12-34 0z" fill="#e3b678" /><path d="M36 38h22M38 42h18" stroke="#b9854a" strokeWidth="1.5" /><Rice /><Greens x={52} y={64} /></>);
      break;
    case "res":
      bg = "#f4dfd4";
      body = (<><path d="M28 34c10-12 32-10 36 2 2 10-14 18-28 12-8-3-10-8-8-14z" fill={P.brown} /><path d="M36 36c6-4 16-4 22 0" stroke={P.brownD} strokeWidth="2" fill="none" /><Rice x={78} /><Carrots x={36} y={62} /></>);
      break;
    case "cerdo":
      bg = "#f4dfd4";
      body = (<><ellipse cx="48" cy="40" rx="22" ry="13" fill="#d9a07f" /><path d="M32 38h32M34 43h28" stroke="#b97a58" strokeWidth="2" /><Greens x={80} y={50} /><Carrots x={40} y={62} /></>);
      break;
    case "pescado":
      bg = "#dae7f0";
      body = (<><path d="M24 42c10-12 30-14 44-2l10-8v22l-10-8c-14 10-34 8-44-4z" fill={P.fish} /><circle cx="34" cy="40" r="2" fill="#1d2a24" /><path d="M46 36c2 4 2 8 0 12M54 34c2 5 2 10 0 15" stroke="#b46f4b" strokeWidth="1.5" fill="none" /><ellipse cx="80" cy="60" rx="10" ry="7" fill="#f4d56a" /><Greens x={40} y={62} /></>);
      break;
    case "camaron":
      bg = "#f4dfd4";
      body = (<><path d="M30 38c0-12 22-14 28-4 6 8-2 16-12 14-6-1-8-4-6-6" fill="none" stroke={P.pink} strokeWidth="9" strokeLinecap="round" /><path d="M64 52c0-8 14-10 18-2 4 7-4 12-12 10" fill="none" stroke={P.pink} strokeWidth="8" strokeLinecap="round" /><Rice x={46} y={62} r={10} /><circle cx="82" cy="36" r="5" fill={P.green2} /></>);
      break;
    case "huevo":
      bg = "#f5e9c6";
      body = (<><ellipse cx="48" cy="42" rx="22" ry="16" fill={P.white} /><circle cx="48" cy="42" r="8" fill={P.yellow} /><ellipse cx="82" cy="50" rx="11" ry="8" fill="#e8c98a" /><Greens x={46} y={64} /></>);
      break;
    case "yogur":
      bg = "#eadcea";
      body = (<><circle cx="60" cy="46" r="24" fill="#d9cfe3" /><circle cx="60" cy="46" r="20" fill={P.white} /><circle cx="52" cy="42" r="4" fill={P.red} /><circle cx="64" cy="48" r="4" fill={P.yellow} /><circle cx="58" cy="54" r="3.5" fill={P.red} /><path d="M46 36c6-6 22-6 28 0" stroke="#e9e2d0" strokeWidth="2" fill="none" /></>);
      break;
    case "batido":
      bg = "#eadcea";
      body = (<><path d="M44 18h32l-4 52c0 4-3 6-6 6H54c-3 0-6-2-6-6z" fill="#f0d3d3" /><path d="M46 30h28l-1.5 20H47.5z" fill="#e7b8c0" /><rect x="66" y="8" width="4" height="30" rx="2" fill={P.red} transform="rotate(14 68 23)" /><ellipse cx="60" cy="19" rx="16" ry="3" fill="#faeaea" /></>);
      break;
    case "legumbre":
      bg = "#f5e9c6";
      body = (<><circle cx="52" cy="46" r="21" fill="#e1c690" /><g fill={P.lent}>{[[44, 40], [52, 36], [58, 44], [48, 50], [56, 54], [40, 48], [62, 38]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="4" ry="3" />)}</g><Rice x={84} y={52} r={11} /><circle cx="82" cy="34" r="5" fill={P.green2} /></>);
      break;
    case "sopa":
      bg = "#f5e9c6";
      body = (<><circle cx="60" cy="46" r="26" fill="#cfa86a" /><circle cx="60" cy="46" r="22" fill="#e8c98a" /><rect x="46" y="38" width="9" height="8" rx="2" fill="#f1e3bd" /><rect x="62" y="48" width="9" height="8" rx="2" fill={P.orange} /><rect x="52" y="52" width="8" height="7" rx="2" fill="#f1e3bd" /><circle cx="68" cy="38" r="4" fill={P.green2} /><circle cx="48" cy="56" r="3.5" fill={P.green} /></>);
      break;
    case "ensalada":
      bg = "#d9e9e0";
      body = (<><circle cx="52" cy="46" r="22" fill={P.green2} /><circle cx="46" cy="40" r="9" fill={P.green} /><circle cx="60" cy="52" r="8" fill={P.green} /><circle cx="64" cy="38" r="5" fill={P.orange} /><circle cx="42" cy="54" r="5" fill={P.yellow} /><path d="M56 44c6 0 10 4 8 8s-8 4-10 0 0-8 2-8z" fill="#aac76a" /><Carrots x={74} y={52} /></>);
      break;
    case "arepa":
      bg = "#f5e9c6";
      body = (<><circle cx="48" cy="46" r="21" fill="#e9cf91" /><circle cx="48" cy="46" r="17" fill="#f3e0ab" /><path d="M36 40c6 4 18 4 24 0" stroke="#d4b673" strokeWidth="1.5" fill="none" /><ellipse cx="82" cy="40" rx="11" ry="8" fill={P.yellow} /><circle cx="82" cy="40" r="4" fill="#e1a93d" /><circle cx="80" cy="62" r="7" fill={P.pink} /></>);
      break;
    case "avena":
      bg = "#f5e9c6";
      body = (<><circle cx="60" cy="46" r="24" fill="#d6b678" /><circle cx="60" cy="46" r="20" fill="#efe1bb" /><circle cx="50" cy="42" r="5" fill={P.yellow} /><circle cx="58" cy="38" r="5" fill={P.yellow} /><circle cx="68" cy="46" r="4" fill={P.red} /><circle cx="56" cy="54" r="4" fill={P.red} /></>);
      break;
    case "arroz":
      bg = "#f5e9c6";
      body = (<><ellipse cx="52" cy="46" rx="26" ry="20" fill={P.rice} /><circle cx="46" cy="42" r="5" fill={P.orange} /><circle cx="58" cy="48" r="5" fill={P.green2} /><circle cx="50" cy="54" r="4" fill={P.pink} /><circle cx="62" cy="38" r="4" fill={P.pink} /><ellipse cx="86" cy="58" rx="9" ry="7" fill="#f4d56a" /></>);
      break;
    case "atun":
      bg = "#dae7f0";
      body = (<><ellipse cx="48" cy="44" rx="22" ry="16" fill="#e8b8a0" /><path d="M32 40c8-4 24-4 30 2M34 48c8 3 20 3 28-2" stroke="#c78a70" strokeWidth="2" fill="none" /><circle cx="80" cy="46" r="10" fill={P.green2} /><circle cx="86" cy="54" r="7" fill="#f4d56a" /></>);
      break;
    default:
      body = (<><circle cx="60" cy="46" r="20" fill={P.green2} /><circle cx="54" cy="42" r="8" fill={P.green} /></>);
  }
  return (
    <svg viewBox="0 0 120 90" role="img" aria-label={label ?? "Ilustración del plato"} className={className}>
      <Plate bg={bg}>{body}</Plate>
    </svg>
  );
}
