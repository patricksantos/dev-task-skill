import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { plannedFlowsForSuite, readCatalog, readPlannedFlows } from "@/catalog/catalog";
import { resolveProject } from "@/project";

test("separa fluxos autorizados dos que ficam fora da suíte", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-catalog-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, ".maestro/flows/coupons"), { recursive: true });
  fs.writeFileSync(path.join(root, ".maestro/flows/coupons/categories.yaml"), "appId: com.example.app\n");
  fs.writeFileSync(path.join(root, ".maestro/flows/coupons/category_tabs.yaml"), "appId: com.example.app\n");
  fs.writeFileSync(
    path.join(root, "scripts/run_maestro_coupons.sh"),
    "#!/bin/bash\n.maestro/flows/coupons/categories.yaml\n",
  );
  const catalog = readCatalog(root);
  const coupons = catalog.modules.find((module) => module.id === "coupons");
  assert.equal(coupons?.flows.find((flow) => flow.name === "categories")?.suites.includes("coupons"), true);
  assert.deepEqual(coupons?.flows.find((flow) => flow.name === "category_tabs")?.suites, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test("descobre as suítes pelos fluxos quando o repositório não tem os scripts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-flows-"));
  fs.mkdirSync(path.join(root, ".maestro/flows/login"), { recursive: true });
  fs.writeFileSync(path.join(root, ".maestro/flows/login/sign_in.yaml"), "appId: com.example.shop\n");
  const project = resolveProject(root, {});
  assert.equal(project.driver, "flows");
  assert.equal(project.appId, "com.example.shop");
  assert.deepEqual(project.suites.map((suite) => suite.id), ["all", "login"]);
  const catalog = readCatalog(root);
  const login = catalog.modules.find((module) => module.id === "login");
  assert.equal(login?.flows[0]?.suites.includes("all"), true);
  assert.equal(login?.flows[0]?.suites.includes("login"), true);
  assert.equal(plannedFlowsForSuite(root, "login").length, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test("lê um script local sem executá-lo", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-script-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "scripts/run_maestro_smoke.sh"),
    ".maestro/flows/smoke/home.yaml\n.maestro/flows/smoke/return_home.yaml\n",
  );
  assert.deepEqual(readPlannedFlows(root, "scripts/run_maestro_smoke.sh").map((flow) => flow.name), ["home", "return_home"]);
  fs.rmSync(root, { recursive: true, force: true });
});
