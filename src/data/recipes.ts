// Catálogo de recetas. Los macros se calculan siempre desde la base de alimentos (foods.ts).
// EXCLUSIONES ABSOLUTAS: nada de tomate, pepino, papaya, brócoli ni coliflor (ver EXCLUDED_PATTERN y tests).
import { FOODS } from "./foods";
import { buildRecipe, snackTitle } from "@/lib/menu/core";
import type { Recipe, RecipeDef, RecipeLine, Role } from "@/lib/menu/types";
import type { RecipeKind } from "@/lib/types";

const L = (food: string, g: number, role: Role, label?: string): RecipeLine => ({ food, g, role, label });
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const lower1 = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const upper1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fname = (k: string) => FOODS[k].name;

/* ═════════════════════ Componentes de acompañamiento ═════════════════════ */

interface Carb {
  food: string;
  g: number;
  name: string;
  step: string;
  min: number;
}
const CARBS: Carb[] = [
  { food: "arroz", g: 150, name: "arroz blanco", step: "Cocina el arroz con el doble de agua, una pizca de sal y tapa a fuego bajo 18 minutos; suelta con un tenedor.", min: 20 },
  { food: "arroz_int", g: 150, name: "arroz integral", step: "Cocina el arroz integral con 2,5 partes de agua a fuego bajo y tapado por 35 minutos; deja reposar 5.", min: 35 },
  { food: "yuca", g: 120, name: "yuca cocida", step: "Pela la yuca, pártela en trozos y hiérvela con sal 20–25 minutos hasta que esté blanda; retira el hilo central.", min: 25 },
  { food: "name", g: 120, name: "ñame cocido", step: "Pela el ñame, córtalo en trozos y hiérvelo 20 minutos con una pizca de sal hasta que un tenedor lo atraviese sin resistencia.", min: 20 },
  { food: "platano_maduro", g: 100, name: "plátano maduro al horno", step: "Corta el plátano maduro en tajadas, rocíalas con apenas una gota de aceite y hornéalas a 200 °C por 15 minutos, volteando a la mitad.", min: 20 },
  { food: "papa_criolla", g: 120, name: "papa criolla", step: "Hierve las papas criollas con cáscara y sal 15 minutos; escurre y sirve.", min: 15 },
  { food: "quinua", g: 150, name: "quinua", step: "Enjuaga la quinua, cuécela con el doble de agua 15 minutos y deja reposar tapada 5 minutos.", min: 20 },
];

interface Veg {
  lines: RecipeLine[];
  name: string;
  step: string;
  min: number;
}
const VEGS: Veg[] = [
  { name: "habichuela y zanahoria salteadas", lines: [L("habichuela", 90, "veg"), L("zanahoria", 50, "veg")], step: "Saltea la habichuela y la zanahoria en juliana con cebolla larga y 1 cucharadita de aceite 6 minutos; deben quedar tiernas pero crujientes.", min: 10 },
  { name: "puré de ahuyama", lines: [L("ahuyama", 150, "veg")], step: "Cocina la ahuyama en trozos 15 minutos, escúrrela y aplástala con sal y una pizca de comino.", min: 18 },
  { name: "espinacas con champiñones", lines: [L("espinaca", 80, "veg"), L("champi", 60, "veg")], step: "Saltea los champiñones laminados con ajo 4 minutos, añade la espinaca y cocina 2 minutos hasta que se marchite.", min: 8 },
  { name: "berenjena al horno", lines: [L("berenjena", 150, "veg")], step: "Corta la berenjena en rodajas, sazona con sal, ajo y comino y hornea a 200 °C por 20 minutos.", min: 22 },
  { name: "ensalada de repollo y zanahoria", lines: [L("repollo", 100, "veg"), L("zanahoria", 50, "veg"), L("limon", 10, "fixed")], step: "Ralla el repollo y la zanahoria, aliña con jugo de limón, sal y una cucharadita de aceite de oliva.", min: 8 },
  { name: "calabacín salteado", lines: [L("calabacin", 160, "veg"), L("cebolla", 30, "veg")], step: "Corta el calabacín en medias lunas y saltéalo con cebolla 5 minutos a fuego alto para que no suelte agua.", min: 8 },
  { name: "ensalada de lechuga y aguacate", lines: [L("lechuga", 80, "veg"), L("aguacate", 40, "fat"), L("limon", 10, "fixed")], step: "Lava bien la lechuga, trocéala y mezcla con el aguacate en cubos, limón y sal.", min: 6 },
  { name: "pimentón y cebolla salteados", lines: [L("pimenton", 80, "veg"), L("cebolla", 50, "veg")], step: "Corta el pimentón y la cebolla en tiras y saltéalos 6 minutos con una cucharadita de aceite hasta que estén dorados.", min: 8 },
];

/* ═════════════════════ Proteínas y estilos de cocción ═════════════════════ */

type Kind = "meat" | "fish" | "shrimp" | "mince";
interface PDef {
  food: string;
  family: string;
  kind: Kind;
  /** g cocidos base para ~40 g de proteína (almuerzo). */
  gLunch: number;
  name: string; // nombre con género para los títulos
  art: string;
}
const PROTEINS: PDef[] = [
  { food: "pechuga", family: "pollo", kind: "meat", gLunch: 130, name: "Pechuga de pollo", art: "pollo" },
  { food: "muslo", family: "pollo", kind: "meat", gLunch: 155, name: "Muslo de pollo sin piel", art: "pollo" },
  { food: "res", family: "res", kind: "meat", gLunch: 140, name: "Res magra", art: "res" },
  { food: "cerdo", family: "cerdo", kind: "meat", gLunch: 145, name: "Lomo de cerdo magro", art: "cerdo" },
  { food: "pavo", family: "pavo", kind: "meat", gLunch: 130, name: "Pechuga de pavo", art: "pollo" },
  { food: "molida", family: "res", kind: "mince", gLunch: 150, name: "Carne molida magra", art: "res" },
  { food: "bocachico", family: "bocachico", kind: "fish", gLunch: 170, name: "Bocachico", art: "pescado" },
  { food: "mojarra", family: "mojarra", kind: "fish", gLunch: 150, name: "Mojarra", art: "pescado" },
  { food: "robalo", family: "robalo", kind: "fish", gLunch: 170, name: "Róbalo", art: "pescado" },
  { food: "salmon", family: "salmon", kind: "fish", gLunch: 180, name: "Salmón", art: "pescado" },
  { food: "camaron", family: "camaron", kind: "shrimp", gLunch: 165, name: "Camarones", art: "camaron" },
];

interface Style {
  id: string;
  title: (n: string) => string;
  steps: (n: string, food: string) => string[];
  extra: RecipeLine[];
  min: number;
}

const meatSteps = (n: string, verb: string, minutes: string) => [
  `Sazona ${lower1(n)} con ajo, comino, sal y jugo de limón; déjala reposar 15 minutos.`,
  `${verb} hasta que esté completamente cocida (${minutes}); sin partes rosadas por dentro.`,
];

