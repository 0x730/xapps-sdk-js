// @ts-nocheck
import fs from "node:fs";
import {
  buildHostedGatewayPaymentUrlFromGuardContext,
  createPaymentHandlerAsync,
  extractHostedPaymentSessionId,
} from "@xapps-platform/server-sdk";
import { normalizeOwnerIssuer, readRecord, readString } from "./options.js";

function mapHostedSessionResult(input = {}) {
  return {
    ...(input?.redirectUrl ? { redirect_url: input.redirectUrl } : {}),
    ...(input?.flow ? { flow: input.flow } : {}),
    ...(input?.paymentSessionId ? { payment_session_id: input.paymentSessionId } : {}),
    ...(input?.clientSettleUrl ? { client_settle_url: input.clientSettleUrl } : {}),
    ...(input?.providerReference !== undefined
      ? { provider_reference: input.providerReference }
      : {}),
    ...(input?.scheme ? { scheme: input.scheme } : {}),
    ...(input?.metadata ? { metadata: input.metadata } : {}),
  };
}

function readPaymentRequestParams(source = {}) {
  const input = readRecord(source);
  return {
    paymentSessionId: readString(input.payment_session_id, input.paymentSessionId).trim(),
    returnUrl: readString(input.return_url, input.returnUrl).trim(),
    cancelUrl: readString(input.cancel_url, input.cancelUrl).trim(),
    xappsResume: readString(input.xapps_resume, input.xappsResume).trim(),
  };
}

function readClientSettleInput(source = {}) {
  const input = readRecord(source);
  const status = readString(input.status).trim();
  return {
    ...readPaymentRequestParams(input),
    status: status === "failed" || status === "cancelled" ? status : "paid",
    clientToken: readString(input.client_token, input.clientToken).trim() || undefined,
    metadata:
      input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? input.metadata
        : undefined,
  };
}

function sendGatewayUnavailable(reply, message, statusCode = 500) {
  return reply.code(statusCode).send({ message });
}

export async function createPaymentRuntime(options = {}, deps = {}) {
  const createPaymentHandler =
    typeof deps.createPaymentHandler === "function"
      ? deps.createPaymentHandler
      : createPaymentEvidenceHandler;
  const createGatewayClient =
    typeof deps.createGatewayClient === "function" ? deps.createGatewayClient : null;

  const resolvedGatewayClient =
    options?.overrides?.gatewayClient ||
    (createGatewayClient
      ? createGatewayClient({
          baseUrl: options?.gateway?.baseUrl,
          apiKey: options?.gateway?.apiKey,
        })
      : null);
  const resolvedPaymentHandler =
    options?.overrides?.paymentHandler ||
    (await createPaymentHandler({
      payments: options?.payments || {},
      gatewayClient: resolvedGatewayClient,
    }));

  return {
    gatewayClient: resolvedGatewayClient,
    paymentHandler: resolvedPaymentHandler,
    paymentSettings: {
      ownerIssuer: normalizeOwnerIssuer(options?.payments?.ownerIssuer),
      paymentUrl: options?.payments?.paymentUrl,
      returnSecret: options?.payments?.returnSecret,
      returnSecretRef: options?.payments?.returnSecretRef,
      returnUrlAllowlist: options?.payments?.returnUrlAllowlist,
    },
    paymentPageFile: options?.assets?.paymentPage?.filePath || "",
    resolvePolicyRequest: options?.overrides?.resolvePolicyRequest || null,
  };
}

export async function createPaymentEvidenceHandler({
  payments = {},
  gatewayClient = null,
  issuer = "",
  resolvePlatformSecretRef,
} = {}) {
  const paymentSettings = readRecord(payments);
  return createPaymentHandlerAsync({
    secret: readString(paymentSettings.returnSecret).trim() || undefined,
    secretRef: readString(paymentSettings.returnSecretRef).trim() || undefined,
    secretRefResolverOptions: {
      resolvePlatformSecretRef: async (input) => resolvePlatformSecretRef(input),
    },
    issuer:
      normalizeOwnerIssuer(readString(issuer).trim() || readString(paymentSettings.ownerIssuer)) ||
      "tenant",
    returnUrlAllowlist: readString(paymentSettings.returnUrlAllowlist),
    gatewayClient: gatewayClient || undefined,
    requirePersistentStoreInProduction: false,
  });
}

export async function buildHostedGatewayPaymentUrl(input = {}, runtime = {}) {
  const payloadInput = readRecord(input);
  const paymentRuntime = readRecord(runtime);
  const paymentSettings = readRecord(paymentRuntime.paymentSettings);
  const ownerIssuer = normalizeOwnerIssuer(paymentSettings.ownerIssuer);
  const gatewayClient = paymentRuntime.gatewayClient || null;
  const paymentHandler = paymentRuntime.paymentHandler || null;
  if (!gatewayClient) {
    throw new Error("gateway payment session client not configured");
  }
  if (!paymentHandler || typeof paymentHandler.upsertSession !== "function") {
    throw new Error("payment evidence handler not configured");
  }

  const result = await buildHostedGatewayPaymentUrlFromGuardContext({
    deps: {
      createPaymentSession: (payload) => gatewayClient.createPaymentSession(payload),
      upsertSession: (payload) => paymentHandler.upsertSession(payload),
    },
    payload: payloadInput.payload,
    context: payloadInput.context,
    guard: payloadInput.guard,
    guardConfig: payloadInput.guardConfig,
    amount: payloadInput.amount,
    currency: payloadInput.currency,
    defaultPaymentUrl: readString(paymentSettings.paymentUrl),
    fallbackIssuer: readString(payloadInput.fallbackIssuer, ownerIssuer) || ownerIssuer,
    storedIssuer:
      readString(payloadInput.storedIssuer, readString(payloadInput.fallbackIssuer, ownerIssuer)) ||
      ownerIssuer,
    defaultSecret: readString(paymentSettings.returnSecret),
    defaultSecretRef: readString(paymentSettings.returnSecretRef),
    allowDefaultSecretFallback: Boolean(payloadInput.allowDefaultSecretFallback),
  });
  return result.paymentUrl;
}

