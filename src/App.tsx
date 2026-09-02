import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { loadExcel, vorBlob, csvBlob } from "./lib/excelIo";
import { hasCol, processVor, type VorResult, type LoadedFile } from "./lib/vor";
import { BUILTIN_PROMPT, type PromptState } from "./lib/prompt";
import { getDemoFiles } from "./lib/demo";
import { Results } from "./components/results";
import { Pipeline, RulesReference, TmcAlgo, FormatCard } from "./components/reference";
import { PythonPanel } from "./components/pythonPanel";
import {
  FileDrop,
  SectionTitle,
  IconAlert,
  IconCompass,
  IconStamp,
  IconCheck,
  IconGear,
  IconClose,
  IconFile,
  IconDownload,
} from "./components/ui";

const PROMPT_KEY = "vor_hidden_prompt_v1";

type Stage = "idle" | "run" | "done" | "error";
type FileKey = "spec" | "ker" | "tmc";

const FILE_META: Record<
  FileKey,
  { title: string; hint: string; need: string[]; label: string }
> = {
  spec: {
    title: "Спецификация.xlsx",
    label: "Спецификация",
    hint: "Файл, Лист, Система, Этаж, Наименование, Артикул, ЕИ, Кол-во, Строка…",
    need: ["наименование", "колво", "строка", "система"],
  },
  ker: {
    title: "База КЕР.xlsx",
    label: "База КЕР",
    hint: "ИД_КЕР, Наименование_КЕР, ЕдИзм КЕР, Л2 Код, Л3 Код, ФЕР…",
    need: ["идкер", "наименованиекер", "л2код", "л3код"],
  },
  tmc: {
    title: "База ТМЦ.xlsx",
    label: "База ТМЦ",
    hint: "ИД ТМЦ фск, Наименование ТМЦ фск, ЕдИзм ТМЦ…",
    need: ["идтмцфск", "наименованиетмцфск", "едизмтмц"],
  },
};

function loadPromptInitial(): PromptState {
  try {
    const raw = localStorage.getItem(PROMPT_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { text?: string; source?: string };
      if (p && typeof p.text === "string" && p.text.trim()) {
        return { text: p.text, custom: true, source: p.source || "заменён вручную" };
      }
    }
  } catch {
    /* повреждённое хранилище — используем встроенный */
  }
  return { text: BUILTIN_PROMPT, custom: false, source: "встроенная константа" };
}

/* ---------- ErrorBoundary: вместо пустого экрана — диагностика ---------- */

class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="blueprint-paper flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-xl border-2 border-rust-500 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <IconAlert className="h-7 w-7 text-rust-600" />
              <h1 className="font-display text-lg font-bold uppercase tracking-wide text-ink-900">
                Сбой отрисовки интерфейса
              </h1>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-400">
              Приложение перехватило ошибку — это не «пустой экран», а диагностическая
              карточка. Перезагрузите страницу; если ошибка повторяется, сообщите текст ниже.
            </p>
            <pre className="code-panel slim-scroll-light mt-3 max-h-40 overflow-auto border border-ink-900/15 bg-paper-100 p-3 text-[11px] text-rust-600">
              {String(this.state.err?.message ?? this.state.err)}
              {"\n"}
              {this.state.err?.stack ?? ""}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-ink-900 px-5 py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-brass-400 transition-colors hover:bg-ink-800"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------- служебная панель Промпт.txt ---------- */

