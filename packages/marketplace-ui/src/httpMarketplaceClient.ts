import type { MarketplaceClient } from "./types";

type JsonFetcher = <T>(path: string) => Promise<T>;
type JsonPoster = <T>(path: string, body?: Record<string, unknown>) => Promise<T>;

type HttpMarketplaceClientRouteConfig = {
  catalogListPath: string;
  catalogXappBasePath: string;
  myXappsBasePath: string;
  myMonetizedXappsPath: string;
  myRequestsPath: string;
  myPaymentSessionsPath: string;
  myInvoicesPath: string;
  myNotificationsPath: string;
  widgetTokenPath?: string;
  supportsSubjectIdQuery?: boolean;
};

export type HttpMarketplaceClientOptions = {
  getJson: JsonFetcher;
  postJson: JsonPoster;
  routes: HttpMarketplaceClientRouteConfig;
  defaultLocale?: string | null | (() => string | null | undefined);
  getWidgetToken?: MarketplaceClient["getWidgetToken"];
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function encodeSegment(value: string): string {
  return encodeURIComponent(String(value || "").trim());
}

function appendQuery(
  path: string,
  query: Record<string, string | number | boolean | null | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === null || rawValue === undefined) continue;
    const value =
      typeof rawValue === "string"
        ? rawValue.trim()
        : typeof rawValue === "number" || typeof rawValue === "boolean"
          ? String(rawValue)
          : "";
    if (!value) continue;
    params.set(key, value);
  }
  const suffix = params.toString();
  if (!suffix) return path;
  return path.includes("?") ? `${path}&${suffix}` : `${path}?${suffix}`;
}

function resolveDefaultLocale(input: HttpMarketplaceClientOptions["defaultLocale"]): string | null {
  if (typeof input === "function") {
    return readString(input()) || null;
  }
  return readString(input) || null;
}

