import http from "node:http";
import https from "node:https";

export type PublisherApiClientOptions = {
  baseUrl: string;
  apiKey?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  timeoutMs?: number;
};

export type PublisherApiClientErrorCode =
  | "PUBLISHER_API_UNAUTHORIZED"
  | "PUBLISHER_API_CONFLICT"
  | "PUBLISHER_API_NOT_FOUND"
  | "PUBLISHER_API_HTTP_ERROR"
  | "PUBLISHER_API_NETWORK_ERROR"
  | "PUBLISHER_API_INVALID_RESPONSE";

export class PublisherApiClientError extends Error {
  code: PublisherApiClientErrorCode;
  status?: number;
  details?: unknown;

  constructor(input: {
    code: PublisherApiClientErrorCode;
    message: string;
    status?: number;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "PublisherApiClientError";
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
  }
}

export type ImportManifestResult = {
  xappId: string;
  versionId: string;
};

export type PublishVersionResult = {
  version: Record<string, unknown>;
};

export type PublisherXappListItem = Record<string, unknown> & { id?: string; slug?: string };
export type PublisherXappVersionListItem = Record<string, unknown> & {
  id?: string;
  status?: string;
  published_at?: string | null;
  created_at?: string | null;
};
export type PublisherEndpointListItem = Record<string, unknown> & { id?: string; env?: string };
export type PublisherClientListItem = Record<string, unknown> & {
  id?: string;
  slug?: string;
  name?: string;
  status?: string;
};
export type CreateEndpointCredentialInput = {
  authType: string;
  config?: Record<string, unknown>;
  initialKey?: {
    secret?: string;
    secretRef?: string;
    status?: string;
    algorithm?: string;
    notBefore?: string;
    notAfter?: string;
  };
};
export type CreateEndpointCredentialResult = {
  credential: Record<string, unknown>;
};
export type ListEndpointCredentialsResult = {
  items: Array<Record<string, unknown>>;
};
export type CompletePublisherLinkInput = {
  subjectId: string;
  xappId: string;
  publisherUserId: string;
  realm?: string;
  metadata?: Record<string, unknown>;
};
export type CompletePublisherLinkResult = {
  success: boolean;
  link_id?: string;
};
export type RevokePublisherLinkInput = {
  subjectId: string;
  xappId: string;
  publisherUserId: string;
  reason?: string;
};
export type RevokePublisherLinkResult = {
  revoked: boolean;
  alreadyRevoked?: boolean;
  deleted?: number;
};
export type PublisherLinkStatusResult = {
  linked: boolean;
  reason?: string;
  publisherUserId?: string;
  link_id?: string;
};
export type ExchangePublisherBridgeTokenInput = {
  publisher_id: string;
  scopes?: string[];
  link_required?: boolean;
};
export type ExchangePublisherBridgeTokenResult = {
  vendor_assertion: string;
  issuer?: string;
  subject_id?: string;
  link_id?: string;
  expires_in?: number;
};

function normalizeBaseUrl(input: string): string {
  const value = String(input || "").trim();
  if (!value) {
    throw new PublisherApiClientError({
      code: "PUBLISHER_API_INVALID_RESPONSE",
      message: "publisherApiClient.baseUrl is required",
    });
  }
  return value.replace(/\/+$/g, "");
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch | null {
  if (typeof fetchImpl === "function") return fetchImpl;
  return null;
}

function normalizeRequestTimeoutMs(input: unknown): number {
  if (input === undefined || input === null || input === "") return 30_000;
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PublisherApiClientError({
      code: "PUBLISHER_API_INVALID_RESPONSE",
      message: "publisherApiClient.requestTimeoutMs must be a positive integer",
      details: { value: input },
    });
  }
  return Math.floor(parsed);
}

function buildAuthHeaders(input: { apiKey?: string; token?: string }): Headers {
  const headers = new Headers();
  const token = String(input.token || "").trim();
  const apiKey = String(input.apiKey || "").trim();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (apiKey) headers.set("x-api-key", apiKey);
  return headers;
}

function mapHttpError(status: number, message: string, details?: unknown): PublisherApiClientError {
  if (status === 401 || status === 403) {
    return new PublisherApiClientError({
      code: "PUBLISHER_API_UNAUTHORIZED",
      message,
      status,
      details,
    });
  }
  if (status === 409) {
    return new PublisherApiClientError({
      code: "PUBLISHER_API_CONFLICT",
      message,
      status,
      details,
    });
  }
  if (status === 404) {
    return new PublisherApiClientError({
      code: "PUBLISHER_API_NOT_FOUND",
      message,
      status,
      details,
    });
  }
  return new PublisherApiClientError({
    code: "PUBLISHER_API_HTTP_ERROR",
    message,
    status,
    details,
  });
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[server-sdk] JSON parse fallback", {
        scope: "publisherApiClient.parseJsonSafe",
        url: res.url || "",
        message: error instanceof Error ? error.message : String(error),
        preview: text.slice(0, 200),
      });
    }
    return text;
  }
}

