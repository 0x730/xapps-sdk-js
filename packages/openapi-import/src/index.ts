import yaml from "js-yaml";

type AnyRecord = Record<string, any>;

export type OpenApiDocumentInfo = {
  title?: string;
  description?: string;
  version?: string;
};

export type OpenApiImportOptions = {
  name: string;
  slug: string;
  version?: string;
  description?: string;
  endpointBaseUrl: string;
  endpointEnv?: string;
};

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function slugifyManifestName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function toSlug(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

function parseInputDocument(raw: string): AnyRecord {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    throw new Error("OpenAPI input is empty");
  }
  try {
    const parsedJson = JSON.parse(trimmed);
    if (!isRecord(parsedJson)) throw new Error("OpenAPI JSON must be an object");
    return parsedJson;
  } catch {
    const parsedYaml = yaml.load(trimmed);
    if (!isRecord(parsedYaml)) throw new Error("OpenAPI YAML must be an object");
    return parsedYaml;
  }
}

export function extractOpenApiInfoFromText(raw: string): OpenApiDocumentInfo {
  const doc = parseInputDocument(raw);
  const info = isRecord(doc.info) ? doc.info : {};
  return {
    title: typeof info.title === "string" ? info.title : undefined,
    description: typeof info.description === "string" ? info.description : undefined,
    version: typeof info.version === "string" ? info.version : undefined,
  };
}

function resolveJsonPointer(root: AnyRecord, ref: string): unknown {
  if (!ref.startsWith("#/")) {
    throw new Error(`Only local $ref values are supported. Received: ${ref}`);
  }
  const segments = ref
    .slice(2)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));

  let cursor: unknown = root;
  for (const segment of segments) {
    if (!isRecord(cursor) && !Array.isArray(cursor)) return undefined;
    cursor = (cursor as any)[segment];
  }
  return cursor;
}

function resolveSchema(root: AnyRecord, schema: unknown, seen: Set<string> = new Set()): AnyRecord {
  if (!isRecord(schema)) {
    return { type: "object", additionalProperties: true };
  }

  if (typeof schema.$ref === "string" && schema.$ref.trim()) {
    const ref = schema.$ref.trim();
    if (seen.has(ref)) {
      throw new Error(`Circular $ref detected: ${ref}`);
    }
    const target = resolveJsonPointer(root, ref);
    if (!target) {
      throw new Error(`$ref not found: ${ref}`);
    }
    const nextSeen = new Set(seen);
    nextSeen.add(ref);
    return resolveSchema(root, target, nextSeen);
  }

  const resolved: AnyRecord = { ...schema };

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged: AnyRecord = { type: "object", properties: {}, required: [] as string[] };
    for (const part of schema.allOf) {
      const resolvedPart = resolveSchema(root, part, seen);
      if (isRecord(resolvedPart.properties)) {
        merged.properties = { ...(merged.properties || {}), ...resolvedPart.properties };
      }
      if (Array.isArray(resolvedPart.required)) {
        merged.required = Array.from(
          new Set([...(merged.required || []), ...resolvedPart.required]),
        );
      }
      if (resolvedPart.type && merged.type !== resolvedPart.type) {
        merged.type = resolvedPart.type;
      }
    }
    return merged;
  }

  if (isRecord(schema.properties)) {
    resolved.properties = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      resolved.properties[key] = resolveSchema(root, prop, seen);
    }
  }

  if (isRecord(schema.items)) {
    resolved.items = resolveSchema(root, schema.items, seen);
  }

  return resolved;
}

function pickRequestBodySchema(root: AnyRecord, operation: AnyRecord): AnyRecord | null {
  const requestBodyRaw = operation.requestBody;
  if (!requestBodyRaw) return null;
  const requestBody = resolveSchema(root, requestBodyRaw);
  const content = isRecord(requestBody.content) ? requestBody.content : {};
  const jsonLike =
    (content["application/json"] as AnyRecord) ||
    (content["application/*+json"] as AnyRecord) ||
    (content["*/*"] as AnyRecord);
  if (!isRecord(jsonLike) || !jsonLike.schema) return null;
  return resolveSchema(root, jsonLike.schema);
}

function pickResponseSchema(root: AnyRecord, operation: AnyRecord): AnyRecord {
  const responses = isRecord(operation.responses) ? operation.responses : {};
  const candidates = ["200", "201", "202", "default"];
  for (const status of candidates) {
    const response = responses[status];
    if (!response) continue;
    const resolvedResponse = resolveSchema(root, response);
    const content = isRecord(resolvedResponse.content) ? resolvedResponse.content : {};
    const jsonLike =
      (content["application/json"] as AnyRecord) ||
      (content["application/*+json"] as AnyRecord) ||
      (content["*/*"] as AnyRecord);
    if (isRecord(jsonLike) && jsonLike.schema) {
      return resolveSchema(root, jsonLike.schema);
    }
  }
  return { type: "object", additionalProperties: true };
}

function collectParameters(
  root: AnyRecord,
  pathItem: AnyRecord,
  operation: AnyRecord,
): AnyRecord[] {
  const out: AnyRecord[] = [];
  const raw = [
    ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
    ...(Array.isArray(operation.parameters) ? operation.parameters : []),
  ];
  for (const param of raw) {
    const resolved = resolveSchema(root, param);
    if (!isRecord(resolved)) continue;
    if (!resolved.name || typeof resolved.name !== "string") continue;
    out.push(resolved);
  }
  return out;
}

function interpolatePath(pathTemplate: string): string {
  return String(pathTemplate || "").replace(
    /\{([^}]+)\}/g,
    (_m, name: string) => `{{ payload.${name} }}`,
  );
}