function ServiceDrawer({
  open,
  onClose,
  current,
  onApply,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  current: PromptState;
  onApply: (text: string, source: string) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(current.text);
  const [source, setSource] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(current.text);
      setSource("");
    }
  }, [open, current.text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onFile = async (f: File | null) => {
    if (!f) return;
    const t = (await f.text()).replace(/^\uFEFF/, "");
    if (t.trim()) {
      setDraft(t);
      setSource(f.name);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink-950/75 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="ink-hatch absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l-2 border-brass-500/60 text-ink-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-paper-50/10 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-brass-500">
              <IconGear className="h-4 w-4" /> служебный доступ
            </div>
            <h3 className="mt-1 font-display text-lg font-bold uppercase tracking-wide text-paper-50">
              Промпт.txt
            </h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-300">
              Замена текста промпта. Действует в этом браузере и фиксируется на листе
              «Промпт» файла ВОР.xlsx. Для непосвящённых кнопки не существует.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 border border-paper-50/20 p-1.5 text-ink-300 transition-colors hover:border-rust-500 hover:text-rust-500"
            aria-label="Закрыть"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="slim-scroll flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-paper-50/12 bg-ink-850/70 px-3 py-2">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-400">
                сейчас действует
              </div>
              <div
                className={`mt-0.5 truncate font-mono text-[11.5px] font-bold ${
                  current.custom ? "text-brass-400" : "text-moss-500"
                }`}
              >
                {current.custom ? "заменён" : "встроенный"}
              </div>
            </div>
            <div className="border border-paper-50/12 bg-ink-850/70 px-3 py-2">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-400">
                источник
              </div>
              <div className="mt-0.5 truncate font-mono text-[11.5px] text-ink-200" title={current.source}>
                {current.source}
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 border border-dashed border-paper-50/25 px-3.5 py-3 transition-colors hover:border-brass-500 hover:bg-brass-500/5">
            <IconFile className="h-5 w-5 shrink-0 text-brass-500" />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-paper-50">
                Прикрепить файл Промпт.txt
              </span>
              <span className="block truncate font-mono text-[10.5px] text-ink-300">
                {source || "выберите .txt — BOM будет удалён автоматически"}
              </span>
            </span>
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                текст промпта
              </span>
              <span className="font-mono text-[10.5px] text-ink-300">
                {draft.length.toLocaleString("ru-RU")} симв.
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="slim-scroll h-64 w-full resize-y border border-paper-50/15 bg-ink-950 p-3 font-mono text-[11.5px] leading-relaxed text-ink-200 outline-none transition-colors focus:border-brass-500/70"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-paper-50/10 px-5 py-4">
          <button
            disabled={!draft.trim()}
            onClick={() => onApply(draft, source || "ручная правка")}
            className="flex-1 bg-brass-500 px-4 py-2.5 font-display text-[11.5px] font-bold uppercase tracking-[0.1em] text-ink-950 transition-all hover:bg-brass-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Применить
          </button>
          <button
            onClick={onReset}
            className="border border-paper-50/25 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-200 transition-colors hover:border-rust-500 hover:text-rust-500"
          >
            Встроенный
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ---------- приложение ---------- */

function AppInner() {
  const [files, setFiles] = useState<Record<FileKey, LoadedFile | null>>({
    spec: null,
    ker: null,
    tmc: null,
  });
  const [errors, setErrors] = useState<Record<FileKey, string | null>>({
    spec: null,
    ker: null,
    tmc: null,
  });
  const [l2, setL2] = useState("2.8");
  const [l3, setL3] = useState("2.8.3");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState({ p: 0, label: "" });
  const [result, setResult] = useState<VorResult | null>(null);
  const [downloads, setDownloads] = useState<{ xlsx: string; csv: string } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [clock, setClock] = useState(new Date());
  const [svcOpen, setSvcOpen] = useState(false);
  const [prompt, setPrompt] = useState<PromptState>(loadPromptInitial);

  const svcClicks = useRef<number[]>([]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const applyPrompt = (text: string, source: string) => {
    setPrompt({ text, custom: true, source });
    try {
      localStorage.setItem(PROMPT_KEY, JSON.stringify({ text, source }));
    } catch {
      /* приватный режим — работаем без сохранения */
    }
    setSvcOpen(false);
  };

  const resetPrompt = () => {
    setPrompt({ text: BUILTIN_PROMPT, custom: false, source: "встроенная константа" });
    try {
      localStorage.removeItem(PROMPT_KEY);
    } catch {
      /* ignore */
    }
  };

  // скрытый вход для посвящённых: 5 быстрых кликов по «ВОР» в шапке
  const onTitleSecret = () => {
    const now = Date.now();
    svcClicks.current = [...svcClicks.current.filter((t) => now - t < 1700), now];
    if (svcClicks.current.length >= 5) {
      svcClicks.current = [];
      setSvcOpen(true);
    }
  };

  const handleFile = async (key: FileKey, f: File) => {
    setErrors((e) => ({ ...e, [key]: null }));
    try {
      const lf = await loadExcel(f, key);
      const meta = FILE_META[key];
      const missing = meta.need.filter((norm) => !hasCol(lf.rows, norm));
      if (missing.length) {
        setErrors((e) => ({ ...e, [key]: `Нет колонок: ${missing.join(", ")}.` }));
        setFiles((s) => ({ ...s, [key]: null }));
        return;
      }
      setFiles((s) => ({ ...s, [key]: lf }));
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [key]: err instanceof Error ? err.message : "Не удалось прочитать файл .xlsx.",
      }));
    }
  };

  const loadDemo = () => {
    setErrors({ spec: null, ker: null, tmc: null });
    setFiles({ spec: null, ker: null, tmc: null });
    for (const d of getDemoFiles()) setFiles((s) => ({ ...s, [d.key]: d.file }));
  };

  const run = async () => {
    setRunError(null);
    const missing = (Object.keys(FILE_META) as FileKey[]).filter((k) => !files[k]);
    if (missing.length) {
      setStage("error");
      setRunError(
        `Не загружены обязательные файлы: ${missing.map((k) => FILE_META[k].label).join(", ")}.`
      );
      return;
    }
    setStage("run");
    setProgress({ p: 0.02, label: "Чтение исходных данных…" });
    setResult(null);
    await new Promise((r) => setTimeout(r, 80));
    try {
      const res = await processVor({
        spec: files.spec!,
        ker: files.ker!,
        tmc: files.tmc!,
        l2,
        l3,
        onProgress: (p, label) => setProgress({ p, label }),
      });
      setProgress({ p: 1, label: "Формирование файлов…" });
      const xlsxUrl = URL.createObjectURL(vorBlob(res, prompt));
      const csvUrl = URL.createObjectURL(csvBlob(res));
      setDownloads((old) => {
        if (old) {
          URL.revokeObjectURL(old.xlsx);
          URL.revokeObjectURL(old.csv);
        }
        return { xlsx: xlsxUrl, csv: csvUrl };
      });
      setResult(res);
      setStage("done");
      setTimeout(
        () =>
          document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        80
      );
    } catch (err) {
      setStage("error");
      setRunError(
        err instanceof Error ? err.message : "Непредвиденная ошибка обработки данных."
      );
    }
  };

  const ready = !!(files.spec && files.ker && files.tmc);
  const ledColor =
    stage === "run"
      ? "bg-brass-500 text-brass-500"
      : stage === "done"
        ? "bg-moss-500 text-moss-500"
        : stage === "error"
          ? "bg-rust-500 text-rust-500"
          : "bg-ink-400 text-ink-400";
  const ledLabel =
    stage === "run"
      ? "Обработка"
      : stage === "done"
        ? "Готово"
        : stage === "error"
          ? "Ошибка"
          : "Ожидание";

  return (
    <div className="min-h-screen">
      <ServiceDrawer
        open={svcOpen}
        onClose={() => setSvcOpen(false)}
        current={prompt}
        onApply={applyPrompt}
        onReset={resetPrompt}
      />

      <div className="mx-auto flex w-full max-w-[1560px] flex-col lg:flex-row">
        {/* ======= САЙДБАР: исходные данные ======= */}
        <aside className="ink-hatch lg:sticky lg:top-0 lg:h-screen lg:w-[400px] lg:shrink-0 lg:overflow-y-auto slim-scroll">
          <div className="px-6 py-6">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-brass-500">
              <IconStamp className="h-4 w-4" /> вос · форма 01-ВОР
            </div>
            <h1 className="mt-2 font-display text-[26px] font-bold leading-tight text-paper-50">
              Исходные
              <br />
              данные
            </h1>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-300">
              Три файла — обязательные. Файл Промпт.txt встроен в приложение и читается
              автоматически, кнопка загрузки не предусмотрена.
            </p>

            <div className="mt-6 space-y-3">
              {(Object.keys(FILE_META) as FileKey[]).map((k) => (
                <FileDrop
                  key={k}
                  title={FILE_META[k].title}
                  hint={FILE_META[k].hint}
                  loaded={
                    files[k]
                      ? { name: files[k]!.name, rows: files[k]!.rows.length, sheet: files[k]!.sheet }
                      : null
                  }
                  error={errors[k]}
                  onFile={(f) => handleFile(k, f)}
                />
              ))}
            </div>

            <div className="mt-7">
              <div className="flex items-center gap-2.5">
                <IconCompass className="h-5 w-5 text-brass-500" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-50">
                  Навигатор КЕР
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-300">
                    Л2 Код
                  </span>
                  <input
                    value={l2}
                    onChange={(e) => setL2(e.target.value)}
                    placeholder="2.8"
                    className="mt-1 w-full border border-paper-50/20 bg-ink-850 px-3 py-2 font-mono text-[14px] text-paper-50 outline-none transition-colors placeholder:text-ink-400 focus:border-brass-500"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-300">
                    Л3 Код
                  </span>
                  <input
                    value={l3}
                    onChange={(e) => setL3(e.target.value)}
                    placeholder="2.8.3"
                    className="mt-1 w-full border border-paper-50/20 bg-ink-850 px-3 py-2 font-mono text-[14px] text-paper-50 outline-none transition-colors placeholder:text-ink-400 focus:border-brass-500"
                  />
                </label>
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
                Пустые поля = значения по умолчанию 2.8 / 2.8.3. База КЕР фильтруется по
                введённым кодам иерархии.
              </p>
            </div>

            <div className="mt-7 space-y-2.5">
              <button
                onClick={run}
                disabled={stage === "run"}
                className={`w-full px-4 py-3.5 font-display text-[13px] font-bold uppercase tracking-[0.08em] transition-all ${
                  stage === "run"
                    ? "cursor-wait bg-ink-700 text-ink-300"
                    : "bg-brass-500 text-ink-950 hover:-translate-y-0.5 hover:bg-brass-400 hover:shadow-[0_8px_24px_rgba(240,168,28,0.3)] active:translate-y-0"
                }`}
              >
                {stage === "run" ? "Обработка…" : "Сформировать ВОР"}
              </button>

              {stage === "run" && (
                <div className="border border-paper-50/12 bg-ink-850 px-3.5 py-3">
                  <div className="flex justify-between font-mono text-[10.5px] uppercase tracking-wider text-ink-300">
                    <span className="truncate">{progress.label}</span>
                    <span className="ml-2 shrink-0 text-brass-400">
                      {Math.round(progress.p * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full bg-ink-700">
                    <div
                      className="stripes h-full bg-brass-500 transition-[width] duration-200"
                      style={{ width: `${progress.p * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {stage === "error" && runError && (
                <div className="flex items-start gap-2.5 border border-rust-500/60 bg-rust-500/10 px-3.5 py-3 text-[12px] leading-snug text-rust-500">
                  <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {runError}
                </div>
              )}

              {stage === "done" && result && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 border border-moss-500/50 bg-moss-500/10 px-3.5 py-3 text-[12px] leading-snug text-moss-500">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    ВОР готов: {result.stats.vorTotal.toLocaleString("ru-RU")} строк · КЕР —{" "}
                    {result.stats.kerFound} · ТМЦ — {result.stats.tmcFound} · «Не найдено» —{" "}
                    {result.stats.notFoundRows}.
                  </div>
                  {downloads && (
                    <div className="border border-brass-500/40 bg-ink-850 p-3">
                      <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-brass-500">
                        Скачать результат
                      </div>
                      <div className="grid gap-2">
                        <a
                          href={downloads.xlsx}
                          download="ВОР.xlsx"
                          className="flex items-center justify-center gap-2 bg-brass-500 px-3 py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.08em] text-ink-950 transition-colors hover:bg-brass-400"
                        >
                          <IconDownload className="h-4 w-4" /> ВОР.xlsx
                        </a>
                        <a
                          href={downloads.csv}
                          download="ВОР_с_ТА.csv"
                          className="flex items-center justify-center gap-2 border border-paper-50/25 px-3 py-2 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ink-100 transition-colors hover:border-brass-500 hover:text-brass-400"
                        >
                          <IconDownload className="h-3.5 w-3.5" /> ВОР_с_ТА.csv
                        </a>
                        <p className="text-[10px] leading-snug text-ink-400">
                          Если скачивание не началось — правый клик по ссылке → «Сохранить
                          как…», либо откройте результат ниже.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  onClick={loadDemo}
                  className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-300 underline decoration-ink-600 underline-offset-4 transition-colors hover:text-brass-400"
                >
                  Загрузить демо-данные
                </button>
                <span className="font-mono text-[10px] text-ink-400">
                  {ready
                    ? "3 / 3 файла"
                    : "файлов: " + Object.values(files).filter(Boolean).length + " / 3"}
                </span>
              </div>
            </div>

            <div className="mt-8 border-t border-paper-50/10 pt-4 text-[11px] leading-relaxed text-ink-300">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-500">
                Инструкция
              </div>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Загрузите Спецификацию, Базу КЕР и Базу ТМЦ.</li>
                <li>Уточните коды навигатора (Л2 / Л3) или оставьте по умолчанию.</li>
                <li>Нажмите «Сформировать ВОР» и скачайте файл — ссылки появятся здесь и
                  под результатами.</li>
                <li>Строки без «Кол-ва» сохраняются как заголовки — иерархия не теряется.</li>
              </ol>
              <p className="mt-3 border-l-2 border-brass-500/50 pl-2.5 text-[10.5px] text-ink-400">
                Файл Промпт.txt встроен в код как константа и подставляется автоматически.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-paper-50/10 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-50/40">
              <span className="flex items-center gap-2">
                ВОС · 2026
                {prompt.custom && (
                  <span className="h-1.5 w-1.5 bg-brass-500" title="Промпт заменён" />
                )}
              </span>
              <a href="#python" className="transition-colors hover:text-brass-500">
                app.py ↓
              </a>
            </div>

            {/* скрытая служебная кнопка — почти невидима, проявляется при наведении */}
            <div className="mt-1 flex justify-center">
              <button
                onClick={() => setSvcOpen(true)}
                className="px-3 text-[10px] leading-none text-paper-50 opacity-[0.05] transition-opacity duration-300 hover:opacity-60"
                tabIndex={-1}
                aria-hidden
              >
                · · ·
              </button>
            </div>
          </div>
        </aside>

        {/* ======= ОСНОВНАЯ ОБЛАСТЬ ======= */}
        <main className="blueprint-paper min-w-0 flex-1">
          <header className="border-b-2 border-ink-900/80">
            <div className="flex flex-wrap items-stretch">
              <div className="flex min-w-[280px] flex-1 flex-col justify-center gap-1 border-r border-ink-900/15 px-6 py-5 sm:px-9">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-blueprint-600">
                  СМЕТНЫЙ ОТДЕЛ · ПИД «ВОС»
                </div>
                <h1 className="font-display text-[clamp(28px,4.5vw,54px)] font-black uppercase leading-[0.95] tracking-tight text-ink-900">
                  <span
                    className="cursor-default select-none transition-colors hover:text-blueprint-700"
                    onClick={onTitleSecret}
                    title="Генератор ВОР"
                  >
                    ВОР
                  </span>
                  <span className="text-brass-600">·</span>ГЕН
                </h1>
                <p className="max-w-xl text-[13px] leading-relaxed text-ink-400">
                  Автоматическое формирование ведомости объёмов работ: привязка кодов КЕР и
                  ТМЦ к спецификации, тройная детализация, трассировка по колонке «Строка»,
                  экспорт в ВОР.xlsx.
                </p>
              </div>
              <div className="hidden grid-cols-2 md:grid">
                {[
                  ["Объект", "ЖК «Северный»"],
                  ["Раздел", "ОВ · вентиляция"],
                  ["Стадия", "Р / С"],
                  ["Лист", "01"],
                ].map(([k, v], i) => (
                  <div
                    key={k}
                    className={`flex min-w-[130px] flex-col justify-center border-b border-r border-ink-900/15 px-5 py-2 ${
                      i % 2 === 1 ? "border-r-0" : ""
                    } ${i >= 2 ? "border-b-0" : ""}`}
                  >
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-400">
                      {k}
                    </span>
                    <span className="font-mono text-[12.5px] font-semibold text-ink-800">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 border-l border-ink-900/15 px-6 py-5 lg:border-l-0">
                <span className={`led h-2.5 w-2.5 rounded-full ${ledColor}`} />
                <div>
                  <div className="font-mono text-[12px] font-bold uppercase tracking-widest text-ink-800">
                    {ledLabel}
                  </div>
                  <div className="font-mono text-[10.5px] text-ink-400">
                    {clock.toLocaleDateString("ru-RU")} {clock.toLocaleTimeString("ru-RU")}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-16 px-6 py-10 sm:px-9 sm:py-14">
            <section>
              <SectionTitle kicker="01 · технология" title="Как формируется ведомость" />
              <Pipeline />
            </section>

            <section>
              <SectionTitle kicker="02 · расценки" title="Подбор Код КЕР">
                <span className="hidden max-w-xs border-l-2 border-brass-500 pl-3 text-[11.5px] leading-snug text-ink-400 sm:block">
                  Правила применяются к «Наименованию» спецификации после фильтрации базы по
                  навигатору Л2 / Л3.
                </span>
              </SectionTitle>
              <RulesReference />
            </section>

            <section>
              <SectionTitle kicker="03 · материалы" title="Подбор Код ТМЦ" />
              <TmcAlgo />
            </section>

            <section>
              <SectionTitle kicker="04 · выдача" title="Формат ВОР.xlsx" />
              <FormatCard />
            </section>

            <section>
              <SectionTitle kicker="05 · результат" title="Ведомость объёмов работ">
                {!result && (
                  <span className="border border-dashed border-ink-400/50 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-400">
                    ожидает запуска — {ready ? "файлы готовы" : "загрузите файлы слева"}
                  </span>
                )}
              </SectionTitle>
              {result ? (
                <Results
                  res={result}
                  xlsxUrl={downloads?.xlsx ?? null}
                  csvUrl={downloads?.csv ?? null}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 border-2 border-dashed border-ink-900/20 bg-white/40 px-6 py-14 text-center">
                  <IconStamp className="h-9 w-9 text-ink-300" />
                  <p className="max-w-md text-[13px] leading-relaxed text-ink-400">
                    Здесь появится тройная детализация: каждая позиция спецификации
                    раскроется строками «Спецификация» → «КЕР» → «ТМЦ» со штампом и
                    статистикой.
                  </p>
                </div>
              )}
            </section>

            <section id="python">
              <SectionTitle kicker="06 · streamlit" title="Python-версия app.py">
                <span className="hidden max-w-xs border-l-2 border-brass-500 pl-3 text-[11.5px] leading-snug text-ink-400 sm:block">
                  Полная Streamlit-реализация того же алгоритма — скачивается одним набором
                  файлов и запускается локально.
                </span>
              </SectionTitle>
              <PythonPanel />
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink-900 pt-5 pb-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-ink-400">
                ВОС · генератор ВОР · {clock.getFullYear()}
              </span>
              <span className="font-mono text-[10.5px] text-ink-400">
                ВОР.xlsx · ВОР_с_ТА.csv · app.py · requirements.txt · README.md
              </span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
