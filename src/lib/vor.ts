// ============================================================
//  Ядро генератора ВОР: подбор КЕР/ТМЦ, тройная детализация
// ============================================================

export type TaKind = "Спецификация" | "КЕР" | "ТМЦ" | "Заголовок";

export const HEADER_TA_LABEL =
  "Строка-заголовок (уровень 1/2), иерархия сохранена";

export interface SpecRow {
  file: string;
  sheet: string;
  system: string;
  floor: string;
  name: string;
  article: string;
  vendor: string;
  unit: string;
  qty: number | null;
  mass: string;
  note: string;
  line: string; // «Строка» — ключ трассировки
}

export interface KerRow {
  id: number;
  name: string;
  unit: string;
  l2: string;
  l3: string;
  fer: string;
}

export interface TmcRow {
  id: number;
  name: string;
  unit: string;
}

export interface VorRow {
  npp: string; // «001» (текст, ведущие нули сохранены)
  system: string;
  line: string;
  floor: string;
  name: string;
  unit: string;
  qty: number | null;
  kerId: number | null;
  tmcId: number | null;
  rashod: number | null;
  ta: TaKind;
  taFull: string;
}

export interface NotFoundRow {
  system: string;
  line: string;
  name: string;
  qty: number | null;
  what: "Код КЕР" | "Код ТМЦ";
  reason: string;
}

export interface VorStats {
  specTotal: number; // позиций с объёмом
  headerCount: number; // строк-заголовков
  skippedEmpty: number;
  vorTotal: number;
  kerFound: number;
  tmcFound: number;
  notFoundRows: number; // позиций, где КЕР или ТМЦ не подобран
  fasonCount: number; // фасонные изделия — учтены в расценке
  taCounts: Record<TaKind, number>;
  kerCodeFreq: Array<{ code: number; count: number }>;
  tmcExact: number;
  tmcGroup: number;
  tmcAnalog: number;
}

export interface VorResult {
  rows: VorRow[];
  notFound: NotFoundRow[];
  stats: VorStats;
  warnings: string[];
  kerBaseTotal: number;
  kerBaseFiltered: number;
  l2: string;
  l3: string;
  generatedAt: Date;
}

// ---------- нормализация ----------

export function normKey(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[\s\u00a0_\-.]/g, "");
}

export function parseQty(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\u00a0/g, "").replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function toInt(v: unknown): number | null {
  const n = parseQty(v);
  return n === null ? null : Math.round(n);
}

export function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// ---------- чтение кадров в типизированные строки ----------

type Frame = Record<string, unknown>[];

function colMap(row: Record<string, unknown>): Map<string, string> {
  const m = new Map<string, string>();
  for (const k of Object.keys(row)) m.set(normKey(k), k);
  return m;
}

export function frameToSpec(rows: Frame): { data: SpecRow[]; missing: string[] } {
  if (!rows.length) return { data: [], missing: ["(файл пуст)"] };
  const m = colMap(rows[0]);
  const need: Array<[string, string]> = [
    ["система", "Система"],
    ["наименование", "Наименование"],
    ["колво", "Кол-во"],
    ["строка", "Строка"],
    ["еи", "ЕИ"],
    ["этаж", "Этаж"],
  ];
  const missing = need.filter(([k]) => !m.has(k)).map(([, label]) => label);
  const data: SpecRow[] = rows.map((r) => {
    const g = (k: string) => (m.has(k) ? r[m.get(k)!] : "");
    return {
      file: s(g("файл")),
      sheet: s(g("лист")),
      system: s(g("система")),
      floor: s(g("этаж")),
      name: s(g("наименование")),
      article: s(g("артикул")),
      vendor: s(g("производитель")),
      unit: s(g("еи")),
      qty: parseQty(g("колво")),
      mass: s(g("масса")),
      note: s(g("примечания")),
      line: s(g("строка")),
    };
  });
  return { data, missing };
}

export function frameToKer(rows: Frame): { data: KerRow[]; missing: string[] } {
  if (!rows.length) return { data: [], missing: ["(файл пуст)"] };
  const m = colMap(rows[0]);
  const need: Array<[string, string]> = [
    ["идкер", "ИД_КЕР"],
    ["наименованиекер", "Наименование_КЕР"],
    ["едизмкер", "ЕдИзм КЕР"],
  ];
  const missing = need.filter(([k]) => !m.has(k)).map(([, label]) => label);
  const data: KerRow[] = [];
  for (const r of rows) {
    const g = (k: string) => (m.has(k) ? r[m.get(k)!] : "");
    const id = toInt(g("идкер"));
    if (id === null) continue;
    data.push({
      id,
      name: s(g("наименованиекер")),
      unit: s(g("едизмкер")),
      l2: s(g("л2код")),
      l3: s(g("л3код")),
      fer: s(g("фер")),
    });
  }
  return { data, missing };
}