function buildResponseMapping(outputSchema: AnyRecord): AnyRecord | undefined {
  if (!isRecord(outputSchema) || String(outputSchema.type || "") !== "object") return undefined;
  if (!isRecord(outputSchema.properties)) return undefined;
  const mapping: AnyRecord = {};
  for (const key of Object.keys(outputSchema.properties)) {
    mapping[key] = `{{ response.${key} }}`;
  }
  return Object.keys(mapping).length ? mapping : undefined;
}

export function buildManifestFromOpenApiDocument(
  openApiDocument: AnyRecord,
  options: OpenApiImportOptions,
): AnyRecord {
  if (!isRecord(openApiDocument.openapi) && typeof openApiDocument.openapi !== "string") {
    // fall through; some specs provide swagger key only, but we still support path parsing.
  }
  const paths = isRecord(openApiDocument.paths) ? openApiDocument.paths : {};
  const tools: AnyRecord[] = [];

  for (const [pathName, pathItemRaw] of Object.entries(paths)) {
    if (!isRecord(pathItemRaw)) continue;
    const pathItem = pathItemRaw as AnyRecord;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isRecord(operation)) continue;

      const fallbackToolName =
        toSlug(`${method}_${pathName.replace(/[{}]/g, "")}`) || `tool_${tools.length + 1}`;
      const operationId =
        typeof operation.operationId === "string" ? operation.operationId : fallbackToolName;
      const toolName = toSlug(operationId) || fallbackToolName;
      const title =
        (typeof operation.summary === "string" && operation.summary.trim()) ||
        (typeof operation.operationId === "string" && operation.operationId.trim()) ||
        `${method.toUpperCase()} ${pathName}`;

      const description =
        (typeof operation.description === "string" && operation.description.trim()) || undefined;

      const parameters = collectParameters(openApiDocument, pathItem, operation);
      const requestBodySchema = pickRequestBodySchema(openApiDocument, operation);

      const inputSchema: AnyRecord = { type: "object", properties: {}, required: [] as string[] };
      for (const param of parameters) {
        const paramName = String(param.name || "").trim();
        if (!paramName) continue;
        inputSchema.properties[paramName] = param.schema
          ? resolveSchema(openApiDocument, param.schema)
          : { type: "string" };
        if (param.required === true) {
          inputSchema.required.push(paramName);
        }
      }

      if (requestBodySchema) {
        if (
          String(requestBodySchema.type || "") === "object" &&
          isRecord(requestBodySchema.properties)
        ) {
          inputSchema.properties = {
            ...(inputSchema.properties || {}),
            ...requestBodySchema.properties,
          };
          if (Array.isArray(requestBodySchema.required)) {
            inputSchema.required = Array.from(
              new Set([...(inputSchema.required || []), ...requestBodySchema.required.map(String)]),
            );
          }
        } else {
          inputSchema.properties.body = requestBodySchema;
        }
      }
      if (!Object.keys(inputSchema.properties || {}).length) {
        inputSchema.additionalProperties = true;
      }
      if (!(inputSchema.required || []).length) {
        delete inputSchema.required;
      }

      const outputSchema = pickResponseSchema(openApiDocument, operation);

      const query: AnyRecord = {};
      const headers: AnyRecord = {};
      for (const param of parameters) {
        const paramName = String(param.name || "").trim();
        if (!paramName) continue;
        const where = String(param.in || "").trim();
        if (where === "query") query[paramName] = `{{ payload.${paramName} }}`;
        if (where === "header") headers[paramName] = `{{ payload.${paramName} }}`;
      }

      const adapter: AnyRecord = {
        method: method.toUpperCase(),
        path: interpolatePath(pathName),
      };
      if (Object.keys(query).length) adapter.query = query;
      if (Object.keys(headers).length) adapter.headers = headers;
      if (requestBodySchema && ["post", "put", "patch", "delete"].includes(method)) {
        adapter.body = "{{ payload }}";
      }
      const responseMapping = buildResponseMapping(outputSchema);
      if (responseMapping) adapter.response_mapping = responseMapping;

      tools.push({
        tool_name: toolName,
        title,
        ...(description ? { description } : {}),
        input_schema: inputSchema,
        output_schema: outputSchema,
        adapter,
      });
    }
  }

  if (!tools.length) {
    throw new Error("No OpenAPI operations found in paths.*");
  }

  const widgets = tools.map((tool) => ({
    widget_name: `${tool.tool_name}_widget`.slice(0, 100),
    title: tool.title,
    type: "write",
    renderer: "json-forms",
    bind_tool_name: tool.tool_name,
    entry: { kind: "platform_template", template: "write_form" },
  }));

  const endpointEnv = String(options.endpointEnv || "prod").trim() || "prod";
  const manifest: AnyRecord = {
    name: options.name,
    slug: options.slug,
    version: options.version || "1.0.0",
    ...(options.description ? { description: options.description } : {}),
    tools,
    widgets,
    endpoints: {
      [endpointEnv]: {
        base_url: options.endpointBaseUrl,
        timeout_ms: 15000,
        retry_policy: { max_retries: 1, backoff: "exponential" },
        region: "global",
        labels: { profile: "openapi-import", env: endpointEnv },
      },
    },
    connectivity: {
      executor_mode: "PUBLIC_EXECUTOR",
      auth_mode: "PUBLISHER_APP",
      signing_policy: "none",
      proxy_policy: { egress_enabled: false },
    },
  };

  return manifest;
}

export function buildManifestFromOpenApiText(
  rawText: string,
  options: OpenApiImportOptions,
): AnyRecord {
  const document = parseInputDocument(rawText);
  return buildManifestFromOpenApiDocument(document, options);
}
