import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { TA } from "../lib/vor";

/* ---------- иконки (инлайн-SVG, чертёжный стиль) ---------- */

type IconProps = { className?: string };
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;

export const IconStamp = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5.5" strokeDasharray="2.5 2.5" />
    <path d="M12 9.5v5M9.5 12h5" />
  </svg>
);

export const IconCompass = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5 13.6 13.6 8.5 15.5l1.9-5.1z" />
  </svg>
);

export const IconGear = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4M6 6l1.7 1.7M16.3 16.3 18 18M18 6l-1.7 1.7M7.7 16.3 6 18" />
  </svg>
);

export const IconDownload = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <path d="M12 4v10m0 0 4-4m-4 4-4-4" />
    <path d="M5 19h14" />
  </svg>
);

export const IconCopy = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <rect x="8" y="8" width="11" height="12" />
    <path d="M5 16V4h11" />
  </svg>
);

export const IconTerminal = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <rect x="3" y="4.5" width="18" height="15" />
    <path d="m6.5 9 3 3-3 3M12.5 15.5h5" />
  </svg>
);

export const IconAlert = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <path d="M12 4 2.8 20h18.4z" />
    <path d="M12 10v4.5M12 17.4v.2" />
  </svg>
);

export const IconCheck = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const IconClose = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconFile = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4M10 12h6M10 15.5h6" />
  </svg>
);

export const IconUpload = ({ className = "h-5 w-5" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...S}>
    <path d="M12 16V6m0 0 4 4m-4-4-4 4" />
    <path d="M5 19h14" />
  </svg>
);

/* ---------- scroll reveal ---------- */

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
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
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

/* ---------- анимированный счётчик ---------- */

export function CountUp({ value }: { value: number }) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    const dur = 700;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (value - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{v.toLocaleString("ru-RU")}</span>;
}

/* ---------- заголовок раздела ---------- */

export function SectionTitle({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-blueprint-600">
          {kicker}
        </div>
        <h2 className="mt-1.5 font-display text-[clamp(20px,2.6vw,30px)] font-bold uppercase leading-tight tracking-tight text-ink-900">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

/* ---------- зона загрузки файла ---------- */

export function FileDrop({
  title,
  hint,
  loaded,
  error,
  onFile,
}: {
  title: string;
  hint: string;
  loaded: { name: string; rows: number; sheet: string } | null;
  error?: string | null;
  onFile: (f: File) => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      className={`dropzone group relative cursor-pointer border-2 border-dashed px-4 py-4 ${
        drag
          ? "drag"
          : error
            ? "border-rust-500/70 bg-rust-500/5"
            : loaded
              ? "border-moss-500/60 bg-moss-500/5"
              : "border-paper-50/25 bg-ink-850/60 hover:border-brass-500/70"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 shrink-0 ${
            loaded ? "text-moss-500" : error ? "text-rust-500" : "text-brass-500"
          }`}
        >
          {loaded ? (
            <IconCheck className="h-5 w-5" />
          ) : error ? (
            <IconAlert className="h-5 w-5" />
          ) : (
            <IconUpload className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[12.5px] font-bold tracking-wide text-paper-50">
            {title}
          </div>
          {loaded ? (
            <div className="mt-0.5 truncate text-[11px] text-moss-500">
              {loaded.name} · лист «{loaded.sheet}» ·{" "}
              {loaded.rows.toLocaleString("ru-RU")} строк
            </div>
          ) : error ? (
            <div className="mt-0.5 text-[11px] leading-snug text-rust-500">{error}</div>
          ) : (
            <div className="mt-0.5 text-[11px] leading-snug text-ink-300">{hint}</div>
          )}
        </div>
      </div>
      {loaded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className="absolute right-2.5 top-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-300 opacity-0 transition-opacity hover:text-brass-400 group-hover:opacity-100"
        >
          заменить
        </button>
      )}
    </div>
  );
}

/* ---------- чип источника ТА ---------- */

const TA_STYLES: Record<TA, string> = {
  Спецификация: "bg-blueprint-50 text-blueprint-700 border-blueprint-600/40",
  КЕР: "bg-brass-100 text-[#8a6206] border-brass-500/50",
  ТМЦ: "bg-moss-100 text-moss-600 border-moss-500/50",
  Заголовок: "bg-paper-200 text-ink-400 border-ink-300/60",
};

export function TaChip({ ta }: { ta: TA }) {
  return (
    <span
      className={`inline-block border px-1.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wide ${TA_STYLES[ta]}`}
    >
      {ta}
    </span>
  );
}
