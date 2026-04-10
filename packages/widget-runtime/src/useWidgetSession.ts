import { useCallback, useEffect, useMemo, useState } from "react";
import type { GuardUiDescriptor } from "./types";
import {
  asRecord,
  normalizeResultPresentation,
  readFirstString,
  readString,
} from "./runtimeReaders";

export type WidgetSessionResult = {
  token: string;
  embedUrl: string;
  context?: {
    clientId: string;
    installationId: string;
    xappId: string;
    subjectId: string | null;
    requestId?: string | null;
    resultPresentation?: "runtime_default" | "inline" | "publisher_managed";
    locale?: string | null;
  } | null;
  widget?: unknown | null;
  tool?: unknown | null;
  xappWidgets?: unknown[] | null;
};

function readLatestRequestPayload(value: unknown): unknown {
  const record = asRecord(value);
  return record.response ?? record.result ?? null;
}

function readRequestCreateSuccessId(value: unknown): string {
  const message = asRecord(value);
  if (readString(message.type) !== "XAPPS_REQUEST_CREATE_SUCCESS") return "";
  const payload = asRecord(message.payload);
  return readFirstString(payload.id, payload.requestId);
}

function updateEmbedUrl(rawUrl: string, devMode: boolean) {
  const url = new URL(rawUrl, window.location.origin);
  if (devMode) {
    url.searchParams.set("dev", "1");
  } else {
    url.searchParams.delete("dev");
  }
  return url.toString();
}

