export type Theme = "dark" | "light";

export const THEME_KEY = "maestro-qa-theme";
export const THEME_EVENT = "maestro-theme";

export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var v=t==="light"?"light":"dark";var r=document.documentElement;r.setAttribute("data-theme",v);r.style.colorScheme=v;}catch(e){document.documentElement.setAttribute("data-theme","dark");document.documentElement.style.colorScheme="dark"}`;

export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" ? "light" : "dark";
}

export function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return parseTheme(window.localStorage.getItem(THEME_KEY));
  } catch {
    return "dark";
  }
}

function paintTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  paintTheme(theme);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* localStorage pode estar bloqueado */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}
