// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createHostConfirmDialog } from "./hostUiBridge";

describe("createHostConfirmDialog", () => {
  let fullscreenRoot: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    fullscreenRoot = document.createElement("div");
    document.body.appendChild(fullscreenRoot);
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: fullscreenRoot,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    document.body.innerHTML = "";
  });

  it("mounts the fallback confirm overlay inside the active fullscreen root", async () => {
    const confirm = createHostConfirmDialog({ target: window });
    const resultPromise = confirm({
      title: "Confirm",
      message: "Continue?",
      confirmLabel: "Continue",
      cancelLabel: "Cancel",
    });

    const overlay = fullscreenRoot.firstElementChild as HTMLElement | null;
    expect(overlay).toBeTruthy();
    expect(overlay?.parentElement).toBe(fullscreenRoot);

    const confirmButton = Array.from(overlay?.querySelectorAll("button") || []).find(
      (el) => el.textContent === "Continue",
    ) as HTMLButtonElement | undefined;
    expect(confirmButton).toBeTruthy();
    confirmButton?.click();

    await expect(resultPromise).resolves.toBe(true);
  });
});
