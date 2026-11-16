const DISPLAY_ALIASES: Record<string, string> = {
  all: "Todos",
};

export function humanizeLabel(id: string | null | undefined): string {
  if (!id) return "—";
  const alias = DISPLAY_ALIASES[id];
  if (alias) return alias;
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
