import { useEffect, useRef, useState } from "react";
import type { ReactNode, DragEvent } from "react";
import type { LoadedFile } from "../lib/excelIo";
import { parseUpload } from "../lib/excelIo";
import type { TaKind } from "../lib/vor";

// ---------- inline SVG icons ----------

type IconProps = { className?: string };

export const IconSheet = ({ className = "w-4 h-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
    <path d="M14 3v5h5M8 13h8M8 17h8M8 13v4M12 13v4M16 13v4" />
  </svg>
);

export const IconCheck = ({ className = "w-4 h-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className}>
    <path d="M4 12.5 9.5 18 20 6.5" />
  </svg>
);

export const IconAlert = ({ className = "w-4 h-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 3 2.5 20h19zM12 9.5V14M12 16.8v.4" />
  </svg>
);

export const IconDownload = ({ className = "w-4 h-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
    <path d="M12 3v11m0 0 4.5-4.5M12 14 7.5 9.5M4 17v3h16v-3" />
  </svg>
);

export const IconGear = ({ className = "w-4 h-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" />
  </svg>
);

export const IconTerminal = ({ className = "w-4 h-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="m7 9 3 3-3 3M12.5 15.5H17" />
  </svg>
);

export const IconCompass = ({ className = "w-4 h-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </svg>
);

export const IconPython = ({ className = "w-4 h-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.9 2c-2.4 0-3.9 1-3.9 2.9v2h4v.9H5.6C3.6 7.8 2 9.5 2 12s1.6 4.2 3.6 4.2h2.1v-2.4c0-1.9 1.5-3.3 3.4-3.3h4.5c1.6 0 2.9-1.3 2.9-2.9V5c0-1.9-1.5-3-3.6-3h-3zM9.4 4.1c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zM20.3 7.8h-2.1v2.4c0 1.9-1.5 3.3-3.4 3.3h-4.5c-1.6 0-2.9 1.3-2.9 2.9V19c0 1.9 1.5 3 3.6 3h3c2.4 0 3.9-1 3.9-2.9v-2h-4v-.9h6.4c2 0 3.6-1.7 3.6-4.2s-1.6-4.2-3.6-4.2zm-5.7 11.2c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z" />
  </svg>
);

export const IconStamp = ({ className = "w-4 h-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <path d="M9 10.5c.8-1.2 1-3.3 1-5a2 2 0 1 1 4 0c0 1.7.2 3.8 1 5h1.5A2.5 2.5 0 0 1 19 13v1H5v-1a2.5 2.5 0 0 1 2.5-2.5zM5 18h14M6 14v4M18 14v4" />
  </svg>
);

// ---------- scroll reveal ----------

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${inView ? "is-in" : ""} ${className}`}
      style={{ ["--reveal-delay" as string]: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ---------- animated counter ----------

export function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const dur = 950;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setDisplay(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display.toLocaleString("ru-RU")}</>;
}

// ---------- ТА chip ----------

export const TA_STYLE: Record<TaKind, { chip: string; dot: string; label: string }> = {
  Спецификация: {
    chip: "bg-blueprint-50 text-blueprint-700 border-blueprint-500/30",
    dot: "bg-blueprint-600",
    label: "Спецификация",
  },
  КЕР: { chip: "bg-brass-100 text-[#7a5606] border-brass-500/40", dot: "bg-brass-500", label: "КЕР" },
  ТМЦ: { chip: "bg-moss-100 text-moss-600 border-moss-500/30", dot: "bg-moss-500", label: "ТМЦ" },
  Заголовок: { chip: "bg-paper-200 text-ink-400 border-ink-300/60", dot: "bg-ink-400", label: "Заголовок" },
};

export function TaChip({ ta }: { ta: TaKind }) {
  const s = TA_STYLE[ta];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ---------- file dropzone ----------

export function FileDrop({
  label,
  hint,
  preferSheets,
  file,
  error,
  onLoaded,
  onError,
}: {
  label: string;
  hint: string;
  preferSheets: string[];
  file: LoadedFile | null;
  error: string | null;
  onLoaded: (f: LoadedFile) => void;
  onError: (e: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    onError(null);
    try {
      const loaded = await parseUpload(f, preferSheets);
      if (loaded.rows.length === 0) {
        onError(`Файл прочитан, но лист «${loaded.sheet}» не содержит строк.`);
      } else {
        onLoaded(loaded);
      }
    } catch {
      onError("Не удалось прочитать файл. Убедитесь, что это корректный .xlsx.");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    handle(e.dataTransfer.files?.[0]);
  };

  const ok = !!file;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`dropzone group cursor-pointer border-2 border-dashed px-3 py-3 text-left ${drag ? "drag" : ""} ${
        ok
          ? "border-moss-500/60 bg-moss-500/[0.07]"
          : error
          ? "border-rust-500/60 bg-rust-500/[0.06]"
          : "border-ink-600 bg-ink-850/70 hover:border-ink-400"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 shrink-0 ${ok ? "text-moss-500" : error ? "text-rust-500" : "text-brass-500"}`}
        >
          {busy ? (
            <IconGear className="h-4.5 w-4.5 animate-spin" />
          ) : ok ? (
            <IconCheck className="h-4.5 w-4.5" />
          ) : error ? (
            <IconAlert className="h-4.5 w-4.5" />
          ) : (
            <IconSheet className="h-4.5 w-4.5" />
          )}
        </span>
        <div className="min-w-0">
          <div className="font-mono text-[12px] font-semibold tracking-wide text-ink-100">
            {label}
            <span className="ml-1.5 text-rust-500">*</span>
          </div>
          {ok ? (
            <div className="mt-1 truncate text-[11px] text-moss-500">
              {file.name} · лист «{file.sheet}» ·{" "}
              <span className="font-mono">{file.rows.length.toLocaleString("ru-RU")}</span> строк
            </div>
          ) : error ? (
            <div className="mt-1 text-[11px] leading-snug text-rust-500">{error}</div>
          ) : (
            <div className="mt-1 text-[11px] leading-snug text-ink-300 group-hover:text-ink-200">
              {busy ? "Чтение файла…" : hint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- section heading ----------

export function SectionTitle({
  code,
  title,
  light = false,
}: {
  code: string;
  title: string;
  light?: boolean;
}) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <span
        className={`font-mono text-[11px] font-bold tracking-[0.2em] ${
          light ? "text-blueprint-600" : "text-brass-500"
        }`}
      >
        {code}
      </span>
      <h2
        className={`font-display text-[15px] font-semibold uppercase tracking-[0.08em] ${
          light ? "text-ink-900" : "text-ink-100"
        }`}
      >
        {title}
      </h2>
      <div className={`h-px flex-1 ${light ? "bg-ink-900/15" : "bg-ink-100/10"}`} />
    </div>
  );
}
