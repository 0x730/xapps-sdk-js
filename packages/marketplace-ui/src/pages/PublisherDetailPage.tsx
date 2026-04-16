import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { resolveMarketplaceText, useMarketplaceI18n } from "../i18n";
import { useMarketplace } from "../MarketplaceContext";
import { MarketplacePrimaryNav } from "../components/MarketplacePrimaryNav";
import type { CatalogXapp } from "../types";
import { buildTokenSearch } from "../utils/embedSearch";
import { shouldHideMarketplaceVersions } from "../utils/installationPolicy";
import { asRecord, readFirstString, readString } from "../utils/readers";
import "../marketplace.css";

function useQueryToken(): string {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  return qs.get("token") ?? "";
}

export function PublisherDetailPage() {
  const { publisherSlug = "" } = useParams();
  const { client, host, env } = useMarketplace();
  const { locale, t } = useMarketplaceI18n();
  const loc = useLocation();
  const token = useQueryToken();
  const tokenSearch = buildTokenSearch(token, loc.search);
  const isEmbedded = window.location.pathname.startsWith("/embed");

  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogXapp[]>([]);
  const [q, setQ] = useState("");

  const installationsByXappId = host.getInstallationsByXappId();
  const hideVersions = shouldHideMarketplaceVersions({
    installationPolicy: env?.installationPolicy ?? host.installationPolicy ?? null,
    installationPolicyResolved: env?.installationPolicyResolved,
    subjectId: host.subjectId,
  });

  async function refresh() {
    if (!publisherSlug) return;
    setBusy(true);
    setError(null);
    try {
      const catalogRes = await client.listCatalogXapps();
      const list = Array.isArray(catalogRes?.items) ? catalogRes.items : [];
      setItems(
        list.filter((x) => {
          const slug = String(x.publisher?.slug || "").trim();
          const status = String(x.status || "active").toLowerCase();
          return slug === String(publisherSlug) && status === "active";
        }),
      );
    } catch (e) {
      setError(readFirstString(asRecord(e).message) || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publisherSlug]);

  const publisherName = useMemo(() => {
    return String(items[0]?.publisher?.name || "").trim() || String(publisherSlug);
  }, [items, publisherSlug]);

  const backToPublishers = isEmbedded
    ? `/publishers${tokenSearch}`
    : `/marketplace/publishers${tokenSearch}`;
  const backToXapps = isEmbedded ? `/${tokenSearch}` : `/marketplace${tokenSearch}`;

  const filteredItems = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((x) => {
      const manifest = asRecord(x.manifest);
      const title =
        resolveMarketplaceText(manifest.title as any, locale) || readFirstString(x.name);
      const desc =
        resolveMarketplaceText(manifest.description as any, locale) ||
        readFirstString(x.description);
      const hay = `${title} ${desc} ${x.slug}`.toLowerCase();
      return hay.includes(query);
    });
  }, [items, locale, q]);

  return (
    <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
      <div className="mx-breadcrumb">
        <Link to={backToXapps}>{t("common.marketplace", undefined, "Marketplace")}</Link>
        <span className="mx-breadcrumb-sep">/</span>
        <Link to={backToPublishers}>
          {t("publisher.publishers_title", undefined, "Publishers")}
        </Link>
        <span className="mx-breadcrumb-sep">/</span>
        <span>{publisherName}</span>
      </div>

      <header className="mx-header">
        <h1 className="mx-title">{publisherName}</h1>
        <div className="mx-header-actions">
          <MarketplacePrimaryNav
            active="publishers"
            isEmbedded={isEmbedded}
            tokenSearch={tokenSearch}
          />
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
            <label className="mx-label">
              {t("publisher.search_xapps", undefined, "Search xapps")}
            </label>
            <input
              className="mx-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t(
                "publisher.search_xapps_placeholder",
                undefined,
                "Search by title, slug, description...",
              )}
              aria-label={t(
                "publisher.search_xapps_aria",
                undefined,
                "Search this publisher's xapps",
              )}
            />
          </div>
        </div>
      </div>

      {busy && items.length === 0 ? (
        <div className="mx-grid" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
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
                {filteredItems.length === items.length
                  ? `${filteredItems.length} xapp${filteredItems.length === 1 ? "" : "s"}`
                  : `${filteredItems.length} of ${items.length} xapp${items.length === 1 ? "" : "s"}`}
              </div>
            </div>
          )}
          <div className="mx-grid">
            {filteredItems.length === 0 && !busy ? (
              <div className="mx-empty-catalog">
                <div className="mx-empty-catalog-icon">⌕</div>
                <div className="mx-empty-catalog-title">
                  {t("publisher.no_xapps_found", undefined, "No xapps found")}
                </div>
                <div className="mx-empty-catalog-desc">
                  {q
                    ? t(
                        "publisher.empty_xapps_filtered",
                        undefined,
                        "Try adjusting your search to find what you're looking for.",
                      )
                    : t(
                        "publisher.empty_xapps_default",
                        { publisher: publisherName },
                        `${publisherName} has no active xapps in the catalog right now.`,
                      )}
                </div>
              </div>
            ) : (
              filteredItems.map((x) => {
                const manifest = asRecord(x.manifest);
                const title =
                  resolveMarketplaceText(manifest.title as any, locale) ||
                  readFirstString(x.name, x.slug, "App");
                const desc =
                  resolveMarketplaceText(manifest.description as any, locale) ||
                  readFirstString(x.description);
                const image =
                  readString(manifest.image) || "https://picsum.photos/seed/" + x.slug + "/560/320";
                const tags = Array.isArray(manifest.tags)
                  ? manifest.tags
                      .map((tag) => readString(tag))
                      .filter(Boolean)
                      .slice(0, 3)
                  : [];
                const inst = installationsByXappId[String(x.id)];
                const installed = Boolean(inst);
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
                          <div className="mx-card-publisher">
                            {t("common.by", undefined, "by")} {publisherName}
                          </div>
                          <div className="mx-card-badges">
                            {installed && (
                              <span className="mx-card-installed-badge">
                                <span className="mx-card-installed-badge-dot" />
                                {t("common.added", undefined, "Added")}
                              </span>
                            )}
                            {!hideVersions && x.latest_version?.version && (
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
                        {tags.map((t) => (
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
