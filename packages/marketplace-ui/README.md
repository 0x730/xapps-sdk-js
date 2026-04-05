# `@xapps-platform/marketplace-ui`

React UI package for marketplace/catalog and xapp operational screens.

## Status

This package is now prepared for public distribution for React integrators who want the ready-made marketplace/catalog/activity UI layer above `@xapps-platform/embed-sdk`.

## Exports

- `MarketplaceProvider`, `useMarketplace`
- `MarketplaceApp`
- Pages/components:
  - `CatalogPage`
  - `XappDetailPage`
  - `PublishersPage`
  - `PublisherDetailPage`
  - `RequestsPage`
  - `RequestDetailPage`
  - `PaymentsPage`
  - `InvoicesPage`
  - `NotificationsPage`
  - `WidgetView`
- CSS entry: `@xapps-platform/marketplace-ui/marketplace.css`

## Locale

`MarketplaceProvider` accepts `env.locale` and uses the shared platform i18n core.

- current first-wave shipped locales: `en`, `ro`
- shared navigation/catalog/widget-shell copy now resolves through the common catalog
- open widget routes also forward runtime locale changes to the embedded widget with
  `XAPPS_LOCALE_CHANGED`

## Minimal usage

```tsx
import { MarketplaceApp, MarketplaceProvider } from "@xapps-platform/marketplace-ui";
import "@xapps-platform/marketplace-ui/marketplace.css";

export function App() {
  return (
    <MarketplaceProvider client={client} host={hostAdapter} env={env}>
      <MarketplaceApp />
    </MarketplaceProvider>
  );
}
```

## Notes

- Runtime: React host/integrator portal.
- Composes with `@xapps-platform/embed-sdk` when host pages need iframe catalog/widget orchestration.
- Provides shared marketplace navigation for `Xapps`, `Publishers`, and `Activity`, plus activity
  tabs for `Requests`, `Payments`, `Invoices`, and `Notifications`.
- `XappDetailPage` now also consumes the current-user XMS monetization read when exposed by the
  host client:
  - current access / subscription state
  - credits summary
  - additive entitlement summaries for owned durable unlocks
  - resolved paywall-driven plan options from the published xapp manifest
  - optional current-user checkout actions when the host exposes purchase-intent/payment-session helpers
  - shared plan semantics that distinguish recurring memberships from additive unlocks:
    - current recurring packages are not re-purchasable
    - owned additive unlocks are not re-purchasable
    - non-owned additive unlocks can still be purchased alongside an active membership and are
      presented as add-ons instead of replacement plans
- Supports xapp-scoped operational surfaces for `requests`, `payments`, `invoices`, and
  `notifications`.
- Host placement policy is declared through `MarketplaceEnv.host.operationalSurfaces`; the contract
  supports `in_router`, `side_panel`, and `full_page`, while current default behavior remains
  `in_router`.
- Does not replace `@xapps-platform/widget-sdk` (widget iframe runtime) or `@xapps-platform/server-sdk` (backend contracts).
- See package/runtime ownership: `docs/guides/12-package-usage-and-ownership.md`.
