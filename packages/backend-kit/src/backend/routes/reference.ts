// @ts-nocheck
import fs from "node:fs";
import {
  getBackendModeEndpointGroups,
  getBackendModeReferenceDetails,
  normalizeEnabledBackendModes,
} from "../modes/index.js";

const BASE_ENDPOINT_GROUPS = [
  {
    key: "core_health",
    label: "Core health",
    when_to_use: "Always present in the reference backend.",
    endpoints: [{ method: "GET", path: "/health", purpose: "Basic backend health." }],
  },
  {
    key: "guard_execution",
    label: "Tenant guard execution reference",
    when_to_use: "Needed when the tenant owns payment-policy or subject-profile policy execution.",
    endpoints: [
      {
        method: "POST",
        path: "/xapps/requests",
        purpose: "Receives tenant-owned guard/policy tool execution.",
      },
    ],
  },
  {
    key: "tenant_subject_profile_reference",
    label: "Tenant subject-profile reference seam",
    when_to_use:
      "Optional seam when the tenant wants to provide tenant-owned billing profile candidates.",
    endpoints: [
      {
        method: "POST",
        path: "/guard/subject-profiles/tenant-candidates",
        purpose: "Returns tenant-owned billing/profile candidates for the guard.",
      },
    ],
  },
  {
    key: "reference_assets",
    label: "Reference assets",
    when_to_use: "Only for the current local/reference browser flow.",
    endpoints: [
      { method: "GET", path: "/", purpose: "Entry page for the marketplace host reference." },
      {
        method: "GET",
        path: "/marketplace.html",
        purpose: "Marketplace host shell with single-panel and split-panel embed modes.",
      },
      {
        method: "GET",
        path: "/single-xapp.html",
        purpose: "Focused single-xapp host surface using the same shared host/runtime contract.",
      },
      {
        method: "GET",
        path: "/embed/sdk/xapps-embed-sdk.esm.js",
        purpose: "Serves the embed SDK bundle used by the local reference host surfaces.",
      },
      {
        method: "GET",
        path: "/host/marketplace-host.js",
        purpose: "Browser bootstrap for the marketplace host reference.",
      },
      {
        method: "GET",
        path: "/host/single-xapp-host.js",
        purpose: "Browser bootstrap for the single-xapp host reference.",
      },
      {
        method: "GET",
        path: "/host/host-shell.js",
        purpose: "Shared host-shell rendering helpers for marketplace and single-xapp surfaces.",
      },
      {
        method: "GET",
        path: "/host/marketplace-runtime.js",
        purpose: "Shared marketplace runtime wiring over the browser SDK contract.",
      },
      {
        method: "GET",
        path: "/host/reference-runtime.js",
        purpose: "Reference theme/runtime helpers for the standard marketplace host flow.",
      },
      {
        method: "GET",
        path: "/host/host-status.js",
        purpose: "Shared host proof/status renderer used by tenant host surfaces.",
      },
    ],
  },
  {
    key: "reference_marketplace_host_core",
    label: "Reference marketplace host proxy: core contract",
    when_to_use:
      "Use this first. It is the core tenant browser->backend contract for the marketplace host.",
    endpoints: [
      {
        method: "GET",
        path: "/api/host-config",
        purpose: "Returns current host config such as gateway base URL and supported embed modes.",
      },
      {
        method: "POST",
        path: "/api/resolve-subject",
        purpose: "Resolves a stable subject id from email for the stateless host bootstrap.",
      },
      {
        method: "POST",
        path: "/api/create-catalog-session",
        purpose: "Proxies catalog session creation for the host page.",
      },
      {
        method: "POST",
        path: "/api/catalog-customer-profile",
        purpose:
          "Resolves the default tenant billing profile used to prefill subject-bound catalog sessions.",
      },
      {
        method: "POST",
        path: "/api/create-widget-session",
        purpose: "Proxies widget session creation for the host page.",
      },
    ],
  },
  {
    key: "reference_marketplace_host_lifecycle",
    label: "Reference marketplace host proxy: lifecycle",
    when_to_use:
      "Required for a real tenant marketplace host, while still kept as a separate layer for clarity.",
    endpoints: [
      {
        method: "GET",
        path: "/api/installations",
        purpose: "Lists installations for the current subject in the host page.",
      },
      {
        method: "POST",
        path: "/api/install",
        purpose: "Install mutation proxy used by the host page.",
      },
      {
        method: "POST",
        path: "/api/update",
        purpose: "Update mutation proxy used by the host page.",
      },
      {
        method: "POST",
        path: "/api/uninstall",
        purpose: "Uninstall mutation proxy used by the host page.",
      },
      {
        method: "GET",
        path: "/api/my-xapps/:xappId/monetization",
        purpose:
          "Loads current-subject monetization state and published paywalls for an installed xapp.",
      },
      {
        method: "GET",
        path: "/api/my-xapps/:xappId/monetization/history",
        purpose:
          "Loads recent current-subject XMS history for auditability across purchases, access, wallets, and invoices.",
      },
      {
        method: "POST",
        path: "/api/my-xapps/:xappId/monetization/purchase-intents/prepare",
        purpose: "Prepares a current-subject XMS purchase intent for the host plans surface.",
      },
      {
        method: "POST",
        path: "/api/my-xapps/:xappId/monetization/purchase-intents/:intentId/payment-session",
        purpose: "Starts hosted checkout for the selected published paywall package.",
      },
      {
        method: "POST",
        path: "/api/my-xapps/:xappId/monetization/purchase-intents/:intentId/payment-session/finalize",
        purpose: "Finalizes hosted return and refreshes access for the current-subject XMS flow.",
      },
    ],
  },
  {
    key: "reference_marketplace_host_bridge",
    label: "Reference marketplace host proxy: advanced bridge",
    when_to_use:
      "Add these only when the tenant host needs bridge renewal or advanced signing seams.",
    endpoints: [
      {
        method: "POST",
        path: "/api/bridge/token-refresh",
        purpose: "Bridge v2 token-refresh helper for widget session renewal.",
      },
      {
        method: "POST",
        path: "/api/bridge/sign",
        purpose: "Optional bridge signing seam for advanced host integrations.",
      },
      {
        method: "POST",
        path: "/api/bridge/vendor-assertion",
        purpose: "Optional vendor assertion seam for advanced linked integrations.",
      },
    ],
  },
];

