import { useEffect, useMemo, useRef, useState } from "react";
import { APP_PY, README_MD, REQUIREMENTS_TXT } from "../lib/streamlit";
import { textBlob } from "../lib/excelIo";
import { IconCheck, IconDownload, IconTerminal } from "./ui";

type FileKey = "app" | "req" | "readme";

const FILES: Record<FileKey, { name: string; text: string; mime: string }> = {
  app: { name: "app.py", text: APP_PY, mime: "text/x-python;charset=utf-8" },
  req: { name: "requirements.txt", text: REQUIREMENTS_TXT, mime: "text/plain;charset=utf-8" },
  readme: { name: "README.md", text: README_MD, mime: "text/markdown;charset=utf-8" },
};

/**
 * Кнопка «Python-версия · Streamlit» с контекстным меню:
 * описание и скачивание набора файлов (app.py, requirements.txt, README.md).
 */
export function PythonMenuButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<FileKey | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // прямые ссылки на blob — скачивание одним пользовательским кликом
  const urls = useMemo(
    () => ({
      app: URL.createObjectURL(textBlob(FILES.app.text, FILES.app.mime)),
      req: URL.createObjectURL(textBlob(FILES.req.text, FILES.req.mime)),
      readme: URL.createObjectURL(textBlob(FILES.readme.text, FILES.readme.mime)),
    }),
    []
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copy = async (k: FileKey) => {
    try {
      await navigator.clipboard.writeText(FILES[k].text);
      setCopied(k);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* клипборд недоступен */
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 border px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] transition-all ${
          open
            ? "border-ink-900 bg-ink-900 text-brass-400 shadow-[0_6px_18px_rgba(14,24,35,0.25)]"
            : "border-ink-900/40 bg-paper-50 text-ink-800 hover:-translate-y-0.5 hover:border-ink-900 hover:shadow-[0_4px_14px_rgba(14,24,35,0.12)]"
        }`}
      >
        <IconTerminal className="h-4 w-4 text-brass-600" />
        Python-версия · Streamlit
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-40 mb-2 w-[320px] border-2 border-ink-900 bg-white shadow-[0_18px_44px_rgba(14,24,35,0.28)]">
          <div className="border-b-2 border-ink-900 bg-ink-900 px-4 py-2.5">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-brass-500">
              контекстное меню
            </div>
            <p className="mt-1 text-[12px] leading-snug text-ink-100">
              Полная Streamlit-реализация этого же алгоритма — скачивается одним набором
              файлов.
            </p>
          </div>
          <ul className="divide-y divide-ink-900/8">
            {(Object.keys(FILES) as FileKey[]).map((k) => (
              <li key={k} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[12px] font-bold text-ink-800">
                    {FILES[k].name}
                  </span>
                  <span className="block font-mono text-[9.5px] uppercase tracking-wider text-ink-400">
                    {FILES[k].text.split("\n").length} строк
                  </span>
                </span>
                <button
                  onClick={() => copy(k)}
                  className={`border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    copied === k
                      ? "border-moss-500 text-moss-600"
                      : "border-ink-900/25 text-ink-400 hover:border-ink-900 hover:text-ink-800"
                  }`}
                  title="Скопировать содержимое"
                >
                  {copied === k ? <IconCheck className="h-3.5 w-3.5" /> : "код"}
                </button>
                <a
                  href={urls[k]}
                  download={FILES[k].name}
                  className="inline-flex items-center gap-1 border border-ink-900/25 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-800 transition-colors hover:border-brass-600 hover:bg-brass-100/60 hover:text-[#8a6206]"
                >
                  <IconDownload className="h-3.5 w-3.5" /> скачать
                </a>
              </li>
            ))}
          </ul>
          <div className="border-t border-ink-900/10 bg-paper-100 px-4 py-2 font-mono text-[10px] text-ink-400">
            $ pip install -r requirements.txt && streamlit run app.py
          </div>
        </div>
      )}
    </div>
--- src/components/pythonPanel.tsx (原始)


+++ src/components/pythonPanel.tsx (修改后)
import { useState } from "react";
import { APP_PY, README_MD, REQUIREMENTS_TXT } from "../lib/streamlit";
import { downloadText } from "../lib/excelIo";
import { IconDownload, IconPython, IconTerminal, Reveal } from "./ui";

const FILES = [
  {
    name: "app.py",
    lang: "python",
    desc: "Всё приложение: UI, правила КЕР, скоринг ТМЦ, запись XLSX",
    content: APP_PY,
  },
  {
    name: "requirements.txt",
    lang: "text",
    desc: "Зависимости Python",
    content: REQUIREMENTS_TXT,
  },
  {
    name: "README.md",
    lang: "markdown",
    desc: "Инструкция по установке и запуску",
    content: README_MD,
  },
] as const;

export function PythonPanel() {
  const [active, setActive] = useState<number>(0);
  const file = FILES[active];
  const lines = file.content.split("\n").length;

  return (
    <Reveal>
      <section className="border border-ink-900/12 bg-white/70 backdrop-blur-[2px]">
        <div className="flex flex-wrap items-center gap-3 border-b-2 border-ink-900 px-6 py-4">
          <span className="flex h-9 w-9 items-center justify-center bg-ink-900 text-brass-500">
            <IconPython className="h-5 w-5" />
          </span>
          <div className="mr-auto">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink-900">
              Streamlit-версия · Python
            </h2>
            <p className="text-[12px] text-ink-400">
              Тот же алгоритм серверным приложением: <span className="font-mono">streamlit run app.py</span>.
              Промпт.txt встроен константой — загрузка не требуется.
            </p>
          </div>
          <div className="flex gap-2">
            {FILES.map((f) => (
              <button
                key={f.name}
                onClick={() => downloadText(f.content, f.name)}
                title={`Скачать ${f.name}`}
                className="inline-flex items-center gap-1.5 border border-ink-900/25 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-ink-700 transition-colors hover:border-ink-900 hover:bg-ink-900 hover:text-brass-400"
              >
                <IconDownload className="h-3.5 w-3.5" />
                {f.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-ink-900/12 bg-paper-200/70 px-4 pt-2">
          {FILES.map((f, i) => (
            <button
              key={f.name}
              onClick={() => setActive(i)}
              className={`-mb-px border border-b-0 px-3.5 py-1.5 font-mono text-[11.5px] font-semibold transition-colors ${
                i === active
                  ? "border-ink-900/20 bg-ink-900 text-brass-400"
                  : "border-transparent text-ink-400 hover:text-ink-800"
              }`}
            >
              {f.name}
            </button>
          ))}
          <span className="ml-auto hidden pb-1 font-mono text-[10.5px] uppercase tracking-wider text-ink-400 sm:block">
            {file.desc} · {lines} строк
          </span>
        </div>

        <div className="code-panel slim-scroll-light max-h-[460px] overflow-auto bg-ink-950 text-ink-200">
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-ink-100/10 bg-ink-950/95 px-5 py-2 backdrop-blur">
            <IconTerminal className="h-3.5 w-3.5 text-brass-500" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-300">
              $ pip install -r requirements.txt && streamlit run app.py
            </span>
          </div>
          <pre className="px-5 py-4">
            <code>{file.content}</code>
          </pre>
        </div>
      </section>
    </Reveal>
  );
}