const STYLES: Record<Kind, Style[]> = {
  meat: [
    { id: "plancha", title: (n) => `${n} a la plancha con ajo y limón`, steps: (n) => [...meatSteps(n, "Sella en una sartén antiadherente con 1 cucharadita de aceite, 5–6 minutos por lado", "temperatura interna de 74 °C si usas termómetro"), "Deja reposar 3 minutos antes de cortar en tiras."], extra: [L("aceite", 5, "fat"), L("limon", 10, "fixed")], min: 20 },
    { id: "desmechado", title: (n) => `${n} desmechada con cebolla y pimentón`, steps: (n) => [`Hierve ${lower1(n)} en agua con cebolla, ajo y sal 25 minutos hasta que esté muy tierna.`, "Desmecha con dos tenedores.", "Sofríe cebolla y pimentón en tiras con 1 cucharadita de aceite 5 minutos, agrega la carne desmechada y cocina 5 minutos más."], extra: [L("cebolla", 40, "veg"), L("pimenton", 40, "veg"), L("aceite", 5, "fat")], min: 40 },
    { id: "horno", title: (n) => `${n} al horno con hierbas`, steps: (n) => [`Calienta el horno a 200 °C. Sazona ${lower1(n)} con ajo, tomillo, orégano, sal y limón.`, "Hornea 20–25 minutos hasta que esté bien cocida y jugosa; voltea a la mitad.", "Reposa 5 minutos antes de servir."], extra: [L("aceite", 5, "fat"), L("limon", 10, "fixed")], min: 35 },
    { id: "guisado", title: (n) => `${n} guisada con champiñones y cebolla larga`, steps: (n) => ["Sofríe cebolla larga picada y ajo con 1 cucharadita de aceite 3 minutos.", `Agrega ${lower1(n)} en cubos y sella 4 minutos; suma los champiñones laminados y medio vaso de agua.`, "Tapa y cocina a fuego bajo 15 minutos hasta que espese y la carne esté totalmente cocida."], extra: [L("champi", 60, "veg"), L("cebolla", 30, "veg"), L("aceite", 5, "fat")], min: 30 },
    { id: "brocheta", title: (n) => `${n} en brocheta con pimentón y cebolla`, steps: (n) => [`Corta ${lower1(n)} en cubos de 3 cm y alterna en palitos con tiras de pimentón y cebolla.`, "Sazona con sal, ajo, comino y limón.", "Asa en sartén o parrilla 12–15 minutos girando para que se cocine por todos los lados."], extra: [L("pimenton", 50, "veg"), L("cebolla", 30, "veg"), L("aceite", 5, "fat")], min: 30 },
  ],
  mince: [
    { id: "albondigas", title: (n) => `Albóndigas de ${lower1(n)} al horno`, steps: (n) => [`Mezcla ${lower1(n)} con cebolla rallada, ajo, sal, comino y 1 clara; forma bolitas de 4 cm.`, "Hornea a 200 °C por 18–20 minutos, volteando a la mitad, hasta que estén cocidas por dentro (sin rosado).", "Sirve calientes."], extra: [L("cebolla", 30, "veg"), L("clara", 33, "protein")], min: 35 },
    { id: "saltada", title: (n) => `${n} salteada con zanahoria y cebolla`, steps: (n) => ["Sofríe cebolla y zanahoria rallada con 1 cucharadita de aceite 4 minutos.", `Agrega ${lower1(n)}, sazona con comino y sal, y cocina 10 minutos desbaratando los grumos hasta que esté bien cocida.`], extra: [L("cebolla", 40, "veg"), L("zanahoria", 40, "veg"), L("aceite", 5, "fat")], min: 20 },
    { id: "pastel", title: (n) => `Mini pastel de ${lower1(n)} con espinaca`, steps: (n) => ["Calienta el horno a 190 °C.", `Mezcla ${lower1(n)} con espinaca picada, cebolla, 1 clara, sal y comino.`, "Llena moldes de muffin y hornea 22 minutos hasta que estén firmes y cocidos por dentro."], extra: [L("espinaca", 50, "veg"), L("cebolla", 30, "veg"), L("clara", 33, "protein")], min: 35 },
  ],
  fish: [
    { id: "plancha", title: (n) => `${n} a la plancha con limón`, steps: (n) => [`Sazona el filete de ${lower1(n)} con sal, ajo y limón.`, "Cocina en sartén antiadherente con 1 cucharadita de aceite, 4–5 minutos por lado, hasta que la carne se desmenuce con el tenedor y no quede translúcida."], extra: [L("aceite", 5, "fat"), L("limon", 10, "fixed")], min: 15 },
    { id: "horno", title: (n) => `${n} al horno con cebolla y pimentón`, steps: (n) => [`Calienta el horno a 200 °C. Pon el filete de ${lower1(n)} sobre cebolla y pimentón en tiras.`, "Sazona con sal, ajo, comino y limón; cubre con papel aluminio.", "Hornea 20 minutos hasta que esté completamente cocido y opaco."], extra: [L("cebolla", 40, "veg"), L("pimenton", 40, "veg"), L("aceite", 5, "fat")], min: 30 },
    { id: "coco", title: (n) => `${n} en salsa de coco ligera`, steps: (n) => ["Sofríe cebolla larga y ajo con una cucharadita de aceite 3 minutos.", `Agrega la leche de coco light, sal y comino; cuando hierva, añade el filete de ${lower1(n)}.`, "Tapa y cocina a fuego bajo 10–12 minutos hasta que esté bien cocido."], extra: [L("coco", 25, "fat"), L("cebolla", 30, "veg")], min: 25 },
    { id: "papel", title: (n) => `${n} en papillote con limón y cilantro`, steps: (n) => [`Pon el filete de ${lower1(n)} sobre papel aluminio con rodajas de limón, cilantro, ajo y sal.`, "Cierra el paquete y hornea a 200 °C por 18–20 minutos hasta que esté bien cocido."], extra: [L("limon", 15, "fixed"), L("aceite", 5, "fat")], min: 25 },
  ],
  shrimp: [
    { id: "ajo", title: (n) => `${n} salteados al ajo con limón`, steps: () => ["Sazona los camarones limpios con sal y limón.", "Saltea ajo picado en 1 cucharadita de aceite 30 segundos; añade los camarones y cocina 3–4 minutos hasta que estén bien rosados y firmes."], extra: [L("aceite", 5, "fat"), L("limon", 10, "fixed")], min: 12 },
    { id: "coco", title: (n) => `${n} en salsa de coco`, steps: () => ["Sofríe cebolla y ajo con 1 cucharadita de aceite 3 minutos.", "Agrega leche de coco light y sal; cuando hierva, añade los camarones y cocina 5 minutos hasta que estén completamente cocidos."], extra: [L("coco", 25, "fat"), L("cebolla", 30, "veg")], min: 15 },
    { id: "pimenton", title: (n) => `${n} salteados con pimentón y cebolla`, steps: () => ["Saltea cebolla y pimentón en tiras con 1 cucharadita de aceite 4 minutos.", "Agrega los camarones sazonados con comino y sal; cocina 4 minutos más hasta que estén firmes y rosados."], extra: [L("pimenton", 50, "veg"), L("cebolla", 30, "veg"), L("aceite", 5, "fat")], min: 15 },
  ],
};

/* ═════════════════════ Constructores ═════════════════════ */

function make(def: Omit<RecipeDef, "slug"> & { slug?: string }): RecipeDef {
  return { ...def, slug: def.slug ?? slugify(`${def.kind}-${def.name}`) };
}

/* ───────── Almuerzos ───────── */