export function frameToTmc(rows: Frame): { data: TmcRow[]; missing: string[] } {
  if (!rows.length) return { data: [], missing: ["(файл пуст)"] };
  const m = colMap(rows[0]);
  const need: Array<[string, string]> = [
    ["идтмцфск", "ИД ТМЦ фск"],
    ["наименованиетмцфск", "Наименование ТМЦ фск"],
    ["едизмтмц", "ЕдИзм ТМЦ"],
  ];
  const missing = need.filter(([k]) => !m.has(k)).map(([, label]) => label);
  const data: TmcRow[] = [];
  for (const r of rows) {
    const g = (k: string) => (m.has(k) ? r[m.get(k)!] : "");
    const id = toInt(g("идтмцфск"));
    if (id === null) continue;
    data.push({ id, name: s(g("наименованиетмцфск")), unit: s(g("едизмтмц")) });
  }
  return { data, missing };
}

// ---------- ШАГ 3. Правила подбора Код КЕР ----------

const FASON_KEYS = [
  "отвод",
  "переход",
  "врезка",
  "тройник",
  "крестовина",
  "утка",
  "заглушка",
];

const RECT_RE = /\d+\s*[xх×]\s*\d+/i; // «300x150», «300х150», «300×150»
const ROUND_RE = /[⌀øØ]|диам/;

export interface KerMatch {
  id: number | null;
  note: string;
}

export function getKerId(name: string): KerMatch {
  const n = name.toLowerCase();
  if (n.includes("воздуховод")) {
    if (RECT_RE.test(n)) return { id: 1426, note: "Прямоугольное сечение (число×число)" };
    if (ROUND_RE.test(n)) return { id: 1434, note: "Круглое сечение (⌀/диам)" };
    return { id: 300, note: "Общий случай" };
  }
  if (FASON_KEYS.some((k) => n.includes(k)))
    return {
      id: null,
      note: "Фасонные изделия — учтены в расценке на воздуховоды",
    };
  if (n.includes("клапан") || n.includes("заслонк")) {
    if (n.includes("противопожарн") || n.includes("огнезадержив"))
      return { id: 1524, note: "Огнезадерживающий" };
    if (n.includes("электропривод") || n.includes("механич"))
      return { id: 1516, note: "Механический привод" };
    if (n.includes("рукоятк") || n.includes("ручн"))
      return { id: 1510, note: "Ручной привод" };
  }
  if (["огнезащит", "изовент", "вбор", "огневент"].some((k) => n.includes(k)))
    return { id: 3677, note: "Огнезащита воздуховодов" };
  if (
    ["вытяжная установка", "приточная", "агрегат", "камера"].some((k) =>
      n.includes(k)
    )
  )
    return { id: 1589, note: "Приточно-вытяжной агрегат" };
  if (n.includes("вентилятор")) {
    if (n.includes("радиальн") || n.includes("центробеж"))
      return { id: 1976, note: "Радиальный" };
    if (n.includes("осев")) return { id: 1453, note: "Осевой" };
    if (n.includes("крышн")) return { id: 1459, note: "Крышный" };
    if (n.includes("канальн")) return { id: 4683, note: "Канальный" };
    return { id: 4681, note: "Прочие вентиляторы" };
  }
  if (n.includes("шумоглушитель")) return { id: 1785, note: "" };
  if (n.includes("решетк") || n.includes("диффузор"))
    return { id: 3947, note: "Воздухораспределители" };
  if (n.includes("зонт")) return { id: 1490, note: "Зонты над шахтами" };
  return { id: null, note: "Не найдено (по навигатору: Л2.Л3)" };
}

// ---------- ШАГ 4. Подбор Код ТМЦ ----------

const WORD_RE = /[a-zа-яё0-9]{3,}/g;
const FIRST_WORD_RE = /[a-zа-яё0-9]+/g;

export function wordSet(text: string): Set<string> {
  return new Set((text.toLowerCase().match(WORD_RE) || []));
}

export type TmcStatusKind = "exact" | "group" | "analog" | "none";

export interface TmcMatch {
  id: number | null;
  name: string;
  score: number;
  status: TmcStatusKind;
  reason: string;
}

interface TmcIndex {
  rec: TmcRow;
  nameL: string;
  words: Set<string>;
}

export function buildTmcIndex(tmc: TmcRow[]): TmcIndex[] {
  return tmc.map((rec) => ({
    rec,
    nameL: rec.name.toLowerCase(),
    words: wordSet(rec.name),
  }));
}

