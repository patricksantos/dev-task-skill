import assert from "node:assert/strict";
import test from "node:test";
import { assertApiUrl, loadConfig } from "@/config";

test("a configuração exige repositório absoluto e só aceita API HTTPS", () => {
  const config = loadConfig({ repoRoot: "/tmp/app-exemplo", simulatorUdid: "invalido" });
  assert.equal(config.repoRoot, "/tmp/app-exemplo");
  assert.equal(config.simulatorUdid, "");
  assert.equal(config.apiUrl, null);
  assert.equal(loadConfig({ repoRoot: "relativo" }).repoRoot, "");
  assert.equal(loadConfig({ apiUrl: "https://api.example.com/health" }).apiUrl, "https://api.example.com/health");
  assert.equal(loadConfig({ apiUrl: "http://api.example.com" }).apiUrl, null);
  assert.throws(() => assertApiUrl("http://api.example.com"));
  assert.doesNotThrow(() => assertApiUrl("https://api.example.com/health"));
});