function buildLunches(): RecipeDef[] {
  const out: RecipeDef[] = [];
  let i = 0;
  for (const p of PROTEINS) {
    for (const st of STYLES[p.kind]) {
      const carb = CARBS[(i * 3 + 1) % CARBS.length];
      const veg = VEGS[(i * 5 + 2) % VEGS.length];
      i++;
      const name = `${st.title(p.name)} con ${carb.name} y ${veg.name}`;
      out.push(
        make({
          name,
          kind: "lunch",
          family: p.family,
          art: p.art,
          lines: [L(p.food, p.gLunch, "protein", "cocida"), ...st.extra, L(carb.food, carb.g, "carb"), ...veg.lines],
          timeMin: st.min + Math.max(carb.min, veg.min) - 5,
          steps: [...st.steps(p.name, p.food), carb.step, veg.step, "Arma el plato: la proteína ocupa un cuarto, el carbohidrato otro cuarto y la mitad del plato son verduras. Mide las porciones con la balanza o con las medidas caseras indicadas."],
          tags: ["almuerzo", p.family, "colombiana"],
        }),
      );
    }
  }
  return out;
}

const sig = (
  name: string,
  kind: RecipeKind,
  family: string,
  art: string,
  lines: RecipeLine[],
  timeMin: number,
  steps: string[],
  tags: string[] = [],
  extra: Partial<RecipeDef> = {},
): RecipeDef => make({ name, kind, family, art, lines, timeMin, steps, tags: [kind === "lunch" ? "almuerzo" : "cena", family, "plato de la casa", ...tags], ...extra });

const SIGNATURE_LUNCHES: RecipeDef[] = [
  sig("Sancocho ligero de pollo", "lunch", "pollo", "sopa", [L("pechuga", 130, "protein", "en presa"), L("yuca", 90, "carb"), L("name", 70, "carb"), L("platano_verde", 40, "carb"), L("ahuyama", 100, "veg"), L("zanahoria", 40, "veg"), L("cebolla", 30, "veg"), L("especias", 5, "fixed", "cilantro")], 50, ["Pon a hervir 1 litro de agua con cebolla, ajo y sal. Añade la pechuga y cocina 15 minutos.", "Agrega yuca, ñame, plátano verde y zanahoria en trozos; cocina 20 minutos.", "Suma la ahuyama y cocina 10 minutos más hasta que todo esté tierno y el pollo bien cocido.", "Termina con cilantro picado. Sirve en plato hondo, retirando el exceso de grasa del caldo."], ["sopa", "caribeña"]),
  sig("Lentejas con pollo desmechado y arroz", "lunch", "legumbre", "legumbre", [L("lentejas", 160, "fixed"), L("pechuga", 100, "protein", "desmechada"), L("arroz", 90, "carb"), L("zanahoria", 40, "veg"), L("cebolla", 40, "veg"), L("aceite", 5, "fat")], 45, ["Remoja las lentejas 30 minutos si tienes tiempo y cuécelas con zanahoria picada, cebolla, ajo y sal 25 minutos.", "Cuece la pechuga 15 minutos y desmécha.", "Mezcla el pollo con las lentejas y cocina 5 minutos.", "Sirve con el arroz blanco cocido aparte."], ["legumbres", "hierro"]),
  sig("Frijoles con carne magra y arroz", "lunch", "res", "legumbre", [L("frijoles", 150, "fixed"), L("res", 105, "protein", "en cubos"), L("arroz", 100, "carb"), L("aguacate", 40, "fat"), L("cebolla", 30, "veg")], 55, ["Cuece los frijoles (previamente remojados) con cebolla y ajo hasta que estén blandos, unos 40 minutos.", "Cocina la res magra en cubos con sal y comino 20 minutos hasta que esté tierna y sin rosado.", "Mezcla la carne con los frijoles. Sirve con arroz y aguacate en láminas."], ["legumbres", "hierro"]),
  sig("Arroz con pollo ligero", "lunch", "pollo", "arroz", [L("pechuga", 130, "protein", "en cubos"), L("arroz", 150, "carb"), L("zanahoria", 40, "veg"), L("habichuela", 40, "veg"), L("pimenton", 30, "veg"), L("cebolla", 30, "veg"), L("aceite", 5, "fat")], 40, ["Sofríe cebolla, pimentón y ajo con 1 cucharadita de aceite 3 minutos.", "Agrega el pollo en cubos y sella 4 minutos; suma zanahoria y habichuela picadas.", "Añade el arroz crudo y el doble de agua con sal y cúrcuma o comino. Tapa y cocina a fuego bajo 18–20 minutos hasta que el pollo esté bien cocido."], ["un solo pocillo"]),
  sig("Pollo sudado con ahuyama y papa criolla", "lunch", "pollo", "pollo", [L("pechuga", 130, "protein", "en presa"), L("ahuyama", 120, "veg"), L("papa_criolla", 100, "carb"), L("cebolla", 40, "veg"), L("pimenton", 40, "veg"), L("aceite", 5, "fat")], 40, ["Sofríe cebolla, pimentón y ajo con 1 cucharadita de aceite.", "Agrega la pechuga, la ahuyama en cubos y la papa criolla con medio vaso de agua y sal.", "Tapa y cocina a fuego bajo 25 minutos hasta que el pollo esté cocido y la salsa espese de forma natural con la ahuyama."], ["sudado"]),
  sig("Mojarra al horno con patacón de plátano verde", "lunch", "mojarra", "pescado", [L("mojarra", 170, "protein", "entera o filete"), L("platano_verde", 100, "carb"), L("lechuga", 50, "veg"), L("zanahoria", 40, "veg"), L("limon", 15, "fixed"), L("aceite", 5, "fat")], 45, ["Haz cortes superficiales a la mojarra, sazónala con sal, ajo y limón y hornéala a 200 °C por 25 minutos.", "Corta el plátano verde en rodajas gruesas, hornea 10 minutos, aplástalas y hornea 8 minutos más hasta que estén doradas.", "Sirve con ensalada de lechuga y zanahoria rallada."], ["caribeña", "omega 3"]),
  sig("Bocachico asado con yuca y ensalada de repollo", "lunch", "bocachico", "pescado", [L("bocachico", 175, "protein", "asado"), L("yuca", 120, "carb"), L("repollo", 80, "veg"), L("zanahoria", 30, "veg"), L("limon", 15, "fixed")], 45, ["Sazona el bocachico con sal, ajo y limón y ásalo a la parrilla o al horno 20 minutos, hasta que la carne se separe de la espina y quede opaca.", "Hierve la yuca con sal 20–25 minutos.", "Mezcla repollo y zanahoria ralladas con limón y sal. Sirve todo junto."], ["caribeña", "barranquilla", "omega 3"]),
  sig("Arroz de camarón con coco", "lunch", "camaron", "arroz", [L("camaron", 160, "protein", "bien cocidos"), L("arroz", 140, "carb"), L("coco", 25, "fat"), L("pimenton", 40, "veg"), L("cebolla", 30, "veg"), L("aceite", 3, "fat")], 35, ["Sofríe cebolla, pimentón y ajo con el aceite 3 minutos.", "Agrega el arroz crudo, la leche de coco light y agua (el doble del arroz) con sal; cocina tapado 15 minutos.", "Incorpora los camarones y cocina 5 minutos más hasta que estén bien rosados y firmes."], ["caribeña", "yodo"]),
  sig("Ceviche de camarón hervido con mango y tostones al horno", "lunch", "camaron", "camaron", [L("camaron", 165, "protein", "hervidos 3–4 min"), L("mango", 60, "fixed"), L("cebolla", 30, "veg"), L("limon", 30, "fixed"), L("aguacate", 40, "fat"), L("platano_verde", 70, "carb")], 30, ["Hierve los camarones 3–4 minutos hasta que estén rosados y firmes; enfría y cocínalos completamente (nunca los uses crudos).", "Mezcla con cebolla morada en plumas, mango en cubos, jugo de limón, cilantro y sal; reposa 10 minutos.", "Hornea rodajas de plátano verde aplastadas 15 minutos para los tostones. Sirve con aguacate."], ["caribeña", "frío"]),
  sig("Pescado en salsa de coco con arroz y habichuela", "lunch", "mojarra", "pescado", [L("mojarra", 170, "protein"), L("coco", 30, "fat"), L("arroz", 140, "carb"), L("habichuela", 80, "veg"), L("cebolla", 30, "veg")], 35, ["Sofríe la cebolla con ajo, agrega la leche de coco light y sal; al hervir, añade la mojarra en trozos y cocina 10 minutos.", "Cuece el arroz y saltea la habichuela 5 minutos. Sirve el pescado con su salsa."], ["caribeña"]),
  sig("Carne desmechada con arroz y plátano maduro", "lunch", "res", "res", [L("res", 135, "protein", "desmechada"), L("cebolla", 50, "veg"), L("pimenton", 40, "veg"), L("arroz", 120, "carb"), L("platano_maduro", 80, "carb"), L("aceite", 5, "fat")], 60, ["Hierve la res magra en agua con cebolla y ajo 40 minutos hasta que esté muy blanda; desmecha.", "Sofríe cebolla y pimentón en tiras, agrega la carne, comino, sal y un chorrito del caldo; cocina 8 minutos.", "Hornea el plátano maduro en tajadas 15 minutos. Sirve con el arroz."], ["colombiana"]),
  sig("Bistec de res con cebolla, ñame y ensalada", "lunch", "res", "res", [L("res", 140, "protein", "en bistec"), L("cebolla", 60, "veg"), L("name", 120, "carb"), L("lechuga", 50, "veg"), L("zanahoria", 30, "veg"), L("aceite", 5, "fat")], 35, ["Sazona el bistec con sal, ajo y comino; séllalo en sartén caliente 3–4 minutos por lado.", "En la misma sartén cocina la cebolla en aros 5 minutos.", "Hierve el ñame 20 minutos. Sirve con ensalada de lechuga y zanahoria."], ["colombiana"]),
  sig("Cerdo a la plancha con puré de ahuyama y habichuela", "lunch", "cerdo", "cerdo", [L("cerdo", 145, "protein", "a la plancha"), L("ahuyama", 150, "veg"), L("habichuela", 80, "veg"), L("papa_criolla", 70, "carb"), L("aceite", 5, "fat")], 30, ["Sazona el lomo con sal, ajo y orégano y cocínalo a la plancha 6 minutos por lado hasta que esté bien cocido.", "Haz el puré con ahuyama cocida y papa criolla. Saltea la habichuela 5 minutos y sirve."], ["colombiana"]),
  sig("Albóndigas de res magra con arroz integral y ensalada", "lunch", "res", "res", [L("molida", 150, "protein", "en albóndigas"), L("clara", 33, "protein"), L("arroz_int", 130, "carb"), L("lechuga", 50, "veg"), L("zanahoria", 40, "veg"), L("cebolla", 30, "veg")], 40, ["Mezcla la carne con cebolla rallada, clara, sal y comino; forma albóndigas.", "Hornea 20 minutos a 200 °C, hasta que no queden rosadas por dentro.", "Sirve con arroz integral y ensalada de lechuga con zanahoria."], ["meal prep"]),
  sig("Garbanzos guisados con pollo y espinaca", "lunch", "legumbre", "legumbre", [L("garbanzo", 140, "fixed"), L("pechuga", 100, "protein"), L("espinaca", 80, "veg"), L("cebolla", 40, "veg"), L("arroz", 80, "carb"), L("aceite", 5, "fat")], 35, ["Sofríe cebolla y ajo; agrega el pollo en cubos y sella 4 minutos.", "Suma garbanzos cocidos, comino, sal y medio vaso de agua; cocina 10 minutos.", "Incorpora la espinaca 2 minutos antes de apagar. Sirve con el arroz."], ["hierro", "folato"]),
  sig("Salmón al horno con quinua y habichuelas", "lunch", "salmon", "pescado", [L("salmon", 170, "protein", "bien cocido"), L("quinua", 130, "carb"), L("habichuela", 100, "veg"), L("limon", 15, "fixed"), L("aceite", 3, "fat")], 30, ["Sazona el salmón con sal, ajo y limón y hornéalo a 200 °C por 15–18 minutos, hasta que esté bien cocido por dentro.", "Cuece la quinua 15 minutos y saltea las habichuelas 5 minutos. Sirve."], ["omega 3"]),
  sig("Pavo salteado con quinua y verduras", "lunch", "pavo", "pollo", [L("pavo", 130, "protein", "en tiras"), L("quinua", 130, "carb"), L("calabacin", 100, "veg"), L("pimenton", 50, "veg"), L("zanahoria", 40, "veg"), L("aceite", 5, "fat")], 30, ["Saltea el pavo en tiras con sal y comino 6 minutos hasta que esté bien cocido.", "Agrega calabacín, pimentón y zanahoria y cocina 5 minutos. Mezcla con la quinua cocida."], ["rápido"]),
  sig("Tortitas de pollo y ahuyama con ensalada de repollo", "lunch", "pollo", "pollo", [L("pechuga", 125, "protein", "molida cocida"), L("clara", 66, "protein"), L("ahuyama", 100, "carb"), L("avena", 20, "carb"), L("repollo", 80, "veg"), L("zanahoria", 30, "veg"), L("aceite", 4, "fat")], 35, ["Procesa la pechuga cocida con la ahuyama cocida, las claras, la avena, sal y comino.", "Forma tortitas y dóralas en sartén antiadherente 4 minutos por lado.", "Acompaña con ensalada de repollo y zanahoria con limón."], ["meal prep"]),
];