const OPTION_GROUPS = [
  {
    key: "lean_managed_first_lane",
    label: "Lean first version",
    recommended: true,
    platform_managed: ["payments: stripe gateway-managed", "invoicing", "notifications"],
    tenant_must_own: [
      "tenant identity/bootstrap",
      "core marketplace host proxy contract",
      "marketplace lifecycle routes",
      "payment return signing configuration",
      "guard execution endpoint",
      "tenant configuration for the chosen gateway lane",
    ],
    reference_endpoint_groups: [
      "core_health",
      "guard_execution",
      "gateway_managed_payment_reference",
      "reference_marketplace_host_core",
      "reference_marketplace_host_lifecycle",
      "tenant_subject_profile_reference",
    ],
  },
  {
    key: "tenant_payment_control",
    label: "Tenant payment method / delegated evolution",
    recommended: false,
    platform_managed: ["invoicing", "notifications"],
    tenant_must_own: [
      "payment lane selection/configuration",
      "core marketplace host proxy contract",
      "marketplace lifecycle routes",
      "payment return signing policy",
      "tenant payment page or equivalent UX if owner-managed mode is selected",
    ],
    reference_endpoint_groups: [
      "core_health",
      "guard_execution",
      "tenant_delegated_payment_reference",
      "owner_managed_payment_reference",
      "reference_marketplace_host_core",
      "reference_marketplace_host_lifecycle",
      "reference_marketplace_host_bridge",
      "tenant_subject_profile_reference",
    ],
    notes: [
      "Current tenant backend is the reference seam for tenant-controlled payment evolution.",
      "The tenant may keep the same contract in Node or reimplement it in PHP/Laravel via xapps-platform/xapps-php.",
    ],
  },
  {
    key: "tenant_own_invoicing",
    label: "Tenant-owned invoicing later",
    recommended: false,
    platform_managed: [],
    tenant_must_own: [
      "tenant invoice provider configuration",
      "invoice execution policy/refs on the gateway lane",
    ],
    reference_endpoint_groups: [],
    notes: [
      "No dedicated tenant backend endpoint is required in the current lean lane for managed invoicing.",
      "If tenant-owned invoicing is selected later, follow docs/specifications/expansions/09-invoicing-hook-provider-model.md.",
    ],
  },
  {
    key: "tenant_own_notifications",
    label: "Tenant-owned notifications later",
    recommended: false,
    platform_managed: [],
    tenant_must_own: [
      "tenant notification provider configuration",
      "notification execution policy/refs on the gateway lane",
    ],
    reference_endpoint_groups: [],
    notes: [
      "No dedicated tenant backend endpoint is required in the current lean lane for managed notifications.",
      "If tenant-owned notifications are selected later, follow docs/specifications/expansions/08-notification-hook-provider-model.md.",
    ],
  },
];

