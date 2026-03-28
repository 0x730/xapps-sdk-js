import { Link } from "react-router-dom";
import { useMarketplaceI18n } from "../i18n";

type MarketplacePrimaryNavProps = {
  active: "xapps" | "publishers" | "activity";
  isEmbedded: boolean;
  tokenSearch: string;
};

export function MarketplacePrimaryNav(props: MarketplacePrimaryNavProps) {
  const { t } = useMarketplaceI18n();
  const xappsTo = props.isEmbedded ? `/${props.tokenSearch}` : `/marketplace${props.tokenSearch}`;
  const publishersTo = props.isEmbedded
    ? `/publishers${props.tokenSearch}`
    : `/marketplace/publishers${props.tokenSearch}`;
  const activityTo = props.isEmbedded
    ? `/requests${props.tokenSearch}`
    : `/marketplace/requests${props.tokenSearch}`;

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
