# `@xapps-platform/widget-runtime`

Public React runtime components for rendering Xapps widgets outside publisher iframes.

## Status

This package is now prepared for public distribution for React integrators who want the platform-rendered widget runtime above the lower-level embed/widget bridge.

## Exports

- `UiKitWidget`
- `AppShellWidget`
- `WidgetRuntime`
- `useWidgetSession`
- `useWidgetUiBridge`
- `createWindowXappsHostAdapter`
- Types: `WidgetHostAdapter`, `WidgetContext`, `UiKitWidgetProps`, `AppShellWidgetProps`, `WidgetRuntimeProps`

## Bridge events supported

- `XAPPS_UI_NOTIFICATION`
- `XAPPS_UI_ALERT`
- `XAPPS_UI_MODAL_OPEN`
- `XAPPS_UI_MODAL_CLOSE`
- `XAPPS_UI_NAVIGATE`
- `XAPPS_UI_REFRESH`
- `XAPPS_UI_GET_CONTEXT` -> `XAPPS_UI_GET_CONTEXT_RESULT`
- `XAPPS_UI_STATE_UPDATE` (optional, if host provides `updateState`)
- `XAPPS_UI_EXPAND_REQUEST` -> `XAPPS_UI_EXPAND_RESULT` (optional, if host provides `expandWidget`)
- `XAPPS_OPEN_OPERATIONAL_SURFACE` (optional, if host provides `openOperationalSurface`)
- `XAPPS_GUARD_REQUEST` -> `XAPPS_GUARD_RESULT` + `XAPPS_GUARD_STATUS` (optional, if host provides `requestGuard`; otherwise config-driven fallback evaluator is used)
  - Fallback supports `config.policy.kind` (`confirmation`, `step_up`, `payment`, `subscription`, `allow`, `deny`)
  - Fallback supports predicate rules: `config.policy.pass_if_any`, `pass_if_all`, `fail_if_any`
- `XAPPS_REQUEST_CREATE_SUCCESS` (request-id tracking convenience in `useWidgetSession`)

## `UiKitWidget` usage

```tsx
import { UiKitWidget, type WidgetHostAdapter } from "@xapps-platform/widget-runtime";

const host: WidgetHostAdapter = {
  showNotification: (msg, variant) => console.log("notify", variant, msg),
  showAlert: (msg, title) => window.alert(`${title ?? "Alert"}\n\n${msg}`),
  openModal: (title, message) => console.log("modal-open", title, message),
  closeModal: () => console.log("modal-close"),
  navigate: (path) => console.log("navigate", path),
  refresh: () => window.location.reload(),
  expandWidget: async (input) => {
    // Map widget request to your app shell overlay/fullscreen logic.
    const stage = input.stage || (input.expanded ? "focus" : "inline");
    setWidgetOverlayStage(stage);
    return {
      hostManaged: true,
      expanded: stage !== "inline",
      stage,
    };
  },
};

<UiKitWidget
  apiBaseUrl={window.location.origin}
  installationId="inst_123"
  widgetToken={token}
  widget={widget}
  tool={tool}
  host={host}
/>;
```

## `AppShellWidget` usage

```tsx
import { AppShellWidget } from "@xapps-platform/widget-runtime";

<AppShellWidget
  apiBaseUrl={window.location.origin}
  installationId="inst_123"
  shellWidget={shellWidget}
  xappWidgets={xappWidgets}
  createWidgetSession={({ installationId, widgetId }) =>
    api.createWidgetSession({ installationId, widgetId })
  }
  host={host}
/>;
```

## Minimal usage

```tsx
import { WidgetRuntime } from "@xapps-platform/widget-runtime";

<WidgetRuntime
  apiBaseUrl={window.location.origin}
  installationId="inst_123"
  widgetId="w_123"
  createWidgetSession={createWidgetSession}
  host={hostAdapter}
/>;
```

## Notes

- Runtime: host/platform React app rendering widget UIs.
- Can be used in the same host app with `@xapps-platform/marketplace-ui` when product combines marketplace pages and runtime-rendered widgets.
- Separate concern from `@xapps-platform/widget-sdk` (publisher iframe widgets) and `@xapps-platform/embed-sdk` (host iframe bridge/orchestration).
- Host UI actions are delegated through `WidgetHostAdapter` (notification/modal/navigation/refresh).
- `WidgetHostAdapter.expandWidget(...)` enables host-managed `inline`/`focus`/`fullscreen` UX for widgets using the UI bridge.
- `WidgetHostAdapter.openOperationalSurface(...)` lets runtime-rendered widgets open marketplace
  surfaces for `requests`, `payments`, `invoices`, and `notifications`.
- No implicit `window.XappsHost` requirement; compatibility is opt-in with `createWindowXappsHostAdapter`.
- See package/runtime ownership: `docs/guides/12-package-usage-and-ownership.md`.
