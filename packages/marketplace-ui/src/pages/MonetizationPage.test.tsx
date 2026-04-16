// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MarketplaceProvider } from "../MarketplaceContext";
import { MonetizationPage } from "./MonetizationPage";

const cleanupFns: Array<() => void> = [];
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).React = React;

afterEach(() => {
  while (cleanupFns.length > 0) {
    cleanupFns.pop()?.();
  }
  document.body.innerHTML = "";
});

describe("MonetizationPage", () => {
  it("shows named virtual currency alongside current balances", async () => {
    const client: any = {
      listMyMonetizedXapps: async () => ({
        overview: {
          items: [{ xapp_id: "xapp_credits" }],
        },
      }),
      getCatalogXapp: async () => ({
        xapp: {
          id: "xapp_credits",
          publisher: { slug: "demo-publisher", name: "Demo Publisher" },
          publisher_id: "pub_1",
          name: "Credits App",
        },
        version: {
          id: "ver_1",
          version: "1.0.0",
        },
        manifest: {
          title: { en: "Credits App" },
          summary: { en: "Named balance app" },
          monetization: {},
        },
        tools: [],
        widgets: [],
      }),
      getMyXappMonetization: async () => ({
        xapp_id: "xapp_credits",
        version_id: "ver_1",
        subject_id: "subject_1",
        access_projection: {
          entitlement_state: "active",
          tier: "pro",
          source_ref: "catalog:plans",
          balance_state: "sufficient",
          credits_remaining: "12",
          virtual_currency: {
            code: "CREATOR_CREDITS",
            name: "Creator Credits",
          },
        },
        current_subscription: {
          id: "sub_1",
          status: "active",
          tier: "pro",
          renews_at: "2026-05-15T08:00:00.000Z",
        },
      }),
      getMyXappMonetizationHistory: async () => ({
        history: {
          wallet_accounts: {
            total: 2,
            items: [
              {
                id: "wallet_creator",
                balance_remaining: "12",
                virtual_currency: {
                  code: "CREATOR_CREDITS",
                  name: "Creator Credits",
                },
              },
              {
                id: "wallet_bonus",
                balance_remaining: "7",
                virtual_currency: {
                  code: "BONUS_TOKENS",
                  name: "Bonus Tokens",
                },
              },
            ],
          },
        },
      }),
    };

    const hostAdapter: any = {
      subjectId: "self",
      getInstallationsByXappId: () => ({
        xapp_credits: { installationId: "inst_credits", xappId: "xapp_credits" },
      }),
      notifyNavigation: () => {},
    };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/marketplace/monetization"]}>
          <MarketplaceProvider client={client} host={hostAdapter}>
            <Routes>
              <Route path="/marketplace/monetization" element={<MonetizationPage />} />
            </Routes>
          </MarketplaceProvider>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    cleanupFns.push(() => {
      act(() => root.unmount());
      host.remove();
    });

    const text = host.textContent || "";
    expect(text).toContain("Credits App");
    expect(text).toContain("Currency");
    expect(text).toContain("Creator Credits (CREATOR_CREDITS)");
    expect(text).toContain("Balance");
    expect(text).toContain("12 Creator Credits");
    expect(text).not.toContain("Balances now");
    expect(text).not.toContain("7 Bonus Tokens");
    expect(text).toContain("Balance status");
    expect(text).toContain("sufficient");
  });
});