export function findTmc(
  name: string,
  article: string,
  index: TmcIndex[]
): TmcMatch {
  const nameL = name.toLowerCase();
  const firstWord = (nameL.match(FIRST_WORD_RE) || []).find((w) => w.length >= 3);
  if (!firstWord)
    return { id: null, name: "", score: 0, status: "none", reason: "Ключ поиска не определён" };

  const specWords = wordSet(name);
  const art = article.trim().toLowerCase();

  let best: TmcIndex | null = null;
  let bestScore = -Infinity;

  for (const cand of index) {
    if (!cand.nameL.includes(firstWord)) continue;
    let score = 0;
    for (const w of specWords) if (cand.words.has(w)) score++;
    if (art.length >= 4 && cand.nameL.includes(art)) score += 10;
    if (cand.nameL.includes("труб") && !nameL.includes("труб")) score -= 5;
    if (cand.nameL.includes("светильник") && !nameL.includes("светильник"))
      score -= 5;
    if (score > bestScore) {
      best = cand;
      bestScore = score;
    }
  }

  if (!best)
    return {
      id: null,
      name: "",
      score: 0,
      status: "none",
      reason: `Нет ТМЦ, содержащих ключ «${firstWord}»`,
    };

  if (bestScore >= 5)
    return { id: best.rec.id, name: best.rec.name, score: bestScore, status: "exact", reason: "Точное совпадение ТМЦ" };
  if (bestScore >= 2)
    return { id: best.rec.id, name: best.rec.name, score: bestScore, status: "group", reason: "ТМЦ подобран по группе" };
  return {
    id: best.rec.id,
    name: best.rec.name,
    score: bestScore,
    status: "analog",
    reason: `Аналог: ${best.rec.name} (частичное совпадение)`,
  };
}

// ---------- ШАГ 5–6. Сборка ВОР ----------

