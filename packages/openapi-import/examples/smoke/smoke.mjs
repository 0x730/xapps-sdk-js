import {
  buildManifestFromOpenApiText,
  extractOpenApiInfoFromText,
  slugifyManifestName,
} from "../../dist/index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const openApiText = `
openapi: 3.1.0
info:
  title: Certificates API
  version: 1.0.0
paths:
  /certificates:
    post:
      operationId: issueCertificate
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                userId:
                  type: string
              required: [userId]
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  certificateId:
                    type: string
`;

console.log("openapi-import smoke: start");

const info = extractOpenApiInfoFromText(openApiText);
assert(info.title === "Certificates API", "OpenAPI info title mismatch");
assert(slugifyManifestName("Certificates API") === "certificates-api", "slugify mismatch");

const manifest = buildManifestFromOpenApiText(openApiText, {
  name: "Certificates API",
  slug: "certificates-api",
  endpointBaseUrl: "https://api.example.test",
  endpointEnv: "prod",
});
assert(manifest.slug === "certificates-api", "manifest slug mismatch");
assert(Array.isArray(manifest.tools) && manifest.tools.length === 1, "manifest tools mismatch");
assert(
  manifest.tools[0].tool_name === "issuecertificate",
  "tool operation id normalization mismatch",
);

console.log("openapi-import smoke: ok");