const PAYMENT_MODE_SUMMARY = [
  {
    key: "gateway_managed",
    label: "Gateway managed",
    default_for_first_lane: true,
    page_owner: "gateway",
  },
  {
    key: "tenant_delegated",
    label: "Gateway delegated by tenant",
    default_for_first_lane: false,
    page_owner: "gateway",
  },
  {
    key: "publisher_delegated",
    label: "Gateway delegated by publisher",
    default_for_first_lane: false,
    page_owner: "gateway",
  },
  {
    key: "owner_managed",
    reference_key: "owner_managed",
    label: "Owner managed",
    default_for_first_lane: false,
    page_owner: "owner",
  },
];

function nowIso() {
  return new Date().toISOString();
}

function buildReferenceCapabilityState(options = {}) {
  return {
    enableReference: options.enableReference !== false,
    enableLifecycle: options.enableLifecycle !== false,
    enableBridge: options.enableBridge !== false,
    enabledModes: normalizeEnabledBackendModes(options.enabledModes),
  };
}

function filterEndpointGroups(capabilities) {
  const filteredStaticGroups = BASE_ENDPOINT_GROUPS.filter((group) => {
    if (group.key === "reference_marketplace_host_lifecycle") return capabilities.enableLifecycle;
    if (group.key === "reference_marketplace_host_bridge") return capabilities.enableBridge;
    if (
      [
        "gateway_managed_payment_reference",
        "tenant_delegated_payment_reference",
        "publisher_delegated_payment_reference",
        "owner_managed_payment_reference",
      ].includes(group.key)
    ) {
      return false;
    }
    return true;
  });
  const modeGroups = getBackendModeEndpointGroups(capabilities.enabledModes);
  const guardIndex = filteredStaticGroups.findIndex((group) => group.key === "guard_execution");
  if (guardIndex === -1) return [...filteredStaticGroups, ...modeGroups];
  return [
    ...filteredStaticGroups.slice(0, guardIndex + 1),
    ...modeGroups,
    ...filteredStaticGroups.slice(guardIndex + 1),
  ];
}

function filterIntegrationOptions(capabilities) {
  const allowedGroupKeys = new Set(filterEndpointGroups(capabilities).map((group) => group.key));
  return OPTION_GROUPS.map((option) => ({
    ...option,
    reference_endpoint_groups: (option.reference_endpoint_groups || []).filter((key) =>
      allowedGroupKeys.has(key),
    ),
  }));
}

