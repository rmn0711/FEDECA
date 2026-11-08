import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { ExerciseArt, ART_KEYS } from "../src/components/ExerciseArt";

const cells = ART_KEYS.map((k) => `<figure style="margin:0"><div style="width:230px">${renderToStaticMarkup(<ExerciseArt art={k} />)}</div><figcaption style="font:12px sans-serif">${k}</figcaption></figure>`).join("");
writeFileSync(process.argv[2], `<body style="margin:12px;background:#f8f6f0"><div style="display:grid;grid-template-columns:repeat(6,230px);gap:10px">${cells}</div></body>`);
