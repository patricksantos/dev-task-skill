import assert from "node:assert/strict";
import test from "node:test";
import { parseTheme, THEME_BOOT_SCRIPT, THEME_KEY } from "@/theme/theme";

test("o tema padrão é escuro e só light é o modo claro", () => {
  assert.equal(parseTheme(undefined), "dark");
  assert.equal(parseTheme(null), "dark");
  assert.equal(parseTheme("dark"), "dark");
  assert.equal(parseTheme("light"), "light");
  assert.equal(parseTheme("system"), "dark");
  assert.match(THEME_BOOT_SCRIPT, new RegExp(THEME_KEY));
  assert.match(THEME_BOOT_SCRIPT, /data-theme/);
});
