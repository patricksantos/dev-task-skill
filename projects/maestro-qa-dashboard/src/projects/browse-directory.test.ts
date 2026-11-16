import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RequestError } from "@/errors";
import { normalizePickedPath, pickLocalDirectory } from "./browse-directory";

describe("browse-directory", () => {
  it("normaliza POSIX path com barra final", () => {
    assert.equal(normalizePickedPath("/Users/yan/app/\n"), "/Users/yan/app");
  });

  it("cancelamento vazio vira null", () => {
    assert.equal(normalizePickedPath("\n"), null);
  });

  it("abre o diálogo do macOS e devolve o caminho", async () => {
    const calls: unknown[] = [];
    const path = await pickLocalDirectory({
      platform: "darwin",
      execFile: async (cmd, args) => {
        calls.push([cmd, args]);
        return { stdout: "/Users/yan/StudioProjects/app/\n", stderr: "" };
      },
    });
    assert.equal(path, "/Users/yan/StudioProjects/app");
    assert.equal((calls[0] as string[])[0], "osascript");
  });

  it("cancelamento do macOS devolve null", async () => {
    const path = await pickLocalDirectory({
      platform: "darwin",
      execFile: async () => ({ stdout: "", stderr: "" }),
    });
    assert.equal(path, null);
  });

  it("recusa plataforma sem diálogo nativo", async () => {
    await assert.rejects(
      () => pickLocalDirectory({ platform: "freebsd", execFile: async () => ({ stdout: "", stderr: "" }) }),
      (error: unknown) => error instanceof RequestError && error.status === 501,
    );
  });
});