/* ───────── Cenas (carbohidrato bajo, proteína alta) ───────── */

function buildDinners(): RecipeDef[] {
  const out: RecipeDef[] = [];
  let i = 0;
  const dinnerFat = (k: number): RecipeLine => (k % 2 === 0 ? L("aguacate", 50, "fat") : L("aceite", 5, "fat"));
  for (const p of PROTEINS) {
    // 3 estilos por proteína (rotados)
    const styles = STYLES[p.kind];
    for (let s = 0; s < 3; s++) {
      const st = styles[(s + i) % styles.length];
      const veg = VEGS[(i * 3 + s + 1) % VEGS.length];
      const veg2 = VEGS[(i * 3 + s + 4) % VEGS.length];
      const withCarb = (i + s) % 3 === 0;
      const name = `${st.title(p.name)} con ${veg.name}${veg2 !== veg ? ` y ${veg2.name}` : ""}`;
      const extras = st.extra.filter((l) => l.role !== "fat");
      const lines = [L(p.food, Math.round(p.gLunch * 0.75), "protein", "cocida"), ...extras, ...veg.lines.filter((l) => l.role !== "fat"), ...veg2.lines.filter((l) => l.role !== "fat"), dinnerFat(i + s)];
      if (withCarb) lines.push(L("arroz_int", 60, "carb"));
      out.push(
        make({
          name,
          slug: slugify(`dinner-${name}`),
          kind: "dinner",
          family: p.family,
          art: p.art,
          lines,
          timeMin: st.min + 8,
          steps: [...st.steps(p.name, p.food), veg.step, veg2 !== veg ? veg2.step : "Acompaña con una porción extra de verduras crudas lavadas muy bien.", withCarb ? "Sirve con una porción pequeña de arroz integral cocido (cena baja en carbohidrato)." : "Cena baja en carbohidrato: no agregues arroz ni papa; prioriza la proteína y las verduras."],
          tags: ["cena", p.family, "baja en carbohidrato"],
        }),
      );
    }
    i++;
  }
  return out;
}