export interface BuildOptions {
  l2: string;
  l3: string;
  onProgress?: (fraction: number, stage: string) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function buildVor(
  spec: SpecRow[],
  ker: KerRow[],
  tmc: TmcRow[],
  opts: BuildOptions
): Promise<VorResult> {
  const warnings: string[] = [];
  const l2 = opts.l2.trim() || "2.8";
  const l3 = opts.l3.trim() || "2.8.3";
  const on = opts.onProgress ?? (() => {});

  // ШАГ 2 — фильтрация базы КЕР по навигатору
  on(0.06, `Фильтрация базы КЕР: Л2 = ${l2}, Л3 = ${l3}`);
  await sleep(120);
  const normL2 = normKey(l2);
  const normL3 = normKey(l3);
  let filtered = ker.filter(
    (k) => normKey(k.l2) === normL2 && normKey(k.l3) === normL3
  );
  if (filtered.length === 0) {
    warnings.push(
      `Фильтр «Л2 = ${l2}, Л3 = ${l3}» вернул 0 строк — использована вся база КЕР (${ker.length} строк). Проверьте коды навигатора.`
    );
    filtered = ker;
  }
  if (!ker.some((k) => k.l2 || k.l3)) {
    warnings.push(
      "В базе КЕР не найдены колонки «Л2 Код» / «Л3 Код» — фильтрация по навигатору пропущена."
    );
  }
  const kerById = new Map<number, KerRow>();
  for (const k of filtered) kerById.set(k.id, k);

  // индекс ТМЦ
  on(0.14, "Индексация базы ТМЦ");
  await sleep(90);
  const tmcIndex = buildTmcIndex(tmc);

  // ШАГ 3–5 — построчная обработка с тройной детализацией
  const rows: VorRow[] = [];
  const notFound: NotFoundRow[] = [];
  const systemNum = new Map<string, string>();
  const stats: VorStats = {
    specTotal: 0,
    headerCount: 0,
    skippedEmpty: 0,
    vorTotal: 0,
    kerFound: 0,
    tmcFound: 0,
    notFoundRows: 0,
    fasonCount: 0,
    taCounts: { Спецификация: 0, КЕР: 0, ТМЦ: 0, Заголовок: 0 },
    kerCodeFreq: [],
    tmcExact: 0,
    tmcGroup: 0,
    tmcAnalog: 0,
  };
  const freq = new Map<number, number>();

  const total = Math.max(1, spec.length);
  const CHUNK = 150;

  for (let i = 0; i < spec.length; i++) {
    const r = spec[i];

    const numFor = (sys: string): string => {
      const key = sys || "—";
      if (!systemNum.has(key)) {
        systemNum.set(key, String(systemNum.size + 1).padStart(3, "0"));
      }
      return systemNum.get(key)!;
    };

    // полностью пустая строка — пропускаем
    if (!r.name && r.qty === null) {
      stats.skippedEmpty++;
      if (i % CHUNK === 0) {
        on(0.14 + 0.72 * (i / total), "Подбор КЕР и ТМЦ по спецификации");
        await sleep(0);
      }
      continue;
    }

    const npp = numFor(r.system);

    // строка-заголовок (нет Кол-ва, но есть наименование)
    if (r.qty === null) {
      stats.headerCount++;
      stats.taCounts["Заголовок"]++;
      rows.push({
        npp,
        system: r.system,
        line: r.line,
        floor: r.floor,
        name: r.name,
        unit: r.unit,
        qty: null,
        kerId: null,
        tmcId: null,
        rashod: null,
        ta: "Заголовок",
        taFull: HEADER_TA_LABEL,
      });
      if (i % CHUNK === 0) {
        on(0.14 + 0.72 * (i / total), "Подбор КЕР и ТМЦ по спецификации");
        await sleep(0);
      }
      continue;
    }

    // позиция с объёмом
    stats.specTotal++;
    const kerMatch = getKerId(r.name);
    const tmcMatch = findTmc(r.name, r.article, tmcIndex);

    const kerOk = kerMatch.id !== null && kerById.has(kerMatch.id);
    if (kerMatch.id !== null && !kerById.has(kerMatch.id)) {
      warnings.length < 4 &&
        warnings.push(
          `ИД_КЕР ${kerMatch.id} отсутствует в отфильтрованной базе КЕР — позиция «${r.name.slice(0, 60)}…» осталась без КЕР.`
        );
    }
    const tmcOk = tmcMatch.id !== null;

    if (kerOk) {
      stats.kerFound++;
      freq.set(kerMatch.id!, (freq.get(kerMatch.id!) || 0) + 1);
    } else if (kerMatch.note.startsWith("Фасонные")) {
      stats.fasonCount++;
    }
    if (tmcOk) {
      stats.tmcFound++;
      if (tmcMatch.status === "exact") stats.tmcExact++;
      else if (tmcMatch.status === "group") stats.tmcGroup++;
      else stats.tmcAnalog++;
    }
    if (!kerOk || !tmcOk) {
      stats.notFoundRows++;
      if (!kerOk)
        notFound.push({
          system: r.system,
          line: r.line,
          name: r.name,
          qty: r.qty,
          what: "Код КЕР",
          reason: kerMatch.note,
        });
      if (!tmcOk)
        notFound.push({
          system: r.system,
          line: r.line,
          name: r.name,
          qty: r.qty,
          what: "Код ТМЦ",
          reason: tmcMatch.reason,
        });
    }

    const base = {
      npp,
      system: r.system,
      line: r.line,
      floor: r.floor,
      qty: r.qty,
      rashod: r.qty,
    };

    // СТРОКА 1 — Спецификация (всегда)
    stats.taCounts["Спецификация"]++;
    rows.push({
      ...base,
      name: r.name,
      unit: r.unit,
      kerId: kerOk ? kerMatch.id : null,
      tmcId: tmcOk ? tmcMatch.id : null,
      ta: "Спецификация",
      taFull: "Спецификация",
    });

    // СТРОКА 2 — КЕР (если найден; Код ТМЦ пустой)
    if (kerOk) {
      const k = kerById.get(kerMatch.id!)!;
      stats.taCounts["КЕР"]++;
      rows.push({
        ...base,
        name: k.name,
        unit: k.unit,
        kerId: k.id,
        tmcId: null,
        ta: "КЕР",
        taFull: "КЕР",
      });
    }

    // СТРОКА 3 — ТМЦ (если найден; Код КЕР пустой)
    if (tmcOk) {
      const t = tmcIndex.find((x) => x.rec.id === tmcMatch.id)!.rec;
      stats.taCounts["ТМЦ"]++;
      rows.push({
        ...base,
        name: t.name,
        unit: t.unit,
        kerId: null,
        tmcId: t.id,
        ta: "ТМЦ",
        taFull: "ТМЦ",
      });
    }

    if (i % CHUNK === 0) {
      on(0.14 + 0.72 * (i / total), "Подбор КЕР и ТМЦ по спецификации");
      await sleep(0);
    }
  }

  on(0.9, "Формирование колонки «№ п/п» и трассировки");
  await sleep(140);

  stats.vorTotal = rows.length;
  stats.kerCodeFreq = [...freq.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  on(1, "Готово");
  await sleep(80);

  return {
    rows,
    notFound,
    stats,
    warnings: [...new Set(warnings)],
    kerBaseTotal: ker.length,
    kerBaseFiltered: filtered.length,
    l2,
    l3,
    generatedAt: new Date(),
  };
}
