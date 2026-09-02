import { useState } from "react";
import type { VorResult } from "../lib/vor";
import { CountUp, IconAlert, IconDownload, IconCheck, Reveal, TaChip } from "./ui";

const fmtQty = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
--- src/components/results.tsx (原始)


+++ src/components/results.tsx (修改后)
import { useMemo, useState } from "react";
import type { VorResult } from "../lib/vor";
import {
  buildVorWorkbook,
  buildVorCsv,
  downloadWorkbook,
  downloadText,
} from "../lib/excelIo";
import { CountUp, IconAlert, IconDownload, Reveal, TaChip, IconCheck } from "./ui";

const fmtQty = (v: number | null) =>
  v === null
    ? "—"
    : v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function StatCard({
  label,
  value,
  tone = "ink",
  sub,
}: {
  label: string;
  value: number;
  tone?: "ink" | "blue" | "brass" | "moss" | "rust";
  sub?: string;
}) {
  const tones: Record<string, string> = {
    ink: "border-t-ink-900 text-ink-900",
    blue: "border-t-blueprint-600 text-blueprint-700",
    brass: "border-t-brass-500 text-[#8a6206]",
    moss: "border-t-moss-500 text-moss-600",
    rust: "border-t-rust-500 text-rust-600",
  };
  return (
    <div
      className={`border border-ink-900/12 border-t-4 bg-white/85 px-4 py-3.5 shadow-[0_1px_0_rgba(14,24,35,0.05)] transition-transform duration-200 hover:-translate-y-0.5 ${tones[tone]}`}
    >
      <div className="font-mono text-2xl font-bold leading-none tracking-tight sm:text-[27px]">
        <CountUp value={value} />
      </div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">
        {label}
      </div>
      {sub && <div className="mt-0.5 font-mono text-[10.5px] text-ink-300">{sub}</div>}
    </div>
  );
}