const SIGNATURE_DINNERS: RecipeDef[] = [
  sig("Omelette de claras con espinaca y champiñones", "dinner", "huevo", "huevo", [L("huevo", 50, "protein"), L("clara", 132, "protein"), L("espinaca", 80, "veg"), L("champi", 60, "veg"), L("campesino", 20, "protein"), L("aceite", 4, "fat")], 15, ["Saltea champiñones y espinaca con ajo 4 minutos y reserva.", "Bate el huevo con las claras y sal; cuaja en sartén antiadherente con el aceite a fuego medio-bajo.", "Rellena con las verduras y el queso campesino pasteurizado, dobla y cocina hasta que el huevo esté completamente firme."], ["rápido"]),
  sig("Tortilla de huevo con ahuyama y cebolla", "dinner", "huevo", "huevo", [L("huevo", 100, "protein"), L("clara", 66, "protein"), L("ahuyama", 100, "veg"), L("cebolla", 30, "veg"), L("aceite", 4, "fat"), L("lechuga", 50, "veg")], 20, ["Cuece la ahuyama en cubos pequeños 8 minutos.", "Sofríe la cebolla, añade la ahuyama y vierte los huevos batidos con sal.", "Tapa a fuego bajo 6–8 minutos y voltea para que quede firme por ambos lados. Sirve con lechuga."], ["vegetariana"]),
  sig("Crema de ahuyama con pollo desmechado", "dinner", "pollo", "sopa", [L("ahuyama", 200, "veg"), L("pechuga", 105, "protein", "desmechada"), L("cebolla", 30, "veg"), L("leche", 100, "fixed"), L("aceite", 5, "fat")], 30, ["Cuece la ahuyama con cebolla y ajo 15 minutos y licúa con la leche y sal hasta obtener una crema.", "Cuece y desmecha la pechuga.", "Sirve la crema caliente con el pollo encima."], ["sopa"]),
  sig("Sopa de pollo con verduras", "dinner", "pollo", "sopa", [L("pechuga", 105, "protein"), L("zanahoria", 60, "veg"), L("habichuela", 60, "veg"), L("papa_criolla", 60, "carb"), L("cebolla", 30, "veg")], 35, ["Hierve la pechuga 15 minutos con cebolla, ajo y sal; retira y desmecha.", "Cuece zanahoria, habichuela y papa criolla en el caldo 12 minutos.", "Devuelve el pollo y sirve caliente."], ["sopa"]),
  sig("Ensalada de atún con aguacate y lechuga", "dinner", "atun", "atun", [L("atun", 115, "protein"), L("aguacate", 60, "fat"), L("lechuga", 100, "veg"), L("zanahoria", 40, "veg"), L("limon", 15, "fixed"), L("huevo", 50, "protein", "duro")], 15, ["Cuece el huevo 10 minutos hasta que la yema esté firme; pela y pica.", "Escurre el atún y mezcla con lechuga, zanahoria rallada y aguacate.", "Aliña con limón, sal y una pizca de orégano."], ["rápido", "frío"], { pregNote: "El atún en lata va limitado a 1–2 porciones por semana en el embarazo." }),
  sig("Ensalada de pollo con mango y aguacate", "dinner", "pollo", "ensalada", [L("pechuga", 105, "protein", "cocida y desmechada"), L("mango", 60, "fixed"), L("lechuga", 80, "veg"), L("aguacate", 40, "fat"), L("limon", 15, "fixed")], 20, ["Cuece la pechuga y desmécha.", "Lava muy bien la lechuga; mezcla con mango y aguacate en cubos.", "Agrega el pollo y aliña con limón, sal y pimienta."], ["frío"]),
  sig("Berenjena rellena de carne y queso campesino", "dinner", "res", "res", [L("berenjena", 200, "veg"), L("molida", 105, "protein"), L("campesino", 30, "protein"), L("cebolla", 30, "veg"), L("aceite", 4, "fat")], 40, ["Parte la berenjena por la mitad, vacía un poco el centro y hornéala 15 minutos a 200 °C.", "Sofríe cebolla y la carne molida con sal y comino 8 minutos hasta que esté bien cocida; mezcla con la pulpa picada.", "Rellena, cubre con queso campesino pasteurizado y gratina 8 minutos."], ["horno"]),
  sig("Tortitas de atún y huevo con ensalada de repollo", "dinner", "atun", "atun", [L("atun", 100, "protein"), L("huevo", 50, "protein"), L("clara", 33, "protein"), L("repollo", 90, "veg"), L("zanahoria", 40, "veg"), L("aceite", 4, "fat")], 25, ["Mezcla el atún escurrido con el huevo, la clara, cebolla picada y pimienta.", "Dora en sartén antiadherente 3 minutos por lado hasta que el huevo esté firme.", "Sirve con ensalada de repollo y zanahoria con limón."], ["rápido"], { pregNote: "El atún en lata va limitado a 1–2 porciones por semana en el embarazo." }),
  sig("Pechuga rellena de espinaca y queso campesino", "dinner", "pollo", "pollo", [L("pechuga", 105, "protein"), L("espinaca", 60, "veg"), L("campesino", 25, "protein"), L("lechuga", 60, "veg"), L("aceite", 4, "fat")], 35, ["Abre la pechuga en libro y sazona con sal y ajo.", "Rellena con espinaca salteada y queso campesino pasteurizado; ciérrala con palillos.", "Hornea a 200 °C por 25 minutos hasta que esté completamente cocida. Sirve con lechuga."], ["horno"]),
  sig("Sopa de lentejas con espinaca y huevo duro", "dinner", "legumbre", "legumbre", [L("lentejas", 100, "fixed"), L("huevo", 100, "protein", "duro"), L("clara", 66, "protein"), L("espinaca", 60, "veg"), L("cebolla", 30, "veg"), L("aceite", 4, "fat")], 35, ["Cuece las lentejas con cebolla y ajo 20 minutos.", "Agrega la espinaca los últimos 3 minutos.", "Sirve con el huevo y las claras cocidas (10 minutos) en cuartos."], ["hierro", "folato"]),
];

/* ───────── Desayunos ───────── */

const FRUITS: { food: string; g: number; name: string }[] = [
  { food: "patilla", g: 200, name: "patilla" },
  { food: "mango", g: 120, name: "mango" },
  { food: "pina", g: 150, name: "piña" },
  { food: "banano", g: 118, name: "banano" },
  { food: "guayaba", g: 120, name: "guayaba" },
  { food: "fresa", g: 150, name: "fresas" },
];