async function requestJsonViaNode(input: {
  url: string;
  method: "GET" | "POST";
  headers: Headers;
  body?: string;
  timeoutMs: number;
}): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const parsed = new URL(input.url);
  const isHttps = parsed.protocol === "https:";
  const transport = isHttps ? https : http;
  const headersObject: Record<string, string> = {};
  input.headers.forEach((value, key) => {
    headersObject[key] = value;
  });
  if (!headersObject.accept) {
    headersObject.accept = "application/json";
  }
  const body = typeof input.body === "string" ? input.body : "";
  if (body) {
    if (!headersObject["content-type"]) {
      headersObject["content-type"] = "application/json";
    }
    headersObject["content-length"] = String(Buffer.byteLength(body));
  }

  const requestOptions: http.RequestOptions = {
    method: input.method,
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: `${parsed.pathname}${parsed.search}`,
    headers: headersObject,
    timeout: input.timeoutMs,
  };

  return new Promise((resolve, reject) => {
    const req = transport.request(requestOptions, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        let payload: unknown = null;
        const trimmed = raw.trim();
        if (trimmed) {
          try {
            payload = JSON.parse(trimmed);
          } catch (error) {
            if (typeof console !== "undefined" && typeof console.debug === "function") {
              console.debug("[server-sdk] JSON parse fallback", {
                scope: "publisherApiClient.requestJsonViaNode",
                url: input.url,
                message: error instanceof Error ? error.message : String(error),
                preview: raw.slice(0, 200),
              });
            }
            payload = raw;
          }
        }
        const status = Number(res.statusCode || 0);
        resolve({
          ok: status >= 200 && status < 300,
          status,
          payload,
        });
      });
    });
    req.setTimeout(input.timeoutMs, () => {
      req.destroy(Object.assign(new Error("publisher_api_timeout"), { name: "AbortError" }));
    });
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

/**
 * Creates a typed HTTP client for publisher console/import/publish APIs.
 */
