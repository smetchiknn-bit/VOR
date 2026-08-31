import * as XLSX from "xlsx";
import type { VorResult } from "./vor";
import { HEADER_TA_LABEL } from "./vor";

export interface LoadedFile {
  name: string;
  sheet: string;
  rows: Record<string, unknown>[];
}

// ---------- чтение загруженного файла ----------

export async function parseUpload(
  file: File,
  preferSheets: string[]
): Promise<LoadedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const preferNorm = preferSheets.map((p) => p.toLowerCase());
  const sheetName =
    wb.SheetNames.find((n) => preferNorm.includes(n.toLowerCase())) ??
    wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
  });
  return { name: file.name, sheet: sheetName, rows };
}

// ---------- числа в формате Excel ----------

function numCell(v: number | null) {
  return v;
}

// ---------- книга ВОР.xlsx ----------

export const VOR_HEADERS = [
  "№ п/п",
  "Система",
  "Строка",
  "Этаж",
  "Наименование",
  "ЕИ",
  "Кол-во",
  "Код КЕР",
  "Код ТМЦ",
  "Расход ТМЦ",
  "ТА",
];

export function buildVorWorkbook(res: VorResult): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // --- Лист «ВОР» ---
  const aoa: (string | number | null)[][] = [VOR_HEADERS];
  for (const r of res.rows) {
    aoa.push([
      r.npp,
      r.system,
      r.line,
      r.floor,
      r.name,
      r.unit,
      numCell(r.qty),
      numCell(r.kerId),
      numCell(r.tmcId),
      numCell(r.rashod),
      r.ta === "Заголовок" ? HEADER_TA_LABEL : r.taFull,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 64 },
    { wch: 7 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
  ];
  // текстовый формат для «№ п/п» (ведущие нули) и числовой для количеств
  const rowCount = aoa.length;
  for (let i = 1; i < rowCount; i++) {
    const a = XLSX.utils.encode_cell({ r: i, c: 0 });
    if (ws[a]) ws[a].t = "s";
    for (const c of [6, 9]) {
      const addr = XLSX.utils.encode_cell({ r: i, c });
      if (ws[addr] && typeof ws[addr].v === "number") ws[addr].z = "0.00";
    }
  }
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, ws, "ВОР");

  // --- Лист «Статистика» ---
  const s = res.stats;
  const dist = s.taCounts;
  const stat: (string | number)[][] = [
    ["Показатель", "Значение"],
    ["Дата формирования", res.generatedAt.toLocaleString("ru-RU")],
    ["Навигатор КЕР — Л2 Код", res.l2],
    ["Навигатор КЕР — Л3 Код", res.l3],
    ["Строк в базе КЕР (всего / после фильтра)", `${res.kerBaseTotal} / ${res.kerBaseFiltered}`],
    [],
    ["Всего строк в спецификации (позиций с объёмом)", s.specTotal],
    ["Строк-заголовков (уровень 1/2)", s.headerCount],
    ["Пустых строк пропущено", s.skippedEmpty],
    ["Всего строк в ВОР", s.vorTotal],
    ["Строк с подобранным Код КЕР", s.kerFound],
    ["Строк с подобранным Код ТМЦ", s.tmcFound],
    ["Строк с пометкой «Не найдено» (КЕР или ТМЦ)", s.notFoundRows],
    ["Фасонные изделия (учтены в расценке на воздуховоды)", s.fasonCount],
    [],
    ["Распределение по источникам (ТА)", "строк"],
    ["  — Спецификация", dist["Спецификация"]],
    ["  — КЕР", dist["КЕР"]],
    ["  — ТМЦ", dist["ТМЦ"]],
    ["  — Строки-заголовки", dist["Заголовок"]],
    [],
    ["Качество подбора ТМЦ", "строк"],
    ["  — Точное совпадение (балл ≥ 5)", s.tmcExact],
    ["  — Подобрано по группе (балл 2–4)", s.tmcGroup],
    ["  — Аналог (балл < 2)", s.tmcAnalog],
  ];
  const wsStat = XLSX.utils.aoa_to_sheet(stat);
  wsStat["!cols"] = [{ wch: 52 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsStat, "Статистика");

  // --- Лист «Не найдено» ---
  const nf: (string | number | null)[][] = [
    ["Система", "Строка", "Наименование", "Кол-во", "Что не найдено", "Причина"],
  ];
  for (const r of res.notFound) {
    nf.push([r.system, r.line, r.name, r.qty, r.what, r.reason]);
  }
  if (res.notFound.length === 0) {
    nf.push(["—", "—", "Все позиции обработаны без пропусков", null, "—", "—"]);
  }
  const wsNf = XLSX.utils.aoa_to_sheet(nf);
  wsNf["!cols"] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 64 },
    { wch: 10 },
    { wch: 14 },
    { wch: 48 },
  ];
  XLSX.utils.book_append_sheet(wb, wsNf, "Не найдено");

  return wb;
}

// ---------- ВОР_с_ТА.csv (utf-8-sig, «;», десятичная запятая) ----------

function csvNum(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "";
  const fixed = Math.abs(v % 1) < 1e-9 ? String(Math.round(v)) : v.toFixed(2);
  return fixed.replace(".", ",");
}

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const str = String(v);
  if (/[";\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

export function buildVorCsv(res: VorResult): string {
  const lines: string[] = [VOR_HEADERS.join(";")];
  for (const r of res.rows) {
    lines.push(
      [
        `'${r.npp}`, // апостроф — Excel воспринимает как текст, нули сохраняются
        csvCell(r.system),
        csvCell(r.line),
        csvCell(r.floor),
        csvCell(r.name),
        csvCell(r.unit),
        csvNum(r.qty),
        r.kerId === null ? "" : String(r.kerId),
        r.tmcId === null ? "" : String(r.tmcId),
        csvNum(r.rashod),
        csvCell(r.ta === "Заголовок" ? HEADER_TA_LABEL : r.taFull),
      ].join(";")
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

// ---------- скачивание ----------

export function downloadWorkbook(wb: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(wb, fileName);
}

export function downloadText(content: string, fileName: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
