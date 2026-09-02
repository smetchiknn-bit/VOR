--- src/components/reference.tsx (原始)


+++ src/components/reference.tsx (修改后)
import { Reveal } from "./ui";

const PIPELINE: Array<{ n: string; title: string; text: string }> = [
  {
    n: "01",
    title: "Чтение исходных данных",
    text: "Спецификация.xlsx, База КЕР.xlsx (лист «Выгрузка»), База ТМЦ.xlsx — колонки нормализуются автоматически.",
  },
  {
    n: "02",
    title: "Фильтрация базы КЕР",
    text: "По кодам навигатора Л2 / Л3. Если фильтр пуст — берётся вся база с предупреждением.",
  },
  {
    n: "03",
    title: "Подбор Код КЕР",
    text: "19 правил по ключевым словам: воздуховоды, клапаны, огнезащита, вентиляторы; фасонные изделия — без отдельной расценки.",
    text: "19 правил по ключевым словам: воздуховоды, клапаны, огнезащита, вентиляторы, фасонные изделия — без отдельной расценки.",
  },
  {
    n: "04",
    title: "Подбор Код ТМЦ",
    text: "Ключ — первое слово наименования. Оценка по пересечению слов, +10 за артикул, −5 за чужую категорию.",
  },
  {
    n: "05",
    title: "Тройная детализация",
    text: "На позицию — до 3 строк: «Спецификация» (оба кода) → «КЕР» (без Код ТМЦ) → «ТМЦ» (без Код КЕР).",
  },
  {
    n: "06",
    title: "№ п/п и запись ВОР.xlsx",
    text: "Нумерация систем '001, '002…; листы «ВОР» (11 колонок), «Статистика», «Не найдено».",
  },
];

const RULES: Array<{ keys: string; id: string; note: string }> = [
  { keys: "воздуховод + «число×число» (прямоугольный)", id: "1426", note: "периметр 601–1000 мм" },
  { keys: "воздуховод + ⌀ / диам (круглый)", id: "1434", note: "Ø251–355 мм" },
  { keys: "воздуховод — общий случай", id: "300", note: "периметр до 600 мм" },
  { keys: "отвод · переход · врезка · тройник · крестовина · утка · заглушка", id: "—", note: "учтено в расценке на воздуховоды" },
  { keys: "клапан + противопожарный / огнезадержив", id: "1524", note: "огнезадерживающие, перим. до 1600" },
  { keys: "клапан + электропривод / механич", id: "1516", note: "КВР с механическим приводом" },
  { keys: "клапан + рукоятк / ручн", id: "1510", note: "КВР с ручным приводом" },
  { keys: "огнезащит / изовент / вбор / огневент", id: "3677", note: "мин. волокна, EI 1,5 ч" },
  { keys: "вытяжная установка / приточная / агрегат / камера", id: "1589", note: "приточно-вытяжной агрегат" },
  { keys: "вентилятор + радиальн / центробеж", id: "1976", note: "до 50 кг" },
  { keys: "вентилятор + осев", id: "1453", note: "до 25 кг" },
  { keys: "вентилятор + крышн", id: "1459", note: "до 100 кг" },
  { keys: "вентилятор + канальн", id: "4683", note: "Ø 250 мм" },
  { keys: "вентилятор — прочие", id: "4681", note: "вытяжные бытовые" },
  { keys: "шумоглушитель", id: "1785", note: "" },
  { keys: "решетк / диффузор", id: "3947", note: "воздухораспределители" },
  { keys: "зонт", id: "1490", note: "зонты над шахтами до Ø400" },
  { keys: "иначе", id: "NaN", note: "Не найдено (по навигатору Л2.Л3)" },
];

