# `@xapps-platform/platform-i18n`

Shared locale normalization, translation lookup, and React i18n helpers for Xapps surfaces.

## Purpose

Use this package when multiple Xapps UI surfaces need one consistent locale contract and fallback
model.

Current shipped usage includes:

- portal locale state/provider
- shared marketplace/embed UI
- shared widget/runtime fallback copy

## Install

```bash
npm install @xapps-platform/platform-i18n
```

## Scope

This package is intentionally small:

- locale normalization
- fallback-aware dictionary lookup
- lightweight React provider/hooks

It is the shared i18n seam under higher-level packages such as
`@xapps-platform/marketplace-ui`.
