import * as XLSX from "xlsx";
import type { VorResult, LoadedFile, Row } from "./vor";
import { hasCol } from "./vor";
import type { PromptState } from "./prompt";

const XLSXR = XLSX.read;
const XLSXU = XLSX.utils;
const XLSXW = XLSX.write;

export type { LoadedFile, Row };

const HEADER_MAP: Record<string, string[]> = {
  spec: ["Файл", "Лист", "Система", "Этаж", "Наименование", "Артикул", "Производитель", "ЕИ", "Кол-во", "Масса", "Примечания", "Строка"],
  ker: ["ИД_КЕР", "Наименование_КЕР", "ЕдИзм КЕР", "Иерархия", "Л1 Код", "Л1 Наименование", "Л2 Код", "Л2 Наименование", "Л3 Код", "Л3 Наименование", "Л4 Код", "Л4 Наименование", "Л5 Код", "Л5 Наименование", "ФЕР"],
  tmc: ["ИД ТМЦ фск", "Наименование ТМЦ фск", "ЕдИзм ТМЦ", "КСР код Группы", "Бренд", "ФСБЦ"],
};

const SHEET_HINTS: Record<string, string[]> = {
  spec: ["спецификация"],
  ker: ["выгрузка", "кер"],
  tmc: ["тмц"],
};

const REQUIRED: Record<string, string[][]> = {
  spec: [["наименование"], ["колво"], ["строка"], ["система"]],
  ker: [["идкер"], ["наименованиекер"]],
  tmc: [["идтмцфск"], ["наименованиетмцфск"]],
};

export async function loadExcel(file: File, kind: keyof typeof REQUIRED): Promise<LoadedFile> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });
  let sheetName = wb.SheetNames[0];
  const hints = SHEET_HINTS[kind] ?? [];
  for (const sn of wb.SheetNames) {
    const low = sn.toLowerCase();
    if (hints.some((h) => low.includes(h))) {
      sheetName = sn;
      break;
    }
  }
  const ws = wb.Sheets[sheetName];
  const rows = XLSXU.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const missing = REQUIRED[kind].filter((alts) => !rows.length || !alts.some((a) => hasCol(rows, a)));
  if (missing.length)
    throw new Error(
      `В файле «${file.name}» (лист «${sheetName}») не найдены обязательные колонки: ${missing
        .map((alts) => HEADER_MAP[kind]?.find((h) => h.toLowerCase().includes(alts[0].slice(0, 4))) ?? alts[0])
        .join(", ")}.`
    );
  return { name: file.name, sheet: sheetName, rows };
}

// ---------- формирование книги ВОР.xlsx ----------

