import type { RecipeKind } from "../types";

export type Aisle =
  | "Carnes y aves"
  | "Pescados y mariscos"
  | "Huevos y lácteos"
  | "Frutas"
  | "Verduras"
  | "Granos y tubérculos"
  | "Despensa";

export const AISLE_ORDER: Aisle[] = [
  "Verduras",
  "Frutas",
  "Carnes y aves",
  "Pescados y mariscos",
  "Huevos y lácteos",
  "Granos y tubérculos",
  "Despensa",
];

export interface Macros {
  kcal: number;
  p: number;
  c: number;
  f: number;
  fiber: number;
}

export type PregLevel = "avoid" | "limit" | "cook";

export interface PregRule {
  level: PregLevel;
  /** Alimento de reemplazo (clave) cuando level = "avoid". */
  sub?: string;
  note: string;
  /** Tope semanal de porciones si level = "limit". */
  weeklyMax?: number;
}

export interface Food {
  key: string;
  name: string;
  per100: Macros; // por 100 g tal como se consume (cocido)
  aisle: Aisle;
  /** cocido/crudo: crudo = cocido / rawYield. */
  rawYield?: number;
  /** Medida casera de referencia. */
  measure?: { label: string; plural?: string; g: number };
  /** Unidades enteras para la lista de mercado (huevos, bananos…). */
  unit?: { singular: string; plural: string; rawG: number };
  preg?: PregRule;
  tags?: string[];
}

export type Role = "protein" | "carb" | "fat" | "veg" | "fixed";

export interface RecipeLine {
  food: string;
  g: number; // gramos tal como se consume (cocido)
  role: Role;
  label?: string; // anotación visible, p. ej. "a la plancha"
}

export interface RecipeDef {
  slug: string;
  name: string;
  kind: RecipeKind;
  lines: RecipeLine[];
  timeMin: number;
  steps: string[];
  tags: string[];
  art: string;
  /** Categoría de proteína principal para rotación y topes semanales. */
  family: string;
  /** Contenido de cafeína (mg) por porción base; 0 si no aplica. */
  caffeineMg?: number;
  pregNote?: string;
}

export interface Recipe extends RecipeDef {
  macros: Macros;
}
