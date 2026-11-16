import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "@/config";
import { checkPrerequisites } from "@/prerequisites/prerequisites";

const booted = {
  devices: {
    ios: [{ udid: "11111111-1111-4111-8111-111111111111", name: "iPhone 16 Plus", state: "Booted" }],
  },
};

test("a consulta da API não envia credencial e reconhece o simulador ligado", async () => {
  let authorization = "";
  const report = await checkPrerequisites(loadConfig(), {
    fetchImpl: async (_url, init) => {
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response("", { status: 404 });
    },
    execFileImpl: async () => ({ stdout: JSON.stringify(booted) }),
  });
  assert.equal(authorization, "");
  assert.equal(report.checks.find((check) => check.id === "hml")?.ok, true);
  assert.equal(report.checks.find((check) => check.id === "simulator")?.ok, true);
  assert.match(report.checks.find((check) => check.id === "simulator")?.message ?? "", /iPhone 16 Plus/);
});

test("falha de rede da API não bloqueia os pré-requisitos obrigatórios", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-prereq-"));
  const bin = path.join(root, "maestro");
  fs.mkdirSync(path.join(root, ".maestro/flows/login"), { recursive: true });
  fs.writeFileSync(path.join(root, ".maestro/flows/login/sign_in.yaml"), "appId: com.example.app\n");
  fs.writeFileSync(bin, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(bin, 0o755);
  const previous = process.env.MAESTRO_API_URL;
  process.env.MAESTRO_API_URL = "https://api.example.com/health";
  try {
    const report = await checkPrerequisites(
      loadConfig({
        repoRoot: root,
        maestroBin: bin,
        simulatorUdid: "11111111-1111-4111-8111-111111111111",
      }),
      {
        fetchImpl: async () => {
          throw new Error("offline");
        },
        execFileImpl: async () => ({ stdout: JSON.stringify(booted) }),
      },
    );
    assert.equal(report.checks.find((check) => check.id === "hml")?.ok, false);
    assert.equal(report.checks.find((check) => check.id === "hml")?.level, "warning");
    assert.equal(report.ready, true);
  } finally {
    if (previous === undefined) delete process.env.MAESTRO_API_URL;
    else process.env.MAESTRO_API_URL = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