export function buildVorWorkbook(res: VorResult, prompt: PromptState): XLSX.WorkBook {
  const vor = res.rows.map((r) => ({
    "№ п/п": r.npp,
    "Система": r.system,
    "Строка": r.line,
    "Этаж": r.floor,
    "Наименование": r.name,
    "ЕИ": r.unit,
    "Кол-во": r.qty ?? "",
    "Код КЕР": r.kerId ?? "",
    "Код ТМЦ": r.tmcId ?? "",
    "Расход ТМЦ": r.rashod ?? "",
    "ТА":
      r.ta === "Заголовок"
        ? "Строка-заголовок (уровень 1/2), иерархия сохранена"
        : r.ta,
  }));

  const d = res.stats.taCounts;
  const stat: Array<Record<string, string | number>> = [
    { Показатель: "Дата формирования", Значение: res.generatedAt.toLocaleString("ru-RU") },
    { Показатель: "Навигатор: Л2 Код / Л3 Код", Значение: `${res.l2} / ${res.l3}` },
    { Показатель: `Промпт.txt (${prompt.custom ? "заменён" : "встроенный"}) · символов`, Значение: prompt.text.length },
    { Показатель: "Всего строк в спецификации (с объёмом)", Значение: res.stats.specTotal },
    { Показатель: "Строк-заголовков (уровень 1/2)", Значение: res.stats.headerCount },
    { Показатель: "Всего строк в ВОР", Значение: res.stats.vorTotal },
    { Показатель: "Строк с подобранным Код КЕР", Значение: res.stats.kerFound },
    { Показатель: "Строк с подобранным Код ТМЦ", Значение: res.stats.tmcFound },
    { Показатель: "Строк с пометкой «Не найдено»", Значение: res.stats.notFoundRows },
    { Показатель: "Фасонные изделия (учтены в расценке)", Значение: res.stats.fasonCount },
    { Показатель: "", Значение: "" },
    { Показатель: "Распределение по источникам (ТА)", Значение: "строк" },
    { Показатель: "— Спецификация", Значение: d["Спецификация"] },
    { Показатель: "— КЕР", Значение: d["КЕР"] },
    { Показатель: "— ТМЦ", Значение: d["ТМЦ"] },
    { Показатель: "— Строки-заголовки", Значение: d["Заголовок"] },
  ];

  const nf =
    res.notFound.length > 0
      ? res.notFound.map((r) => ({
          Система: r.system,
          Строка: r.line,
          Наименование: r.name,
          "Кол-во": r.qty ?? "",
          "Что не найдено": r.what,
          Причина: r.reason,
        }))
      : [{ Система: "—", Строка: "—", Наименование: "Все позиции обработаны", "Кол-во": "", "Что не найдено": "—", Причина: "—" }];

  const promptRows = [
    { "Промпт.txt (активный на момент формирования)": `Источник: ${prompt.source}` },
    ...prompt.text.split("\n").map((line) => ({ "Промпт.txt (активный на момент формирования)": line })),
  ];

  const wb = XLSXU.book_new();
  const wsVor = XLSXU.json_to_sheet(vor);
  wsVor["!cols"] = [
    { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 64 },
    { wch: 7 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 44 },
  ];
  const wsStat = XLSXU.json_to_sheet(stat);
  wsStat["!cols"] = [{ wch: 46 }, { wch: 26 }];
  const wsNf = XLSXU.json_to_sheet(nf);
  wsNf["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 64 }, { wch: 10 }, { wch: 14 }, { wch: 52 }];
  const wsPrompt = XLSXU.json_to_sheet(promptRows);
  wsPrompt["!cols"] = [{ wch: 100 }];
  XLSXU.book_append_sheet(wb, wsVor, "ВОР");
  XLSXU.book_append_sheet(wb, wsStat, "Статистика");
  XLSXU.book_append_sheet(wb, wsNf, "Не найдено");
  XLSXU.book_append_sheet(wb, wsPrompt, "Промпт");
  return wb;
}

// ВОР_с_ТА.csv по разделу 9 промпта: UTF-8 BOM, «;», десятичная запятая, «'001»
export function buildVorCsv(res: VorResult): string {
  const header = ["№ п/п", "Система", "Строка", "Этаж", "Наименование", "ЕИ", "Кол-во", "Код КЕР", "Код ТМЦ", "Расход ТМЦ", "ТА"];
  const esc = (v: string) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const num = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
  const lines = res.rows.map((r) =>
    [
      `'${r.npp}`,
      r.system,
      r.line,
      r.floor,
      r.name,
      r.unit,
      num(r.qty),
      num(r.kerId),
      num(r.tmcId),
      num(r.rashod),
      r.ta === "Заголовок" ? "Строка-заголовок (уровень 1/2), иерархия сохранена" : r.ta,
    ]
      .map(esc)
      .join(";")
  );
  return "\uFEFF" + header.join(";") + "\n" + lines.join("\n");
}

// ---------- blob'ы для прямых ссылок скачивания ----------

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function vorBlob(res: VorResult, prompt: PromptState): Blob {
  const wb = buildVorWorkbook(res, prompt);
  const ab = XLSXW(wb, { bookType: "xlsx", type: "array" });
  return new Blob([ab], { type: XLSX_MIME });
}

export function csvBlob(res: VorResult): Blob {
  return new Blob([buildVorCsv(res)], { type: "text/csv;charset=utf-8" });
}

export function textBlob(text: string, mime: string): Blob {
  return new Blob([text], { type: mime });
}

// программное скачивание (запасной путь; основной — прямые <a download>)
export function downloadWorkbook(wb: XLSX.WorkBook, name: string): void {
  const ab = XLSXW(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([ab], { type: XLSX_MIME }), name);
}

export function downloadText(text: string, name: string, mime = "text/plain;charset=utf-8"): void {
  downloadBlob(new Blob([text], { type: mime }), name);
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 400);
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}
