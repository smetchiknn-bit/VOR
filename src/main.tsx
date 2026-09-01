import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Флаг для авто-починки путей (см. inline-скрипт в index.html):
// модуль исполнился — значит абсолютные пути работают, перезапуск не нужен.
(window as unknown as { __VOR_APP_MOUNTED__: boolean }).__VOR_APP_MOUNTED__ = true;

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
