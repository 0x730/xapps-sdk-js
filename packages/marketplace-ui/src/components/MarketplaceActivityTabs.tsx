import { Link, useLocation } from "react-router-dom";
import { useMarketplaceI18n } from "../i18n";
import { buildMarketplaceHref } from "../utils/marketplaceRouting";

type ActivityTabKey = "requests" | "monetization" | "payments" | "invoices" | "notifications";

type MarketplaceActivityTabsProps = {
  active: ActivityTabKey;
  isEmbedded: boolean;
  token?: string;
  xappId?: string;
  installationId?: string;
};

function buildActivityHref(input: {
  surface: ActivityTabKey;
  pathname: string;
  token?: string;
  xappId?: string;
  installationId?: string;
}) {
  return buildMarketplaceHref(input.pathname, input.surface, {
    token: input.token,
    xappId: input.xappId,
    installationId: input.surface !== "requests" ? input.installationId : undefined,
  });
}

export function MarketplaceActivityTabs(props: MarketplaceActivityTabsProps) {
  const { t } = useMarketplaceI18n();
  const loc = useLocation();
  const tabs: Array<{ key: ActivityTabKey; label: string }> = [
    { key: "requests", label: t("activity.requests", undefined, "Requests") },
    { key: "monetization", label: t("activity.monetization", undefined, "Monetization") },
    { key: "payments", label: t("activity.payments", undefined, "Payments") },
    { key: "invoices", label: t("activity.invoices", undefined, "Invoices") },
    { key: "notifications", label: t("activity.notifications", undefined, "Notifications") },
  ];

  return (
    <nav
      className="mx-activity-tabs"
      aria-label={t("activity.navigation", undefined, "Activity navigation")}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={
            buildActivityHref({
              surface: tab.key,
              pathname: loc.pathname,
              token: props.token,
              xappId: props.xappId,
              installationId: props.installationId,
            }) as any
          }
          className={`mx-activity-tab ${props.active === tab.key ? "is-active" : ""}`}
          aria-current={props.active === tab.key ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
