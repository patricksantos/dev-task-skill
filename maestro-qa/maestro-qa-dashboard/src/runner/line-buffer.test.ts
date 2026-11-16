import assert from "node:assert/strict";
import test from "node:test";
import { createLineBuffer } from "@/runner/line-buffer";

test("junta fragmentos e trata retorno de carro como linha", () => {
  const lines: string[] = [];
  const buffer = createLineBuffer((line) => lines.push(line));
  buffer.push("Run");
  buffer.push("ning on iPhone\r > Flow home\nLaunch");
  buffer.push(" app...\n");
  buffer.flush();
  assert.deepEqual(lines, ["Running on iPhone", " > Flow home", "Launch app..."]);
});