export async function buildModeHostedGatewayPaymentUrl(input = {}, defaults = {}, runtime = {}) {
  const payloadInput = readRecord(input);
  const modeDefaults = readRecord(defaults);
  const paymentRuntime = readRecord(runtime);
  const paymentSettings = readRecord(paymentRuntime.paymentSettings);
  const ownerIssuer = normalizeOwnerIssuer(paymentSettings.ownerIssuer);
  return buildHostedGatewayPaymentUrl(
    {
      ...payloadInput,
      fallbackIssuer:
        readString(
          modeDefaults.fallbackIssuer,
          readString(payloadInput.fallbackIssuer, ownerIssuer),
        ) || ownerIssuer,
      storedIssuer:
        readString(
          modeDefaults.storedIssuer,
          readString(
            payloadInput.storedIssuer,
            readString(
              modeDefaults.fallbackIssuer,
              readString(payloadInput.fallbackIssuer, ownerIssuer),
            ),
          ),
        ) || ownerIssuer,
      allowDefaultSecretFallback: Boolean(
        modeDefaults.allowDefaultSecretFallback ?? payloadInput.allowDefaultSecretFallback,
      ),
    },
    runtime,
  );
}

export async function registerPaymentPageAssetRoute(
  fastify,
  { pagePath = "/tenant-payment.html", pageFile = "" } = {},
) {
  fastify.get(pagePath, async (_request, reply) => {
    const html = fs.readFileSync(pageFile, "utf8");
    return reply.code(200).type("text/html; charset=utf-8").send(html);
  });
}

export async function registerPaymentPageApiRoutes(
  fastify,
  { gatewayClient = null, pathPrefix = "/api/tenant-payment" } = {},
) {
  fastify.get(`${pathPrefix}/session`, async (request, reply) => {
    const { paymentSessionId, returnUrl, cancelUrl, xappsResume } = readPaymentRequestParams(
      request.query,
    );
    if (!gatewayClient || typeof gatewayClient.getGatewayPaymentSession !== "function") {
      return sendGatewayUnavailable(reply, "gateway payment client is not configured");
    }
    if (!paymentSessionId) {
      return reply.code(400).send({ message: "payment_session_id is required" });
    }
    const hosted = await gatewayClient.getGatewayPaymentSession({
      paymentSessionId,
      ...(returnUrl ? { returnUrl } : {}),
      ...(cancelUrl ? { cancelUrl } : {}),
      ...(xappsResume ? { xappsResume } : {}),
    });
    return reply.code(200).send({ status: "success", result: hosted.session });
  });

  fastify.post(`${pathPrefix}/complete`, async (request, reply) => {
    const { paymentSessionId, returnUrl, cancelUrl, xappsResume } = readPaymentRequestParams(
      request.body,
    );
    if (!gatewayClient || typeof gatewayClient.completeGatewayPayment !== "function") {
      return sendGatewayUnavailable(reply, "gateway payment client is not configured");
    }
    if (!paymentSessionId) {
      return reply.code(400).send({ message: "payment_session_id is required" });
    }
    const hosted = await gatewayClient.completeGatewayPayment({
      paymentSessionId,
      ...(returnUrl ? { returnUrl } : {}),
      ...(cancelUrl ? { cancelUrl } : {}),
      ...(xappsResume ? { xappsResume } : {}),
    });
    return reply.code(200).send({ status: "success", result: mapHostedSessionResult(hosted) });
  });

  fastify.post(`${pathPrefix}/client-settle`, async (request, reply) => {
    const { paymentSessionId, returnUrl, xappsResume, status, clientToken, metadata } =
      readClientSettleInput(request.body);
    if (!paymentSessionId) {
      return reply.code(400).send({ message: "payment_session_id is required" });
    }
    if (!gatewayClient || typeof gatewayClient.clientSettleGatewayPayment !== "function") {
      return sendGatewayUnavailable(
        reply,
        "client-settle is not available for this payment mode",
        409,
      );
    }
    try {
      const settled = await gatewayClient.clientSettleGatewayPayment({
        paymentSessionId,
        returnUrl: returnUrl || undefined,
        xappsResume: xappsResume || undefined,
        status,
        clientToken,
        metadata,
      });
      return reply.code(200).send({ status: "success", result: mapHostedSessionResult(settled) });
    } catch (err) {
      request.log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "client-settle failed",
      );
      return reply.code(502).send({ message: "client_settle_failed" });
    }
  });
}

export { extractHostedPaymentSessionId };
