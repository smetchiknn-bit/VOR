--- src/lib/streamlit.ts (原始)


+++ src/lib/streamlit.ts (修改后)
// ============================================================
//  Streamlit-версия генератора ВОР: app.py + requirements + README
// ============================================================

export const APP_PY = `# -*- coding: utf-8 -*-
"""
ГЕНЕРАТОР ВОР (Ведомость объёмов работ)
Streamlit-приложение: автоматическая привязка кодов КЕР и ТМЦ
к позициям спецификации с тройной детализацией (Спецификация → КЕР → ТМЦ).

Запуск:
    pip install -r requirements.txt
    streamlit run app.py
"""
import io
import re
from datetime import datetime

import numpy as np
import pandas as pd
import streamlit as st

# ------------------------------------------------------------
# Промпт.txt встроен в приложение как константа
# (читается автоматически при запуске, загрузка файла не нужна)
# ------------------------------------------------------------
PROMPT_TXT = """1. РОЛЬ И ЗАДАЧА
Ты — сметчик высшей квалификации. Главная задача — построчно привязать коды КЕР и коды ТМЦ
к позициям спецификации, обеспечив однозначную трассировку по колонке «Строка» и учёт иерархии
(заголовки 1-го и 2-го уровня). Суммарные обороты и итоговые стоимости не нужны.

2. ВХОДНЫЕ ДАННЫЕ
2.1. Спецификация.xlsx — колонки: Файл, Лист, Система, Этаж, Наименование, Артикул,
Производитель, ЕИ, Кол-во, Масса, Примечания, Строка. Для трассировки обязательно: Строка.
Строки без Кол-во, но с Наименованием и Строка — строки-заголовки 1/2 уровня, сохраняются в ВОР.
2.2. База КЕР.xlsx — для выгрузки: ИД_КЕР, Наименование_КЕР, ЕдИзм КЕР.
Остальные колонки (Л1–Л5, ФЕР) — справочные.
2.3. База ТМЦ.xlsx — для выгрузки: ИД ТМЦ фск, Наименование ТМЦ фск, ЕдИзм ТМЦ.
2.4. Навигатор «Где искать КЕР»: пользователь вводит Л2 Код (например 2.8) и Л3 Код (например 2.8.3).
База КЕР фильтруется по этим кодам; без них подбор не производится.

3. ЦЕЛЕВАЯ СТРУКТУРА (11 колонок): № п/п; Система; Строка; Этаж; Наименование; ЕИ; Кол-во;
Код КЕР; Код ТМЦ; Расход ТМЦ; ТА.

4. ТРОЙНАЯ ДЕТАЛИЗАЦИЯ: для каждой позиции с Кол-во — до трёх строк:
Строка 1 «Спецификация» (всегда): оба подобранных кода.
Строка 2 «КЕР» (если найден): Код ТМЦ пустой.
Строка 3 «ТМЦ» (если найден): Код КЕР пустой.

5. ПРАВИЛА ПОДБОРА КОД КЕР:
воздуховод + прямоугольный (число x число) → 1426; воздуховод + круглый (⌀/диам) → 1434;
воздуховод (общий) → 300; отвод/переход/врезка/тройник/крестовина/утка/заглушка → NaN (учтено
в расценке); клапан + противопожарный/огнезадержив → 1524; клапан + электропривод/механич → 1516;
клапан + рукоятк/ручн → 1510; огнезащит/изовент/вбор/огневент → 3677; вытяжная установка/
приточная/агрегат/камера → 1589; вентилятор + радиальн/центробеж → 1976; осев → 1453;
крышн → 1459; канальн → 4683; прочие вентиляторы → 4681; шумоглушитель → 1785;
решетк/диффузор → 3947; зонт → 1490; иначе → NaN «Не найдено (по навигатору: Л2.Л3)».

6. ПРАВИЛА ПОДБОРА КОД ТМЦ: первое слово Наименования — ключ поиска; кандидаты содержат ключ;
оценка = пересечение слов; +10 за совпадение Артикула; −5 за «труб»/«светильник» в ТМЦ
без их наличия в спецификации. Балл ≥ 5 — точное совпадение; 2–4 — по группе; < 2 — аналог;
кандидатов нет — Не найдено.

7. СТРОКИ-ЗАГОЛОВКИ: без Кол-ва, но с Наименованием и Строка — одна строка, ТА =
«Строка-заголовок (уровень 1/2), иерархия сохранена», коды и Расход пустые.

8. № п/п: уникальным системам — номера по порядку первого появления, три знака с лидирующими
нулями; значение текстовое (в XLSX — текстовая ячейка «001», нули сохраняются).

9. ФОРМАТ: ВОР.xlsx, листы «ВОР», «Статистика», «Не найдено». Числовые колонки — pd.to_numeric.

10. ОГРАНИЧЕНИЯ: трассируемость по колонке «Строка»; не найденные позиции не удаляются;
Расход ТМЦ = Кол-во (ресурсная часть КЕР недоступна); фасонные изделия отдельной расценки
не получают (учтены в расценке на воздуховоды)."""

# ------------------------------------------------------------
# CSS интерфейса
# ------------------------------------------------------------
st.set_page_config(page_title="Генератор ВОР", page_icon="📐", layout="wide")

st.markdown(
    """
    <style>
    .stApp { background: #f4f6f8; }
    div[data-testid="stMetric"] {
        background: #ffffff; border: 1px solid #dde3ea; border-radius: 10px;
        padding: 12px 16px; box-shadow: 0 1px 2px rgba(16,24,35,.06);
    }
    .kerNote {
        font-size: 12px; color: #5c6b7a; border-left: 3px solid #f0a81c;
        padding: 4px 10px; margin: 6px 0; background: #fdf6e7;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ------------------------------------------------------------
# Константы и функции обработки
# ------------------------------------------------------------
FASON_KEYS = ("отвод", "переход", "врезка", "тройник", "крестовина", "утка", "заглушка")
PENALTY_KEYS = ("труб", "светильник")
RECT_RE = re.compile(r"\\d+\\s*[xх×]\\s*\\d+")
ROUND_RE = re.compile(r"[⌀øØ]|диам")
WORDS_RE = re.compile(r"[a-zа-яё0-9]{3,}")
FIRST_RE = re.compile(r"[a-zа-яё0-9]+")

VOR_COLS = ["№ п/п", "Система", "Строка", "Этаж", "Наименование", "ЕИ", "Кол-во",
            "Код КЕР", "Код ТМЦ", "Расход ТМЦ", "ТА"]
HEADER_TA = "Строка-заголовок (уровень 1/2), иерархия сохранена"


def norm_key(s):
    return re.sub(r"[\\s\\u00a0_\\-.]", "", str(s)).lower()


def pick(df, key):
    m = {norm_key(c): c for c in df.columns}
    if key in m:
        return df[m[key]]
    return pd.Series([""] * len(df), index=df.index)


def parse_qty(v):
    try:
        if v is None or str(v).strip() == "":
            return np.nan
        if isinstance(v, (int, float)):
            return np.nan if np.isnan(v) else float(v)
        return float(str(v).replace("\\u00a0", "").replace(" ", "").replace(",", "."))
    except (ValueError, TypeError):
        return np.nan


def get_ker_id(name: str):
    n = str(name).lower()
    if "воздуховод" in n:
        if RECT_RE.search(n):
            return 1426, "Прямоугольное сечение"
        if ROUND_RE.search(n):
            return 1434, "Круглое сечение"
        return 300, "Общий случай"
    if any(k in n for k in FASON_KEYS):
        return np.nan, "Фасонные изделия — учтены в расценке на воздуховоды"
    if "клапан" in n or "заслонк" in n:
        if "противопожарн" in n or "огнезадержив" in n:
            return 1524, "Огнезадерживающий"
        if "электропривод" in n or "механич" in n:
            return 1516, "Механический привод"
        if "рукоятк" in n or "ручн" in n:
            return 1510, "Ручной привод"
    if any(k in n for k in ("огнезащит", "изовент", "вбор", "огневент")):
        return 3677, "Огнезащита воздуховодов"
    if any(k in n for k in ("вытяжная установка", "приточная", "агрегат", "камера")):
        return 1589, "Приточно-вытяжной агрегат"
    if "вентилятор" in n:
        if "радиальн" in n or "центробеж" in n:
            return 1976, "Радиальный"
        if "осев" in n:
            return 1453, "Осевой"
        if "крышн" in n:
            return 1459, "Крышный"
        if "канальн" in n:
            return 4683, "Канальный"
        return 4681, "Прочие вентиляторы"
    if "шумоглушитель" in n:
        return 1785, ""
    if "решетк" in n or "диффузор" in n:
        return 3947, "Воздухораспределители"
    if "зонт" in n:
        return 1490, "Зонты над шахтами"
    return np.nan, "Не найдено (по навигатору: Л2.Л3)"


def word_set(text):
    return set(WORDS_RE.findall(str(text).lower()))


def build_tmc_index(tmc_df):
    ids = pd.to_numeric(pick(tmc_df, "идтмцфск"), errors="coerce")
    names = pick(tmc_df, "наименованиетмцфск").astype(str)
    units = pick(tmc_df, "едизмтмц").astype(str)
    idx = []
    for i in range(len(tmc_df)):
        if pd.isna(ids.iloc[i]):
            continue
        nm = names.iloc[i]
        idx.append({"id": int(ids.iloc[i]), "name": nm, "unit": units.iloc[i],
                    "name_l": nm.lower(), "words": word_set(nm)})
    return idx


def find_tmc(name, article, index):
    name_l = str(name).lower()
    first = next((w for w in FIRST_RE.findall(name_l) if len(w) >= 3), None)
    if first is None:
        return np.nan, "Ключ поиска не определён"
    spec_words = word_set(name)
    art = str(article).strip().lower()
    best, best_score = None, -10 ** 9
    for cand in index:
        if first not in cand["name_l"]:
            continue
        score = len(spec_words & cand["words"])
        if len(art) >= 4 and art in cand["name_l"]:
            score += 10
        for pen in PENALTY_KEYS:
            if pen in cand["name_l"] and pen not in name_l:
                score -= 5
        if score > best_score:
            best, best_score = cand, score
    if best is None:
        return np.nan, "Нет ТМЦ, содержащих ключ «" + first + "»"
    return best["id"], best["name"]


# ------------------------------------------------------------
# Интерфейс
# ------------------------------------------------------------
st.title("Генератор ВОР (Ведомость объёмов работ)")
st.caption("Автоматическая привязка кодов КЕР и ТМЦ · тройная детализация · "
           "трассировка по колонке «Строка» · Промпт.txt встроен в приложение")

with st.sidebar:
    st.markdown("### 📖 Инструкция")
    st.markdown(
        """
        1. Загрузите три файла: **Спецификация.xlsx**, **База КЕР.xlsx**, **База ТМЦ.xlsx**.
        2. В «Навигаторе КЕР» укажите **Л2 Код** и **Л3 Код** (по умолчанию 2.8 / 2.8.3).
        3. Нажмите **«Сформировать ВОР»**.
        4. Скачайте **ВОР.xlsx** (листы: ВОР, Статистика, Не найдено).

        **Тройная детализация:** для каждой позиции создаётся строка «Спецификация»
        (оба кода), строка «КЕР» (без Код ТМЦ) и строка «ТМЦ» (без Код КЕР).
        Строки без Кол-ва сохраняются как заголовки — иерархия не теряется.
        """
    )
    with st.expander("Встроенный Промпт.txt"):
        st.text(PROMPT_TXT)

st.markdown("#### 📂 Исходные данные")
c1, c2, c3 = st.columns(3)
spec_f = c1.file_uploader(
    "Спецификация.xlsx", type=["xlsx", "xls"],
    help="Колонки: Файл, Лист, Система, Этаж, Наименование, Артикул, "
         "Производитель, ЕИ, Кол-во, Масса, Примечания, Строка")
ker_f = c2.file_uploader(
    "База КЕР.xlsx", type=["xlsx", "xls"],
    help="Колонки: ИД_КЕР, Наименование_КЕР, ЕдИзм КЕР, Иерархия, Л1–Л5, ФЕР")
tmc_f = c3.file_uploader(
    "База ТМЦ.xlsx", type=["xlsx", "xls"],
    help="Колонки: ИД ТМЦ фск, Наименование ТМЦ фск, ЕдИзм ТМЦ, КСР код Группы, Бренд, ФСБЦ")

st.markdown("#### 🧭 Навигатор КЕР")
n1, n2, _ = st.columns([1, 1, 2])
l2 = n1.text_input("Л2 Код", value="2.8")
l3 = n2.text_input("Л3 Код", value="2.8.3")

run = st.button("Сформировать ВОР", type="primary", use_container_width=True)

if run:
    if not (spec_f and ker_f and tmc_f):
        st.warning("⚠️ Загрузите все три обязательных файла: "
                   "Спецификация.xlsx, База КЕР.xlsx, База ТМЦ.xlsx.")
    else:
        try:
            progress = st.progress(0.04, text="Шаг 1/6 · Чтение файлов…")
            spec_df = pd.read_excel(spec_f)
            ker_df = pd.read_excel(ker_f)
            tmc_df = pd.read_excel(tmc_f)

            progress.progress(0.12, text="Шаг 2/6 · Фильтрация базы КЕР по навигатору…")
            l2n = norm_key(l2 or "2.8")
            l3n = norm_key(l3 or "2.8.3")
            ker_l2 = pick(ker_df, "л2код").astype(str).map(norm_key)
            ker_l3 = pick(ker_df, "л3код").astype(str).map(norm_key)
            ker_ids = pd.to_numeric(pick(ker_df, "идкер"), errors="coerce")
            ker_names = pick(ker_df, "наименованиекер").astype(str)
            ker_units = pick(ker_df, "едизмкер").astype(str)
            ker_map = {}
            for i in range(len(ker_df)):
                if pd.isna(ker_ids.iloc[i]):
                    continue
                if ker_l2.iloc[i] == l2n and ker_l3.iloc[i] == l3n:
                    ker_map[int(ker_ids.iloc[i])] = (ker_names.iloc[i], ker_units.iloc[i])
            if not ker_map:
                st.warning("Фильтр «Л2 = %s, Л3 = %s» вернул 0 строк — "
                           "использована вся база КЕР." % (l2, l3))
                for i in range(len(ker_df)):
                    if pd.notna(ker_ids.iloc[i]):
                        ker_map[int(ker_ids.iloc[i])] = (ker_names.iloc[i], ker_units.iloc[i])

            progress.progress(0.2, text="Шаг 3/6 · Индексация базы ТМЦ…")
            tmc_index = build_tmc_index(tmc_df)
            tmc_map = {r["id"]: r for r in tmc_index}

            names = pick(spec_df, "наименование").astype(str)
            articles = pick(spec_df, "артикул").astype(str)
            systems = pick(spec_df, "система").astype(str)
            floors = pick(spec_df, "этаж").astype(str)
            lines = pick(spec_df, "строка").astype(str)
            units = pick(spec_df, "еи").astype(str)
            qtys = pick(spec_df, "колво").map(parse_qty)

            result_rows, not_found = [], []
            system_num = {}
            counters = {"spec": 0, "headers": 0, "ker": 0, "tmc": 0,
                        "notfound": 0, "fason": 0,
                        "ta_spec": 0, "ta_ker": 0, "ta_tmc": 0, "ta_head": 0}

            n = len(spec_df)
            for i in range(n):
                if i % 25 == 0:
                    progress.progress(0.2 + 0.65 * i / max(n, 1),
                                      text="Шаги 4–5/6 · Подбор КЕР и ТМЦ: "
                                           "строка %d из %d" % (i + 1, n))
                name, art = names.iloc[i], articles.iloc[i]
                qty = qtys.iloc[i]
                if not name.strip() and pd.isna(qty):
                    continue

                sys_name = systems.iloc[i] or "—"
                if sys_name not in system_num:
                    system_num[sys_name] = len(system_num) + 1
                npp = "%03d" % system_num[sys_name]  # текстовое значение, нули сохраняются
                base = {"№ п/п": npp, "Система": systems.iloc[i], "Строка": lines.iloc[i],
                        "Этаж": floors.iloc[i], "Кол-во": qty}

                if pd.isna(qty):  # строка-заголовок 1/2 уровня
                    counters["headers"] += 1
                    counters["ta_head"] += 1
                    row = dict(base)
                    row.update({"Наименование": name, "ЕИ": units.iloc[i],
                                "Код КЕР": np.nan, "Код ТМЦ": np.nan,
                                "Расход ТМЦ": np.nan, "ТА": HEADER_TA})
                    result_rows.append(row)
                    continue

                counters["spec"] += 1
                ker_id, ker_note = get_ker_id(name)
                ker_ok = pd.notna(ker_id) and int(ker_id) in ker_map
                tmc_id, tmc_note = find_tmc(name, art, tmc_index)
                tmc_ok = pd.notna(tmc_id) and int(tmc_id) in tmc_map

                if ker_ok:
                    counters["ker"] += 1
                elif str(ker_note).startswith("Фасонные"):
                    counters["fason"] += 1
                if tmc_ok:
                    counters["tmc"] += 1
                if not ker_ok or not tmc_ok:
                    counters["notfound"] += 1
                    if not ker_ok:
                        not_found.append({"Система": systems.iloc[i], "Строка": lines.iloc[i],
                                          "Наименование": name, "Кол-во": qty,
                                          "Что не найдено": "Код КЕР", "Причина": ker_note})
                    if not tmc_ok:
                        not_found.append({"Система": systems.iloc[i], "Строка": lines.iloc[i],
                                          "Наименование": name, "Кол-во": qty,
                                          "Что не найдено": "Код ТМЦ", "Причина": tmc_note})

                # СТРОКА 1 — Спецификация (всегда)
                counters["ta_spec"] += 1
                r1 = dict(base)
                r1.update({"Наименование": name, "ЕИ": units.iloc[i],
                           "Код КЕР": int(ker_id) if ker_ok else np.nan,
                           "Код ТМЦ": int(tmc_id) if tmc_ok else np.nan,
                           "Расход ТМЦ": qty, "ТА": "Спецификация"})
                result_rows.append(r1)

                # СТРОКА 2 — КЕР (Код ТМЦ пустой)
                if ker_ok:
                    counters["ta_ker"] += 1
                    kn, ku = ker_map[int(ker_id)]
                    r2 = dict(base)
                    r2.update({"Наименование": kn, "ЕИ": ku, "Код КЕР": int(ker_id),
                               "Код ТМЦ": np.nan, "Расход ТМЦ": qty, "ТА": "КЕР"})
                    result_rows.append(r2)

                # СТРОКА 3 — ТМЦ (Код КЕР пустой)
                if tmc_ok:
                    counters["ta_tmc"] += 1
                    tr = tmc_map[int(tmc_id)]
                    r3 = dict(base)
                    r3.update({"Наименование": tr["name"], "ЕИ": tr["unit"],
                               "Код КЕР": np.nan, "Код ТМЦ": int(tmc_id),
                               "Расход ТМЦ": qty, "ТА": "ТМЦ"})
                    result_rows.append(r3)

            progress.progress(0.9, text="Шаг 6/6 · Формирование ВОР.xlsx…")

            df_vor = pd.DataFrame(result_rows, columns=VOR_COLS)
            for c in ("Кол-во", "Код КЕР", "Код ТМЦ", "Расход ТМЦ"):
                df_vor[c] = pd.to_numeric(df_vor[c], errors="coerce")
            df_vor["№ п/п"] = df_vor["№ п/п"].astype(str)  # текст: «001» не станет «1»

            df_stat = pd.DataFrame([
                ["Дата формирования", datetime.now().strftime("%d.%m.%Y %H:%M")],
                ["Навигатор: Л2 Код / Л3 Код", "%s / %s" % (l2 or "2.8", l3 or "2.8.3")],
                ["Всего строк в спецификации (с объёмом)", counters["spec"]],
                ["Строк-заголовков (уровень 1/2)", counters["headers"]],
                ["Всего строк в ВОР", len(df_vor)],
                ["Строк с подобранным Код КЕР", counters["ker"]],
                ["Строк с подобранным Код ТМЦ", counters["tmc"]],
                ["Строк с пометкой «Не найдено»", counters["notfound"]],
                ["Фасонные изделия (учтены в расценке)", counters["fason"]],
                ["", ""],
                ["Распределение по источникам (ТА)", "строк"],
                ["  — Спецификация", counters["ta_spec"]],
                ["  — КЕР", counters["ta_ker"]],
                ["  — ТМЦ", counters["ta_tmc"]],
                ["  — Строки-заголовки", counters["ta_head"]],
            ], columns=["Показатель", "Значение"])

            df_nf = pd.DataFrame(not_found, columns=[
                "Система", "Строка", "Наименование", "Кол-во", "Что не найдено", "Причина"])
            if df_nf.empty:
                df_nf = pd.DataFrame([["—", "—", "Все позиции обработаны", "", "—", "—"]],
                                     columns=df_nf.columns)

            buf = io.BytesIO()
            with pd.ExcelWriter(buf, engine="openpyxl") as writer:
                df_vor.to_excel(writer, sheet_name="ВОР", index=False)
                df_stat.to_excel(writer, sheet_name="Статистика", index=False)
                df_nf.to_excel(writer, sheet_name="Не найдено", index=False)
                ws = writer.sheets["ВОР"]
                widths = [8, 12, 10, 8, 64, 7, 10, 10, 10, 12, 16]
                for i, w in enumerate(widths, start=1):
                    ws.column_dimensions[chr(64 + i)].width = w
                # числовой формат 0.00 → в русской локали Excel отображается «71,52»
                for row in ws.iter_rows(min_row=2, min_col=7, max_col=7):
                    for cell in row:
                        cell.number_format = "0.00"
                for row in ws.iter_rows(min_row=2, min_col=10, max_col=10):
                    for cell in row:
                        cell.number_format = "0.00"
            buf.seek(0)

            progress.progress(1.0, text="Готово ✓")

            st.success("ВОР сформирован: **%d** строк (спецификация: %d · КЕР: %d · ТМЦ: %d · "
                       "заголовки: %d). КЕР подобран для %d позиций, ТМЦ — для %d, "
                       "«Не найдено» — %d." %
                       (len(df_vor), counters["ta_spec"], counters["ta_ker"],
                        counters["ta_tmc"], counters["ta_head"],
                        counters["ker"], counters["tmc"], counters["notfound"]))

            m1, m2, m3, m4, m5 = st.columns(5)
            m1.metric("Строк в ВОР", len(df_vor))
            m2.metric("Подобрано КЕР", counters["ker"])
            m3.metric("Подобрано ТМЦ", counters["tmc"])
            m4.metric("Не найдено", counters["notfound"])
            m5.metric("Систем", len(system_num))

            st.dataframe(df_vor.head(200), use_container_width=True, height=420)
            with st.expander("Позиции «Не найдено» (%d)" % len(not_found)):
                st.dataframe(df_nf, use_container_width=True)

            st.download_button("⬇️ Скачать ВОР.xlsx", data=buf.getvalue(),
                               file_name="ВОР.xlsx",
                               mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        except Exception as e:  # noqa: BLE001
            st.error("Ошибка обработки: %s" % e)
`;

