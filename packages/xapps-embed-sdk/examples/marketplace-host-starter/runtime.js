import {
  createHostDomUiController,
  createHostPaymentResumeState,
  createStandardMarketplaceRuntime,
} from "/embed/sdk/xapps-embed-sdk.esm.js";
import { setWidgetPlaceholder } from "./shell.js";

const STARTER_THEME = {
  primary: "#2358f2",
  primaryDark: "#14389f",
  bg: "#eef3ff",
  bgSubtle: "#e0e8ff",
  card: "#ffffff",
  border: "#c3d0ea",
  text: "#132033",
  muted: "#61708a",
  shadowSm: "0 3px 8px rgba(19, 32, 51, 0.06)",
  shadow: "0 18px 40px rgba(19, 32, 51, 0.09)",
  shadowLg: "0 32px 68px rgba(19, 32, 51, 0.12)",
  radiusSm: "12px",
  radiusMd: "16px",
  radiusLg: "22px",
  tokens: {
    "--mx-card-bg": "#ffffff",
    "--mx-bg-subtle": "#e0e8ff",
  },
};

export function createMarketplaceHostStarterRuntime(options) {
  const hostUi = createHostDomUiController({
    toastRootId: "toast-root",
    modalBackdropId: "host-modal",
    modalTitleId: "host-modal-title",
    modalMessageId: "host-modal-message",
    modalCloseId: "host-modal-close",
  });

  return createStandardMarketplaceRuntime({
    baseUrl: options.gatewayBaseUrl,
    subjectId: options.subjectId,
    paymentResumeState: createHostPaymentResumeState(window.location.href, {
      autoCleanUrl: true,
    }),
    hostUi,
    theme: STARTER_THEME,
    apiBasePath: "/api",
    getCatalogMount: () => document.getElementById("catalog"),
    getWidgetMount: () => document.getElementById("widget"),
    singlePanel: {
      resumeDelayMs: 220,
    },
    splitPanel: {
      widgetTitle: "App Widget",
      placeholderMessage: "Select an app from the marketplace to open its widget in this panel.",
      emptyCatalogMessage: "Select an app from the marketplace to open its widget.",
      xappDetailMismatchMessage: "Select a widget from this app to open it.",
      setWidgetPlaceholder,
      onExpandError: (error) => {
        console.warn("[marketplace-host-starter] split-panel expand failed", error);
      },
    },
  });
}
