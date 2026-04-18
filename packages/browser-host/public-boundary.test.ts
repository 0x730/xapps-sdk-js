import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

describe("@xapps-platform/browser-host public boundary", () => {
  it("keeps reference host controllers out of the published package exports", () => {
    const pkg = JSON.parse(readWorkspaceFile("packages/browser-host/package.json")) as {
      exports?: Record<string, unknown>;
    };
    const exportsMap = pkg.exports || {};

    expect(exportsMap["."]).toBeTruthy();
    expect(exportsMap["./backend-base"]).toBeTruthy();
    expect(exportsMap["./launcher-core"]).toBeTruthy();
    expect(exportsMap["./embed-surface"]).toBeTruthy();
    expect(exportsMap["./standard-runtime"]).toBeTruthy();
    expect(exportsMap["./subject-profile"]).toBeTruthy();
    expect(exportsMap["./modal-shell"]).toBeTruthy();
    expect(exportsMap["./xms"]).toBeTruthy();

    expect(exportsMap["./host-shell"]).toBeUndefined();
    expect(exportsMap["./host-status"]).toBeUndefined();
    expect(exportsMap["./reference-runtime"]).toBeUndefined();
    expect(exportsMap["./marketplace-host"]).toBeUndefined();
    expect(exportsMap["./single-xapp-host"]).toBeUndefined();
  });

  it("keeps the root barrel focused on SDK-level exports", () => {
    const source = readWorkspaceFile("packages/browser-host/src/index.ts");

    expect(source).toContain('export * from "./backend-base.js"');
    expect(source).toContain('export * from "./launcher-core.js"');
    expect(source).toContain('export * from "./embed-surface.js"');
    expect(source).toContain('export * from "./standard-runtime.js"');
    expect(source).toContain('export * from "./subjectProfile.js"');
    expect(source).toContain('export * from "./modalShell.js"');
    expect(source).toContain('export * from "./xms.js"');

    expect(source).not.toContain('export * from "./host-shell.js"');
    expect(source).not.toContain('export * from "./host-status.js"');
    expect(source).not.toContain('export * from "./reference-runtime.js"');
    expect(source).not.toContain('export * from "./marketplace-host.js"');
    expect(source).not.toContain('export * from "./single-xapp-host.js"');
  });
});
