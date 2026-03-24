import { describe, expect, it } from "vitest";
import {
  buildManifestFromOpenApiDocument,
  buildManifestFromOpenApiText,
  extractOpenApiInfoFromText,
  slugifyManifestName,
} from "../src/index";

describe("openapi-import", () => {
  it("extracts basic document info from YAML", () => {
    const info = extractOpenApiInfoFromText(`
openapi: 3.0.0
info:
  title: Billing API
  description: Import test
  version: 1.2.3
paths: {}
`);

    expect(info).toEqual({
      title: "Billing API",
      description: "Import test",
      version: "1.2.3",
    });
  });

  it("slugifies manifest names predictably", () => {
    expect(slugifyManifestName("  Billing API / Internal  ")).toBe("billing-api-internal");
  });

  it("builds a manifest from an OpenAPI document with refs and allOf", () => {
    const doc = {
      openapi: "3.0.0",
      info: { title: "Payments API", version: "1.0.0" },
      paths: {
        "/payments/{paymentId}": {
          get: {
            operationId: "getPayment",
            summary: "Get payment",
            parameters: [
              {
                name: "paymentId",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "ok",
                content: {
                  "application/json": {
                    schema: {
                      allOf: [
                        { $ref: "#/components/schemas/PaymentBase" },
                        {
                          type: "object",
                          properties: {
                            status: { type: "string" },
                          },
                          required: ["status"],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          PaymentBase: {
            type: "object",
            properties: {
              id: { type: "string" },
              amount: { type: "number" },
            },
            required: ["id"],
          },
        },
      },
    };

    const manifest = buildManifestFromOpenApiDocument(doc, {
      name: "Payments API",
      slug: "payments-api",
      endpointBaseUrl: "https://api.example.test",
    });

    expect(manifest.tools).toHaveLength(1);
    expect(manifest.tools[0]).toMatchObject({
      tool_name: "getpayment",
      title: "Get payment",
      input_schema: {
        properties: {
          paymentId: { type: "string" },
        },
        required: ["paymentId"],
      },
      output_schema: {
        properties: {
          id: { type: "string" },
          amount: { type: "number" },
          status: { type: "string" },
        },
        required: ["id", "status"],
      },
      adapter: {
        method: "GET",
        path: "/payments/{{ payload.paymentId }}",
        response_mapping: {
          id: "{{ response.id }}",
          amount: "{{ response.amount }}",
          status: "{{ response.status }}",
        },
      },
    });
  });

  it("builds a manifest from raw text", () => {
    const manifest = buildManifestFromOpenApiText(
      JSON.stringify({
        openapi: "3.0.0",
        info: { title: "Users API" },
        paths: {
          "/users": {
            post: {
              operationId: "createUser",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        email: { type: "string" },
                      },
                      required: ["email"],
                    },
                  },
                },
              },
              responses: {
                "201": {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                        },
                        required: ["id"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      {
        name: "Users API",
        slug: "users-api",
        endpointBaseUrl: "https://users.example.test",
      },
    );

    expect(manifest.widgets[0]).toMatchObject({
      widget_name: "createuser_widget",
      bind_tool_name: "createuser",
    });
  });
});
