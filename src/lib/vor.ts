// ============================================================
//  Доменная логика генератора ВОР: подбор КЕР/ТМЦ, тройная
//  детализация, строки-заголовки, нумерация № п/п, статистика
// ============================================================

export type Row = Record<string, unknown>;

export interface LoadedFile {
  name: string;
  sheet: string;
  rows: Row[];
}

export type TA = "Спецификация" | "КЕР" | "ТМЦ" | "Заголовок";

export interface VorRow {
  npp: string;
  system: string;
  line: string;
  floor: string;
  name: string;
  unit: string;
  qty: number | null;
  kerId: number | null;
  tmcId: number | null;
  rashod: number | null;
  ta: TA;
  specLineIndex: number;
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
  specTotal: number;
  headerCount: number;
  vorTotal: number;
  kerFound: number;
  tmcFound: number;
  notFoundRows: number;
  fasonCount: number;
  taCounts: Record<TA, number>;
  kerCodeFreq: Array<{ code: number; count: number }>;
  tmcExact: number;
  tmcGroup: number;
  tmcAnalog: number;
}

export interface VorResult {
  rows: VorRow[];
  notFound: NotFoundRow[];
  stats: VorStats;
  l2: string;
  l3: string;
  kerBaseFiltered: number;
  kerBaseTotal: number;
  systems: string[];
  generatedAt: Date;
  warnings: string[];
}

// ---------- нормализация ключей колонок ----------