export function createPublisherApiClient(options: PublisherApiClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = resolveFetch(options.fetchImpl);
  const authHeaders = buildAuthHeaders({ apiKey: options.apiKey, token: options.token });
  const requestTimeoutMs = normalizeRequestTimeoutMs(options.requestTimeoutMs ?? options.timeoutMs);

  async function postJson(pathname: string, body: unknown): Promise<unknown> {
    try {
      const headers = new Headers(authHeaders);
      headers.set("content-type", "application/json");
      const endpoint = `${baseUrl}${pathname}`;
      const rawBody = JSON.stringify(body ?? {});
      const result =
        fetchImpl && typeof fetchImpl === "function"
          ? await (async () => {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
              try {
                const res = await fetchImpl(endpoint, {
                  method: "POST",
                  headers,
                  body: rawBody,
                  signal: controller.signal,
                });
                const payload = await parseJsonSafe(res);
                return { ok: res.ok, status: res.status, payload };
              } finally {
                clearTimeout(timer);
              }
            })()
          : await requestJsonViaNode({
              url: endpoint,
              method: "POST",
              headers,
              body: rawBody,
              timeoutMs: requestTimeoutMs,
            });
      if (!result.ok) {
        const msg =
          typeof result.payload === "object" &&
          result.payload &&
          typeof (result.payload as any).message === "string"
            ? String((result.payload as any).message)
            : `Publisher API request failed (${result.status})`;
        throw mapHttpError(result.status, msg, result.payload);
      }
      return result.payload;
    } catch (err: any) {
      if (err instanceof PublisherApiClientError) throw err;
      throw new PublisherApiClientError({
        code: "PUBLISHER_API_NETWORK_ERROR",
        message:
          err?.name === "AbortError"
            ? `Publisher API request timed out after ${requestTimeoutMs}ms`
            : `Publisher API request failed: ${err?.message || String(err)}`,
        details: err,
      });
    }
  }

  async function getJson(pathname: string): Promise<unknown> {
    try {
      const headers = new Headers(authHeaders);
      const endpoint = `${baseUrl}${pathname}`;
      const result =
        fetchImpl && typeof fetchImpl === "function"
          ? await (async () => {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
              try {
                const res = await fetchImpl(endpoint, {
                  method: "GET",
                  headers,
                  signal: controller.signal,
                });
                const payload = await parseJsonSafe(res);
                return { ok: res.ok, status: res.status, payload };
              } finally {
                clearTimeout(timer);
              }
            })()
          : await requestJsonViaNode({
              url: endpoint,
              method: "GET",
              headers,
              timeoutMs: requestTimeoutMs,
            });
      if (!result.ok) {
        const msg =
          typeof result.payload === "object" &&
          result.payload &&
          typeof (result.payload as any).message === "string"
            ? String((result.payload as any).message)
            : `Publisher API request failed (${result.status})`;
        throw mapHttpError(result.status, msg, result.payload);
      }
      return result.payload;
    } catch (err: any) {
      if (err instanceof PublisherApiClientError) throw err;
      throw new PublisherApiClientError({
        code: "PUBLISHER_API_NETWORK_ERROR",
        message:
          err?.name === "AbortError"
            ? `Publisher API request timed out after ${requestTimeoutMs}ms`
            : `Publisher API request failed: ${err?.message || String(err)}`,
        details: err,
      });
    }
  }

  return {
    async importManifest(manifest: unknown): Promise<ImportManifestResult> {
      const payload = await postJson("/publisher/import-manifest", manifest);
      const xappId =
        typeof (payload as any)?.xappId === "string" ? String((payload as any).xappId) : "";
      const versionId =
        typeof (payload as any)?.versionId === "string" ? String((payload as any).versionId) : "";
      if (!xappId || !versionId) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher import-manifest returned malformed response",
          details: payload,
        });
      }
      return { xappId, versionId };
    },

    async publishVersion(xappVersionId: string): Promise<PublishVersionResult> {
      const id = String(xappVersionId || "").trim();
      if (!id) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "xappVersionId is required",
        });
      }
      const payload = await postJson(
        `/publisher/xapp-versions/${encodeURIComponent(id)}/publish`,
        {},
      );
      if (!payload || typeof payload !== "object" || !("version" in (payload as any))) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher publishVersion returned malformed response",
          details: payload,
        });
      }
      return payload as PublishVersionResult;
    },

    async importAndPublishManifest(
      manifest: unknown,
    ): Promise<ImportManifestResult & PublishVersionResult> {
      const imported = await this.importManifest(manifest);
      const published = await this.publishVersion(imported.versionId);
      return { ...imported, ...published };
    },

    async listXapps(): Promise<{ items: PublisherXappListItem[] }> {
      const payload = await getJson("/publisher/xapps");
      const items = Array.isArray((payload as any)?.items) ? (payload as any).items : null;
      if (!items) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher listXapps returned malformed response",
          details: payload,
        });
      }
      return { items };
    },

    async listClients(): Promise<{ items: PublisherClientListItem[] }> {
      const payload = await getJson("/publisher/clients");
      const items = Array.isArray((payload as any)?.items) ? (payload as any).items : null;
      if (!items) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher listClients returned malformed response",
          details: payload,
        });
      }
      return { items };
    },

    async listXappVersions(xappId: string): Promise<{ items: PublisherXappVersionListItem[] }> {
      const id = String(xappId || "").trim();
      if (!id) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "xappId is required",
        });
      }
      const payload = await getJson(`/publisher/xapps/${encodeURIComponent(id)}/versions`);
      const items = Array.isArray((payload as any)?.items) ? (payload as any).items : null;
      if (!items) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher listXappVersions returned malformed response",
          details: payload,
        });
      }
      return { items };
    },

    async listEndpoints(xappVersionId: string): Promise<{ items: PublisherEndpointListItem[] }> {
      const id = String(xappVersionId || "").trim();
      if (!id) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "xappVersionId is required",
        });
      }
      const payload = await getJson(`/publisher/xapp-versions/${encodeURIComponent(id)}/endpoints`);
      const items = Array.isArray((payload as any)?.items) ? (payload as any).items : null;
      if (!items) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher listEndpoints returned malformed response",
          details: payload,
        });
      }
      return { items };
    },

    async createEndpointCredential(
      endpointId: string,
      input: CreateEndpointCredentialInput,
    ): Promise<CreateEndpointCredentialResult> {
      const id = String(endpointId || "").trim();
      if (!id) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "endpointId is required",
        });
      }
      const payload = await postJson(
        `/publisher/endpoints/${encodeURIComponent(id)}/credentials`,
        input,
      );
      if (!payload || typeof payload !== "object" || !("credential" in (payload as any))) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher createEndpointCredential returned malformed response",
          details: payload,
        });
      }
      return payload as CreateEndpointCredentialResult;
    },

    async listEndpointCredentials(endpointId: string): Promise<ListEndpointCredentialsResult> {
      const id = String(endpointId || "").trim();
      if (!id) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "endpointId is required",
        });
      }
      const payload = await getJson(`/publisher/endpoints/${encodeURIComponent(id)}/credentials`);
      const items = Array.isArray((payload as any)?.items) ? (payload as any).items : null;
      if (!items) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher listEndpointCredentials returned malformed response",
          details: payload,
        });
      }
      return { items };
    },

    async completeLink(input: CompletePublisherLinkInput): Promise<CompletePublisherLinkResult> {
      const subjectId = String(input?.subjectId || "").trim();
      const xappId = String(input?.xappId || "").trim();
      const publisherUserId = String(input?.publisherUserId || "").trim();
      if (!subjectId || !xappId || !publisherUserId) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "subjectId, xappId, and publisherUserId are required",
          details: input,
        });
      }
      const payload = await postJson("/v1/publisher/links/complete", {
        subjectId,
        xappId,
        publisherUserId,
        ...(typeof input.realm === "string" && input.realm.trim()
          ? { realm: input.realm.trim() }
          : {}),
        ...(input.metadata && typeof input.metadata === "object"
          ? { metadata: input.metadata }
          : {}),
      });
      if (
        !payload ||
        typeof payload !== "object" ||
        typeof (payload as any).success !== "boolean"
      ) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher completeLink returned malformed response",
          details: payload,
        });
      }
      return payload as CompletePublisherLinkResult;
    },

    async revokeLink(input: RevokePublisherLinkInput): Promise<RevokePublisherLinkResult> {
      const subjectId = String(input?.subjectId || "").trim();
      const xappId = String(input?.xappId || "").trim();
      const publisherUserId = String(input?.publisherUserId || "").trim();
      if (!subjectId || !xappId || !publisherUserId) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "subjectId, xappId, and publisherUserId are required",
          details: input,
        });
      }
      const payload = await postJson("/v1/publisher/links/revoke", {
        subjectId,
        xappId,
        publisherUserId,
        ...(typeof input.reason === "string" && input.reason.trim()
          ? { reason: input.reason.trim() }
          : {}),
      });
      if (
        !payload ||
        typeof payload !== "object" ||
        typeof (payload as any).revoked !== "boolean"
      ) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher revokeLink returned malformed response",
          details: payload,
        });
      }
      return payload as RevokePublisherLinkResult;
    },

    async getLinkStatus(): Promise<PublisherLinkStatusResult> {
      const payload = await getJson("/v1/publisher/links/status");
      if (!payload || typeof payload !== "object" || typeof (payload as any).linked !== "boolean") {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher getLinkStatus returned malformed response",
          details: payload,
        });
      }
      return payload as PublisherLinkStatusResult;
    },

    async exchangeBridgeToken(
      input: ExchangePublisherBridgeTokenInput,
    ): Promise<ExchangePublisherBridgeTokenResult> {
      const publisherId = String(input?.publisher_id || "").trim();
      if (!publisherId) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "publisher_id is required",
          details: input,
        });
      }
      const payload = await postJson("/v1/publisher/bridge/token", {
        publisher_id: publisherId,
        ...(Array.isArray(input.scopes)
          ? {
              scopes: input.scopes.map((value) => String(value || "").trim()).filter(Boolean),
            }
          : {}),
        ...(typeof input.link_required === "boolean" ? { link_required: input.link_required } : {}),
      });
      if (
        !payload ||
        typeof payload !== "object" ||
        typeof (payload as any).vendor_assertion !== "string"
      ) {
        throw new PublisherApiClientError({
          code: "PUBLISHER_API_INVALID_RESPONSE",
          message: "Publisher exchangeBridgeToken returned malformed response",
          details: payload,
        });
      }
      return payload as ExchangePublisherBridgeTokenResult;
    },
  };
}
