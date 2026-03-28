import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resolveMarketplaceText, useMarketplaceI18n } from "../i18n";
import { useMarketplace } from "../MarketplaceContext";
import type { CatalogXapp } from "../types";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { MarketplacePrimaryNav } from "../components/MarketplacePrimaryNav";
import { buildTokenSearch } from "../utils/embedSearch";
import { asRecord, readFirstString, readString } from "../utils/readers";
import "../marketplace.css";

type StoredCatalogFilters = {
  addedOnly?: boolean;
  selectedTag?: string;
};

type PendingRemoval = {
  installationId: string;
  xappId: string;
  title: string;
} | null;

function useQueryToken(): string {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  return qs.get("token") ?? "";
}

function getDefaultWidgetId(x: CatalogXapp): string | null {
  const rawWidgets = asRecord(x.manifest).widgets;
  const widgets: unknown[] | null = Array.isArray(rawWidgets) ? rawWidgets : null;
  if (!widgets || widgets.length === 0) return null;
  const def = widgets.find((w) => asRecord(w).default === true);
  const pick = def || widgets[0];
  return readFirstString(asRecord(pick).id) || null;
}

function buildCatalogFilterStorageKey(input: {
  isEmbedded: boolean;
  singleXappMode?: boolean;
  xappId?: string;
  publishers?: string[];
  tags?: string[];
  subjectId?: string | null;
}): string {
  const mode = input.isEmbedded ? "embed" : "portal";
  const scope = input.singleXappMode && input.xappId ? `xapp:${input.xappId}` : "catalog";
  const publishers = (input.publishers ?? []).slice().sort().join(",") || "all";
  const tags = (input.tags ?? []).slice().sort().join(",") || "all";
  const subject = String(input.subjectId || "").trim() || "anonymous";
  return `xapps:marketplace:catalog-filters:${mode}:${scope}:subject=${subject}:publishers=${publishers}:tags=${tags}`;
}

function readStoredCatalogFilters(storageKey: string): StoredCatalogFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCatalogFilters | null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredCatalogFilters(storageKey: string, value: StoredCatalogFilters): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Ignore storage write failures; filters still work for the current session.
  }
}

