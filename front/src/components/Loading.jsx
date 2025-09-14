// src/components/Loading.jsx
import React, { useEffect, useState } from "react";
import "../App.css";

export default function Loading({ active = false, duration = 500 }) {
  // visible controla se o componente deve estar montado no DOM
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    let timer;
    if (active) {
      // quando ativar: monta imediatamente (entra com fade-in)
      setVisible(true);
    } else {
      // quando desativar: espera o tempo da animação e desmonta
      timer = setTimeout(() => setVisible(false), duration);
    }
    return () => clearTimeout(timer);
  }, [active, duration]);

  if (!visible) return null;

  return (
    <div
      className={`loading-overlay ${active ? "fade-in" : "fade-out"}`}
      aria-hidden={!active}
    >
      <div className="loading-spinner" />
      <p>Carregando...</p>
    </div>
  );
}
