# `@xapps-platform/xapp-manifest`

Shared Xapp manifest schema, types, and structural validator.

## Install

```bash
npm install @xapps-platform/xapp-manifest
```

## Purpose

Use this package when you need manifest parsing and validation without pulling in the broader backend/runtime SDK surface.

It is the direct public home for:

- `xappManifestJsonSchema`
- `parseXappManifest(...)`
- `resolveManifestLocalizedText(...)`
- manifest-facing TypeScript types such as `XappManifest`

## What moved here

This package now owns the shared manifest contract that was previously implemented only in the core validator.

That shared surface includes:

- JSON schema validation
- structural manifest normalization/parsing
- shared governance checks for hook/notification/invoice/subject-profile manifest sections
- structured warnings for unreferenced definitions/templates

## What stayed in core

Gateway/runtime-only behavior still stays in core API code.

The current core wrapper in `src/validation/xappManifest.ts` exists only to:

- reuse this shared validator
- map shared warnings into gateway logger output

## Minimal usage

```ts
import {
  parseXappManifest,
  resolveManifestLocalizedText,
  xappManifestJsonSchema,
} from "@xapps-platform/xapp-manifest";

const manifest = parseXappManifest({
  title: { en: "Example Xapp", ro: "Xapp Exemplu" },
  name: "Example Xapp",
  slug: "example-xapp",
  version: "1.0.0",
  tools: [
    {
      tool_name: "echo",
      title: { en: "Echo", ro: "Ecou" },
      input_schema: { type: "object", properties: {} },
      output_schema: { type: "object", properties: {} },
    },
  ],
  widgets: [],
});

console.log(manifest.slug);
console.log(xappManifestJsonSchema.type);
console.log(resolveManifestLocalizedText(manifest.title, "ro-RO"));
```

Existing plain-string manifests remain valid. Localized text is additive and falls back to English/default when the requested locale is missing.

Notification and invoice templates also accept additive locale metadata:

- `notification_templates[].locale`
- `notification_templates[].family`
- `invoice_templates[].locale`
- `invoice_templates[].family`

These fields do not change current template resolution by themselves. They are safe metadata for locale-aware template families and future variant selection.

## Relation to other packages

- `@xapps-platform/server-sdk` re-exports this package for convenience in backend-oriented code.
- `@xapps-platform/cli` uses this validator through `@xapps-platform/server-sdk` so current CLI publish flows stay non-breaking.

## Build

```bash
npm run build --workspace packages/xapp-manifest
```

## Smoke

```bash
npm run smoke --workspace packages/xapp-manifest
```
