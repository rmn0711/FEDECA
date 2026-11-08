// Tamaño aproximado del bebé por semana de gestación y con qué alimento se compara.
// Valores promedio de referencia (varían entre bebés). Hasta la semana 19 la talla es de coronilla a rabadilla;
// desde la 20, de cabeza a talones. Se evitan comparaciones con alimentos excluidos del menú.

export interface BabyWeek {
  week: number;
  key: string;
  /** "un frijol", "una uva"… */
  label: string;
  cm: number;
  grams: number | null;
}

export const BABY_WEEKS: BabyWeek[] = [
  { week: 4, key: "sesamo", label: "una semilla de sésamo", cm: 0.1, grams: null },
  { week: 5, key: "semilla", label: "una semilla de manzana", cm: 0.3, grams: null },
  { week: 6, key: "lenteja", label: "una lenteja", cm: 0.6, grams: null },
  { week: 7, key: "arandano", label: "un arándano", cm: 1.3, grams: 1 },
  { week: 8, key: "frijol", label: "un frijol", cm: 1.6, grams: 1 },
  { week: 9, key: "uva", label: "una uva", cm: 2.3, grams: 2 },
  { week: 10, key: "fresa", label: "una fresa", cm: 3.1, grams: 4 },
  { week: 11, key: "higo", label: "un higo", cm: 4.1, grams: 7 },
  { week: 12, key: "lima", label: "una lima", cm: 5.4, grams: 14 },
  { week: 13, key: "durazno", label: "un durazno", cm: 7.4, grams: 23 },
  { week: 14, key: "limon", label: "un limón", cm: 8.7, grams: 43 },
  { week: 15, key: "manzana", label: "una manzana", cm: 10.1, grams: 70 },
  { week: 16, key: "aguacate", label: "un aguacate", cm: 11.6, grams: 100 },
  { week: 17, key: "pera", label: "una pera", cm: 13, grams: 140 },
  { week: 18, key: "camote", label: "un camote", cm: 14.2, grams: 190 },
  { week: 19, key: "mango", label: "un mango", cm: 15.3, grams: 240 },
  { week: 20, key: "banano", label: "un banano", cm: 25.6, grams: 300 },
  { week: 21, key: "zanahoria", label: "una zanahoria grande", cm: 26.7, grams: 360 },
  { week: 22, key: "yuca", label: "una yuca pequeña", cm: 27.8, grams: 430 },
  { week: 23, key: "toronja", label: "una toronja", cm: 28.9, grams: 500 },
  { week: 24, key: "maiz", label: "una mazorca de maíz", cm: 30, grams: 600 },
  { week: 25, key: "ahuyama", label: "una ahuyama pequeña", cm: 34.6, grams: 660 },
  { week: 26, key: "lechuga", label: "una lechuga", cm: 35.6, grams: 760 },
  { week: 27, key: "repollo", label: "un repollo pequeño", cm: 36.6, grams: 875 },
  { week: 28, key: "berenjena", label: "una berenjena", cm: 37.6, grams: 1005 },
  { week: 29, key: "calabacin", label: "un calabacín grande", cm: 38.6, grams: 1150 },
  { week: 30, key: "pina", label: "una piña pequeña", cm: 39.9, grams: 1320 },
  { week: 31, key: "coco", label: "un coco", cm: 41.1, grams: 1500 },
  { week: 32, key: "name", label: "un ñame", cm: 42.4, grams: 1700 },
  { week: 33, key: "pina", label: "una piña grande", cm: 43.7, grams: 1920 },
  { week: 34, key: "melon", label: "un melón cantalupo", cm: 45, grams: 2150 },
  { week: 35, key: "ahuyama", label: "una ahuyama mediana", cm: 46.2, grams: 2380 },
  { week: 36, key: "repollo", label: "un repollo grande", cm: 47.4, grams: 2620 },
  { week: 37, key: "lechuga", label: "una lechuga romana grande", cm: 48.6, grams: 2860 },
  { week: 38, key: "sandia", label: "una sandía pequeña", cm: 49.8, grams: 3080 },
  { week: 39, key: "ahuyama", label: "una ahuyama grande", cm: 50.7, grams: 3290 },
  { week: 40, key: "sandia", label: "una sandía", cm: 51.2, grams: 3460 },
];

/** Tamaño de la semana indicada (antes de la semana 4 no hay comparación; después de la 40 se mantiene). */
export function babyForWeek(week: number): BabyWeek | null {
  if (week < 4) return null;
  let cur = BABY_WEEKS[0];
  for (const b of BABY_WEEKS) if (b.week <= week) cur = b;
  return cur;
}

export const MEASURE_NOTE = (week: number) => (week < 20 ? "de la coronilla a la rabadilla" : "de la cabeza a los talones");
