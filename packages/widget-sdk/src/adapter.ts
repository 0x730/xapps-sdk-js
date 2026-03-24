import { createBridge, type XappsBridge, type XappsWidgetContext } from "./index.js";

/**
 * Options for the lightweight global adapter wrapper.
 */
export interface XappsAdapterInitOptions {
  targetOrigin?: string;
  onContext?: (context: XappsWidgetContext) => void;
  onSessionExpired?: (payload: unknown) => void;
  onTokenRefresh?: (token: string) => void;
}

/**
 * Global adapter instance returned by `init(...)`.
 */
export interface XappsAdapterInstance {
  bridge: XappsBridge;
  destroy: () => void;
}

function installGlobalAdapter() {
  const globalWindow = globalThis as typeof globalThis & { XappsAdapter?: { init: typeof init } };
  if (typeof window === "undefined") return;
  globalWindow.XappsAdapter = { init };
}

export function init(options: XappsAdapterInitOptions = {}): XappsAdapterInstance {
  const bridge = createBridge({
    targetOrigin: options.targetOrigin,
    autoHandshake: true,
  });

  if (typeof options.onTokenRefresh === "function") {
    bridge.onTokenRefresh((token) => options.onTokenRefresh?.(token));
  }
  if (typeof options.onSessionExpired === "function") {
    bridge.onSessionExpired((payload) => options.onSessionExpired?.(payload));
  }
  if (typeof options.onContext === "function") {
    void bridge.getContext().then((context) => options.onContext?.(context));
  }

  return {
    bridge,
    destroy: () => bridge.destroy(),
  };
}

installGlobalAdapter();

/**
 * Global adapter namespace exposed for plain browser/host integrations.
 */
export const XappsAdapter = { init };