export function CatalogPage() {
  const { client, host, env } = useMarketplace();
  const { locale, t } = useMarketplaceI18n();
  const canMutate = host.canMutate ? host.canMutate() : true;
  const addAppLabel = env?.copy?.addAppLabel || "Add app";
  const removeAppLabel = env?.copy?.removeAppLabel || "Remove app";
  const loc = useLocation();
  const token = useQueryToken();
  const tokenSearch = buildTokenSearch(token, loc.search);
  const navigate = useNavigate();
  const isEmbedded = window.location.pathname.startsWith("/embed");
  const storageKey = useMemo(
    () =>
      buildCatalogFilterStorageKey({
        isEmbedded,
        singleXappMode: env?.singleXappMode,
        xappId: env?.xappId,
        publishers: env?.publishers,
        tags: env?.tags,
        subjectId: host.subjectId,
      }),
    [env?.publishers, env?.singleXappMode, env?.tags, env?.xappId, host.subjectId, isEmbedded],
  );
  const defaultTag = env?.tags?.[0] ?? "";

  const [items, setItems] = useState<CatalogXapp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [installedOnly, setInstalledOnly] = useState<boolean>(() =>
    Boolean(readStoredCatalogFilters(storageKey)?.addedOnly),
  );
  const [selectedTag, setSelectedTag] = useState<string>(() => {
    const stored = readStoredCatalogFilters(storageKey);
    return typeof stored?.selectedTag === "string" ? stored.selectedTag : defaultTag;
  });
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval>(null);

  const installationsByXappId = host.getInstallationsByXappId();

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const x of items) {
      const tags = x.manifest?.tags;
      if (Array.isArray(tags)) {
        for (const t of tags) s.add(t);
      }
    }
    // If env.tags provided, we might want to restrict the dropdown to only those.
    if (env?.tags && env.tags.length > 0) {
      return Array.from(s)
        .filter((t) => env.tags!.includes(t))
        .sort((a, b) => a.localeCompare(b));
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items, env?.tags]);

  async function refresh() {
    setError(null);
    setBusy(true);
    try {
      const res = await client.listCatalogXapps();
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      setError(readFirstString(asRecord(e).message) || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    host.refreshInstallations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = readStoredCatalogFilters(storageKey);
    setInstalledOnly(Boolean(stored?.addedOnly));
    setSelectedTag(typeof stored?.selectedTag === "string" ? stored.selectedTag : defaultTag);
  }, [defaultTag, storageKey]);

  useEffect(() => {
    const restrictedTags = env?.tags ?? [];
    if (selectedTag && restrictedTags.length > 0 && !restrictedTags.includes(selectedTag)) {
      setSelectedTag(defaultTag);
    }
  }, [defaultTag, env?.tags, selectedTag]);

  useEffect(() => {
    writeStoredCatalogFilters(storageKey, {
      addedOnly: installedOnly,
      selectedTag: selectedTag || "",
    });
  }, [installedOnly, selectedTag, storageKey]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((x) => {
      const inst = installationsByXappId[String(x.id)];
      const isInstalled = Boolean(inst);
      if (installedOnly && !isInstalled) return false;

      // Filter by tags from env (if any) - these are usually mandatory restrictions from the session
      if (env?.tags && env.tags.length > 0) {
        const xTags = Array.isArray(x.manifest?.tags)
          ? x.manifest.tags.filter((tag): tag is string => typeof tag === "string")
          : [];
        const hasMatch = env.tags.some((t) => xTags.includes(t));
        if (!hasMatch) return false;
      }

      // Filter by publishers from env (if any)
      if (env?.publishers && env.publishers.length > 0) {
        if (x.publisher?.slug && !env.publishers.includes(x.publisher.slug)) return false;
      }

      // Local UI filter (Tags dropdown)
      if (selectedTag) {
        const tags = asRecord(x).manifest ? asRecord(asRecord(x).manifest).tags : undefined;
        if (!Array.isArray(tags) || !tags.includes(selectedTag)) return false;
      }

      if (!qq) return true;
      const hay =
        `${x.manifest?.title ?? x.name} ${x.manifest?.description ?? x.description ?? ""} ${x.slug}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [items, installationsByXappId, installedOnly, q, selectedTag, env?.tags, env?.publishers]);

  return (
    <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
      <header className="mx-header">
        <h1 className="mx-title">
          {env?.title ?? t("common.marketplace", undefined, "Marketplace")}
        </h1>
        <div className="mx-header-actions">
          <MarketplacePrimaryNav active="xapps" isEmbedded={isEmbedded} tokenSearch={tokenSearch} />
          <button
            className={`mx-btn-icon ${busy ? "is-spinning" : ""}`}
            onClick={() => void refresh()}
            disabled={busy}
            title={t("common.refresh", undefined, "Refresh")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </header>

      {error && <div className="mx-alert mx-alert-error">{error}</div>}

      <div className="mx-search-filters">
        <div className="mx-filters-inner">
          <div className="mx-input-group mx-input-group-grow">
            <label className="mx-label">{t("common.search", undefined, "Search")}</label>
            <input
              className="mx-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t(
                "catalog.search_placeholder",
                undefined,
                "Search by name, description...",
              )}
              aria-label={t("catalog.search_aria", undefined, "Search apps")}
            />
          </div>

          <div className="mx-input-group">
            <label className="mx-label">{t("common.tag", undefined, "Tag")}</label>
            <select
              className="mx-input mx-select"
              value={selectedTag}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedTag(next);
                writeStoredCatalogFilters(storageKey, {
                  addedOnly: installedOnly,
                  selectedTag: next,
                });
              }}
              aria-label={t("catalog.filter_by_tag", undefined, "Filter by tag")}
            >
              <option value="">{t("common.all_tags", undefined, "All Tags")}</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <label className="mx-checkbox-label">
            <input
              type="checkbox"
              checked={installedOnly}
              onChange={(e) => {
                const next = e.target.checked;
                setInstalledOnly(next);
                writeStoredCatalogFilters(storageKey, {
                  addedOnly: next,
                  selectedTag: selectedTag || "",
                });
              }}
              className="mx-checkbox"
            />
            <span className="mx-label mx-label-inline">
              {t("common.added_only", undefined, "Added only")}
            </span>
          </label>
        </div>
      </div>

      {busy && items.length === 0 ? (
        <div className="mx-grid" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="mx-skeleton-card">
              <div className="mx-skeleton-card-image" />
              <div className="mx-skeleton-card-content">
                <div className="mx-skeleton-line mx-skeleton-line-sm" />
                <div className="mx-skeleton-line mx-skeleton-line-title" />
                <div className="mx-skeleton-line mx-skeleton-line-full" />
                <div className="mx-skeleton-line mx-skeleton-line-short" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {!busy && (
            <div className="mx-results-bar">
              <div className="mx-results-count">
                {filtered.length === items.length
                  ? t(
                      "catalog.results_all",
                      {
                        count: filtered.length,
                        suffix: filtered.length === 1 ? "" : "s",
                      },
                      `${filtered.length} app${filtered.length === 1 ? "" : "s"}`,
                    )
                  : t(
                      "catalog.results_filtered",
                      {
                        count: filtered.length,
                        total: items.length,
                        suffix: items.length === 1 ? "" : "s",
                      },
                      `${filtered.length} of ${items.length} app${items.length === 1 ? "" : "s"}`,
                    )}
              </div>
            </div>
          )}
          <div className="mx-grid">
            {filtered.length === 0 && !busy ? (
              <div className="mx-empty-catalog">
                <div className="mx-empty-catalog-icon">⌕</div>
                <div className="mx-empty-catalog-title">
                  {t("catalog.no_apps_found", undefined, "No apps found")}
                </div>
                <div className="mx-empty-catalog-desc">
                  {installedOnly && items.length > 0
                    ? t(
                        "catalog.empty_added_only",
                        undefined,
                        "No apps are installed for the current subject yet. Turn off Added only to browse the full catalog.",
                      )
                    : q || selectedTag || installedOnly
                      ? t(
                          "catalog.empty_filtered",
                          undefined,
                          "Try adjusting your search or filters to find what you're looking for.",
                        )
                      : t(
                          "catalog.empty_default",
                          undefined,
                          "No apps are available in the catalog right now.",
                        )}
                </div>
              </div>
            ) : (
              filtered.map((x: CatalogXapp) => {
                const manifest = asRecord(x.manifest);
                const title =
                  resolveMarketplaceText(manifest.title as any, locale) ||
                  readFirstString(x.name, x.slug) ||
                  "App";
                const desc =
                  resolveMarketplaceText(manifest.description as any, locale) ||
                  readFirstString(x.description);
                const image =
                  typeof manifest.image === "string"
                    ? manifest.image
                    : "https://picsum.photos/seed/" + x.slug + "/560/320";
                const inst = installationsByXappId[String(x.id)];
                const installed = Boolean(inst);
                const defaultWidgetId = getDefaultWidgetId(x);

                const xTerms = asRecord(manifest.terms);
                const requiresTerms = Boolean(
                  Object.keys(xTerms).length > 0 ||
                  (typeof xTerms.text === "string" && xTerms.text.trim()) ||
                  (typeof xTerms.url === "string" && xTerms.url.trim()),
                );
                const needsInstallDetails = !x.manifest || !("terms" in manifest) || requiresTerms;

                const detailTo = {
                  pathname: isEmbedded
                    ? `/xapps/${encodeURIComponent(String(x.id))}`
                    : `/marketplace/xapps/${encodeURIComponent(String(x.id))}`,
                  search: tokenSearch,
                };

                return (
                  <div key={x.id} className="mx-card">
                    <Link to={detailTo} className="mx-card-image-wrap">
                      <img src={image} alt={title} className="mx-card-image" />
                    </Link>
                    <div className="mx-card-content">
                      <div className="mx-card-head">
                        <div className="mx-card-meta">
                          {x.publisher?.slug ? (
                            <div className="mx-card-publisher">
                              {t("common.by", undefined, "by")}{" "}
                              <Link
                                to={{
                                  pathname: isEmbedded
                                    ? `/publishers/${encodeURIComponent(String(x.publisher.slug))}`
                                    : `/marketplace/publishers/${encodeURIComponent(
                                        String(x.publisher.slug),
                                      )}`,
                                  search: tokenSearch,
                                }}
                                className="mx-inline-link"
                              >
                                {x.publisher.name || x.publisher.slug}
                              </Link>
                            </div>
                          ) : (
                            <div className="mx-card-publisher">
                              {t("common.catalog_app", undefined, "Catalog app")}
                            </div>
                          )}
                          <div className="mx-card-badges">
                            {installed && (
                              <span className="mx-card-installed-badge">
                                <span className="mx-card-installed-badge-dot" />
                                {t("common.added", undefined, "Added")}
                              </span>
                            )}
                            {x.latest_version?.version && (
                              <div className="mx-card-version">v{x.latest_version.version}</div>
                            )}
                          </div>
                        </div>
                        <h3 className="mx-card-title">
                          <Link to={detailTo} className="mx-card-title-link">
                            {title}
                          </Link>
                        </h3>
                      </div>
                      <p className="mx-card-desc">{desc}</p>
                      <div className="mx-card-tags">
                        {(Array.isArray(manifest.tags) ? manifest.tags : [])
                          .filter((t): t is string => typeof t === "string")
                          .slice(0, 3)
                          .map((t) => (
                            <span key={t} className="mx-tag mx-tag-compact">
                              {t}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="mx-card-footer">
                      <Link
                        to={detailTo}
                        className="mx-btn mx-btn-ghost mx-btn-sm mx-card-footer-link"
                      >
                        {t("catalog.view_details", undefined, "View details")}
                      </Link>
                      {canMutate &&
                        (!installed ? (
                          <button
                            className="mx-btn mx-btn-primary mx-btn-sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (needsInstallDetails) {
                                navigate(detailTo);
                                return;
                              }
                              host.requestInstall({
                                xappId: String(x.id),
                                defaultWidgetId,
                                subjectId: host.subjectId ?? null,
                              });
                            }}
                          >
                            {addAppLabel}
                          </button>
                        ) : (
                          <button
                            className="mx-btn mx-btn-outline mx-btn-sm mx-btn-danger-text"
                            disabled={!inst?.installationId}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (inst?.installationId) {
                                setPendingRemoval({
                                  installationId: inst.installationId,
                                  xappId: String(x.id),
                                  title,
                                });
                              }
                            }}
                          >
                            {removeAppLabel}
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
      <ConfirmActionModal
        open={Boolean(pendingRemoval)}
        title={t("catalog.remove_app_title", undefined, "Remove app?")}
        description={
          pendingRemoval
            ? t(
                "catalog.remove_app_description",
                { title: pendingRemoval.title },
                `Remove ${pendingRemoval.title} from your current workspace? You can add it again later.`,
              )
            : ""
        }
        confirmLabel={removeAppLabel}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (!pendingRemoval) return;
          host.requestUninstall?.({
            installationId: pendingRemoval.installationId,
            xappId: pendingRemoval.xappId,
          });
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}
