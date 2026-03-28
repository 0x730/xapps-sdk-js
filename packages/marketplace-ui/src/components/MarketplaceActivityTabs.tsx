import { Link } from "react-router-dom";
import { useMarketplaceI18n } from "../i18n";

type ActivityTabKey = "requests" | "payments" | "invoices" | "notifications";

type MarketplaceActivityTabsProps = {
  active: ActivityTabKey;
  isEmbedded: boolean;
  token?: string;
  xappId?: string;
  installationId?: string;
};

function buildActivityHref(input: {
  surface: ActivityTabKey;
  isEmbedded: boolean;
  token?: string;
  xappId?: string;
  installationId?: string;
}) {
  const qs = new URLSearchParams();
  if (input.token) qs.set("token", input.token);
  if (input.xappId) qs.set("xappId", input.xappId);
  if (input.installationId && input.surface !== "requests") {
    qs.set("installationId", input.installationId);
  }
  const suffix = qs.toString();
  return {
    pathname: input.isEmbedded ? `/${input.surface}` : `/marketplace/${input.surface}`,
    search: suffix ? `?${suffix}` : "",
  };
}

export function MarketplaceActivityTabs(props: MarketplaceActivityTabsProps) {
  const { t } = useMarketplaceI18n();
  const tabs: Array<{ key: ActivityTabKey; label: string }> = [
    { key: "requests", label: t("activity.requests", undefined, "Requests") },
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
              isEmbedded: props.isEmbedded,
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
