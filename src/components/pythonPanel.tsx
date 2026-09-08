import { useEffect, useRef, useState } from "react";
import { APP_PY, README_MD, REQUIREMENTS_TXT } from "../lib/streamlit";
import { textBlob } from "../lib/excelIo";
import { IconDownload, IconCopy, IconCheck, IconTerminal } from "./ui";

type FileKey = "app" | "req" | "readme";

const FILES: Record<FileKey, { name: string; text: string; mime: string; lines: number }> = {
  app: { name: "app.py", text: APP_PY, mime: "text/x-python;charset=utf-8", lines: APP_PY.split("\n").length },
  req: { name: "requirements.txt", text: REQUIREMENTS_TXT, mime: "text/plain;charset=utf-8", lines: REQUIREMENTS_TXT.split("\n").length },
  readme: { name: "README.md", text: README_MD, mime: "text/markdown;charset=utf-8", lines: README_MD.split("\n").length },
};

export function PythonMenuButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", onClick);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const urls = {
    app: URL.createObjectURL(textBlob(FILES.app.text, FILES.app.mime)),
    req: URL.createObjectURL(textBlob(FILES.req.text, FILES.req.mime)),
    readme: URL.createObjectURL(textBlob(FILES.readme.text, FILES.readme.mime)),
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 border border-ink-900/30 px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-800 transition-colors hover:border-brass-600 hover:bg-brass-100/50 hover:text-brass-600"
      >
        <IconTerminal className="h-3.5 w-3.5" />
        Python-версия · Streamlit
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-80 border-2 border-ink-900 bg-ink-900 p-4 text-ink-100 shadow-2xl">
          <div className="mb-3 border-b border-paper-50/10 pb-3">
            <div className="font-display text-[13px] font-bold uppercase tracking-wide text-paper-50">
              Python-версия · Streamlit
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-300">
              Полная Streamlit-реализация этого же алгоритма — скачивается одним набором файлов.
            </p>
          </div>
          <div className="space-y-1.5">
            {(Object.keys(FILES) as FileKey[]).map((k) => (
              <a
                key={k}
                href={urls[k]}
                download={FILES[k].name}
                className="flex items-center justify-between gap-2 border border-paper-50/15 px-3 py-2 transition-colors hover:border-brass-500 hover:bg-brass-500/10"
              >
                <span className="font-mono text-[11.5px] font-semibold text-ink-100">
                  {FILES[k].name}
                </span>
                <IconDownload className="h-3.5 w-3.5 text-brass-500" />
              </a>
            ))}
          </div>
          <div className="mt-3 border-t border-paper-50/10 pt-3">
            <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-400">
              Запуск
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 border border-paper-50/15 bg-ink-950 px-2.5 py-1.5">
              <code className="truncate font-mono text-[10.5px] text-ink-200">
                streamlit run app.py
              </code>
              <CopyButton text="streamlit run app.py" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  return (
    <button onClick={copy} className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider transition-colors ${copied ? "border-moss-500 text-moss-500" : "border-paper-50/20 text-ink-300 hover:border-brass-500 hover:text-brass-400"}`}>
      {copied ? <IconCheck className="h-3 w-3" /> : <IconCopy className="h-3 w-3" />}
    </button>
  );
}
