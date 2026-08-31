import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoadedFile } from "./lib/excelIo";
import { frameToKer, frameToSpec, frameToTmc, buildVor } from "./lib/vor";
import type { VorResult } from "./lib/vor";
import { getDemoFiles } from "./lib/demo";
import {
  FileDrop,
  SectionTitle,
  IconAlert,
  IconCompass,
  IconStamp,
  IconCheck,
  IconGear,
} from "./components/ui";
import { Pipeline, RulesReference, TmcAlgo, FormatCard } from "./components/reference";
import { Results } from "./components/results";
import { PythonPanel } from "./components/pythonPanel";

// ---------- live clock for the title block ----------

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

type Status = "idle" | "busy" | "done";

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  idle: { label: "Ожидание", cls: "bg-brass-500 text-brass-500" },
  busy: { label: "Обработка", cls: "bg-blueprint-500 text-blueprint-500" },
  done: { label: "Готово", cls: "bg-moss-500 text-moss-500" },
};

// ---------- sidebar accordion ----------

function Instruction() {
  const [open, setOpen] = useState(false);
  const items = [
    ["Загрузите 3 файла", "Спецификация.xlsx, База КЕР.xlsx и База ТМЦ.xlsx — все обязательны. Колонки распознаются автоматически, порядок не важен."],
    ["Задайте навигатор КЕР", "Л2 Код (по умолчанию 2.8 — Внутренние инженерные сети) и Л3 Код (2.8.3 — Устройство системы вентиляции). Пустые поля = значения по умолчанию."],
    ["Нажмите «Сформировать ВОР»", "Обработка идёт построчно с прогресс-баром. Позиции без кодов не удаляются — они попадают на лист «Не найдено»."],
    ["Скачайте результат", "ВОР.xlsx (листы ВОР / Статистика / Не найдено) или ВОР_с_ТА.csv: UTF-8 BOM, «;», десятичная запятая, № п/п с апострофом."],
  ] as const;
  return (
    <div className="border border-ink-700 bg-ink-850/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
      >
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-200">
          Инструкция
        </span>
        <span
          className={`font-mono text-[11px] text-brass-500 transition-transform duration-300 ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <ol className="space-y-3 px-3.5 pb-4">
            {items.map(([t, d], i) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-brass-500/60 font-mono text-[10px] font-bold text-brass-500">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[12px] font-bold text-ink-100">{t}</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-ink-300">{d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ============================================================

export default function App() {
  const now = useClock();
  const [specFile, setSpecFile] = useState<LoadedFile | null>(null);
  const [kerFile, setKerFile] = useState<LoadedFile | null>(null);
  const [tmcFile, setTmcFile] = useState<LoadedFile | null>(null);
  const [specErr, setSpecErr] = useState<string | null>(null);
  const [kerErr, setKerErr] = useState<string | null>(null);
  const [tmcErr, setTmcErr] = useState<string | null>(null);
  const [l2, setL2] = useState("2.8");
  const [l3, setL3] = useState("2.8.3");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ p: 0, stage: "" });
  const [result, setResult] = useState<VorResult | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const status: Status = processing ? "busy" : result ? "done" : "idle";
  const ready = !!specFile && !!kerFile && !!tmcFile;
  const filesLoaded = [specFile, kerFile, tmcFile].filter(Boolean).length;

  const run = useCallback(async () => {
    setAlert(null);
    if (!specFile || !kerFile || !tmcFile) {
      setAlert("Загрузите все три обязательных файла: Спецификация.xlsx, База КЕР.xlsx, База ТМЦ.xlsx.");
      return;
    }
    const spec = frameToSpec(specFile.rows);
    const ker = frameToKer(kerFile.rows);
    const tmc = frameToTmc(tmcFile.rows);
    const missing: string[] = [];
    if (spec.missing.length) missing.push(`Спецификация: нет колонок ${spec.missing.join(", ")}`);
    if (ker.missing.length) missing.push(`База КЕР: нет колонок ${ker.missing.join(", ")}`);
    if (tmc.missing.length) missing.push(`База ТМЦ: нет колонок ${tmc.missing.join(", ")}`);
    if (missing.length) {
      setAlert("Проверьте структуру файлов. " + missing.join(" · "));
      return;
    }

    setProcessing(true);
    setResult(null);
    setProgress({ p: 0, stage: "Подготовка…" });
    try {
      const res = await buildVor(spec.data, ker.data, tmc.data, {
        l2,
        l3,
        onProgress: (p, stage) => setProgress({ p, stage }),
      });
      setResult(res);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch (e) {
      setAlert(`Ошибка обработки: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProcessing(false);
    }
  }, [specFile, kerFile, tmcFile, l2, l3]);

  const loadDemo = useCallback(() => {
    const demo = getDemoFiles();
    setSpecFile(demo[0].file);
    setKerFile(demo[1].file);
    setTmcFile(demo[2].file);
    setSpecErr(null);
    setKerErr(null);
    setTmcErr(null);
    setAlert(null);
  }, []);

  const stampCell = useMemo(
    () =>
      [
        ["ШИФР", "ВОР-2.8.3"],
        ["СТАДИЯ", "П"],
        ["ЛИСТ", "01"],
      ] as const,
    []
  );

  return (
    <div className="min-h-screen">
      {/* ================= TITLE BLOCK (чертёжный штамп) ================= */}
      <header className="border-b-[3px] border-brass-500 bg-ink-900 text-paper-50">
        <div className="mx-auto flex max-w-[1460px] flex-wrap items-stretch gap-x-8 gap-y-3 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-brass-500 bg-ink-950">
              <IconStamp className="h-6 w-6 text-brass-500" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-[19px] font-bold uppercase leading-tight tracking-wide sm:text-[22px]">
                Генератор <span className="text-brass-500">ВОР</span>
              </h1>
              <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-300">
                Ведомость объёмов работ · привязка КЕР/ТМЦ · тройная детализация
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-stretch gap-0 self-center border border-ink-600">
            {stampCell.map(([k, v]) => (
              <div key={k} className="border-r border-ink-600 px-3.5 py-1.5 text-center">
                <div className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-ink-300">{k}</div>
                <div className="font-mono text-[12.5px] font-bold text-paper-50">{v}</div>
              </div>
            ))}
            <div className="border-r border-ink-600 px-3.5 py-1.5 text-center">
              <div className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-ink-300">Дата</div>
              <div className="font-mono text-[12.5px] font-bold tabular-nums text-paper-50">
                {now.toLocaleDateString("ru-RU")}{" "}
                <span className="text-brass-500">{now.toLocaleTimeString("ru-RU")}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3.5">
              <span className={`led h-2.5 w-2.5 rounded-full ${STATUS_META[status].cls.split(" ")[0]}`} />
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-200">
                {STATUS_META[status].label}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1460px] flex-col lg:flex-row">
        {/* ================= SIDEBAR ================= */}
        <aside className="ink-hatch shrink-0 border-b-2 border-brass-500/70 text-ink-100 lg:sticky lg:top-0 lg:h-screen lg:w-[360px] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:border-ink-700 slim-scroll">
          <div className="flex flex-col gap-5 p-5">
            {/* 01 файлы */}
            <div>
              <SectionTitle code="01" title="Исходные данные" />
              <div className="space-y-2.5">
                <FileDrop
                  label="Спецификация.xlsx"
                  hint="Файл · Лист · Система · Этаж · Наименование · Артикул · Производитель · ЕИ · Кол-во · Масса · Примечания · Строка"
                  preferSheets={["Спецификация"]}
                  file={specFile}
                  error={specErr}
                  onLoaded={(f) => setSpecFile(f)}
                  onError={setSpecErr}
                />
                <FileDrop
                  label="База КЕР.xlsx"
                  hint="ИД_КЕР · Наименование_КЕР · ЕдИзм КЕР · Иерархия · Л1–Л5 Код/Наименование · ФЕР"
                  preferSheets={["Выгрузка"]}
                  file={kerFile}
                  error={kerErr}
                  onLoaded={(f) => setKerFile(f)}
                  onError={setKerErr}
                />
                <FileDrop
                  label="База ТМЦ.xlsx"
                  hint="ИД ТМЦ фск · Наименование ТМЦ фск · ЕдИзм ТМЦ · КСР код Группы · Бренд · ФСБЦ"
                  preferSheets={["ТМЦ"]}
                  file={tmcFile}
                  error={tmcErr}
                  onLoaded={(f) => setTmcFile(f)}
                  onError={setTmcErr}
                />
              </div>
              <button
                onClick={loadDemo}
                className="mt-2.5 w-full border border-dashed border-ink-600 px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300 transition-colors hover:border-brass-500 hover:text-brass-400"
              >
                Загрузить демо-набор · 67 строк
              </button>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 bg-ink-800">
                  <div
                    className="h-full bg-brass-500 transition-all duration-500"
                    style={{ width: `${(filesLoaded / 3) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-[10.5px] text-ink-300">{filesLoaded}/3</span>
              </div>
            </div>

            {/* 02 навигатор */}
            <div>
              <SectionTitle code="02" title="Навигатор КЕР" />
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-300">
                    <IconCompass className="h-3.5 w-3.5 text-brass-500" /> Л2 Код
                  </span>
                  <input
                    value={l2}
                    onChange={(e) => setL2(e.target.value)}
                    placeholder="2.8"
                    className="w-full border border-ink-600 bg-ink-950/70 px-3 py-2 font-mono text-[13px] font-semibold text-brass-400 outline-none transition-colors placeholder:text-ink-600 focus:border-brass-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-300">
                    Л3 Код
                  </span>
                  <input
                    value={l3}
                    onChange={(e) => setL3(e.target.value)}
                    placeholder="2.8.3"
                    className="w-full border border-ink-600 bg-ink-950/70 px-3 py-2 font-mono text-[13px] font-semibold text-brass-400 outline-none transition-colors placeholder:text-ink-600 focus:border-brass-500"
                  />
                </label>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-300">
                2.8 — Внутренние инженерные сети · 2.8.3 — Устройство системы вентиляции.
                Пустые поля → значения по умолчанию.
              </p>
            </div>

            {/* 03 запуск */}
            <div>
              <SectionTitle code="03" title="Запуск" />
              <button
                onClick={run}
                disabled={processing || !ready}
                className={`group relative w-full overflow-hidden px-4 py-3.5 font-display text-[13px] font-bold uppercase tracking-[0.14em] transition-all duration-200 ${
                  processing
                    ? "cursor-wait bg-ink-700 text-ink-300"
                    : ready
                    ? "bg-brass-500 text-ink-950 shadow-[0_4px_0_rgba(209,143,10,1)] hover:-translate-y-0.5 hover:bg-brass-400 hover:shadow-[0_6px_0_rgba(209,143,10,1)] active:translate-y-0.5 active:shadow-none"
                    : "cursor-not-allowed bg-ink-800 text-ink-400"
                }`}
              >
                {processing ? (
                  <span className="inline-flex items-center gap-2.5">
                    <IconGear className="h-4 w-4 animate-spin" /> Обработка…
                  </span>
                ) : (
                  "Сформировать ВОР"
                )}
              </button>

              {(processing || progress.p > 0) && (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-300">
                      {progress.stage}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-brass-400">
                      {Math.round(progress.p * 100)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 border border-ink-600 bg-ink-950">
                    <div
                      className={`h-full bg-brass-500 transition-[width] duration-200 ${processing ? "stripes" : ""}`}
                      style={{ width: `${progress.p * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {alert && (
                <div className="mt-3 flex items-start gap-2 border border-rust-500/60 bg-rust-500/10 px-3 py-2.5 text-[11.5px] leading-snug text-[#f2b8b6]">
                  <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-rust-500" />
                  {alert}
                </div>
              )}
              {result && !processing && (
                <div className="mt-3 flex items-start gap-2 border border-moss-500/50 bg-moss-500/10 px-3 py-2.5 text-[11.5px] leading-snug text-[#a9d9bf]">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-moss-500" />
                  ВОР сформирован: {result.stats.vorTotal.toLocaleString("ru-RU")} строк. Файлы — в
                  блоке результата.
                </div>
              )}
            </div>

            <Instruction />

            <div className="mt-auto border-t border-ink-700 pt-4">
              <p className="font-mono text-[10px] leading-relaxed text-ink-400">
                Расчёт выполняется локально в браузере — файлы не покидают компьютер.
                Веб-версия идентична Streamlit-приложению (раздел «Python-версия» ниже).
              </p>
            </div>
          </div>
        </aside>

        {/* ================= MAIN ================= */}
        <main className="blueprint-paper relative min-w-0 flex-1">
          <div
            aria-hidden
            className="pointer-events-none absolute right-4 top-6 select-none font-display text-[120px] font-extrabold uppercase leading-none text-blueprint-600/[0.05] sm:text-[180px]"
          >
            ВОР
          </div>

          <div className="relative space-y-8 p-5 sm:p-8">
            {!result && !processing && (
              <>
                <Pipeline />
                <RulesReference />
                <TmcAlgo />
                <FormatCard />
              </>
            )}

            <div ref={resultRef}>
              {result && <Results res={result} />}
            </div>

            <div className="space-y-4">
              <SectionTitle code="ПР" title="Python-версия для Colab / сервера" light />
              <PythonPanel />
            </div>
          </div>

          <footer className="relative border-t border-ink-900/15 bg-paper-200/80 px-5 py-4 sm:px-8">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-400">
              <span>ГОСТ 2.104 · форма титульного блока</span>
              <span className="hidden sm:inline">11 колонок · листы ВОР/Статистика/Не найдено</span>
              <span className="ml-auto">СМЕТНЫЙ ОТДЕЛ · {now.getFullYear()}</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