function buildBreakfasts(): RecipeDef[] {
  const out: RecipeDef[] = [];
  const b = (name: string, family: string, art: string, lines: RecipeLine[], timeMin: number, steps: string[], tags: string[] = [], extra: Partial<RecipeDef> = {}) =>
    out.push(make({ name, kind: "breakfast", family, art, lines, timeMin, steps, tags: ["desayuno", ...tags], ...extra }));
  const fr = (i: number) => FRUITS[i % FRUITS.length];
  const frLine = (f: (typeof FRUITS)[number]) => L(f.food, f.g, "fixed");

  // A. Arepa + huevos revueltos
  [0, 1, 2].forEach((k) => {
    const f = fr(k);
    b(`Arepa con huevos revueltos con cebolla y pimentón y ${f.name}`, "huevo", "arepa", [L("arepa", 90, "carb"), L("huevo", 100, "protein"), L("clara", 66, "protein"), L("cebolla", 20, "veg"), L("pimenton", 20, "veg"), L("aceite", 4, "fat"), frLine(f)], 15, ["Sofríe cebolla y pimentón picados finos con el aceite 2 minutos.", "Agrega los huevos y las claras batidos con sal; revuelve hasta que estén completamente cocidos y secos.", "Calienta la arepa en sartén o tostadora y sirve con los huevos.", `Acompaña con ${f.name} picada(s) y bien lavada(s).`], ["colombiana"]);
  });
  // B. Arepa con queso campesino
  [3, 4, 5].forEach((k) => {
    const f = fr(k);
    b(`Arepa con queso campesino, claras y ${f.name}`, "lacteo", "arepa", [L("arepa", 90, "carb"), L("campesino", 40, "protein"), L("clara", 132, "protein"), L("huevo", 50, "protein"), frLine(f)], 12, ["Cuece las claras con el huevo revueltos 3–4 minutos hasta que estén firmes.", "Abre la arepa caliente, rellena con el queso campesino pasteurizado y los huevos.", `Sirve con ${f.name}.`], ["colombiana"]);
  });
  // C. Avena con whey
  [3, 5, 1].forEach((k) => {
    const f = fr(k);
    b(`Avena cocida con whey y ${f.name}`, "whey", "avena", [L("avena", 50, "carb"), L("whey", 30, "protein"), L("leche", 200, "fixed"), L("clara", 33, "protein"), frLine(f)], 10, ["Cuece la avena con la leche descremada 5 minutos a fuego bajo, moviendo.", "Retira del fuego, deja entibiar 2 minutos y mezcla el whey para que no se formen grumos.", `Cubre con ${f.name} y sirve.`], ["rápido"]);
  });
  // D. Tortilla de claras
  [2, 4, 0].forEach((k) => {
    const f = fr(k);
    b(`Tortilla de claras con espinaca y champiñones, pan integral y ${f.name}`, "huevo", "huevo", [L("huevo", 50, "protein"), L("clara", 132, "protein"), L("espinaca", 60, "veg"), L("champi", 50, "veg"), L("pan_int", 60, "carb"), L("aceite", 4, "fat"), frLine(f)], 15, ["Saltea los champiñones y la espinaca 4 minutos.", "Vierte el huevo y las claras batidos con sal; cocina a fuego medio hasta que quede firme.", `Sirve con el pan integral tostado y ${f.name}.`], ["rápido"]);
  });
  // E. Yogur griego con avena
  [1, 5, 2, 3].forEach((k) => {
    const f = fr(k);
    b(`Bowl de yogur griego con avena y ${f.name}`, "lacteo", "yogur", [L("yogur", 250, "protein"), L("avena", 35, "carb"), L("whey", 15, "protein"), frLine(f)], 5, ["Mezcla el yogur griego con el whey hasta que quede liso.", `Agrega ${f.name} en trozos y la avena en hojuelas por encima.`, "Sirve de inmediato para que la avena quede crocante."], ["sin cocción", "rápido"], { pregNote: "Verifica que el yogur sea pasteurizado." });
  });
  // F. Pancakes
  b("Pancakes de avena y banano con whey", "whey", "avena", [L("avena", 50, "carb"), L("banano", 100, "fixed"), L("huevo", 50, "protein"), L("clara", 66, "protein"), L("whey", 25, "protein")], 15, ["Licúa la avena, el banano, el huevo, las claras y el whey hasta obtener una masa lisa.", "Cocina porciones en sartén antiadherente a fuego medio 2–3 minutos por lado, hasta que estén completamente cocidas.", "Sirve calientes."], ["dulce saludable"]);
  b("Pancakes de avena con fresas y yogur griego", "whey", "avena", [L("avena", 45, "carb"), L("huevo", 50, "protein"), L("clara", 66, "protein"), L("whey", 20, "protein"), L("yogur", 100, "protein"), L("fresa", 100, "fixed")], 18, ["Licúa la avena, el huevo, las claras y el whey.", "Cocina los pancakes 2–3 minutos por lado hasta que estén firmes por dentro.", "Sirve con el yogur griego y las fresas lavadas y en láminas."], ["dulce saludable"]);
  // G. Batidos
  b("Batido de whey con leche, banano y avena", "whey", "batido", [L("whey", 30, "protein"), L("leche", 300, "fixed"), L("banano", 118, "fixed"), L("avena", 30, "carb"), L("yogur", 100, "protein")], 5, ["Licúa todos los ingredientes con hielo 40 segundos.", "Sirve de inmediato."], ["sin cocción", "rápido"]);
  b("Batido de whey con mango, fresa y yogur griego", "whey", "batido", [L("whey", 30, "protein"), L("yogur", 150, "protein"), L("mango", 80, "fixed"), L("fresa", 80, "fixed"), L("avena", 30, "carb")], 5, ["Licúa todo con hielo y un chorrito de agua hasta que esté espeso.", "Sirve frío."], ["sin cocción", "rápido"]);
  // H. Pan con huevo y aguacate
  [0, 4].forEach((k) => {
    const f = fr(k);
    b(`Tostadas integrales con huevo duro y aguacate y ${f.name}`, "huevo", "huevo", [L("pan_int", 60, "carb"), L("huevo", 100, "protein", "duros"), L("clara", 66, "protein"), L("aguacate", 50, "fat"), frLine(f)], 14, ["Cuece los huevos 10 minutos y las claras aparte 4 minutos; enfría y pica.", "Tuesta el pan, aplasta el aguacate con sal y limón y úntalo.", "Cubre con el huevo y las claras. Acompaña con la fruta."], ["rápido"]);
  });
  // I. Arepa con pavo y queso + café
  [2, 0].forEach((k) => {
    const f = fr(k);
    b(`Arepa con pavo y queso campesino, café con leche y ${f.name}`, "pavo", "arepa", [L("arepa", 90, "carb"), L("jamon_pavo", 75, "protein"), L("campesino", 40, "protein"), L("clara", 66, "protein"), L("cafe", 200, "fixed"), frLine(f)], 10, ["Calienta bien el jamón de pavo en sartén hasta que humee (importante en el embarazo).", "Rellena la arepa caliente con el jamón, el queso campesino pasteurizado y las claras cocidas.", `Sirve con el café con leche (descafeinado en el embarazo) y ${f.name}.`], ["café"], { caffeineMg: 95, pregNote: "Embutido bien caliente; café descafeinado o contado dentro de los 200 mg de cafeína." });
  });
  // J. Huevo con yuca
  b("Huevos duros con yuca y aguacate", "huevo", "huevo", [L("huevo", 150, "protein", "duros"), L("clara", 33, "protein"), L("yuca", 100, "carb"), L("aguacate", 40, "fat"), L("mango", 80, "fixed")], 30, ["Hierve la yuca 20–25 minutos con sal.", "Cuece los huevos 10 minutos y las claras 4 minutos.", "Sirve todo con aguacate y el mango en cubos."], ["costeña"]);
  // K. Cottage
  [4, 3].forEach((k) => {
    const f = fr(k);
    b(`Pan integral con queso cottage, jamón de pavo y ${f.name}`, "lacteo", "yogur", [L("cottage", 150, "protein"), L("pan_int", 60, "carb"), L("jamon_pavo", 50, "protein"), L("clara", 33, "protein"), frLine(f)], 8, ["Tuesta el pan integral.", "Úntalo con el queso cottage y agrega el jamón de pavo bien caliente.", `Sirve con ${f.name}.`], ["rápido"], { pregNote: "Cottage solo pasteurizado; jamón de pavo bien caliente." });
  });
  // L. Arepa rellena de pollo
  b("Arepa rellena de pollo desmechado y aguacate", "pollo", "arepa", [L("arepa", 90, "carb"), L("pechuga", 100, "protein", "desmechada"), L("aguacate", 40, "fat"), L("clara", 66, "protein"), L("guayaba", 100, "fixed")], 20, ["Usa pollo cocido y desmechado (meal prep del domingo).", "Calienta el pollo con una pizca de sal y comino 2 minutos.", "Rellena la arepa caliente con el pollo, el aguacate y las claras revueltas. Sirve con guayaba."], ["meal prep", "colombiana"]);
  // M. Arepa con queso costeño (sustitución embarazo)
  b("Arepa con queso costeño y huevo", "huevo", "arepa", [L("arepa", 90, "carb"), L("costeno", 40, "protein"), L("huevo", 100, "protein"), L("clara", 66, "protein"), L("patilla", 150, "fixed")], 12, ["Cocina los huevos y las claras revueltos hasta que estén totalmente firmes.", "Calienta la arepa y rellénala con el queso costeño desmenuzado y el huevo.", "Sirve con patilla bien lavada."], ["costeña"], { pregNote: "Para el embarazo el queso costeño se cambia automáticamente por queso campesino pasteurizado." });
  // N. Avena fría
  b("Avena en frío (overnight) con yogur griego y maracuyá", "lacteo", "avena", [L("avena", 45, "carb"), L("yogur", 200, "protein"), L("whey", 20, "protein"), L("leche", 100, "fixed"), L("maracuya", 36, "fixed")], 5, ["La noche anterior mezcla la avena, el yogur, el whey y la leche en un frasco.", "Refrigera mínimo 6 horas.", "Por la mañana agrega la pulpa de maracuyá y sirve frío."], ["meal prep", "sin cocción"]);
  // O. Quinua con leche
  b("Quinua con leche, banano y clara de huevo", "huevo", "avena", [L("quinua", 120, "carb"), L("leche", 200, "fixed"), L("clara", 99, "protein"), L("whey", 20, "protein"), L("banano", 80, "fixed")], 20, ["Calienta la quinua cocida con la leche 5 minutos.", "Agrega las claras en hilo moviendo hasta que estén cocidas; retira, entibia y mezcla el whey.", "Cubre con banano en rodajas."], ["alternativo"]);
  return out;
}

