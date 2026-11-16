import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReadField, SelectField, TextField } from "@/components/fields";

test("select customizado não usa o elemento nativo e reserva espaço para o chevron", () => {
  const html = renderToStaticMarkup(
    createElement(SelectField, {
      ariaLabel: "Projeto ativo",
      value: "",
      onChange: () => undefined,
      options: [{ value: "", label: "Nenhum projeto cadastrado" }],
    }),
  );
  assert.equal(html.includes("<select"), false);
  assert.match(html, /select-trigger/);
  assert.match(html, /Nenhum projeto cadastrado/);
});

test("campo de leitura não usa input nativo", () => {
  const html = renderToStaticMarkup(createElement(ReadField, { label: "Ambiente base", value: "dev · API" }));
  assert.equal(html.includes("<input"), false);
  assert.match(html, /dev · API/);
});

test("campo de texto usa classe field e não o visual nativo", () => {
  const html = renderToStaticMarkup(createElement(TextField, { label: "Busca", value: "", onChange: () => undefined, placeholder: "Buscar" }));
  assert.match(html, /class="field"/);
  assert.match(html, /Busca/);
});
