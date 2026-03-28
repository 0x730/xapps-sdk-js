import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMarketplaceI18n } from "../i18n";
import { useMarketplace } from "../MarketplaceContext";
import { MarketplacePrimaryNav } from "../components/MarketplacePrimaryNav";
import { buildTokenSearch } from "../utils/embedSearch";
import { asRecord, readFirstString } from "../utils/readers";
import "../marketplace.css";

type PublisherItem = {
  slug: string;
  name: string;
  xappCount: number;
};

function useQueryToken(): string {
  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  return qs.get("token") ?? "";
}

const AVATAR_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#db2777",
  "#4f46e5",
  "#0d9488",
  "#ea580c",
];

function avatarColor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function PublishersPage() {
  const { client, env } = useMarketplace();
  const { t } = useMarketplaceI18n();
  const loc = useLocation();
  const token = useQueryToken();
  const tokenSearch = buildTokenSearch(token, loc.search);
  const isEmbedded = window.location.pathname.startsWith("/embed");
  const [q, setQ] = useState("");

  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PublisherItem[]>([]);

  async function loadPublishers() {
    const res = await client.listCatalogXapps();
    const list = Array.isArray(res?.items) ? res.items : [];
    const grouped = new Map<string, PublisherItem>();
    for (const x of list) {
      const status = String(x.status || "active").toLowerCase();
      if (status !== "active") continue;
      const slug = String(x.publisher?.slug || "").trim();
      if (!slug) continue;
      const current = grouped.get(slug);
      if (current) {
        current.xappCount += 1;
      } else {
        grouped.set(slug, {
          slug,
          name: String(x.publisher?.name || slug),
          xappCount: 1,
        });
      }
    }
    setItems(Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name)));
  }

  useEffect(() => {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await loadPublishers();
      } catch (e) {
        setError(readFirstString(asRecord(e).message) || String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, [client]);

  const filtered = useMemo(() => {
    let list = items;
    if (env?.publishers && env.publishers.length > 0) {
      const allowed = new Set(env.publishers.map((v) => String(v)));
      list = list.filter((i) => allowed.has(i.slug));
    }
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((i) => {
      const hay = `${i.name} ${i.slug}`.toLowerCase();
      return hay.includes(query);
    });
  }, [items, env?.publishers, q]);

  const totalXapps = useMemo(() => {
    return filtered.reduce((acc, p) => acc + p.xappCount, 0);
  }, [filtered]);

  const ordered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (b.xappCount !== a.xappCount) return b.xappCount - a.xappCount;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  return (
    <div className={`mx-catalog-container ${isEmbedded ? "is-embedded" : ""}`}>
      <header className="mx-header">
        <h1 className="mx-title">
          {env?.title ?? t("common.marketplace", undefined, "Marketplace")}
        </h1>
        <div className="mx-header-actions">
          <MarketplacePrimaryNav
            active="publishers"
            isEmbedded={isEmbedded}
            tokenSearch={tokenSearch}
          />
          <button
            className={`mx-btn-icon ${busy ? "is-spinning" : ""}`}
            onClick={() => {
              setBusy(true);
              void (async () => {
                try {
                  await loadPublishers();
                } catch (e) {
                  setError(readFirstString(asRecord(e).message) || String(e));
                } finally {
                  setBusy(false);
                }
              })();
            }}
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
              {t("publisher.search_publishers", undefined, "Search publishers")}
            </label>
            <input
              className="mx-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t(
                "publisher.search_publishers_placeholder",
                undefined,
                "Search by name or slug...",
              )}
              aria-label={t("publisher.search_publishers", undefined, "Search publishers")}
            />
          </div>
          <div className="mx-stats-grid">
            <div className="mx-stat-card">
              <div className="mx-stat-label">
                {t("publisher.publishers_count", undefined, "Publishers")}
              </div>
              <div className="mx-stat-value">{ordered.length}</div>
            </div>
            <div className="mx-stat-card">
              <div className="mx-stat-label">
                {t("publisher.catalog_xapps", undefined, "Catalog xApps")}
              </div>
              <div className="mx-stat-value">{totalXapps}</div>
            </div>
          </div>
        </div>
      </div>

      {busy && items.length === 0 ? (
        <div className="mx-grid" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mx-skeleton-card">
              <div className="mx-skeleton-card-content">
                <div className="mx-skeleton-publisher-row">
                  <div className="mx-skeleton-line mx-skeleton-avatar" />
                  <div className="mx-skeleton-publisher-info">
                    <div className="mx-skeleton-line mx-skeleton-line-sm" />
                    <div className="mx-skeleton-line mx-skeleton-line-title" />
                    <div className="mx-skeleton-line mx-skeleton-line-short" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {!busy && (
            <div className="mx-results-bar">
              <div className="mx-results-count">
                {t(
                  "publisher.results_count",
                  { count: ordered.length, suffix: ordered.length === 1 ? "" : "s" },
                  `${ordered.length} publisher${ordered.length === 1 ? "" : "s"}`,
                )}
              </div>
            </div>
          )}
          <div className="mx-grid">
            {ordered.length === 0 && !busy ? (
              <div className="mx-empty-catalog">
                <div className="mx-empty-catalog-icon">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="mx-empty-catalog-title">
                  {t("publisher.no_publishers_found", undefined, "No publishers found")}
                </div>
                <div className="mx-empty-catalog-desc">
                  {q
                    ? t(
                        "publisher.empty_filtered",
                        undefined,
                        "Try adjusting your search to find what you're looking for.",
                      )
                    : t(
                        "publisher.empty_default",
                        undefined,
                        "No publishers are available in the catalog right now.",
                      )}
                </div>
              </div>
            ) : (
              ordered.map((p) => {
                const detailTo = isEmbedded
                  ? `/publishers/${encodeURIComponent(p.slug)}${tokenSearch}`
                  : `/marketplace/publishers/${encodeURIComponent(p.slug)}${tokenSearch}`;
                return (
                  <div key={p.slug} className="mx-card">
                    <div className="mx-publisher-card-body">
                      <div
                        className="mx-publisher-avatar"
                        style={{ background: avatarColor(p.slug) }}
                      >
                        {(p.name || p.slug).charAt(0)}
                      </div>
                      <div className="mx-publisher-card-info">
                        <div className="mx-publisher-card-slug">{p.slug}</div>
                        <h3 className="mx-publisher-card-name">
                          <Link to={detailTo}>{p.name}</Link>
                        </h3>
                        <div className="mx-publisher-card-count">
                          {p.xappCount} xapp{p.xappCount === 1 ? "" : "s"} in catalog
                        </div>
                      </div>
                    </div>
                    <div className="mx-card-footer">
                      <Link
                        to={detailTo}
                        className="mx-btn mx-btn-ghost mx-btn-sm mx-card-footer-link"
                      >
                        {t("publisher.view_publisher", undefined, "View publisher")}
                      </Link>
                      <Link to={detailTo} className="mx-btn mx-btn-outline mx-btn-sm">
                        Browse xapps
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