/* ───────── Medias meriendas: solo proteína ───────── */

interface SnackSpec {
  name: string;
  family: string;
  lines: RecipeLine[];
  steps: string[];
  time?: number;
  pregNote?: string;
}

function buildSnacks(): RecipeDef[] {
  const specs: SnackSpec[] = [];
  const s = (family: string, lines: RecipeLine[], steps: string[], time = 5, pregNote?: string) => specs.push({ name: "", family, lines, steps, time, pregNote });
  const P = (food: string, g: number, label?: string) => L(food, g, "protein", label);

  // Carnes frías / cocidas
  for (const g of [100, 120]) s("pollo", [P("pechuga", g, "cocida")], ["Usa pechuga cocida del meal prep.", "Córtala en cubos, sazona con sal y limón y come fría o tibia."], 3);
  for (const g of [100, 125]) s("pavo", [P("pavo", g, "cocida")], ["Cuece la pechuga de pavo con sal y laurel; córtala en láminas.", "Come fría o recalentada."], 3);
  s("res", [P("res", 100, "magra cocida")], ["Corta en láminas delgadas la res magra cocida del meal prep.", "Aliña con limón y sal."], 3);
  s("cerdo", [P("cerdo", 110, "magro cocido")], ["Corta el lomo cocido en tiras.", "Sirve con limón y sal."], 3);
  s("camaron", [P("camaron", 130, "hervidos")], ["Hierve los camarones 3–4 minutos hasta que estén rosados y firmes.", "Enfría y aliña con limón y sal."], 8);
  // Atún y sardinas
  for (const g of [100, 125]) s("atun", [P("atun", g)], ["Escurre muy bien el atún.", "Mezcla con limón, pimienta y cilantro."], 3, "Atún en lata: máximo 1–2 porciones por semana en el embarazo.");
  s("sardina", [P("sardina", 90)], ["Escurre las sardinas y aliña con limón y pimienta."], 2);
  // Huevo y claras
  for (const n of [3, 4]) s("huevo", [P("huevo", n * 50, "duros")], ["Cuece los huevos 10 minutos (yema firme).", "Enfría, pela y sazona con sal y pimienta."], 12);
  for (const n of [6, 8]) s("huevo", [P("clara", n * 33, "cocidas")], ["Cuece las claras en sartén antiadherente como una tortilla o hervidas.", "Sazona con sal, pimienta y limón."], 8);
  s("huevo", [P("huevo", 100, "duros"), P("clara", 99, "cocidas")], ["Cuece 2 huevos y 3 claras (10 minutos).", "Pica y sazona."], 12);
  // Lácteos
  for (const g of [200, 250]) s("lacteo", [P("yogur", g)], ["Sirve el yogur griego natural sin azúcar bien frío.", "Opcional: canela en polvo."], 2, "Verifica que sea pasteurizado.");
  for (const g of [200, 250]) s("lacteo", [P("cottage", g)], ["Sirve el queso cottage con pimienta negra y una pizca de sal."], 2, "Solo pasteurizado.");
  s("lacteo", [P("campesino", 60), P("clara", 132, "cocidas")], ["Cuece 4 claras en sartén antiadherente.", "Sírvelas con el queso campesino pasteurizado en cubos."], 8);
  s("lacteo", [P("yogur", 200), P("clara", 99, "cocidas")], ["Cuece las 3 claras 3 minutos en sartén antiadherente.", "Sírvelas junto al yogur griego."], 6, "Yogur pasteurizado.");
  s("lacteo", [P("cottage", 150), P("clara", 66, "cocidas")], ["Cuece las claras y mézclalas con el queso cottage."], 6, "Cottage pasteurizado.");
  s("lacteo", [P("yogur", 150), P("cottage", 100)], ["Mezcla el yogur griego con el queso cottage hasta que quede cremoso.", "Agrega canela."], 3, "Lácteos pasteurizados.");
  // Whey / caseína
  s("whey", [P("whey", 30)], ["Mezcla 1 scoop de whey con 250 ml de agua fría en shaker."], 2);
  s("whey", [P("whey", 45)], ["Mezcla 1,5 scoop de whey con 300 ml de agua fría en shaker."], 2);
  s("whey", [P("whey", 30), P("leche", 250)], ["Licúa o agita el scoop de whey con la leche descremada fría."], 2);
  s("whey", [P("whey", 30), P("yogur", 100)], ["Mezcla el whey con el yogur griego hasta que quede un pudín cremoso."], 3);
  s("whey", [P("whey", 20), P("clara", 99, "cocidas")], ["Cuece 3 claras en sartén antiadherente.", "Bebe el whey con agua junto a las claras."], 8);
  s("whey", [P("caseina", 33)], ["Mezcla la caseína con agua hasta lograr una textura de pudín."], 3);
  // Combinaciones con carnes
  s("pollo", [P("pechuga", 90, "cocida"), P("clara", 66, "cocidas")], ["Desmecha la pechuga cocida.", "Mézclala con las claras revueltas y sazona."], 8);
  s("pavo", [P("pavo", 60, "cocida"), P("campesino", 30)], ["Corta el pavo cocido y el queso campesino pasteurizado en cubos."], 3);
  s("atun", [P("atun", 80), P("huevo", 50, "duro")], ["Mezcla el atún escurrido con el huevo duro picado."], 12, "Atún en lata: máximo 1–2 porciones por semana en el embarazo.");
  s("pollo", [P("pechuga", 80, "cocida"), P("yogur", 100)], ["Mezcla la pechuga desmechada con el yogur griego, sal y limón para una crema fría."], 5, "Yogur pasteurizado.");
  s("pavo", [P("jamon_pavo", 100), P("clara", 66, "cocidas")], ["Calienta el jamón de pavo en sartén hasta que humee.", "Acompaña con las claras cocidas."], 6, "Jamón de pavo solo bien caliente.");
  s("camaron", [P("camaron", 100, "hervidos"), P("clara", 66, "cocidas")], ["Hierve los camarones hasta que estén firmes.", "Sirve con las claras cocidas."], 10);
  s("sardina", [P("sardina", 60), P("huevo", 50, "duro")], ["Escurre las sardinas y acompaña con el huevo duro."], 12);
  s("res", [P("res", 70, "magra cocida"), P("clara", 66, "cocidas")], ["Calienta la res en tiras.", "Agrega las claras revueltas."], 8);
  s("lacteo", [P("campesino", 40), P("yogur", 150)], ["Corta el queso en cubos y sírvelo con el yogur."], 3, "Lácteos pasteurizados.");
  s("lacteo", [P("cottage", 200), P("whey", 10)], ["Mezcla el cottage con el whey hasta integrar."], 3, "Cottage pasteurizado.");
  s("huevo", [P("clara", 132, "cocidas"), P("campesino", 30)], ["Cuece 4 claras en sartén antiadherente.", "Agrega el queso campesino pasteurizado hasta que se derrita."], 8);
  s("whey", [P("whey", 25), P("leche", 200), P("yogur", 50)], ["Licúa todo con hielo para un batido cremoso."], 3);
  s("pollo", [P("muslo", 110, "sin piel, cocido")], ["Cocina el muslo sin piel en agua con sal y ajo 25 minutos.", "Sirve tibio."], 25);
  s("bocachico", [P("bocachico", 120, "asado, frío")], ["Usa bocachico asado del día anterior; desmenúzalo y aliña con limón."], 3);
  s("mojarra", [P("mojarra", 120, "al horno, frío")], ["Desmenuza mojarra horneada del día anterior y aliña con limón."], 3);

  // Nombres: derivados de los ingredientes
  return specs.map((sp, i) => {
    const title = snackTitle(sp.lines);
    const base = title.split(" = ")[0];
    return make({
      name: base,
      slug: `merienda-${String(i + 1).padStart(2, "0")}-${slugify(base).slice(0, 50)}`,
      kind: "snack",
      family: sp.family,
      art: sp.family === "whey" ? "batido" : sp.family === "lacteo" ? "yogur" : sp.family === "huevo" ? "huevo" : sp.family === "atun" || sp.family === "sardina" ? "atun" : sp.family === "camaron" ? "camaron" : sp.family === "bocachico" || sp.family === "mojarra" ? "pescado" : "pollo",
      lines: sp.lines,
      timeMin: sp.time ?? 5,
      steps: sp.steps,
      tags: ["merienda", "solo proteína", sp.family],
      pregNote: sp.pregNote,
    });
  });
}

