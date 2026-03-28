import { parseXappManifest, resolveManifestLocalizedText } from "../../dist/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log("xapp-manifest smoke: start");

const manifest = parseXappManifest({
  title: { en: "Smoke Manifest", ro: "Manifest Test" },
  name: "Smoke Manifest",
  slug: "smoke-manifest",
  version: "1.0.0",
  tools: [
    {
      tool_name: "echo",
      title: { en: "Echo", ro: "Ecou" },
      input_schema: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: ["message"],
      },
      output_schema: {
        type: "object",
        properties: {
          echoed: { type: "string" },
        },
      },
    },
  ],
  widgets: [
    {
      widget_name: "echo_widget",
      type: "write",
      renderer: "json-forms",
      bind_tool_name: "echo",
      entry: {
        kind: "platform_template",
        template: "write_form",
      },
    },
  ],
});

assert(manifest.slug === "smoke-manifest", "manifest slug mismatch");
assert(Array.isArray(manifest.tools) && manifest.tools.length === 1, "manifest tools mismatch");
assert(
  Array.isArray(manifest.widgets) && manifest.widgets.length === 1,
  "manifest widgets mismatch",
);
assert(
  resolveManifestLocalizedText(manifest.title, "ro") === "Manifest Test",
  "locale fallback mismatch",
);
assert(
  resolveManifestLocalizedText(manifest.tools[0].title, "ro-RO") === "Ecou",
  "tool locale mismatch",
);

console.log("xapp-manifest smoke: ok");
