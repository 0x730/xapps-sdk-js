const tenantBaseUrl = String(process.env.XAPPS_TENANT_BASE_URL || "http://localhost:3312")
  .trim()
  .replace(/\/+$/, "");
const hostPublicUrl = String(process.env.XAPPS_HOST_PUBLIC_URL || "http://localhost:3412")
  .trim()
  .replace(/\/+$/, "");
const bootstrapApiKey = String(process.env.XAPPS_HOST_BOOTSTRAP_API_KEY || "").trim();

if (!bootstrapApiKey) {
  console.error("Missing XAPPS_HOST_BOOTSTRAP_API_KEY");
  process.exit(1);
}

function normalizeHostBootstrapPayload(input = {}) {
  const subjectId = typeof input.subjectId === "string" ? input.subjectId.trim() : "";
  const type = typeof input.type === "string" ? input.type.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const identifier =
    input.identifier && typeof input.identifier === "object" && !Array.isArray(input.identifier)
      ? input.identifier
      : null;
  const metadata =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : null;

  return {
    ...(subjectId ? { subjectId } : {}),
    ...(type ? { type } : {}),
    ...(identifier ? { identifier } : {}),
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export async function forwardHostBootstrap(input = {}) {
  const payload = normalizeHostBootstrapPayload(input);
  const response = await fetch(`${tenantBaseUrl}/api/host-bootstrap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": bootstrapApiKey,
    },
    body: JSON.stringify({
      ...payload,
      origin: hostPublicUrl,
    }),
  });
  const raw = await response.text();
  const data = (() => {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return { message: raw || "host bootstrap failed" };
    }
  })();
  if (!response.ok) {
    throw new Error(String(data?.message || "host bootstrap failed"));
  }
  return data;
}

async function runDemo() {
  const result = await forwardHostBootstrap({
    type: "business_member",
    identifier: {
      idType: "tenant_member_id",
      value: "acct-company-a-user-42",
      hint: "Company A",
    },
    email: "alex@example.com",
    name: "Alex Example",
    metadata: {
      companyId: "company-a",
      role: "member",
    },
  });

  console.log(
    JSON.stringify(
      {
        tenantBaseUrl,
        hostPublicUrl,
        result,
      },
      null,
      2,
    ),
  );
}

runDemo().catch((error) => {
  console.error(error);
  process.exit(1);
});

/*
Framework mapping sketch:

  app.post("/api/browser/host-bootstrap", async (req, reply) => {
    reply.send(await forwardHostBootstrap(req.body));
  });

Expected local request body:

  {
    type?: string,
    identifier?: { idType: string, value: string, hint?: string },
    email?: string,
    name?: string,
    metadata?: Record<string, unknown>
  }

First bootstrap usually sends `identifier`, not `subjectId`.
If the integrator later stores the returned platform `subjectId`, it may include it too.

The local route forwards the same identity payload to:

  POST {XAPPS_HOST_PUBLIC_URL}/api/browser/host-bootstrap

The local browser-safe route forwards to:

  POST {XAPPS_TENANT_BASE_URL}/api/host-bootstrap

with:

  X-API-Key: {XAPPS_HOST_BOOTSTRAP_API_KEY}

and appends:

  { origin: XAPPS_HOST_PUBLIC_URL }
*/
