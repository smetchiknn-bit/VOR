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
