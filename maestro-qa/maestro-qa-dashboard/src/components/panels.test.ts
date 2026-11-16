import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogMark, HistoryMark, LogLine, ProgressBar } from "@/components/panels";

test("a barra de progresso reflete cenários confirmados e ignora o tempo decorrido", () => {
  const html = renderToStaticMarkup(
    createElement(ProgressBar, {
      confirmed: 0,
      total: 4,
      current: "home_to_stores",
      command: "Assert that Restaurantes is visible",
      elapsed: "2m 10s",
      state: "Em execução",
      demo: false,
    }),
  );
  assert.match(html, /0 de 4 concluídos/);
  assert.match(html, /width:0%/);
  assert.match(html, /Atual: home_to_stores/);
  assert.equal(html.includes("Decorrido 2m 10s"), true);
  assert.equal(html.includes("width:100%"), false);
});

test("log de falha, catálogo e demonstração ficam distinguíveis", () => {
  const failure = renderToStaticMarkup(
    createElement(LogLine, {
      entry: {
        id: 1,
        runId: "run",
        scenarioName: "home_to_coupons",
        stream: "stdout",
        ts: "2026-11-12T18:00:00.000Z",
        line: "Assert that Cupons is visible... FAILED",
        command: null,
      },
    }),
  );
  assert.match(failure, /class="log stdout fail"/);
  assert.match(failure, /home_to_coupons/);

  const included = renderToStaticMarkup(createElement(CatalogMark, { name: "home", availability: "included" }));
  const blocked = renderToStaticMarkup(createElement(CatalogMark, { name: "listing", availability: "blocked" }));
  const outside = renderToStaticMarkup(createElement(CatalogMark, { name: "category_tabs", availability: "available" }));
  assert.match(included, /Na suíte completa/);
  assert.match(blocked, /Bloqueado/);
  assert.match(outside, /Disponível, não incluído/);

  const demo = renderToStaticMarkup(createElement(HistoryMark, { demo: true }, null));
  const real = renderToStaticMarkup(createElement(HistoryMark, { demo: false }, null));
  assert.match(demo, /Demonstração/);
  assert.equal(demo.includes("Execução real"), false);
  assert.match(real, /Execução real/);
});
