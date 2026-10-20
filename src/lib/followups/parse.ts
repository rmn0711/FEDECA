/**
 * Interpreta fechas y horas escritas en español dentro de un texto libre:
 * "llamar a Elías mañana a las 3pm", "revisar pauta el jueves", "en 2 semanas",
 * "el 28/10 10:30", "pasado mañana en la tarde"… Todo en hora de Colombia (UTC-5).
 */
export type ParsedFollowup = {
  title: string;
  date: string | null; // AAAA-MM-DD
  time: string | null; // HH:MM
  matched: string[];
};

const WEEKDAYS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const NUM_WORDS: Record<string, number> = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, diez: 10, quince: 15 };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Fecha y hora actuales en Colombia. */
export function bogotaNow(now = new Date()) {
  const local = new Date(now.getTime() - 5 * 3_600_000);
  return { date: local.toISOString().slice(0, 10), hour: local.getUTCHours(), minute: local.getUTCMinutes(), weekday: local.getUTCDay() };
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseFollowup(input: string, now = new Date()): ParsedFollowup {
  const today = bogotaNow(now);
  let text = ` ${input.trim()} `;
  const f = () => fold(text);
  const matched: string[] = [];
  let date: string | null = null;
  let time: string | null = null;

  // Quita del texto la expresión reconocida (con su preposición) y la guarda.
  function take(re: RegExp): RegExpExecArray | null {
    const m = re.exec(f());
    if (!m) return null;
    matched.push(text.slice(m.index, m.index + m[0].length).trim());
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
    return m;
  }

  let m: RegExpExecArray | null;
  // ── Hora ──
  if ((m = take(/\s(?:a\s+las?\s+|a\s+la\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?|am|pm)(?=\s|[.,;]|$)/))) {
    let h = Number(m[1]) % 12;
    if (/p/.test(m[3])) h += 12;
    time = `${pad(h)}:${m[2] ?? "00"}`;
  } else if ((m = take(/\s(?:a\s+las?\s+)?(\d{1,2}):(\d{2})(?=\s|[.,;]|$)/))) {
    time = `${pad(Number(m[1]))}:${m[2]}`;
  } else if ((m = take(/\sa\s+las?\s+(\d{1,2})(?=\s|[.,;]|$)/))) {
    let h = Number(m[1]);
    if (h >= 1 && h <= 6) h += 12; // "a las 3" en horario laboral = 3 p. m.
    time = `${pad(h)}:00`;
  } else if (take(/\s(?:al\s+)?mediodia(?=\s|[.,;]|$)/)) time = "12:00";
  else if (take(/\s(?:en\s+|por\s+)?la\s+manana(?=\s|[.,;]|$)/)) time = "09:00";
  else if (take(/\s(?:en\s+|por\s+)?la\s+tarde(?=\s|[.,;]|$)/)) time = "15:00";
  else if (take(/\s(?:en\s+|por\s+)?la\s+noche(?=\s|[.,;]|$)/)) time = "19:00";

  // ── Fecha ──
  if (take(/\s(?:para\s+)?pasado\s+manana(?=\s|[.,;]|$)/)) date = addDays(today.date, 2);
  else if (take(/\s(?:para\s+)?manana(?=\s|[.,;]|$)/)) date = addDays(today.date, 1);
  else if (take(/\s(?:para\s+)?hoy(?=\s|[.,;]|$)/)) date = today.date;
  else if ((m = take(/\sen\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|diez|quince)\s+(dias?|semanas?|mes(?:es)?|horas?)(?=\s|[.,;]|$)/))) {
    const n = Number(m[1]) || NUM_WORDS[m[1]] || 1;
    const unit = m[2];
    if (unit.startsWith("hora")) {
      const target = new Date(now.getTime() + n * 3_600_000);
      const b = bogotaNow(target);
      date = b.date;
      time = `${pad(b.hour)}:${pad(b.minute)}`;
    } else if (unit.startsWith("semana")) date = addDays(today.date, n * 7);
    else if (unit.startsWith("mes")) {
      const d = new Date(`${today.date}T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + n);
      date = d.toISOString().slice(0, 10);
    } else date = addDays(today.date, n);
  } else if (take(/\s(?:la\s+)?(?:proxima|otra)\s+semana(?=\s|[.,;]|$)/) || take(/\s(?:la\s+)?semana\s+que\s+viene(?=\s|[.,;]|$)/)) {
    date = addDays(today.date, ((8 - today.weekday) % 7) || 7); // próximo lunes
  } else if ((m = take(/\s(?:el\s+|este\s+|para\s+el\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\s+que\s+viene|\s+proximo)?(?=\s|[.,;]|$)/))) {
    let diff = (WEEKDAYS[m[1]] - today.weekday + 7) % 7;
    if (diff === 0) diff = 7;
    date = addDays(today.date, diff);
  } else if ((m = take(/\s(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?(?=\s|[.,;]|$)/))) {
    const y = m[3] ? Number(m[3]) : Number(today.date.slice(0, 4));
    let iso = `${y}-${pad(MONTHS[m[2]])}-${pad(Number(m[1]))}`;
    if (!m[3] && iso < today.date) iso = `${y + 1}${iso.slice(4)}`;
    date = iso;
  } else if ((m = take(/\s(?:el\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s|[.,;]|$)/))) {
    const yRaw = m[3] ? Number(m[3]) : Number(today.date.slice(0, 4));
    const y = yRaw < 100 ? 2000 + yRaw : yRaw;
    let iso = `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
    if (!m[3] && iso < today.date) iso = `${y + 1}${iso.slice(4)}`;
    date = iso;
  }

  if (time && !date) {
    // Solo hora: hoy si aún no pasa, si no mañana.
    const [h, mi] = time.split(":").map(Number);
    date = h * 60 + mi > today.hour * 60 + today.minute ? today.date : addDays(today.date, 1);
  }

  const title = text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, "")
    .trim();
  return { title: title ? title[0].toUpperCase() + title.slice(1) : input.trim(), date, time, matched };
}

/** "2026-10-23" + "15:00" (hora Colombia) → Date UTC. */
export function toRemindAt(date: string, time: string | null) {
  return new Date(`${date}T${time ?? "09:00"}:00-05:00`);
}
