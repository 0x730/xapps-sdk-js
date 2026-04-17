import { Link, useLocation } from "react-router-dom";
import { useMarketplaceI18n } from "../i18n";
import { buildMarketplaceHref } from "../utils/marketplaceRouting";

type MarketplacePrimaryNavProps = {
  active: "xapps" | "publishers" | "activity";
  isEmbedded: boolean;
  tokenSearch: string;
};

export function MarketplacePrimaryNav(props: MarketplacePrimaryNavProps) {
  const { t } = useMarketplaceI18n();
  const loc = useLocation();
  const token = props.tokenSearch.startsWith("?")
    ? new URLSearchParams(props.tokenSearch.slice(1)).get("token") || ""
    : "";
  const xappsTo = buildMarketplaceHref(loc.pathname, "", { token });
  const publishersTo = buildMarketplaceHref(loc.pathname, "publishers", { token });
  const activityTo = buildMarketplaceHref(loc.pathname, "requests", { token });

  return (
    <nav
      className="mx-nav-switch"
      aria-label={t("nav.marketplace", undefined, "Marketplace navigation")}
    >
      <Link
        to={xappsTo as any}
        className={`mx-nav-link ${props.active === "xapps" ? "is-active" : ""}`}
        aria-current={props.active === "xapps" ? "page" : undefined}
      >
        {t("nav.xapps", undefined, "Xapps")}
      </Link>
      <Link
        to={publishersTo as any}
        className={`mx-nav-link ${props.active === "publishers" ? "is-active" : ""}`}
        aria-current={props.active === "publishers" ? "page" : undefined}
      >
        {t("nav.publishers", undefined, "Publishers")}
      </Link>
      <Link
        to={activityTo as any}
        className={`mx-nav-link ${props.active === "activity" ? "is-active" : ""}`}
        aria-current={props.active === "activity" ? "page" : undefined}
      >
        {t("nav.activity", undefined, "Activity")}
      </Link>
    </nav>
  );
}
