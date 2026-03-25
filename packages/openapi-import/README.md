# `@xapps-platform/openapi-import`

Reusable OpenAPI -> Xapps manifest transformer.

## Install

```bash
npm install @xapps-platform/openapi-import
```

## Exports

- `buildManifestFromOpenApiText`
- `buildManifestFromOpenApiDocument`
- `extractOpenApiInfoFromText`
- `slugifyManifestName`

## Minimal usage

```ts
import { buildManifestFromOpenApiText } from "@xapps-platform/openapi-import";

const manifest = buildManifestFromOpenApiText(openApiText, {
  name: "Imported API",
  slug: "imported-api",
  endpointBaseUrl: "https://api.example.com",
  endpointEnv: "prod",
});
```

## Notes

- Supports JSON and YAML OpenAPI input.
- Publishes independently from the other first-wave JS packages; a metadata/docs-only change here should not force a full wave republish.
- Used by CLI import and publisher OpenAPI import routes.
- See package/runtime ownership: `docs/guides/12-package-usage-and-ownership.md`.
