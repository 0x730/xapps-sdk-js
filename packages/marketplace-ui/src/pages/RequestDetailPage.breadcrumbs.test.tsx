import React from "react";
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MarketplaceProvider } from "../MarketplaceContext";
import { RequestDetailPage } from "./RequestDetailPage";

describe("RequestDetailPage", () => {
  it("renders breadcrumbs with marketplace, xapp and request id (preserves token + xappId)", () => {
    // Vitest's SSR compilation in this repo uses the classic JSX runtime for React code,
    // so ensure the global `React` identifier exists for server-rendered modules.
    (globalThis as any).React = React;

    const client: any = {
      listCatalogXapps: async () => ({ items: [] }),
      getCatalogXapp: async () => ({ xapp: {}, version: {}, manifest: {}, tools: [], widgets: [] }),
      listMyRequests: async () => ({ items: [] }),
      getMyRequest: async () => ({}),
    };

    const host: any = {
      getInstallationsByXappId: () => ({}),
      refreshInstallations: () => {},
      openWidget: () => {},
    };

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/marketplace/requests/01REQ?xappId=01XAPP&token=tok123"]}>
        <MarketplaceProvider client={client} host={host}>
          <Routes>
            <Route path="marketplace/requests/:id" element={<RequestDetailPage />} />
          </Routes>
        </MarketplaceProvider>
      </MemoryRouter>,
    );

    expect(html).toContain("Marketplace");
    expect(html).toContain("01REQ");

    // Breadcrumb links should resolve under the same base and preserve token.
    expect(html).toContain('href="/marketplace?token=tok123"');
    expect(html).toContain('href="/marketplace/xapps/01XAPP?token=tok123"');
    expect(html).toContain('href="/marketplace/requests?xappId=01XAPP&amp;token=tok123"');
  });
});
