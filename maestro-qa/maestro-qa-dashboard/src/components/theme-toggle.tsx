"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun } from "@/components/icons";
import { THEME_EVENT, applyTheme, readTheme, type Theme } from "@/theme/theme";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(THEME_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "dark");
}

export function ThemeToggle({ labeled = false }: { labeled?: boolean }) {
  const theme = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      onClick={() => applyTheme(next)}
    >
      {theme === "dark" ? <IconSun /> : <IconMoon />}
      {labeled ? <span>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span> : null}
    </button>
  );
}
