import { parseXappManifest } from "../../dist/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log("xapp-manifest smoke: start");

const manifest = parseXappManifest({
  name: "Smoke Manifest",
  slug: "smoke-manifest",
  version: "1.0.0",
  tools: [
    {
      tool_name: "echo",
      title: "Echo",
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
assert(Array.isArray(manifest.widgets) && manifest.widgets.length === 1, "manifest widgets mismatch");

console.log("xapp-manifest smoke: ok");
