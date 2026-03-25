import React from "react";

type JsonSchema = Record<string, unknown> | null;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isPrimitive(value: unknown) {
  return value == null || ["string", "number", "boolean"].includes(typeof value);
}

function asArtifactLink(
  value: unknown,
): { filename?: string; url: string; mimeType?: string } | null {
  const record = asRecord(value);
  if (typeof record.url === "string") {
    return {
      filename: typeof record.filename === "string" ? record.filename : undefined,
      url: record.url,
      mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined,
    };
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function renderValue(schema: JsonSchema | undefined, value: unknown): React.ReactNode {
  const artifact = asArtifactLink(value);
  if (artifact) {
    return (
      <a href={artifact.url} target="_blank" rel="noreferrer">
        {artifact.filename ?? artifact.url}
      </a>
    );
  }

  if (isPrimitive(value)) {
    return (
      <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
        {String(value)}
      </code>
    );
  }

  if (Array.isArray(value)) {
    const itemSchema = asRecord(schema?.items);
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {value.map((v, idx) => (
          <div key={idx} style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}>
            {renderValue(itemSchema, v)}
          </div>
        ))}
      </div>
    );
  }

  // object
  const props = asRecord(schema?.properties);
  const valueRecord = asRecord(value);
  const keys = Object.keys(props).length ? Object.keys(props) : Object.keys(valueRecord);
  return (
    <div>
      {keys.map((k) => (
        <Field key={k} label={asRecord(props[k]).title ? String(asRecord(props[k]).title) : k}>
          {renderValue(asRecord(props[k]), valueRecord[k])}
        </Field>
      ))}
    </div>
  );
}

export function SchemaOutputView({ schema, value }: { schema: JsonSchema; value: unknown }) {
  if (!schema) {
    return (
      <pre
        style={{
          margin: 0,
          overflow: "auto",
          background: "#f8fafc",
          padding: 12,
          borderRadius: 12,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <div>{renderValue(schema, value)}</div>;
}