export function useWidgetSession(input: {
  apiBaseUrl: string;
  installationId: string;
  widgetId: string;
  devMode?: boolean;
  createWidgetSession: (i: {
    installationId: string;
    widgetId: string;
    resultPresentation?: "runtime_default" | "inline" | "publisher_managed";
    guardUi?: GuardUiDescriptor;
  }) => Promise<WidgetSessionResult>;
}) {
  const { apiBaseUrl, installationId, widgetId, createWidgetSession } = input;
  const devMode = Boolean(input.devMode);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorPayload, setErrorPayload] = useState<unknown | null>(null);

  const [embedUrl, setEmbedUrl] = useState<string>("");
  const [widgetToken, setWidgetToken] = useState<string>("");
  const [widgetMeta, setWidgetMeta] = useState<unknown | null>(null);
  const [toolMeta, setToolMeta] = useState<unknown | null>(null);
  const [xappWidgets, setXappWidgets] = useState<unknown[] | null>(null);
  const [sessionContext, setSessionContext] = useState<WidgetSessionResult["context"]>(null);
  const [resultPresentation, setResultPresentation] = useState<
    "runtime_default" | "inline" | "publisher_managed" | null
  >(null);

  const [requestId, setRequestId] = useState<string>("");
  const [requestStatus, setRequestStatus] = useState<string>("");
  const [requestResponse, setRequestResponse] = useState<string>("");

  const missing = !installationId || !widgetId;

  const refreshSession = useCallback(async () => {
    if (missing || busy) return;
    setError(null);
    setErrorPayload(null);
    setBusy(true);
    try {
      const res = await createWidgetSession({ installationId, widgetId });
      const widgetRecord = asRecord(res.widget);
      setWidgetToken(res.token);
      setWidgetMeta(res.widget ?? null);
      setToolMeta(res.tool ?? null);
      setXappWidgets(res.xappWidgets ?? null);
      setSessionContext(res.context ?? null);
      setResultPresentation(
        normalizeResultPresentation(
          res.context?.resultPresentation ??
            widgetRecord.resultPresentation ??
            widgetRecord.result_presentation ??
            null,
        ),
      );

      // Host-rendered widgets don't need an embed URL.
      const renderer = readString(widgetRecord.renderer);
      if (renderer === "ui-kit" || renderer === "app-shell") {
        setEmbedUrl("");
      } else {
        const absolute = res.embedUrl.startsWith("http")
          ? res.embedUrl
          : window.location.origin + res.embedUrl;
        setEmbedUrl(updateEmbedUrl(absolute, devMode));
      }

      // Reset request lifecycle; we'll re-discover latest after session mint.
      setRequestId("");
      setRequestStatus("");
      setRequestResponse("");

      // Best-effort: resolve latest request associated with the session.
      try {
        const reqResp = await fetch(`${apiBaseUrl}/v1/requests/latest`, {
          headers: { Authorization: `Bearer ${res.token}` },
        });
        if (reqResp.ok) {
          const reqData = asRecord(await reqResp.json().catch(() => ({})));
          const rid = readString(reqData.requestId);
          if (rid) {
            setRequestId(rid);

            const detailResp = await fetch(`${apiBaseUrl}/v1/requests/${encodeURIComponent(rid)}`, {
              headers: { Authorization: `Bearer ${res.token}` },
            });
            if (detailResp.ok) {
              const detailData = asRecord(await detailResp.json().catch(() => ({})));
              setRequestStatus(readString(asRecord(detailData.request).status));
            }

            const resultResp = await fetch(
              `${apiBaseUrl}/v1/requests/${encodeURIComponent(rid)}/response`,
              {
                headers: { Authorization: `Bearer ${res.token}` },
              },
            );
            if (resultResp.ok) {
              const resultData = await resultResp.json().catch(() => ({}));
              const payload = readLatestRequestPayload(resultData);
              if (payload !== null) {
                setRequestResponse(JSON.stringify(payload, null, 2));
              }
            }
          }
        }
      } catch {
        // ignore (not all widgets will have latest request)
      }
    } catch (error: unknown) {
      setErrorPayload(error);
      setError(readFirstString(asRecord(error).message) || String(error));
    } finally {
      setBusy(false);
    }
  }, [apiBaseUrl, busy, createWidgetSession, devMode, installationId, missing, widgetId]);

  useEffect(() => {
    void refreshSession();
    // Intentionally depends only on installationId and widgetId; refreshSession is stable.
  }, [installationId, widgetId]);

  // Keep embedUrl dev flag in sync.
  useEffect(() => {
    if (!embedUrl) return;
    const next = updateEmbedUrl(embedUrl, devMode);
    if (next !== embedUrl) setEmbedUrl(next);
  }, [devMode, embedUrl]);

  // Subscribe to request status updates when a requestId exists.
  useEffect(() => {
    if (!requestId || !widgetToken) return;
    let alive = true;
    let es: EventSource | null = null;

    try {
      es = new EventSource(
        `${apiBaseUrl}/v1/requests/${encodeURIComponent(requestId)}/updates?token=${encodeURIComponent(widgetToken)}`,
      );
      es.onmessage = async (event) => {
        if (!alive) return;
        try {
          const update = asRecord(JSON.parse(event.data));
          const status = readString(update.status);
          if (status) setRequestStatus(status);
          if (status === "COMPLETED") {
            const resultResp = await fetch(
              `${apiBaseUrl}/v1/requests/${encodeURIComponent(requestId)}/response`,
              {
                headers: { Authorization: `Bearer ${widgetToken}` },
              },
            );
            if (resultResp.ok && alive) {
              const resultData = await resultResp.json().catch(() => ({}));
              const payload = readLatestRequestPayload(resultData);
              if (payload !== null) setRequestResponse(JSON.stringify(payload, null, 2));
            }
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }

    return () => {
      alive = false;
      try {
        es?.close();
      } catch {}
    };
  }, [apiBaseUrl, requestId, widgetToken]);

  // Listen for request-create notifications emitted by widget runtimes/builders.
  // This allows hosts to update request tracking without wiring custom listeners.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const newRid = readRequestCreateSuccessId(event.data);
      if (newRid) {
        setRequestId(newRid);
        // Status/response will be updated by the SSE/polling path.
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return useMemo(
    () => ({
      busy,
      error,
      errorPayload,
      refreshSession,
      embedUrl,
      widgetToken,
      widgetMeta,
      toolMeta,
      xappWidgets,
      sessionContext,
      requestId,
      requestStatus,
      requestResponse,
      resultPresentation,
    }),
    [
      busy,
      embedUrl,
      error,
      errorPayload,
      refreshSession,
      requestId,
      requestResponse,
      requestStatus,
      resultPresentation,
      sessionContext,
      toolMeta,
      widgetMeta,
      widgetToken,
      xappWidgets,
    ],
  );
}