/* ───────── Post-cena (proteína de digestión lenta, 150–200 kcal) ───────── */

function buildPostDinner(): RecipeDef[] {
  const P = (food: string, g: number, label?: string) => L(food, g, "protein", label);
  const defs: [string, string, string, RecipeLine[], string[], string?][] = [
    ["Yogur griego natural con canela", "lacteo", "yogur", [P("yogur", 190)], ["Sirve el yogur bien frío y espolvorea canela."], "Yogur pasteurizado."],
    ["Queso cottage con canela y limón", "lacteo", "yogur", [P("cottage", 180)], ["Mezcla el cottage con unas gotas de limón y pimienta."], "Cottage pasteurizado."],
    ["Caseína en agua (pudín)", "whey", "batido", [P("caseina", 26)], ["Mezcla la caseína con 120 ml de agua fría hasta lograr textura de pudín."]],
    ["Caseína con leche descremada", "whey", "batido", [P("caseina", 22), P("leche", 120)], ["Mezcla la caseína con la leche descremada fría."]],
    ["Claras revueltas con pimienta", "huevo", "huevo", [P("clara", 198, "cocidas")], ["Cuece 6 claras en sartén antiadherente sin aceite, revolviendo hasta que estén firmes."]],
    ["Yogur griego y claras cocidas", "lacteo", "yogur", [P("yogur", 100), P("clara", 66, "cocidas")], ["Cuece las 2 claras.", "Sírvelas junto al yogur."], "Yogur pasteurizado."],
    ["Cottage y yogur griego", "lacteo", "yogur", [P("cottage", 100), P("yogur", 100)], ["Mezcla ambos hasta que quede cremoso."], "Lácteos pasteurizados."],
    ["Pudín de caseína con yogur", "whey", "yogur", [P("caseina", 15), P("yogur", 100)], ["Mezcla la caseína con el yogur griego hasta obtener un pudín espeso."], "Yogur pasteurizado."],
    ["Claras al horno en molde con espinaca", "huevo", "huevo", [P("clara", 165, "cocidas"), L("espinaca", 30, "veg")], ["Mezcla 5 claras con espinaca picada y sal.", "Hornea en molde de muffin 12 minutos a 190 °C hasta que estén firmes."]],
    ["Yogur griego con caseína", "lacteo", "yogur", [P("yogur", 150), P("caseina", 10)], ["Mezcla la caseína con el yogur griego frío."], "Yogur pasteurizado."],
    ["Cottage con claras", "lacteo", "yogur", [P("cottage", 100), P("clara", 99, "cocidas")], ["Cuece las claras, mézclalas con el cottage y sazona."], "Cottage pasteurizado."],
    ["Batido de caseína con leche y canela", "whey", "batido", [P("caseina", 20), P("leche", 180)], ["Agita o licúa la caseína con la leche descremada fría y canela."]],
  ];
  return defs.map(([name, family, art, lines, steps, pregNote], i) =>
    make({ name, slug: `postcena-${String(i + 1).padStart(2, "0")}-${slugify(name)}`, kind: "postdinner", family, art, lines, timeMin: 5, steps, tags: ["post-cena", "digestión lenta", family], pregNote }),
  );
}

/* ═════════════════════ Ensamble ═════════════════════ */

function dedupe(defs: RecipeDef[]): RecipeDef[] {
  const seen = new Set<string>();
  return defs.filter((d) => {
    if (seen.has(d.slug)) return false;
    seen.add(d.slug);
    return true;
  });
}

const ALL_DEFS: RecipeDef[] = dedupe([
  ...buildBreakfasts(),
  ...buildSnacks(),
  ...SIGNATURE_LUNCHES,
  ...buildLunches(),
  ...SIGNATURE_DINNERS,
  ...buildDinners(),
  ...buildPostDinner(),
]);

export const RECIPES: Recipe[] = ALL_DEFS.map(buildRecipe);
export const RECIPE_BY_SLUG: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.slug, r]));
export const recipesOfKind = (k: RecipeKind): Recipe[] => RECIPES.filter((r) => r.kind === k);

export const SNACK_LIBRARY = recipesOfKind("snack");
export { upper1 };