export function createHttpMarketplaceClient(
  options: HttpMarketplaceClientOptions,
): MarketplaceClient {
  const { getJson, postJson, routes } = options;
  const supportsSubjectIdQuery = routes.supportsSubjectIdQuery === true;
  const addSubjectId = (subjectId: unknown) =>
    supportsSubjectIdQuery ? { subjectId: readString(subjectId) || undefined } : {};

  return {
    async listCatalogXapps() {
      return getJson(routes.catalogListPath);
    },
    async getCatalogXapp(xappId: string, input) {
      return getJson(
        appendQuery(`${routes.catalogXappBasePath}/${encodeSegment(xappId)}`, {
          installationId: readString(input?.installationId) || undefined,
        }),
      );
    },
    async getMyXappMonetization(xappId: string, input) {
      const locale = readString(input?.locale) || resolveDefaultLocale(options.defaultLocale);
      return getJson(
        appendQuery(`${routes.myXappsBasePath}/${encodeSegment(xappId)}/monetization`, {
          ...addSubjectId(input?.subjectId),
          installationId: readString(input?.installationId) || undefined,
          locale: locale || undefined,
          previewAt: readString(input?.previewAt) || undefined,
        }),
      );
    },
    async cancelMyXappSubscriptionContract(input) {
      return postJson(
        appendQuery(
          `${routes.myXappsBasePath}/${encodeSegment(input.xappId)}/monetization/subscription-contracts/${encodeSegment(input.contractId)}/cancel`,
          {
            ...addSubjectId(input?.subjectId),
            installationId: readString(input?.installationId) || undefined,
          },
        ),
        {},
      );
    },
    async refreshMyXappSubscriptionContractState(input) {
      return postJson(
        appendQuery(
          `${routes.myXappsBasePath}/${encodeSegment(input.xappId)}/monetization/subscription-contracts/${encodeSegment(input.contractId)}/refresh-state`,
          {
            ...addSubjectId(input?.subjectId),
            installationId: readString(input?.installationId) || undefined,
          },
        ),
        {},
      );
    },
    async getMyXappMonetizationHistory(xappId: string, input) {
      return getJson(
        appendQuery(`${routes.myXappsBasePath}/${encodeSegment(xappId)}/monetization/history`, {
          ...addSubjectId(input?.subjectId),
          installationId: readString(input?.installationId) || undefined,
          limit:
            typeof input?.limit === "number" && Number.isFinite(input.limit) && input.limit > 0
              ? input.limit
              : undefined,
        }),
      );
    },
    async listMyMonetizedXapps(input) {
      return getJson(
        appendQuery(routes.myMonetizedXappsPath, {
          ...addSubjectId(input?.subjectId),
          currentOnly:
            typeof input?.currentOnly === "boolean" ? String(input.currentOnly) : undefined,
        }),
      );
    },
    async prepareMyXappPurchaseIntent(input) {
      return postJson(
        `${routes.myXappsBasePath}/${encodeSegment(input.xappId)}/monetization/purchase-intents/prepare`,
        {
          offering_id: input.offeringId,
          package_id: input.packageId,
          price_id: input.priceId,
          ...(supportsSubjectIdQuery && readString(input.subjectId)
            ? { subject_id: readString(input.subjectId) }
            : {}),
          ...(readString(input.installationId)
            ? { installation_id: readString(input.installationId) }
            : {}),
        },
      );
    },
    async createMyXappPurchasePaymentSession(input) {
      return postJson(
        `${routes.myXappsBasePath}/${encodeSegment(input.xappId)}/monetization/purchase-intents/${encodeSegment(input.intentId)}/payment-session`,
        {
          return_url: input.returnUrl,
          ...(readString(input.cancelUrl) ? { cancel_url: readString(input.cancelUrl) } : {}),
          ...(readString(input.pageUrl) ? { page_url: readString(input.pageUrl) } : {}),
          ...(readString(input.xappsResume) ? { xapps_resume: readString(input.xappsResume) } : {}),
          ...(readString(input.locale) ? { locale: readString(input.locale) } : {}),
        },
      );
    },
    async finalizeMyXappPurchasePaymentSession(input) {
      return postJson(
        `${routes.myXappsBasePath}/${encodeSegment(input.xappId)}/monetization/purchase-intents/${encodeSegment(input.intentId)}/payment-session/finalize`,
        {},
      );
    },
    async listMyRequests(input) {
      return getJson(
        appendQuery(routes.myRequestsPath, {
          xappId: readString(input?.xappId) || undefined,
          toolName: readString(input?.toolName) || undefined,
          page:
            typeof input?.page === "number" && Number.isFinite(input.page) ? input.page : undefined,
          pageSize:
            typeof input?.pageSize === "number" && Number.isFinite(input.pageSize)
              ? input.pageSize
              : undefined,
        }),
      );
    },
    async getMyRequest(id: string) {
      return getJson(`${routes.myRequestsPath}/${encodeSegment(id)}`);
    },
    async reconcileMyRequestPayment(input) {
      return postJson(
        `${routes.myRequestsPath}/${encodeSegment(input.requestId)}/payment/reconcile`,
        {
          ...(readString(input.paymentSessionId)
            ? { payment_session_id: readString(input.paymentSessionId) }
            : {}),
          ...(readString(input.returnUrl) ? { return_url: readString(input.returnUrl) } : {}),
          ...(readString(input.cancelUrl) ? { cancel_url: readString(input.cancelUrl) } : {}),
          ...(readString(input.xappsResume) ? { xapps_resume: readString(input.xappsResume) } : {}),
        },
      );
    },
    async listMyPaymentSessions(input) {
      return getJson(
        appendQuery(routes.myPaymentSessionsPath, {
          paymentSessionId: readString(input?.paymentSessionId) || undefined,
          xappId: readString(input?.xappId) || undefined,
          installationId: readString(input?.installationId) || undefined,
          toolName: readString(input?.toolName) || undefined,
          status: readString(input?.status) || undefined,
          issuer: readString(input?.issuer) || undefined,
          createdFrom: readString(input?.createdFrom) || undefined,
          createdTo: readString(input?.createdTo) || undefined,
          limit:
            typeof input?.limit === "number" && Number.isFinite(input.limit)
              ? input.limit
              : undefined,
        }),
      );
    },
    async getMyPaymentSession(id: string) {
      return getJson(`${routes.myPaymentSessionsPath}/${encodeSegment(id)}`);
    },
    async listMyInvoices(input) {
      return getJson(
        appendQuery(routes.myInvoicesPath, {
          requestId: readString(input?.requestId) || undefined,
          paymentSessionId: readString(input?.paymentSessionId) || undefined,
          xappId: readString(input?.xappId) || undefined,
          installationId: readString(input?.installationId) || undefined,
          status: readString(input?.status) || undefined,
          ownerScope: readString(input?.ownerScope) || undefined,
          search: readString(input?.search) || undefined,
          createdFrom: readString(input?.createdFrom) || undefined,
          createdTo: readString(input?.createdTo) || undefined,
          page:
            typeof input?.page === "number" && Number.isFinite(input.page) ? input.page : undefined,
          pageSize:
            typeof input?.pageSize === "number" && Number.isFinite(input.pageSize)
              ? input.pageSize
              : undefined,
        }),
      );
    },
    async getMyInvoiceHistory(id: string) {
      return getJson(`${routes.myInvoicesPath}/${encodeSegment(id)}/history`);
    },
    async listMyNotifications(input) {
      return getJson(
        appendQuery(routes.myNotificationsPath, {
          notificationId: readString(input?.notificationId) || undefined,
          status: readString(input?.status) || undefined,
          trigger: readString(input?.trigger) || undefined,
          xappId: readString(input?.xappId) || undefined,
          installationId: readString(input?.installationId) || undefined,
          unread: typeof input?.unread === "boolean" ? String(input.unread) : undefined,
          limit:
            typeof input?.limit === "number" && Number.isFinite(input.limit)
              ? input.limit
              : undefined,
        }),
      );
    },
    async markMyNotificationRead(notificationId: string) {
      return postJson(`${routes.myNotificationsPath}/${encodeSegment(notificationId)}/read`, {});
    },
    async markAllMyNotificationsRead() {
      return postJson(`${routes.myNotificationsPath}/read-all`, {});
    },
    async getWidgetToken(installationId: string, widgetId: string) {
      if (typeof options.getWidgetToken === "function") {
        return options.getWidgetToken(installationId, widgetId);
      }
      if (!routes.widgetTokenPath) {
        throw new Error("Widget token path is not configured");
      }
      return getJson(
        appendQuery(routes.widgetTokenPath, {
          installationId,
          widgetId,
        }),
      );
    },
  };
}
