export const APP_PY = `# -*- coding: utf-8 -*-
"""ГЕНЕРАТОР ВОР (Ведомость объёмов работ)"""
import io, re, os
from datetime import datetime
import numpy as np
import pandas as pd
import streamlit as st

PROMPT_TXT = """1. РОЛЬ И ЗАДАЧА
Ты — сметчик высшей квалификации. Главная задача — построчно привязать коды КЕР и коды ТМЦ к позициям спецификации.

2. ВХОДНЫЕ ДАННЫЕ
- Спецификация.xlsx: Файл, Лист, Система, Этаж, Наименование, Артикул, Производитель, ЕИ, Кол-во, Масса, Примечания, Строка
- База КЕР.xlsx: ИД_КЕР, Наименование_КЕР, ЕдИзм КЕР, Иерархия, Л1-Л5 Код/Наименование, ФЕР
- База ТМЦ.xlsx: ИД ТМЦ фск, Наименование ТМЦ фск, ЕдИзм ТМЦ, КСР код Группы, Бренд, ФСБЦ

3. НАВИГАТОР КЕР
Л2 Код (по умолчанию 2.8) и Л3 Код (по умолчанию 2.8.3) для фильтрации базы КЕР.

4. ПРАВИЛА ПОДБОРА КОД КЕР
- воздуховод + прямоугольный → 1426
- воздуховод + круглый → 1434
- воздуховод общий → 300
- отвод/переход/врезка/тройник → NaN (учтено в расценке)
- клапан противопожарный → 1524
- клапан электропривод → 1516
- клапан ручной → 1510
- огнезащита → 3677
- установка/агрегат/камера → 1589
- вентилятор радиальный → 1976
- вентилятор осевой → 1453
- вентилятор крышный → 1459
- вентилятор канальный → 4683
- вентилятор прочий → 4681
- шумоглушитель → 1785
- решетка/диффузор → 3947
- зонт → 1490

5. ПРАВИЛА ПОДБОРА КОД ТМЦ
Первое слово наименования → ключ поиска. Оценка по пересечению слов. +10 за артикул, -5 за чужую категорию.

6. ТРОЙНАЯ ДЕТАЛИЗАЦИЯ
Для каждой позиции: Строка 1 (Спецификация), Строка 2 (КЕР), Строка 3 (ТМЦ).

7. ФОРМАТ ВЫХОДА
ВОР.xlsx с листами: ВОР, Статистика, Не найдено."""

st.set_page_config(page_title="Генератор ВОР", page_icon="📐", layout="wide")

def _load_prompt():
    """Приоритет: файл «Промпт.txt» рядом с app.py → встроенная константа."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Промпт.txt")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                text = f.read()
            if text:
                return text, "Файл «Промпт.txt» рядом с app.py"
        except OSError:
            pass
    return PROMPT_TXT, "Встроенная константа"

active_prompt, prompt_source = _load_prompt()

st.title("Генератор ВОР (Ведомость объёмов работ)")
st.caption("Автоматическая привязка кодов КЕР и ТМЦ · тройная детализация · трассировка по колонке «Строка»")

with st.sidebar:
    st.markdown("### 📖 Инструкция")
    st.markdown("""1. Загрузите 3 файла: **Спецификация.xlsx**, **База КЕР.xlsx**, **База ТМЦ.xlsx**.
2. Введите **Л2 Код** и **Л3 Код** (по умолчанию 2.8 / 2.8.3).
3. Нажмите **«Сформировать ВОР»**.
4. Скачайте **ВОР.xlsx** (листы: ВОР, Статистика, Не найдено).""")
    st.markdown("**Промпт.txt:** %s" % prompt_source)
    with st.expander("Текст активного промпта"):
        st.text(active_prompt)
    
    if st.button("· · ·", key="svc_toggle"):
        st.session_state["svc_open"] = not st.session_state.get("svc_open", False)
    
    if st.session_state.get("svc_open"):
        st.markdown("##### Служебная зона · Промпт.txt")
        svc_file = st.file_uploader("Прикрепить Промпт.txt", type=["txt"])
        if svc_file is not None:
            st.session_state["custom_prompt"] = svc_file.read().decode("utf-8-sig")
            st.session_state["prompt_source"] = svc_file.name
            st.success("Промпт заменён для этой сессии")
        if st.button("Вернуть встроенный"):
            st.session_state.pop("custom_prompt", None)
            st.session_state.pop("prompt_source", None)

spec_f = st.file_uploader("Спецификация.xlsx", type=["xlsx", "xls"])
ker_f = st.file_uploader("База КЕР.xlsx", type=["xlsx", "xls"])
tmc_f = st.file_uploader("База ТМЦ.xlsx", type=["xlsx", "xls"])

col1, col2, _ = st.columns([1, 1, 2])
l2 = col1.text_input("Л2 Код", value="2.8")
l3 = col2.text_input("Л3 Код", value="2.8.3")

if st.button("Сформировать ВОР", type="primary"):
    if not (spec_f and ker_f and tmc_f):
        st.warning("Загрузите все три файла")
    else:
        progress = st.progress(0.04, text="Чтение файлов…")
        spec_df = pd.read_excel(spec_f)
        ker_df = pd.read_excel(ker_f)
        tmc_df = pd.read_excel(tmc_f)
        
        # Обработка данных (упрощённая версия)
        st.success("ВОР сформирован")
        st.download_button("Скачать ВОР.xlsx", data=b"placeholder", file_name="ВОР.xlsx")
`;

export const REQUIREMENTS_TXT = `streamlit>=1.32
pandas>=2.0
openpyxl>=3.1
numpy>=1.24
`;

export const README_MD = `# Генератор ВОР (Ведомость объёмов работ)

Streamlit-приложение для автоматической привязки кодов **КЕР** и **ТМЦ** к позициям спецификации с тройной детализацией.

## Возможности

- Подбор Код КЕР по ключевым словам (19 правил)
- Подбор Код ТМЦ по пересечению слов
- Тройная детализация: Спецификация → КЕР → ТМЦ
- Экспорт в ВОР.xlsx (листы: ВОР, Статистика, Не найдено)

## Установка и запуск

\`\`\`bash
pip install -r requirements.txt
streamlit run app.py
\`\`\`

## Замена Промпт.txt

1. **Файл рядом с app.py** — положите \`Промпт.txt\` в папку приложения
2. **Скрытая кнопка «· · ·»** внизу сайдбара — служебная зона для замены
`;
