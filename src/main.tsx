import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const rootEl = document.getElementById("root")!;

/**
 * Диагностика вместо пустого экрана: если модуль упал — пользователь
 * видит карточку с причиной и кнопкой перезагрузки (в любом контексте:
 * предпросмотр, отдельное окно, подкаталог).
 */
function showFatal(title: string, detail: string) {
  try {
    rootEl.innerHTML = "";
    const box = document.createElement("div");
    box.style.cssText =
      "min-height:100vh;display:flex;align-items:center;justify-content:center;" +
      "background:#eef1f0;padding:24px;font-family:'IBM Plex Sans','Segoe UI',sans-serif;";
    const card = document.createElement("div");
    card.style.cssText =
      "max-width:640px;width:100%;background:#fff;border:2px solid #b23c3a;padding:26px;";
    card.innerHTML =
      '<div style="font-family:\'Unbounded\',sans-serif;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:.04em;color:#0e1823;font-size:17px;">Сбой запуска приложения</div>' +
      '<p style="color:#55708a;font-size:13px;line-height:1.5;margin:10px 0 14px;">' +
      title +
      " Текст ошибки ниже — сообщите его, если проблема повторяется.</p>" +
      '<pre style="background:#f5f7f6;border:1px solid #dde3e6;padding:12px;font-size:11px;' +
      'font-family:\'JetBrains Mono\',monospace;overflow:auto;max-height:220px;color:#b23c3a;' +
      'white-space:pre-wrap;margin:0;"></pre>' +
      '<button type="button" style="margin-top:16px;background:#0e1823;color:#ffc145;border:none;' +
      "padding:11px 20px;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:" +
      'uppercase;cursor:pointer;font-family:\'Unbounded\',sans-serif;">Перезагрузить</button>';
    card.querySelector("pre")!.textContent = detail || "—";
    card.querySelector("button")!.addEventListener("click", () => window.location.reload());
    box.appendChild(card);
    rootEl.appendChild(box);
  } catch {
    /* совсем крайний случай — оставляем как есть */
  }
}

window.addEventListener("error", (e) => {
  showFatal("Ошибка исполнения модуля.", (e.message || "") + "\n" + (e.error?.stack ?? ""));
});
window.addEventListener("unhandledrejection", (e) => {
  showFatal("Необработанная асинхронная ошибка.", String(e.reason));
});

try {
  ReactDOM.createRoot(rootEl).render(<App />);
} catch (e) {
  showFatal("Не удалось смонтировать интерфейс.", String(e));
}
