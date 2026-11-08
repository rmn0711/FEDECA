import type { Food } from "@/lib/menu/types";

// Valores aproximados por 100 g tal como se consume (cocido), según tablas USDA / TCAC (ICBF).
const m = (kcal: number, p: number, c: number, f: number, fiber = 0) => ({ kcal, p, c, f, fiber });

const LIST: Food[] = [
  // ── Carnes y aves
  { key: "pechuga", name: "pechuga de pollo", per100: m(165, 31, 0, 3.6), aisle: "Carnes y aves", rawYield: 0.75, measure: { label: "palma de la mano", plural: "palmas de la mano", g: 110 } },
  { key: "muslo", name: "muslo de pollo sin piel", per100: m(175, 26, 0, 8), aisle: "Carnes y aves", rawYield: 0.72, measure: { label: "muslo mediano", plural: "muslos medianos", g: 90 } },
  { key: "res", name: "res magra (sobrebarriga o lomo)", per100: m(190, 29, 0, 8), aisle: "Carnes y aves", rawYield: 0.7, measure: { label: "palma de la mano", plural: "palmas de la mano", g: 100 } },
  { key: "molida", name: "carne molida magra", per100: m(180, 26, 0, 8), aisle: "Carnes y aves", rawYield: 0.72, measure: { label: "puño", plural: "puños", g: 90 } },
  { key: "cerdo", name: "lomo de cerdo magro", per100: m(165, 27, 0, 6), aisle: "Carnes y aves", rawYield: 0.72, measure: { label: "palma de la mano", plural: "palmas de la mano", g: 100 } },
  { key: "pavo", name: "pechuga de pavo", per100: m(135, 30, 0, 1), aisle: "Carnes y aves", rawYield: 0.75, measure: { label: "palma de la mano", plural: "palmas de la mano", g: 100 } },
  { key: "jamon_pavo", name: "jamón de pavo", per100: m(105, 16, 2, 3), aisle: "Carnes y aves", measure: { label: "lonja", plural: "lonjas", g: 25 }, preg: { level: "cook", note: "Caliéntalo hasta que humee (embutido solo bien caliente)." } },

  // ── Pescados y mariscos
  { key: "bocachico", name: "bocachico", per100: m(140, 23, 0, 5), aisle: "Pescados y mariscos", rawYield: 0.78, measure: { label: "filete mediano", plural: "filetes medianos", g: 130 }, tags: ["omega3"] },
  { key: "mojarra", name: "mojarra", per100: m(130, 26, 0, 2.7), aisle: "Pescados y mariscos", rawYield: 0.8, measure: { label: "filete mediano", plural: "filetes medianos", g: 130 }, tags: ["omega3"] },
  { key: "robalo", name: "róbalo", per100: m(125, 23, 0, 2.5), aisle: "Pescados y mariscos", rawYield: 0.8, measure: { label: "filete mediano", plural: "filetes medianos", g: 130 }, preg: { level: "limit", weeklyMax: 1, note: "Pez grande: máximo 1 porción por semana en el embarazo. Prefiere bocachico, mojarra o salmón." } },
  { key: "salmon", name: "salmón", per100: m(206, 22, 0, 12), aisle: "Pescados y mariscos", rawYield: 0.8, measure: { label: "filete mediano", plural: "filetes medianos", g: 120 }, tags: ["omega3"], preg: { level: "cook", note: "Bien cocido (que no quede rosado ni crudo por dentro)." } },
  { key: "camaron", name: "camarón", per100: m(100, 24, 0.2, 0.3), aisle: "Pescados y mariscos", rawYield: 0.8, measure: { label: "taza", plural: "tazas", g: 145 }, tags: ["yodo"], preg: { level: "cook", note: "Siempre bien cocido, nunca en ceviche crudo ni a medio cocer." } },
  { key: "atun", name: "atún en lata en agua (escurrido)", per100: m(116, 26, 0, 1), aisle: "Despensa", measure: { label: "lata escurrida", plural: "latas escurridas", g: 120 }, preg: { level: "limit", weeklyMax: 2, note: "Atún en lata: máximo 1–2 porciones por semana por el mercurio." } },
  { key: "sardina", name: "sardinas en lata (en agua)", per100: m(190, 25, 0, 10), aisle: "Despensa", measure: { label: "lata", plural: "latas", g: 90 }, tags: ["omega3", "calcio"] },

  // ── Huevos y lácteos
  { key: "huevo", name: "huevo entero cocido", per100: m(155, 13, 1.1, 11), aisle: "Huevos y lácteos", unit: { singular: "huevo", plural: "huevos", rawG: 50 }, measure: { label: "huevo", plural: "huevos", g: 50 }, preg: { level: "cook", note: "Siempre con yema y clara firmes; nada de huevo pasado por agua ni crudo." }, tags: ["yodo"] },
  { key: "clara", name: "clara de huevo cocida", per100: m(52, 11, 0.7, 0.2), aisle: "Huevos y lácteos", unit: { singular: "clara", plural: "claras", rawG: 33 }, measure: { label: "clara", plural: "claras", g: 33 }, preg: { level: "cook", note: "Bien cocida, sin partes líquidas." } },
  { key: "yogur", name: "yogur griego natural sin azúcar", per100: m(65, 10.5, 3.6, 0.9), aisle: "Huevos y lácteos", measure: { label: "taza", plural: "tazas", g: 245 }, tags: ["calcio", "yodo"], preg: { level: "cook", note: "Verifica que diga pasteurizado." } },
  { key: "cottage", name: "queso cottage", per100: m(98, 11, 3.4, 4.3), aisle: "Huevos y lácteos", measure: { label: "taza", plural: "tazas", g: 225 }, tags: ["calcio"], preg: { level: "cook", note: "Solo pasteurizado." } },
  { key: "campesino", name: "queso campesino pasteurizado", per100: m(230, 17, 2, 17), aisle: "Huevos y lácteos", measure: { label: "lonja gruesa", plural: "lonjas gruesas", g: 30 }, tags: ["calcio"] },
  { key: "costeno", name: "queso costeño", per100: m(290, 18, 2, 23), aisle: "Huevos y lácteos", measure: { label: "lonja", plural: "lonjas", g: 30 }, preg: { level: "avoid", sub: "campesino", note: "El queso costeño artesanal suele ser sin pasteurizar: se cambia por queso campesino pasteurizado." } },
  { key: "leche", name: "leche descremada pasteurizada", per100: m(35, 3.4, 5, 0.1), aisle: "Huevos y lácteos", measure: { label: "vaso", plural: "vasos", g: 250 }, tags: ["calcio", "yodo"] },
  { key: "whey", name: "proteína whey en polvo", per100: m(400, 80, 8, 6), aisle: "Despensa", measure: { label: "scoop", plural: "scoops", g: 30 } },
  { key: "caseina", name: "caseína micelar en polvo", per100: m(380, 78, 8, 3), aisle: "Despensa", measure: { label: "scoop", plural: "scoops", g: 33 } },

  // ── Legumbres, granos y tubérculos
  { key: "lentejas", name: "lentejas", per100: m(116, 9, 20, 0.4, 7.9), aisle: "Granos y tubérculos", rawYield: 2.4, measure: { label: "taza", plural: "tazas", g: 200 }, tags: ["hierro", "folato"] },
  { key: "frijoles", name: "frijoles", per100: m(127, 8.7, 22.8, 0.5, 6.4), aisle: "Granos y tubérculos", rawYield: 2.3, measure: { label: "taza", plural: "tazas", g: 180 }, tags: ["hierro", "folato"] },
  { key: "garbanzo", name: "garbanzo", per100: m(164, 8.9, 27, 2.6, 7.6), aisle: "Granos y tubérculos", rawYield: 2.4, measure: { label: "taza", plural: "tazas", g: 165 }, tags: ["hierro", "folato"] },
  { key: "arroz", name: "arroz blanco", per100: m(130, 2.7, 28, 0.3, 0.4), aisle: "Granos y tubérculos", rawYield: 2.9, measure: { label: "taza", plural: "tazas", g: 158 } },
  { key: "arroz_int", name: "arroz integral", per100: m(123, 2.7, 25.6, 1, 1.8), aisle: "Granos y tubérculos", rawYield: 2.6, measure: { label: "taza", plural: "tazas", g: 195 } },
  { key: "quinua", name: "quinua", per100: m(120, 4.4, 21, 1.9, 2.8), aisle: "Granos y tubérculos", rawYield: 3, measure: { label: "taza", plural: "tazas", g: 185 } },
  { key: "yuca", name: "yuca", per100: m(160, 1.4, 38, 0.3, 1.8), aisle: "Granos y tubérculos", rawYield: 0.9, measure: { label: "trozo mediano", plural: "trozos medianos", g: 100 } },
  { key: "name", name: "ñame", per100: m(118, 1.5, 28, 0.2, 4), aisle: "Granos y tubérculos", rawYield: 0.9, measure: { label: "trozo mediano", plural: "trozos medianos", g: 100 } },
  { key: "papa_criolla", name: "papa criolla", per100: m(85, 2, 18, 0.1, 2), aisle: "Granos y tubérculos", rawYield: 0.95, measure: { label: "papa mediana", plural: "papas medianas", g: 45 } },
  { key: "platano_maduro", name: "plátano maduro al horno", per100: m(122, 1, 32, 0.4, 2.3), aisle: "Granos y tubérculos", rawYield: 0.85, measure: { label: "tajada", plural: "tajadas", g: 40 }, unit: { singular: "plátano maduro", plural: "plátanos maduros", rawG: 220 } },
  { key: "platano_verde", name: "plátano verde (tostón al horno)", per100: m(150, 1.2, 36, 0.8, 2.5), aisle: "Granos y tubérculos", rawYield: 0.85, measure: { label: "tostón", plural: "tostones", g: 35 }, unit: { singular: "plátano verde", plural: "plátanos verdes", rawG: 250 } },
  { key: "arepa", name: "arepa de maíz blanca", per100: m(180, 3.8, 37, 2, 2.5), aisle: "Granos y tubérculos", measure: { label: "arepa mediana", plural: "arepas medianas", g: 90 }, unit: { singular: "arepa", plural: "arepas", rawG: 90 } },
  { key: "avena", name: "avena en hojuelas (en seco)", per100: m(380, 13, 67, 7, 10), aisle: "Granos y tubérculos", measure: { label: "cucharada", plural: "cucharadas", g: 10 } },
  { key: "pan_int", name: "pan integral", per100: m(250, 10, 45, 3.5, 6), aisle: "Granos y tubérculos", measure: { label: "tajada", plural: "tajadas", g: 30 } },

  // ── Frutas
  { key: "mango", name: "mango", per100: m(60, 0.8, 15, 0.4, 1.6), aisle: "Frutas", measure: { label: "taza en trozos", plural: "tazas en trozos", g: 165 } },
  { key: "guayaba", name: "guayaba", per100: m(68, 2.6, 14, 1, 5.4), aisle: "Frutas", measure: { label: "guayaba", plural: "guayabas", g: 90 }, unit: { singular: "guayaba", plural: "guayabas", rawG: 100 } },
  { key: "pina", name: "piña", per100: m(50, 0.5, 13, 0.1, 1.4), aisle: "Frutas", measure: { label: "rodaja gruesa", plural: "rodajas gruesas", g: 80 } },
  { key: "banano", name: "banano", per100: m(89, 1.1, 23, 0.3, 2.6), aisle: "Frutas", measure: { label: "banano mediano", plural: "bananos medianos", g: 118 }, unit: { singular: "banano", plural: "bananos", rawG: 170 } },
  { key: "fresa", name: "fresas", per100: m(32, 0.7, 7.7, 0.3, 2), aisle: "Frutas", measure: { label: "taza", plural: "tazas", g: 150 } },
  { key: "patilla", name: "patilla", per100: m(30, 0.6, 7.6, 0.2, 0.4), aisle: "Frutas", measure: { label: "taza en trozos", plural: "tazas en trozos", g: 150 } },
  { key: "maracuya", name: "pulpa de maracuyá", per100: m(97, 2.2, 23, 0.7, 10), aisle: "Frutas", measure: { label: "maracuyá", plural: "maracuyás", g: 18 } },

  // ── Verduras
  { key: "ahuyama", name: "ahuyama", per100: m(40, 1, 10, 0.1, 1.5), aisle: "Verduras", rawYield: 0.95, measure: { label: "taza", plural: "tazas", g: 200 } },
  { key: "zanahoria", name: "zanahoria", per100: m(35, 0.8, 8, 0.2, 2.8), aisle: "Verduras", measure: { label: "zanahoria mediana", plural: "zanahorias medianas", g: 60 } },
  { key: "habichuela", name: "habichuela", per100: m(35, 1.9, 7.9, 0.3, 3.2), aisle: "Verduras", measure: { label: "taza", plural: "tazas", g: 125 }, tags: ["folato"] },
  { key: "espinaca", name: "espinaca", per100: m(23, 3, 3.8, 0.3, 2.4), aisle: "Verduras", rawYield: 0.9, measure: { label: "taza cocida", plural: "tazas cocidas", g: 180 }, tags: ["hierro", "folato"] },
  { key: "berenjena", name: "berenjena", per100: m(35, 0.8, 8.7, 0.2, 2.5), aisle: "Verduras", measure: { label: "taza", plural: "tazas", g: 100 } },
  { key: "pimenton", name: "pimentón", per100: m(31, 1, 6, 0.3, 2.1), aisle: "Verduras", measure: { label: "pimentón mediano", plural: "pimentones medianos", g: 120 } },
  { key: "cebolla", name: "cebolla", per100: m(40, 1.1, 9, 0.1, 1.7), aisle: "Verduras", measure: { label: "cebolla mediana", plural: "cebollas medianas", g: 110 } },
  { key: "champi", name: "champiñones", per100: m(28, 3, 4, 0.4, 1), aisle: "Verduras", measure: { label: "taza", plural: "tazas", g: 100 } },
  { key: "aguacate", name: "aguacate", per100: m(160, 2, 8.5, 14.7, 6.7), aisle: "Verduras", measure: { label: "cuarto de aguacate", plural: "cuartos de aguacate", g: 50 }, tags: ["folato"] },
  { key: "lechuga", name: "lechuga", per100: m(15, 1.4, 2.9, 0.2, 1.3), aisle: "Verduras", measure: { label: "taza", plural: "tazas", g: 50 } },
  { key: "repollo", name: "repollo", per100: m(25, 1.3, 5.8, 0.1, 2.5), aisle: "Verduras", measure: { label: "taza picado", plural: "tazas picado", g: 90 } },
  { key: "calabacin", name: "calabacín", per100: m(17, 1.2, 3.1, 0.3, 1), aisle: "Verduras", measure: { label: "calabacín mediano", plural: "calabacines medianos", g: 200 } },

  // ── Despensa
  { key: "aceite", name: "aceite de oliva", per100: m(884, 0, 0, 100), aisle: "Despensa", measure: { label: "cucharadita", plural: "cucharaditas", g: 5 } },
  { key: "coco", name: "leche de coco light", per100: m(120, 1.2, 3, 12), aisle: "Despensa", measure: { label: "cucharada", plural: "cucharadas", g: 15 } },
  { key: "mani", name: "mantequilla de maní natural", per100: m(590, 25, 20, 50, 6), aisle: "Despensa", measure: { label: "cucharada", plural: "cucharadas", g: 16 } },
  { key: "almendras", name: "almendras", per100: m(580, 21, 22, 50, 12), aisle: "Despensa", measure: { label: "puñado", plural: "puñados", g: 28 } },
  { key: "limon", name: "jugo de limón", per100: m(22, 0.4, 7, 0.2), aisle: "Despensa", measure: { label: "cucharada", plural: "cucharadas", g: 15 } },
  { key: "especias", name: "ajo, comino, cilantro y sal", per100: m(0, 0, 0, 0), aisle: "Despensa", measure: { label: "al gusto", plural: "al gusto", g: 5 } },
  { key: "cafe", name: "café con leche descremada", per100: m(20, 1.7, 2.5, 0.05), aisle: "Despensa", measure: { label: "taza", plural: "tazas", g: 240 } },
];

export const FOODS: Record<string, Food> = Object.fromEntries(LIST.map((f) => [f.key, f]));
export const FOOD_LIST = LIST;

/** Palabras prohibidas (exclusiones absolutas). Se verifican en tests sobre todo el texto de las recetas. */
export const EXCLUDED_PATTERN = /tomate|pepino|papaya|br[oó]coli|coliflor|pico de gallo|hogao|ketchup|catsup|salsa roja/i;