export function normKey(s: string): string {
  return String(s).toLowerCase().replace(/[\s\u00a0_.\-–—/\\()«»"]/g, "");
}

export function pick(row: Row, key: string): unknown {
  const m: Record<string, string> = {};
  for (const k of Object.keys(row)) m[normKey(k)] = k;
  const real = m[key];
  return real === undefined ? undefined : row[real];
}

export function hasCol(rows: Row[], key: string): boolean {
  if (!rows.length) return false;
  const m = new Set(Object.keys(rows[0]).map(normKey));
  return m.has(key);
}

export function parseQty(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[\u00a0\s]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------- подбор Код КЕР ----------

const FASON_KEYS = ["отвод", "переход", "врезка", "тройник", "крестовина", "утка", "заглушка"];
const RECT_RE = /\d+\s*[xх×]\s*\d+/;
const ROUND_RE = /[⌀øØ]|диам/;

export function getKerId(name: string): { id: number | null; note: string } {
  const n = name.toLowerCase();
  if (n.includes("воздуховод")) {
    if (RECT_RE.test(n)) return { id: 1426, note: "Прямоугольное сечение (число×число)" };
    if (ROUND_RE.test(n)) return { id: 1434, note: "Круглое сечение (⌀/диам)" };
    return { id: 300, note: "Воздуховод — общий случай" };
  }
  if (FASON_KEYS.some((k) => n.includes(k)))
    return { id: null, note: "Фасонные изделия — учтены в расценке на воздуховоды" };
  if (n.includes("клапан") || n.includes("заслонк")) {
    if (n.includes("противопожарн") || n.includes("огнезадержив"))
      return { id: 1524, note: "Огнезадерживающий клапан" };
    if (n.includes("электропривод") || n.includes("механич"))
      return { id: 1516, note: "Механический привод" };
    if (n.includes("рукоятк") || n.includes("ручн")) return { id: 1510, note: "Ручной привод" };
  }
  if (["огнезащит", "изовент", "вбор", "огневент"].some((k) => n.includes(k)))
    return { id: 3677, note: "Огнезащита воздуховодов" };
  if (["вытяжная установка", "приточная", "агрегат", "камера"].some((k) => n.includes(k)))
    return { id: 1589, note: "Приточно-вытяжной агрегат" };
  if (n.includes("вентилятор")) {
    if (n.includes("радиальн") || n.includes("центробеж")) return { id: 1976, note: "Радиальный" };
    if (n.includes("осев")) return { id: 1453, note: "Осевой" };
    if (n.includes("крышн")) return { id: 1459, note: "Крышный" };
    if (n.includes("канальн")) return { id: 4683, note: "Канальный" };
    return { id: 4681, note: "Вентилятор прочий" };
  }
  if (n.includes("шумоглушитель")) return { id: 1785, note: "Шумоглушитель" };
  if (n.includes("решетк") || n.includes("диффузор")) return { id: 3947, note: "Воздухораспределитель" };
  if (n.includes("зонт")) return { id: 1490, note: "Зонт над шахтой" };
  return { id: null, note: "Не найдено (по навигатору: Л2.Л3)" };
}

// ---------- скоринг ТМЦ ----------

const WORDS_RE = /[a-zа-яё0-9]{3,}/g;
const FIRST_RE = /[a-zа-яё0-9]+/;
const PENALTY_KEYS = ["труб", "светильник"];

export function words(text: string): Set<string> {
  return new Set((text.toLowerCase().match(WORDS_RE) ?? []) as string[]);
}

export interface TmcIndexEntry {
  id: number;
  name: string;
  unit: string;
  nameLower: string;
  wordSet: Set<string>;
}

export function buildTmcIndex(rows: Row[]): TmcIndexEntry[] {
  const out: TmcIndexEntry[] = [];
  for (const r of rows) {
    const idRaw = pick(r, "идтмцфск");
    const id = Number(idRaw);
    const name = String(pick(r, "наименованиетмцфск") ?? "").trim();
    if (!Number.isFinite(id) || !name) continue;
    out.push({ id, name, unit: String(pick(r, "едизмтмц") ?? ""), nameLower: name.toLowerCase(), wordSet: words(name) });
  }
  return out;
}

export interface TmcMatch {
  id: number | null;
  score: number | null;
  status: "exact" | "group" | "analog" | "none";
  note: string;
}

export function findTmc(
  name: string,
  article: string,
  index: TmcIndexEntry[]
): TmcMatch {
  const nameLower = name.toLowerCase();
  const first = (nameLower.match(FIRST_RE) ?? [])[0] ?? "";
  const key = first.length >= 3 ? first : "";
  if (!key) return { id: null, score: null, status: "none", note: "Ключ поиска не определён" };

  const specWords = words(name);
  const art = article.trim().toLowerCase();
  let best: TmcIndexEntry | null = null;
  let bestScore = -Infinity;

  for (const c of index) {
    if (!c.nameLower.includes(key)) continue;
    let score = 0;
    for (const w of specWords) if (c.wordSet.has(w)) score += 1;
    if (art.length >= 4 && c.nameLower.includes(art)) score += 10;
    for (const p of PENALTY_KEYS)
      if (c.nameLower.includes(p) && !nameLower.includes(p)) score -= 5;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (!best)
    return { id: null, score: null, status: "none", note: `Нет ТМЦ, содержащих ключ «${key}»` };
  const status: TmcMatch["status"] = bestScore >= 5 ? "exact" : bestScore >= 2 ? "group" : "analog";
  return { id: best.id, score: bestScore, status, note: best.name };
}

// ---------- навигатор КЕР ----------

export function filterKer(rows: Row[], l2: string, l3: string) {
  const map = new Map<number, { name: string; unit: string }>();
  const l2n = normKey(l2);
  const l3n = normKey(l3);
  let total = 0;
  let filtered = 0;
  for (const r of rows) {
    const id = Number(pick(r, "идкер"));
    if (!Number.isFinite(id)) continue;
    total += 1;
    const r2 = normKey(String(pick(r, "л2код") ?? ""));
    const r3 = normKey(String(pick(r, "л3код") ?? ""));
    if (r2 === l2n && r3 === l3n) {
      filtered += 1;
      if (!map.has(id))
        map.set(id, {
          name: String(pick(r, "наименованиекер") ?? ""),
          unit: String(pick(r, "едизмкер") ?? ""),
        });
    }
  }
  return { map, total, filtered };
}

// ---------- главная обработка (асинхронная: не блокирует UI) ----------

export interface ProcessArgs {
  spec: LoadedFile;
  ker: LoadedFile;
  tmc: LoadedFile;
  l2: string;
  l3: string;
  onProgress?: (p: number, label: string) => void;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function processVor(args: ProcessArgs): Promise<VorResult> {
  const { spec, ker, tmc, onProgress } = args;
  const l2 = args.l2.trim() || "2.8";
  const l3 = args.l3.trim() || "2.8.3";
  const warnings: string[] = [];

  onProgress?.(0.08, "Фильтрация базы КЕР по навигатору (Л2/Л3)…");
  await tick();
  const kerF = filterKer(ker.rows, l2, l3);
  let kerMap = kerF.map;
  if (kerF.filtered === 0) {
    warnings.push(
      `Фильтр «Л2 = ${l2}, Л3 = ${l3}» вернул 0 строк базы КЕР — подбор выполнен по всей базе.`
    );
    const all = new Map<number, { name: string; unit: string }>();
    for (const r of ker.rows) {
      const id = Number(pick(r, "идкер"));
      if (Number.isFinite(id) && !all.has(id))
        all.set(id, {
          name: String(pick(r, "наименованиекер") ?? ""),
          unit: String(pick(r, "едизмкер") ?? ""),
        });
    }
    kerMap = all;
  }

  onProgress?.(0.2, "Индексация базы ТМЦ…");
  await tick();
  const tmcIndex = buildTmcIndex(tmc.rows);
  const tmcById = new Map(tmcIndex.map((e) => [e.id, e]));

  const rows: VorRow[] = [];
  const notFound: NotFoundRow[] = [];
  const systemNum = new Map<string, number>();
  const systems: string[] = [];

  let specTotal = 0;
  let headerCount = 0;
  let kerFound = 0;
  let tmcFound = 0;
  let notFoundRows = 0;
  let fasonCount = 0;
  const taCounts: Record<TA, number> = { Спецификация: 0, КЕР: 0, ТМЦ: 0, Заголовок: 0 };
  const kerFreq = new Map<number, number>();
  let tmcExact = 0;
  let tmcGroup = 0;
  let tmcAnalog = 0;

  const n = spec.rows.length;
  for (let i = 0; i < n; i++) {
    // периодически отдаём управление браузеру: прогресс-бар рисуется,
    // интерфейс не «зависает» даже на больших спецификациях
    if (i % 40 === 0) {
      onProgress?.(
        0.25 + 0.65 * (i / Math.max(n, 1)),
        `Подбор КЕР и ТМЦ — строка ${i + 1} из ${n}`
      );
      await tick();
    }
    const r = spec.rows[i];
    const name = String(pick(r, "наименование") ?? "").trim();
    const qty = parseQty(pick(r, "колво"));
    if (!name && qty === null) continue; // полностью пустая строка

    const system = String(pick(r, "система") ?? "").trim() || "—";
    const line = String(pick(r, "строка") ?? "").trim();
    const floor = String(pick(r, "этаж") ?? "").trim();
    const unit = String(pick(r, "еи") ?? "").trim();
    const article = String(pick(r, "артикул") ?? "");

    if (!systemNum.has(system)) {
      systemNum.set(system, systemNum.size + 1);
      systems.push(system);
    }
    const npp = String(systemNum.get(system)).padStart(3, "0");
    const base = { npp, system, line, floor, specLineIndex: i };

    if (qty === null) {
      // строка-заголовок 1/2 уровня — иерархия сохраняется
      headerCount += 1;
      taCounts["Заголовок"] += 1;
      rows.push({ ...base, name, unit, qty: null, kerId: null, tmcId: null, rashod: null, ta: "Заголовок" });
      continue;
    }

    specTotal += 1;
    let miss = false;

    const ker = getKerId(name);
    let kerId: number | null = null;
    if (ker.id !== null && kerMap.has(ker.id)) {
      kerId = ker.id;
      kerFound += 1;
      kerFreq.set(kerId, (kerFreq.get(kerId) ?? 0) + 1);
    } else if (ker.id !== null && !kerMap.has(ker.id)) {
      miss = true;
      notFound.push({
        system, line, name, qty, what: "Код КЕР",
        reason: `ИД ${ker.id} отсутствует в отфильтрованной базе КЕР`,
      });
    } else if (ker.note.startsWith("Фасонные")) {
      fasonCount += 1;
    } else {
      miss = true;
      notFound.push({ system, line, name, qty, what: "Код КЕР", reason: ker.note });
    }

    const tmc = findTmc(name, article, tmcIndex);
    let tmcId: number | null = null;
    if (tmc.id !== null && tmcById.has(tmc.id)) {
      tmcId = tmc.id;
      tmcFound += 1;
      if (tmc.status === "exact") tmcExact += 1;
      else if (tmc.status === "group") tmcGroup += 1;
      else tmcAnalog += 1;
    } else {
      miss = true;
      notFound.push({ system, line, name, qty, what: "Код ТМЦ", reason: tmc.note });
    }
    if (miss) notFoundRows += 1;

    // СТРОКА 1 — Спецификация (всегда, оба кода для трассировки)
    taCounts["Спецификация"] += 1;
    rows.push({ ...base, name, unit, qty, kerId, tmcId, rashod: qty, ta: "Спецификация" });

    // СТРОКА 2 — КЕР (Код ТМЦ пустой)
    if (kerId !== null) {
      const k = kerMap.get(kerId)!;
      taCounts["КЕР"] += 1;
      rows.push({ ...base, name: k.name, unit: k.unit, qty, kerId, tmcId: null, rashod: qty, ta: "КЕР" });
    }

    // СТРОКА 3 — ТМЦ (Код КЕР пустой)
    if (tmcId !== null) {
      const t = tmcById.get(tmcId)!;
      taCounts["ТМЦ"] += 1;
      rows.push({ ...base, name: t.name, unit: t.unit, qty, kerId: null, tmcId, rashod: qty, ta: "ТМЦ" });
    }
  }

  onProgress?.(0.96, "Формирование структуры файла…");
  await tick();

  return {
    rows,
    notFound,
    stats: {
      specTotal,
      headerCount,
      vorTotal: rows.length,
      kerFound,
      tmcFound,
      notFoundRows,
      fasonCount,
      taCounts,
      kerCodeFreq: [...kerFreq.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count || a.code - b.code),
      tmcExact,
      tmcGroup,
      tmcAnalog,
    },
    l2,
    l3,
    kerBaseFiltered: kerF.filtered,
    kerBaseTotal: kerF.total,
    systems,
    generatedAt: new Date(),
    warnings,
  };
}
