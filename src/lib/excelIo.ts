import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
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

async function makeWorkbook(res: VorResult, prompt: PromptState): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  
  // Лист "ВОР"
  const wsVor = workbook.addWorksheet("ВОР");
  const vorData = vorSheetRows(res);
  
  // Добавляем заголовки
  const headers = Object.keys(vorData[0]);
  wsVor.addRow(headers);
  
  // Добавляем данные и применяем форматирование
  vorData.forEach((row) => {
    const excelRow = wsVor.addRow(Object.values(row));
    
    // Применяем форматирование для строк с ТА="Спецификация"
    if (row["ТА"] === "Спецификация") {
      excelRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9D9D9" }
        };
        cell.font = { bold: true };
      });
    }
  });
  
  // Устанавливаем ширину колонок
  wsVor.columns = [
    { width: 7 },   // № п/п
    { width: 12 },  // Система
    { width: 10 },  // Строка
    { width: 8 },   // Этаж
    { width: 64 },  // Наименование
    { width: 7 },   // ЕИ
    { width: 10 },  // Кол-во
    { width: 9 },   // Код КЕР
    { width: 9 },   // Код ТМЦ
    { width: 12 },  // Расход ТМЦ
    { width: 18 }   // ТА
  ];
  
  // Лист "Статистика"
  const wsStat = workbook.addWorksheet("Статистика");
  const statData = statSheetRows(res, prompt);
  statData.forEach((row) => {
    wsStat.addRow(Object.values(row));
  });
  wsStat.columns = [{ width: 44 }, { width: 28 }];
  
  // Лист "Не найдено"
  const wsNf = workbook.addWorksheet("Не найдено");
  const nfData = notFoundSheetRows(res);
  nfData.forEach((row) => {
    wsNf.addRow(Object.values(row));
  });
  wsNf.columns = [
    { width: 12 },  // Система
    { width: 10 },  // Строка
    { width: 60 },  // Наименование
    { width: 8 },   // Кол-во
    { width: 14 },  // Что не найдено
    { width: 44 }   // Причина
  ];
  
  // Генерируем буфер
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function vorBlob(res: VorResult, prompt: PromptState): Promise<Blob> {
  return await makeWorkbook(res, prompt);
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
