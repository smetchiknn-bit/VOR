import { useMemo, useState } from "react";
import { APP_PY, README_MD, REQUIREMENTS_TXT } from "../lib/streamlit";
import { textBlob } from "../lib/excelIo";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconTerminal,
  Reveal,
} from "./ui";

type FileKey = "app" | "req" | "readme";

const FILES: Record<FileKey, { name: string; text: string; mime: string; lines: number }> = {
  app: { name: "app.py", text: APP_PY, mime: "text/x-python;charset=utf-8", lines: APP_PY.split("\n").length },
  req: {
    name: "requirements.txt",
    text: REQUIREMENTS_TXT,
    mime: "text/plain;charset=utf-8",
    lines: REQUIREMENTS_TXT.split("\n").length,
  },
  readme: { name: "README.md", text: README_MD, mime: "text/markdown;charset=utf-8", lines: README_MD.split("\n").length },
};

export function PythonPanel() {
  const [active, setActive] = useState<FileKey>("app");
  const [copied, setCopied] = useState(false);

  // прямые ссылки на blob — скачивание одним пользовательским кликом
  const urls = useMemo(
    () => ({
      app: URL.createObjectURL(textBlob(FILES.app.text, FILES.app.mime)),
      req: URL.createObjectURL(textBlob(FILES.req.text, FILES.req.mime)),
      readme: URL.createObjectURL(textBlob(FILES.readme.text, FILES.readme.mime)),
    }),
    []
  );

  const f = FILES[active];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(f.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* клипборд недоступен */
    }
  };

  return (
    <Reveal>
      <div className="border-2 border-ink-900 bg-ink-900 text-ink-100">
        <div className="flex flex-wrap items-center gap-3 border-b border-paper-50/10 px-5 py-3.5">
          <IconTerminal className="h-5 w-5 text-brass-500" />
          <div className="mr-auto">
            <div className="font-display text-[15px] font-bold uppercase tracking-wide text-paper-50">
              Python-версия · Streamlit
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-300">
              app.py + requirements.txt + README.md · запуск: streamlit run app.py
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FILES) as FileKey[]).map((k) => (
              <a
                key={k}
                href={urls[k]}
                download={FILES[k].name}
                className="inline-flex items-center gap-1.5 border border-paper-50/20 px-3 py-1.5 font-mono text-[11px] font-semibold text-ink-100 transition-all hover:-translate-y-0.5 hover:border-brass-500 hover:text-brass-400"
              >
                <IconDownload className="h-3.5 w-3.5" />
                {FILES[k].name}
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="flex shrink-0 flex-row gap-1 border-b border-paper-50/10 p-3 lg:w-52 lg:flex-col lg:border-b-0 lg:border-r">
            {(Object.keys(FILES) as FileKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setActive(k)}
                className={`px-3 py-2 text-left font-mono text-[12px] transition-colors ${
                  active === k
                    ? "bg-brass-500 font-bold text-ink-950"
                    : "text-ink-300 hover:bg-paper-50/5 hover:text-paper-50"
                }`}
              >
                {FILES[k].name}
                <span
                  className={`ml-2 text-[10px] ${active === k ? "text-ink-800" : "text-ink-400"}`}
                >
                  {FILES[k].lines} стр.
                </span>
              </button>
            ))}
            <div className="mt-auto hidden px-3 py-2 text-[10.5px] leading-relaxed text-ink-400 lg:block">
              Промпт.txt встроен константой; файл рядом с app.py подхватывается автоматически,
              скрытая кнопка «· · ·» в сайдбаре — замена для сессии.
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 border-b border-paper-50/10 bg-ink-950/60 px-4 py-2">
              <span className="truncate font-mono text-[11px] text-ink-300">
                $ pip install -r requirements.txt && streamlit run app.py
              </span>
              <button
                onClick={copy}
                className={`inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider transition-colors ${
                  copied
                    ? "border-moss-500 text-moss-500"
                    : "border-paper-50/20 text-ink-200 hover:border-brass-500 hover:text-brass-400"
                }`}
              >
                {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
                {copied ? "Готово" : "Копировать"}
              </button>
            </div>
            <pre className="code-panel slim-scroll max-h-[430px] overflow-auto whitespace-pre p-4 text-ink-200">
              {f.text}
            </pre>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
