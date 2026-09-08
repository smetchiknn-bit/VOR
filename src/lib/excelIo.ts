import * as XLSX from "xlsx";
import { normKey, type LoadedFile, type Row, type VorResult } from "./vor";
import type { PromptState } from "./prompt";

export async function loadExcel(file: File, kind: "spec" | "ker" | "tmc"): Promise<LoadedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const wanted = kind === "spec" ? "спецификация" : kind === "ker" ? "выгрузка" : "тмц";
  let sheet = wb.SheetNames.find((n) => normKey(n) === wanted) ?? wb.SheetNames.find((n) => normKey(n).includes(wanted)) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheet];
  let rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
  if (!rows.length && wb.SheetNames.length > 1) {
    for (const name of wb.SheetNames) {
      const alt = XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { defval: "" });
      if (alt.length) {
        rows = alt;
        sheet = name;
        break;
      }
    }
  }
  return { name: file.name, sheet, rows };
}

function vorSheetRows(res: VorResult) {
  return res.rows.map((r) => ({
    "№ п/п": `'${r.npp}`,
    "Система": r.system,
    "Строка": r.line,
    "Этаж": r.floor,
    "Наименование": r.name,
    "ЕИ": r.unit,
    "Кол-во": r.qty,
    "Код КЕР": r.kerId,
    "Код ТМЦ": r.tmcId,
    "Расход ТМЦ": r.rashod,
    "ТА": r.ta === "Заголовок" ? "Строка-заголовок (уровень 1/2), иерархия сохранена" : r.ta,
  }));
}

function statSheetRows(res: VorResult, prompt: PromptState) {
  const s = res.stats;
  return [
    { Показатель: "Дата формирования", Значение: res.generatedAt.toLocaleString("ru-RU") },
    { Показатель: "Навигатор: Л2 Код / Л3 Код", Значение: `${res.l2} / ${res.l3}` },
    { Показатель: "Промпт.txt", Значение: prompt.custom ? `Заменён (${prompt.source})` : "Встроенная константа" },
    { Показатель: "Всего строк в спецификации (с объёмом)", Значение: s.specTotal },
    { Показатель: "Строк-заголовков (уровень 1/2)", Значение: s.headerCount },
    { Показатель: "Всего строк в ВОР", Значение: s.vorTotal },
    { Показатель: "Строк с подобранным Код КЕР", Значение: s.kerFound },
    { Показатель: "Строк с подобранным Код ТМЦ", Значение: s.tmcFound },
    { Показатель: "— из них: точное совпадение", Значение: s.tmcExact },
    { Показатель: "— из них: подобран по группе", Значение: s.tmcGroup },
    { Показатель: "— из них: аналог (слабое совпадение)", Значение: s.tmcAnalog },
    { Показатель: "Фасонные изделия (учтены в расценке КЕР)", Значение: s.fasonCount },
    { Показатель: "Строк с пометкой «Не найдено»", Значение: s.notFoundRows },
    { Показатель: "Уникальных систем", Значение: res.systems.length },
    { Показатель: "", Значение: "" },
    { Показатель: "Распределение по источникам (ТА)", Значение: "строк" },
    { Показатель: "  — Спецификация", Значение: s.taCounts["Спецификация"] },
    { Показатель: "  — КЕР", Значение: s.taCounts["КЕР"] },
    { Показатель: "  — ТМЦ", Значение: s.taCounts["ТМЦ"] },
    { Показатель: "  — Строки-заголовки", Значение: s.taCounts["Заголовок"] },
  ];
}

function notFoundSheetRows(res: VorResult) {
  if (!res.notFound.length)
    return [{ Система: "—", Строка: "—", Наименование: "Все позиции обработаны", "Кол-во": "", "Что не найдено": "—", Причина: "—" }];
  return res.notFound.map((r) => ({
    Система: r.system,
    Строка: r.line,
    Наименование: r.name,
    "Кол-во": r.qty,
    "Что не найдено": r.what,
    Причина: r.reason,
  }));
}

function makeWorkbook(res: VorResult, prompt: PromptState) {
  const wb = XLSX.utils.book_new();
  const wsVor = XLSX.utils.json_to_sheet(vorSheetRows(res));
  wsVor["!cols"] = [{ wch: 7 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 64 }, { wch: 7 }, { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsVor, "ВОР");
  const wsStat = XLSX.utils.json_to_sheet(statSheetRows(res, prompt));
  wsStat["!cols"] = [{ wch: 44 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsStat, "Статистика");
  const wsNf = XLSX.utils.json_to_sheet(notFoundSheetRows(res));
  wsNf["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 60 }, { wch: 8 }, { wch: 14 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(wb, wsNf, "Не найдено");
  return wb;
}

export function vorBlob(res: VorResult, prompt: PromptState): Blob {
  const wb = makeWorkbook(res, prompt);
  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function csvBlob(res: VorResult): Blob {
  const bom = "\uFEFF";
  const rows = vorSheetRows(res);
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(";")];
  for (const r of rows) {
    lines.push(headers.map((h) => {
      const v = r[h as keyof typeof r];
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";"));
  }
  return new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" });
}

export function textBlob(text: string, mime: string): Blob {
  return new Blob([text], { type: mime });
}