export const REQUIREMENTS_TXT = `streamlit>=1.32
pandas>=2.0
openpyxl>=3.1
numpy>=1.24
`;

export const README_MD = `# Генератор ВОР (Ведомость объёмов работ)

Streamlit-приложение для автоматической привязки кодов **КЕР** и **ТМЦ**
к позициям спецификации с тройной детализацией
(Спецификация → КЕР → ТМЦ) и трассировкой по колонке «Строка».

## Возможности

- Подбор Код КЕР по ключевым словам наименования (19 правил, фильтруется
  «Навигатором КЕР»: Л2 Код / Л3 Код, по умолчанию 2.8 / 2.8.3).
- Подбор Код ТМЦ по первому слову + пересечению слов, бонус за артикул,
  штрафы за несовпадение категорий («труб», «светильник»).
- Тройная детализация: строка «Спецификация» (оба кода), строка «КЕР»
  (без Код ТМЦ), строка «ТМЦ» (без Код КЕР).
- Строки-заголовки 1/2 уровня сохраняются — иерархия не теряется.
- Колонка «№ п/п»: текст с ведущими нулями ('001, '002 …) — Excel не
  превращает номера в числа.
- Итог: **ВОР.xlsx** с листами «ВОР» (11 колонок), «Статистика», «Не найдено».

## Требования

- Python 3.10+

## Установка и запуск

\`\`\`bash
pip install -r requirements.txt
streamlit run app.py
\`\`\`

Приложение откроется в браузере по адресу http://localhost:8501.

## Использование

1. Загрузите три файла (все обязательные):
   - **Спецификация.xlsx** — колонки: Файл, Лист, Система, Этаж, Наименование,
     Артикул, Производитель, ЕИ, Кол-во, Масса, Примечания, Строка;
   - **База КЕР.xlsx** — колонки: ИД_КЕР, Наименование_КЕР, ЕдИзм КЕР,
     Иерархия, Л1–Л5 Код/Наименование, ФЕР;
   - **База ТМЦ.xlsx** — колонки: ИД ТМЦ фск, Наименование ТМЦ фск,
     ЕдИзм ТМЦ, КСР код Группы, Бренд, ФСБЦ и др.
2. В блоке «Навигатор КЕР» введите **Л2 Код** (например, 2.8) и
   **Л3 Код** (например, 2.8.3). Пустые поля = значения по умолчанию.
3. Нажмите **«Сформировать ВОР»** — обработка идёт с прогресс-баром.
4. Скачайте **ВОР.xlsx** кнопкой под результатами.

## Примечания

- Файл «Промпт.txt» встроен в код приложения как константа \`PROMPT_TXT\`
  и читается автоматически — загружать его не нужно.
- Фасонные изделия (отводы, переходы, тройники…) отдельный Код КЕР не
  получают — монтаж учтён в расценке на воздуховоды.
- Расход ТМЦ равен Кол-во (ресурсная часть КЕР в базе отсутствует).
- Числовые колонки записываются как числа (pd.to_numeric); в русской
  локали Excel отображается запятая как десятичный разделитель.
- Позиции без подобранного кода не удаляются — они попадают на лист
  «Не найдено» с указанием причины.
`;
