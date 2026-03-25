import { Link } from "react-router-dom";

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
  const tabs: Array<{ key: ActivityTabKey; label: string }> = [
    { key: "requests", label: "Requests" },
    { key: "payments", label: "Payments" },
    { key: "invoices", label: "Invoices" },
    { key: "notifications", label: "Notifications" },
  ];

  return (
    <nav className="mx-activity-tabs" aria-label="Activity navigation">
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
