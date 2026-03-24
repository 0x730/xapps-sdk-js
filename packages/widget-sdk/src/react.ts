import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBridge,
  type XappsBridge,
  type XappsBridgeError,
  type XappsBridgeOptions,
  type XappsRequestCreateInput,
  type XappsWidgetContext,
} from "./index.js";

/**
 * Result shape returned by `useXappsBridge(...)`.
 */
export interface UseXappsBridgeResult {
  bridge: XappsBridge;
  context: XappsWidgetContext | null;
  loading: boolean;
  error: XappsBridgeError | null;
  isEmbedded: boolean;
}

/**
 * React hook options for creating or reusing an Xapps bridge instance.
 */
export interface UseXappsBridgeOptions extends XappsBridgeOptions {
  bridge?: XappsBridge;
}

/**
 * React hook that resolves widget context and exposes bridge lifecycle state.
 */
export function useXappsBridge(options: UseXappsBridgeOptions = {}): UseXappsBridgeResult {
  const bridge = useMemo(() => options.bridge ?? createBridge(options), [options.bridge]);
  const [context, setContext] = useState<XappsWidgetContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<XappsBridgeError | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void bridge
      .getContext()
      .then((ctx) => {
        if (!mounted) return;
        setContext(ctx);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err as XappsBridgeError);
        setLoading(false);
      });
    return () => {
      mounted = false;
      if (!options.bridge) {
        bridge.destroy();
      }
    };
  }, [bridge, options.bridge]);

  return {
    bridge,
    context,
    loading,
    error,
    isEmbedded: bridge.isEmbedded(),
  };
}

/**
 * Options for running a tool request through an existing bridge instance.
 */
export interface UseToolRequestOptions {
  bridge: XappsBridge;
  installationId?: string;
  subjectId?: string | null;
  clientRequestRef?: string;
  externalRequestId?: string;
}

/**
 * Result shape returned by `useToolRequest(...)`.
 */
export interface UseToolRequestResult {
  execute: (payload?: unknown) => Promise<unknown>;
  loading: boolean;
  result: unknown;
  error: XappsBridgeError | null;
  reset: () => void;
}

/**
 * React helper for invoking a widget tool and tracking its loading/result/error state.
 */
export function useToolRequest(
  toolName: string,
  options: UseToolRequestOptions,
): UseToolRequestResult {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<XappsBridgeError | null>(null);

  const execute = useCallback(
    async (payload: unknown = {}) => {
      setLoading(true);
      setError(null);
      try {
        const input: XappsRequestCreateInput = {
          installationId: options.installationId,
          toolName,
          subjectId: options.subjectId ?? undefined,
          clientRequestRef: options.clientRequestRef,
          externalRequestId: options.externalRequestId,
          payload,
        };
        const nextResult = await options.bridge.createRequest(input);
        setResult(nextResult);
        setLoading(false);
        return nextResult;
      } catch (err: unknown) {
        setError(err as XappsBridgeError);
        setLoading(false);
        throw err;
      }
    },
    [
      toolName,
      options.bridge,
      options.clientRequestRef,
      options.externalRequestId,
      options.installationId,
      options.subjectId,
    ],
  );

  const reset = useCallback(() => {
    setLoading(false);
    setResult(null);
    setError(null);
  }, []);

  return { execute, loading, result, error, reset };
}
