import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TA } from "../lib/vor";

export function useInView<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
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

export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - k, 3);
          setDisplay(Math.round(value * eased));
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  return <span ref={ref}>{display.toLocaleString("ru-RU")}</span>;
}

// ---------- иконки (inline SVG) ----------

function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconFile = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" />
    <path d="M14 3v4h4" />
    <path d="M9.5 13h5M9.5 16.5h5" />
  </Svg>
);

export const IconCheck = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
);

export const IconAlert = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 10v4M12 17.2v.3" />
  </Svg>
);

export const IconDownload = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 3v11" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 20h16" />
  </Svg>
);

export const IconTerminal = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m5 7 5 5-5 5" />
    <path d="M12 17h7" />
  </Svg>
);

export const IconCopy = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="9" y="9" width="11" height="11" />
    <path d="M5 15H4V4h11v1" />
  </Svg>
);

export const IconGear = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" />
  </Svg>
);

export const IconStamp = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M9 3h6l-1.5 6H15a2 2 0 0 1 2 2v2H7v-2a2 2 0 0 1 2-2h1.5L9 3Z" />
    <path d="M5 17h14v4H5z" />
  </Svg>
);

export const IconCompass = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Svg>
);

export const IconClose = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

// ---------- зона загрузки файла ----------

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

  return (
    <div
      className={`dropzone group relative cursor-pointer border ${
        loaded
          ? "border-moss-500/70 bg-moss-500/10"
          : error
            ? "border-rust-500/70 bg-rust-500/10"
            : "border-dashed border-paper-50/25 bg-ink-850/60 hover:border-brass-500/70"
      } ${drag ? "drag" : ""} px-4 py-3.5`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
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
            <IconFile className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-paper-50">
            {title}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] leading-snug text-ink-300">
            {error ? (
              <span className="text-rust-500">{error}</span>
            ) : loaded ? (
              <span className="text-moss-500">
                {loaded.name} · лист «{loaded.sheet}» ·{" "}
                {loaded.rows.toLocaleString("ru-RU")} строк
              </span>
            ) : (
              hint
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- чип источника ТА ----------

export function TaChip({ ta }: { ta: TA }) {
  const cls =
    ta === "Спецификация"
      ? "border-blueprint-600/50 bg-blueprint-50 text-blueprint-700"
      : ta === "КЕР"
        ? "border-brass-500/60 bg-brass-100 text-[#8a6206]"
        : ta === "ТМЦ"
          ? "border-moss-500/60 bg-moss-100 text-moss-600"
          : "border-ink-400/50 bg-paper-200 text-ink-400";
  return (
    <span
      className={`inline-block border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {ta}
    </span>
  );
}

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
    <Reveal className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-blueprint-600">
            {kicker}
          </div>
          <h2 className="mt-1 font-display text-[clamp(20px,3vw,30px)] font-bold uppercase leading-tight tracking-tight text-ink-900">
            {title}
          </h2>
        </div>
        {children}
      </div>
      <div className="mt-3 h-[3px] w-24 bg-brass-500" />
    </Reveal>
  );
}