function TaDistribution({ res }: { res: VorResult }) {
  const d = res.stats.taCounts;
  const total = Math.max(1, res.stats.vorTotal);
  const parts = [
    { key: "Спецификация", count: d["Спецификация"], cls: "bg-blueprint-600", text: "text-blueprint-700" },
    { key: "КЕР", count: d["КЕР"], cls: "bg-brass-500", text: "text-[#8a6206]" },
    { key: "ТМЦ", count: d["ТМЦ"], cls: "bg-moss-500", text: "text-moss-600" },
    { key: "Заголовки", count: d["Заголовок"], cls: "bg-ink-400", text: "text-ink-400" },
  ];
  return (
    <div className="border border-ink-900/12 bg-white/85 p-4">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
          Распределение строк по источникам (ТА)
        </span>
        <span className="font-mono text-[11px] text-ink-400">Σ = {res.stats.vorTotal}</span>
      </div>
      <div className="flex h-4 w-full overflow-hidden border border-ink-900/20">
        {parts.map(
          (p) =>
            p.count > 0 && (
              <div
                key={p.key}
                className={`${p.cls} transition-all duration-700`}
                style={{ width: `${(p.count / total) * 100}%` }}
                title={`${p.key}: ${p.count}`}
              />
            )
        )}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {parts.map((p) => (
          <div key={p.key} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 ${p.cls}`} />
            <span className="text-[11.5px] text-ink-400">{p.key}</span>
            <span className={`ml-auto font-mono text-[11.5px] font-bold ${p.text}`}>{p.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KerFrequency({ res }: { res: VorResult }) {
  const top = res.stats.kerCodeFreq.slice(0, 6);
  const max = Math.max(1, ...top.map((t) => t.count));
  if (!top.length) return null;
  return (
    <div className="border border-ink-900/12 bg-white/85 p-4">
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
        Частота кодов КЕР
      </div>
      <ul className="space-y-1.5">
        {top.map((t) => (
          <li key={t.code} className="flex items-center gap-2.5">
            <span className="w-12 shrink-0 border border-blueprint-600/40 bg-blueprint-50 px-1 text-center font-mono text-[11px] font-bold text-blueprint-700">
              {t.code}
            </span>
            <span className="h-2.5 flex-1 bg-paper-200">
              <span
                className="block h-full bg-blueprint-600/80 transition-all duration-700"
                style={{ width: `${(t.count / max) * 100}%` }}
              />
            </span>
            <span className="w-6 text-right font-mono text-[11.5px] font-bold text-ink-800">
              {t.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Results({
  res,
  xlsxUrl,
  csvUrl,
}: {
  res: VorResult;
  xlsxUrl: string | null;
  csvUrl: string | null;
}) {
  const [tab, setTab] = useState<"vor" | "nf">("vor");
  const [limit, setLimit] = useState(120);

export function Results({ res }: { res: VorResult }) {
  const [tab, setTab] = useState<"vor" | "nf">("vor");
  const [limit, setLimit] = useState(120);

  const wb = useMemo(() => buildVorWorkbook(res), [res]);
  const preview = res.rows.slice(0, limit);
  const s = res.stats;

  return (
    <section id="result" className="space-y-4">
      {/* штамп + заголовок результата */}
      <Reveal>
        <div className="relative overflow-hidden border-2 border-ink-900 bg-ink-900 px-6 py-5 text-paper-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-brass-500">
                Лист «ВОР» · ВОР.xlsx · {res.generatedAt.toLocaleString("ru-RU")}
              </div>
              <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wide sm:text-2xl">
                Ведомость сформирована
              </h2>
              <div className="mt-1 font-mono text-[11.5px] text-ink-300">
                Навигатор: Л2 = <span className="text-brass-400">{res.l2}</span> · Л3 ={" "}
                <span className="text-brass-400">{res.l3}</span> · база КЕР:{" "}
                {res.kerBaseTotal.toLocaleString("ru-RU")} →{" "}
                {res.kerBaseFiltered.toLocaleString("ru-RU")} после фильтра
              </div>
            </div>
            <div className="stamp-in select-none border-[3px] border-double border-rust-500 px-4 py-2 text-center">
              <div className="font-display text-[15px] font-bold uppercase tracking-[0.18em] text-rust-500">
                Сформировано
              </div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-rust-500/80">
                ВОС · проверка пройдена
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {res.warnings.length > 0 && (
        <Reveal delay={40}>
          <div className="space-y-1.5">
            {res.warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 border border-brass-500/50 bg-brass-100/60 px-4 py-2.5 text-[12.5px] text-[#6d4e05]"
              >
                <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {w}
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {/* статистика */}
      <Reveal delay={60}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Позиций в спецификации" value={s.specTotal} tone="ink" sub={`+ ${s.headerCount} заголовков`} />
          <StatCard label="Строк в ВОР" value={s.vorTotal} tone="blue" sub="тройная детализация" />
          <StatCard label="Подобрано Код КЕР" value={s.kerFound} tone="brass" sub={`${s.fasonCount} фасонных — в расценке`} />
          <StatCard
            label="Подобрано Код ТМЦ"
            value={s.tmcFound}
            tone="moss"
            sub={`точно ${s.tmcExact} · группа ${s.tmcGroup} · аналог ${s.tmcAnalog}`}
          />
          <StatCard label="Пометка «Не найдено»" value={s.notFoundRows} tone="rust" sub="лист «Не найдено»" />
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <TaDistribution res={res} />
          <KerFrequency res={res} />
        </div>
      </Reveal>

      {/* предпросмотр */}
      <Reveal delay={120}>
        <div className="border border-ink-900/12 bg-white/85">
          <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink-900 px-4 py-2.5">
            <button
              onClick={() => setTab("vor")}
              className={`border px-3 py-1 font-mono text-[11.5px] font-bold uppercase tracking-wider transition-colors ${
                tab === "vor"
                  ? "border-ink-900 bg-ink-900 text-brass-400"
                  : "border-ink-900/25 text-ink-400 hover:border-ink-900 hover:text-ink-800"
              }`}
            >
              Предпросмотр ВОР
            </button>
            <button
              onClick={() => setTab("nf")}
              className={`border px-3 py-1 font-mono text-[11.5px] font-bold uppercase tracking-wider transition-colors ${
                tab === "nf"
                  ? "border-rust-600 bg-rust-600 text-white"
                  : "border-ink-900/25 text-ink-400 hover:border-rust-600 hover:text-rust-600"
              }`}
            >
              Не найдено · {res.notFound.length}
            </button>
            <div className="ml-auto flex items-center gap-2">
              {tab === "vor" && (
                <>
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-400">
                    показать
                  </span>
                  {[60, 120, 300].map((n) => (
                    <button
                      key={n}
                      onClick={() => setLimit(n)}
                      className={`border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                        limit === n
                          ? "border-blueprint-600 bg-blueprint-50 text-blueprint-700"
                          : "border-ink-900/20 text-ink-400 hover:text-ink-800"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="slim-scroll-light max-h-[520px] overflow-auto">
            {tab === "vor" ? (
              <table className="w-full min-w-[980px] text-left text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-ink-800 text-paper-50">
                    {["№ п/п", "Система", "Строка", "Этаж", "Наименование", "ЕИ", "Кол-во", "Код КЕР", "Код ТМЦ", "Расход", "ТА"].map(
                      (h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr
                      key={i}
                      className={`row-in border-t border-ink-900/8 align-top transition-colors hover:bg-brass-100/45 ${
                        r.ta === "Заголовок" ? "bg-ink-900/[0.045] font-semibold" : i % 2 ? "bg-ink-900/[0.02]" : ""
                      }`}
                      style={{ animationDelay: `${Math.min(i, 40) * 8}ms` }}
                    >
                      <td className="px-3 py-1.5 font-mono text-[11.5px] font-bold text-blueprint-700">
                        ’{r.npp}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 font-medium text-ink-800">{r.system || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-ink-400">{r.line || "—"}</td>
                      <td className="px-3 py-1.5 text-ink-400">{r.floor || "—"}</td>
                      <td className="max-w-[420px] px-3 py-1.5 leading-snug text-ink-800">
                        {r.name}
                        {r.ta === "Заголовок" && (
                          <span className="ml-2 font-mono text-[9.5px] uppercase tracking-wider text-ink-400">
                            иерархия сохранена
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-ink-400">{r.unit || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-[11.5px] text-ink-800">
                        {fmtQty(r.qty)}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono text-[11.5px] font-bold text-blueprint-700">
                        {r.kerId ?? ""}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono text-[11.5px] font-bold text-moss-600">
                        {r.tmcId ?? ""}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-[11.5px] text-ink-800">
                        {fmtQty(r.rashod)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5">
                        <TaChip ta={r.ta} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[760px] text-left text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-rust-600 text-white">
                    {["Система", "Строка", "Наименование", "Кол-во", "Что не найдено", "Причина"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.notFound.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-ink-400">
                        <span className="inline-flex items-center gap-2 text-moss-600">
                          <IconCheck className="h-4 w-4" /> Все позиции обработаны без пропусков
                        </span>
                      </td>
                    </tr>
                  ) : (
                    res.notFound.map((r, i) => (
                      <tr key={i} className="border-t border-ink-900/8 transition-colors odd:bg-ink-900/[0.02] hover:bg-rust-100/50">
                        <td className="whitespace-nowrap px-3 py-1.5 font-medium text-ink-800">{r.system}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] text-ink-400">{r.line}</td>
                        <td className="max-w-[360px] px-3 py-1.5 leading-snug text-ink-800">{r.name}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-[11.5px]">{fmtQty(r.qty)}</td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          <span
                            className={`border px-1.5 py-0.5 font-mono text-[10.5px] font-bold ${
                              r.what === "Код КЕР"
                                ? "border-brass-500/50 bg-brass-100 text-[#8a6206]"
                                : "border-moss-500/50 bg-moss-100 text-moss-600"
                            }`}
                          >
                            {r.what}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-[11.5px] text-ink-400">{r.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          <div className="border-t border-ink-900/10 px-4 py-2 font-mono text-[10.5px] uppercase tracking-wider text-ink-400">
            {tab === "vor"
              ? `показано ${Math.min(limit, res.rows.length)} из ${res.rows.length.toLocaleString("ru-RU")} строк`
              ? `показано ${Math.min(limit, res.rows.length)} из ${res.rows.length} строк`
              : `записей: ${res.notFound.length}`}
          </div>
        </div>
      </Reveal>

      {/* скачивание: прямые ссылки <a download> */}
      {/* скачивание */}
      <Reveal delay={160}>
        <div className="flex flex-wrap items-center gap-3 border border-ink-900/12 bg-ink-900 px-5 py-4">
          <IconDownload className="h-5 w-5 text-brass-500" />
          <div className="mr-auto">
            <div className="text-[13px] font-bold text-paper-50">Готовый файл</div>
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-ink-300">
              ВОР · Статистика · Не найдено
            </div>
          </div>
          {xlsxUrl && (
            <a
              href={xlsxUrl}
              download="ВОР.xlsx"
              className="group inline-flex items-center gap-2 bg-brass-500 px-5 py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-ink-950 transition-all hover:-translate-y-0.5 hover:bg-brass-400 hover:shadow-[0_6px_18px_rgba(240,168,28,0.35)] active:translate-y-0"
            >
              <IconDownload className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              Скачать ВОР.xlsx
            </a>
          )}
          {csvUrl && (
            <a
              href={csvUrl}
              download="ВОР_с_ТА.csv"
              className="inline-flex items-center gap-2 border border-ink-300/40 px-4 py-2.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-ink-200 transition-colors hover:border-brass-500 hover:text-brass-400"
            >
              ВОР_с_ТА.csv
            </a>
          )}
          {xlsxUrl && (
            <a
              href={xlsxUrl}
              target="_blank"
              rel="noopener"
              className="font-mono text-[10.5px] uppercase tracking-wider text-ink-300 underline decoration-ink-600 underline-offset-4 transition-colors hover:text-brass-400"
              title="Если скачивание блокируется окном предпросмотра — файл откроется в новой вкладке, сохраните его вручную"
            >
              не скачивается? открыть
            </a>
          )}
          <button
            onClick={() => downloadWorkbook(wb, "ВОР.xlsx")}
            className="group inline-flex items-center gap-2 bg-brass-500 px-5 py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-ink-950 transition-all hover:-translate-y-0.5 hover:bg-brass-400 hover:shadow-[0_6px_18px_rgba(240,168,28,0.35)] active:translate-y-0"
          >
            <IconDownload className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
            Скачать ВОР.xlsx
          </button>
          <button
            onClick={() =>
              downloadText(buildVorCsv(res), "ВОР_с_ТА.csv", "text/csv;charset=utf-8")
            }
            className="inline-flex items-center gap-2 border border-ink-300/40 px-4 py-2.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-ink-200 transition-colors hover:border-brass-500 hover:text-brass-400"
          >
            ВОР_с_ТА.csv
          </button>
        </div>
      </Reveal>
    </section>
  );
}
