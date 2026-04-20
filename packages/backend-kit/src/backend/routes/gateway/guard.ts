// @ts-nocheck
import { resolveBackendPaymentPolicy } from "../../modes/index.js";

function buildPaymentGuardFailClosedResult(upstreamStatus) {
  return {
    allowed: false,
    reason: "payment_session_create_failed",
    message: "Payment session could not be created at this time",
    action: {
      kind: "complete_payment",
      label: "Open Payment",
      title: "Complete Payment",
    },
    details: {
      uiRequired: true,
      orchestration: {
        mode: "blocking",
        surface: "redirect",
        status: "failed_dependency",
      },
      upstream_status: Number(upstreamStatus || 500) || 500,
    },
  };
}

function requireGuardApiKey(request, reply, guardApiKey) {
  const key = String(request.headers["x-api-key"] || "").trim();
  if (!key || key !== String(guardApiKey || "").trim()) {
    reply.code(401).send({ status: "error", result: { message: "Invalid API key" } });
    return false;
  }
  return true;
}

export default async function guardRoutes(
  fastify,
  {
    enabledModes,
    paymentRuntime = {},
    guardApiKey = "",
    guardToolName = "evaluate_tenant_payment_policy",
    logScope = "tenant",
  } = {},
) {
  fastify.post("/xapps/requests", async (request, reply) => {
    if (!requireGuardApiKey(request, reply, guardApiKey)) return;
    const body = request.body && typeof request.body === "object" ? request.body : {};
    const requestId = String(body.requestId || body.request_id || "").trim();
    const toolName = String(body.toolName || body.tool_name || "").trim();
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    if (!requestId || !toolName) {
      return reply.code(400).send({
        status: "error",
        result: { message: "requestId and toolName are required" },
      });
    }
    if (toolName !== guardToolName) {
      return reply.code(400).send({
        status: "error",
        result: { message: `Unsupported tool: ${toolName}` },
      });
    }
    try {
      const result =
        typeof paymentRuntime.resolvePolicyRequest === "function"
          ? await paymentRuntime.resolvePolicyRequest(payload, {
              log: fastify.log,
              enabledModes,
            })
          : await resolveBackendPaymentPolicy(payload, {
              log: fastify.log,
              enabledModes,
              paymentRuntime,
            });
      return reply.send({ status: "success", result });
    } catch (err) {
      const status = Number(err?.status || err?.statusCode || 500) || 500;
      fastify.log.error(
        {
          err,
          requestId,
          toolName,
          status,
        },
        `${logScope} guard evaluation failed; returning fail-closed block`,
      );
      return reply.send({
        status: "success",
        result: buildPaymentGuardFailClosedResult(status),
      });
    }
  });
}