function readReferenceConfig(options = {}) {
  const reference =
    options.reference && typeof options.reference === "object" ? options.reference : {};
  const branding = options.branding && typeof options.branding === "object" ? options.branding : {};
  const gateway = options.gateway && typeof options.gateway === "object" ? options.gateway : {};
  const rawAssets =
    reference.referenceAssets && typeof reference.referenceAssets === "object"
      ? reference.referenceAssets
      : {};
  const assets = Array.isArray(rawAssets.endpoints)
    ? rawAssets.endpoints
    : BASE_ENDPOINT_GROUPS.find((group) => group.key === "reference_assets")?.endpoints || [];
  return {
    tenant: String(reference.tenant || "").trim() || "tenant",
    workspace: String(reference.workspace || "").trim() || "tenant",
    stack: String(reference.stack || "").trim() || "node",
    mode: String(reference.mode || "").trim() || "reference-marketplace-tenant",
    tenantPolicySlugs: Array.isArray(reference.tenantPolicySlugs)
      ? reference.tenantPolicySlugs
      : [],
    proofSources: Array.isArray(reference.proofSources)
      ? reference.proofSources
      : ["/api/reference", "/api/host-config", "/api/installations?subjectId=..."],
    sdkPaths:
      reference.sdkPaths && typeof reference.sdkPaths === "object"
        ? reference.sdkPaths
        : {
            node: "@xapps-platform/server-sdk",
            php: "xapps-platform/xapps-php",
            browser: "@xapps-platform/embed-sdk",
          },
    hostSurfaces: Array.isArray(reference.hostSurfaces)
      ? reference.hostSurfaces
      : [
          { key: "single-panel", label: "Single panel", recommended_for_first_lane: true },
          { key: "split-panel", label: "Split panel", recommended_for_first_lane: false },
          { key: "single-xapp", label: "Single xapp", recommended_for_first_lane: false },
        ],
    notes: Array.isArray(reference.notes) ? reference.notes : [],
    gatewayUrl: String(gateway.baseUrl || "").trim(),
    displayName: String(branding.tenantName || "").trim(),
    stackLabel: String(branding.stackLabel || "").trim(),
    embedSdkCandidateFiles: Array.isArray(reference.embedSdkCandidateFiles)
      ? reference.embedSdkCandidateFiles
      : [],
    referenceAssetEndpoints: assets,
  };
}

export default async function referenceRoutes(fastify, options = {}) {
  const capabilities = buildReferenceCapabilityState(options);
  const enabledModeSet = new Set(capabilities.enabledModes);
  const reference = readReferenceConfig(options);

  fastify.get("/embed/sdk/xapps-embed-sdk.esm.js", async (request, reply) => {
    const localSdkFile = reference.embedSdkCandidateFiles.find((filePath) =>
      fs.existsSync(filePath),
    );
    if (localSdkFile) {
      return reply
        .code(200)
        .type("application/javascript; charset=utf-8")
        .send(fs.readFileSync(localSdkFile, "utf8"));
    }

    const upstreamUrl = `${String(reference.gatewayUrl || "")
      .trim()
      .replace(/\/+$/, "")}/embed/sdk/xapps-embed-sdk.esm.js`;
    if (!upstreamUrl.startsWith("http://") && !upstreamUrl.startsWith("https://")) {
      request.log.error(
        { gatewayUrl: reference.gatewayUrl },
        "invalid gateway URL for embed sdk fallback",
      );
      return reply.code(404).send({ ok: false, message: "embed sdk not built" });
    }

    try {
      const upstream = await fetch(upstreamUrl);
      if (!upstream.ok) {
        request.log.error(
          { status: upstream.status, upstreamUrl },
          "failed to fetch embed sdk from gateway fallback",
        );
        return reply.code(502).send({ ok: false, message: "embed sdk not available" });
      }
      return reply
        .code(200)
        .type("application/javascript; charset=utf-8")
        .send(await upstream.text());
    } catch (err) {
      request.log.error({ err, upstreamUrl }, "embed sdk fallback fetch failed");
      return reply.code(502).send({ ok: false, message: "embed sdk not available" });
    }
  });

  if (!capabilities.enableReference) return;

  fastify.get("/api/reference", async () => {
    const endpointGroups = filterEndpointGroups(capabilities).map((group) =>
      group.key === "reference_assets"
        ? { ...group, endpoints: reference.referenceAssetEndpoints }
        : group,
    );
    return {
      ok: true,
      tenant: reference.tenant,
      workspace: reference.workspace,
      stack: reference.stack,
      mode: reference.mode,
      time: nowIso(),
      gateway_url: reference.gatewayUrl,
      ...(reference.displayName ? { display_name: reference.displayName } : {}),
      ...(reference.stackLabel ? { stack_label: reference.stackLabel } : {}),
      tenant_policy_slugs: reference.tenantPolicySlugs,
      proof_sources: reference.proofSources,
      sdk_paths: reference.sdkPaths,
      host_surfaces: reference.hostSurfaces,
      payment_modes: PAYMENT_MODE_SUMMARY.filter((mode) => enabledModeSet.has(mode.key)),
      payment_mode_reference_details: getBackendModeReferenceDetails(capabilities.enabledModes),
      endpoint_groups: endpointGroups,
      integration_options: filterIntegrationOptions(capabilities),
      ...(reference.notes.length > 0 ? { notes: reference.notes } : {}),
    };
  });
}
