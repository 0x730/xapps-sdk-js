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
- Publishes independently from the other public JS packages; a metadata/docs-only change here should not force a full package-set republish.
- Used by CLI import and publisher OpenAPI import routes.
- Generated manifests still have to pass the Xapp manifest validator. Very large OpenAPI specs can exceed current manifest limits such as the `tools[]` / `widgets[]` `maxItems: 50` cap, so they may need to be split or curated before publish.
- See package/runtime ownership: `docs/guides/12-package-usage-and-ownership.md`.