export function Pipeline() {
  return (
    <Reveal>
      <div className="relative border border-ink-900/12 bg-white/70 p-6 shadow-[0_1px_0_rgba(14,24,35,0.06)] backdrop-blur-[2px] sm:p-8">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink-900 sm:text-xl">
            Маршрутный лист обработки
          </h2>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400 sm:block">
            6 переходов · без промежуточных складов
          </span>
        </div>

        <ol className="grid gap-x-10 gap-y-5 md:grid-cols-2">
          {PIPELINE.map((s, i) => (
            <li key={s.n} className="group flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-ink-900 bg-paper-50 font-mono text-[12px] font-bold text-ink-900 transition-colors duration-300 group-hover:border-brass-600 group-hover:bg-brass-500 group-hover:text-ink-950">
                  {s.n}
                </span>
                {i < PIPELINE.length - 1 && (
                  <svg className="mt-1 h-full min-h-6 w-2 text-ink-900/25" aria-hidden>
                    <line
                      x1="4"
                      y1="0"
                      x2="4"
                      y2="100%"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="3 5"
                      className="dash-flow"
                    />
                  </svg>
                )}
              </div>
              <div className="pb-1">
                <div className="font-body text-[14px] font-bold text-ink-900">{s.title}</div>
                <p className="mt-0.5 max-w-md text-[12.5px] leading-relaxed text-ink-400">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Reveal>
  );
}

export function RulesReference() {
  return (
    <Reveal delay={80}>
      <div className="border border-ink-900/12 bg-white/70 backdrop-blur-[2px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink-900 px-6 py-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink-900">
            Правила подбора Код КЕР
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400">
            таблица 5.2 промпта · 19 правил
          </span>
        </div>
        <div className="slim-scroll-light overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[12.5px]">
            <thead>
              <tr className="bg-ink-900 text-paper-50">
                <th className="px-6 py-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]">
                  Ключевые слова в «Наименование»
                </th>
                <th className="px-4 py-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]">
                  ИД_КЕР
                </th>
                <th className="px-6 py-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]">
                  Расценка
                </th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r, i) => (
                <tr
                  key={i}
                  className={`border-t border-ink-900/8 transition-colors hover:bg-brass-100/50 ${
                    i % 2 ? "bg-ink-900/[0.025]" : ""
                  }`}
                >
                  <td className="px-6 py-2 font-medium text-ink-800">{r.keys}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block min-w-14 border px-1.5 py-0.5 text-center font-mono text-[11.5px] font-bold ${
                        r.id === "—" || r.id === "NaN"
                          ? "border-ink-300 bg-paper-200 text-ink-400"
                          : "border-blueprint-600/40 bg-blueprint-50 text-blueprint-700"
                      }`}
                    >
                      {r.id}
                    </span>
                  </td>
                  <td className="px-6 py-2 text-ink-400">{r.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Reveal>
  );
}

export function TmcAlgo() {
  const steps = [
    {
      t: "Ключ поиска",
      d: "Первое слово «Наименования» длиной ≥ 3 символов: «клапан», «воздуховод», «отвод»…",
      v: "+0",
      tone: "text-ink-400",
    },
    {
      t: "Пересечение слов",
      d: "Каждое общее слово (≥ 3 символов) в наименованиях спецификации и ТМЦ даёт балл.",
      v: "+1 за слово",
      tone: "text-moss-600",
    },
    {
      t: "Совпадение артикула",
      d: "Если «Артикул» спецификации найден в наименовании ТМЦ — приоритетный кандидат.",
      v: "+10",
      tone: "text-moss-600",
    },
    {
      t: "Чужая категория",
      d: "«труб» или «светильник» в ТМЦ при отсутствии в спецификации — явное несовпадение.",
      v: "−5",
      tone: "text-rust-600",
    },
  ];
  const verdicts = [
    { r: "балл ≥ 5", s: "Точное совпадение ТМЦ", c: "border-moss-500 text-moss-600" },
    { r: "балл 2–4", s: "ТМЦ подобран по группе", c: "border-brass-500 text-brass-600" },
    { r: "балл < 2", s: "Аналог: частичное совпадение", c: "border-rust-500 text-rust-600" },
    { r: "кандидатов нет", s: "Код ТМЦ = NaN → лист «Не найдено»", c: "border-ink-400 text-ink-400" },
  ];
  return (
    <Reveal delay={120}>
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="border border-ink-900/12 bg-white/70 p-6 backdrop-blur-[2px]">
          <h3 className="font-display text-[15px] font-bold uppercase tracking-wide text-ink-900">
            Скоринг подбора Код ТМЦ
          </h3>
          <ul className="mt-4 space-y-3">
            {steps.map((s) => (
              <li
                key={s.t}
                className="group flex items-start justify-between gap-4 border-l-2 border-ink-900/10 pl-4 transition-colors hover:border-brass-500"
              >
                <div>
                  <div className="text-[13px] font-bold text-ink-800">{s.t}</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-ink-400">{s.d}</div>
                </div>
                <span className={`shrink-0 font-mono text-[12px] font-bold ${s.tone}`}>{s.v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-ink-900/12 bg-ink-900 p-6 text-ink-100">
          <h3 className="font-display text-[15px] font-bold uppercase tracking-wide text-brass-500">
            Вердикты скоринга
          </h3>
          <ul className="mt-4 space-y-2.5">
            {verdicts.map((v) => (
              <li
                key={v.r}
                className={`border-l-2 pl-3 transition-transform duration-200 hover:translate-x-1 ${v.c}`}
              >
                <span className="font-mono text-[11.5px] font-bold uppercase tracking-wider">{v.r}</span>
                <div className="text-[12.5px] text-ink-200">{v.s}</div>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-ink-100/10 pt-4 text-[11.5px] leading-relaxed text-ink-300">
            Итог: кандидат с максимальным баллом. Строка-заголовок (без «Кол-ва») кодов не
            получает — в колонке ТА фиксируется «Строка-заголовок (уровень 1/2)», иерархия
            получает — в колонке ТА фиксируется «{`Строка-заголовок (уровень 1/2)`}», иерархия
            спецификации сохраняется.
          </p>
        </div>
      </div>
    </Reveal>
  );
}

export function FormatCard() {
  const cols = [
    ["№ п/п", "текст · '001"],
    ["Система", "текст"],
    ["Строка", "ключ трассировки"],
    ["Этаж", "текст"],
    ["Наименование", "по источнику"],
    ["ЕИ", "по источнику"],
    ["Кол-во", "число · запятая"],
    ["Код КЕР", "ИД_КЕР"],
    ["Код ТМЦ", "ИД ТМЦ фск"],
    ["Расход ТМЦ", "= Кол-во"],
    ["ТА", "источник строки"],
  ];
  return (
    <Reveal delay={160}>
      <div className="flex flex-col gap-4 border border-ink-900/12 bg-white/70 p-6 backdrop-blur-[2px] md:flex-row md:items-start md:gap-10">
        <div className="md:w-72 md:shrink-0">
        <div className="md:w-64 md:shrink-0">
          <h3 className="font-display text-[15px] font-bold uppercase tracking-wide text-ink-900">
            ВОР.xlsx · 3 листа
          </h3>
          <ul className="mt-3 space-y-2">
            {[
              ["ВОР", "итоговая таблица · 11 колонок"],
              ["Статистика", "сводка и распределение по ТА"],
              ["Не найдено", "позиции без КЕР/ТМЦ с причиной"],
            ].map(([a, b]) => (
              <li key={a} className="flex items-baseline gap-3">
                <span className="inline-block border border-ink-900/70 bg-paper-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-800">
                  {a}
                </span>
                <span className="text-[12px] text-ink-400">{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11.5px] leading-relaxed text-ink-400">
            В XLSX числа хранятся числами (в русской локали Excel — запятая), «№ п/п» —
            текстом: ведущие нули не теряются. Дополнительно выгружается{" "}
            <span className="font-mono text-ink-800">ВОР_с_ТА.csv</span>: UTF-8 BOM, «;»,
            десятичная запятая, «'001».
          </p>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-px border border-ink-900/15 bg-ink-900/15 sm:grid-cols-3 lg:grid-cols-4">
            {cols.map(([name, kind], i) => (
              <div
                key={name}
                className="group bg-paper-50 px-3 py-2.5 transition-colors hover:bg-brass-100/70"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-bold text-ink-800">{name}</span>
                  <span className="font-mono text-[10px] font-semibold text-blueprint-600">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-wide text-ink-400">
                  {kind}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
