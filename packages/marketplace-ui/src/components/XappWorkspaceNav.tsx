import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMarketplaceI18n } from "../i18n";
import { buildMarketplaceHref } from "../utils/marketplaceRouting";
import "../marketplace.css";

type XappWorkspaceTab = "overview" | "open_app" | "requests" | "billing" | "notifications";
type XappWorkspaceBillingTab = "monetization" | "plans" | "payments" | "invoices";

type XappWorkspaceNavProps = {
  xappId: string;
  isEmbedded: boolean;
  token?: string;
  installationId?: string;
  xappTitle?: string;
  active: XappWorkspaceTab;
  billingActive?: XappWorkspaceBillingTab;
  openWidgetId?: string;
  openWidgetName?: string;
  openToolName?: string;
  openAppStrategy?: "direct_widget" | "choose_widget";
  onOpenApp?: (() => void) | undefined;
  openAppHrefOverride?: { pathname: string; search?: string } | undefined;
};

function buildOverviewHref(input: {
  pathname: string;
  xappId: string;
  token?: string;
  installationId?: string;
  focus?: string;
}) {
  return buildMarketplaceHref(input.pathname, `xapps/${encodeURIComponent(input.xappId)}`, {
    token: input.token,
    installationId: input.installationId,
    focus: input.focus,
  });
}

function buildRequestsHref(input: { pathname: string; xappId: string; token?: string }) {
  return buildMarketplaceHref(input.pathname, "requests", {
    token: input.token,
    xappId: input.xappId,
  });
}

function buildNotificationsHref(input: { pathname: string; xappId: string; token?: string }) {
  return buildMarketplaceHref(input.pathname, "notifications", {
    token: input.token,
    xappId: input.xappId,
  });
}

function buildMonetizationHref(input: {
  pathname: string;
  xappId: string;
  token?: string;
  installationId?: string;
}) {
  return buildMarketplaceHref(input.pathname, "monetization", {
    token: input.token,
    xappId: input.xappId,
    installationId: input.installationId,
  });
}

function buildPlansHref(input: {
  pathname: string;
  xappId: string;
  token?: string;
  installationId?: string;
}) {
  return buildMarketplaceHref(input.pathname, `xapps/${encodeURIComponent(input.xappId)}/plans`, {
    token: input.token,
    installationId: input.installationId,
  });
}

function buildBillingSurfaceHref(input: {
  pathname: string;
  surface: "payments" | "invoices";
  xappId: string;
  token?: string;
}) {
  return buildMarketplaceHref(input.pathname, input.surface, {
    token: input.token,
    xappId: input.xappId,
  });
}

function buildOpenAppHref(input: {
  pathname: string;
  xappId: string;
  isEmbedded: boolean;
  token?: string;
  installationId?: string;
  xappTitle?: string;
  openWidgetId?: string;
  openWidgetName?: string;
  openToolName?: string;
  openAppStrategy?: "direct_widget" | "choose_widget";
  openAppHrefOverride?: { pathname: string; search?: string } | undefined;
}) {
  if (input.openAppHrefOverride) {
    return {
      pathname: input.openAppHrefOverride.pathname,
      search: String(input.openAppHrefOverride.search || ""),
    };
  }
  const installationId = String(input.installationId || "").trim();
  const openWidgetId = String(input.openWidgetId || "").trim();
  if (input.openAppStrategy === "choose_widget") {
    return buildOverviewHref({ ...input, focus: "views" });
  }
  if (!installationId || !openWidgetId) {
    return buildOverviewHref({ ...input, focus: "views" });
  }
  if (input.isEmbedded) {
    return buildMarketplaceHref(
      input.pathname,
      `widget/${encodeURIComponent(installationId)}/${encodeURIComponent(openWidgetId)}`,
      {
        token: input.token,
      },
    );
  }
  return buildMarketplaceHref(
    input.pathname,
    `widget/${encodeURIComponent(installationId)}/${encodeURIComponent(openWidgetId)}`,
    {
      installationId,
      xappId: input.xappId,
      xappTitle: input.xappTitle,
      widgetName: input.openWidgetName,
      toolName: input.openToolName,
    },
  );
}

function buildHomeHref(input: { pathname: string; token?: string }) {
  return buildMarketplaceHref(input.pathname, "", {
    token: input.token,
  });
}

function WorkspaceLink(props: {
  to: { pathname: string; search: string };
  active: boolean;
  icon: ReactNode;
  tone?: "default" | "subtle" | "primary";
  children: ReactNode;
}) {
  return (
    <Link
      to={props.to as any}
      className={`mx-xapp-workspace-link ${
        props.tone === "subtle" ? "is-subtle" : props.tone === "primary" ? "is-primary" : ""
      } ${props.active ? "is-active" : ""}`}
      aria-current={props.active ? "page" : undefined}
    >
      <span className="mx-xapp-workspace-link-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span>{props.children}</span>
    </Link>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9.5 10 4l7 5.5V17a1 1 0 0 1-1 1h-4.5v-4.5h-3V18H4a1 1 0 0 1-1-1V9.5Z" />
    </svg>
  );
}

function IconOverview() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="5" height="5" rx="1.2" />
      <rect x="12" y="3" width="5" height="5" rx="1.2" />
      <rect x="3" y="12" width="5" height="5" rx="1.2" />
      <rect x="12" y="12" width="5" height="5" rx="1.2" />
    </svg>
  );
}

function IconOpenApp() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 13 15 5" />
      <path d="M9 5h6v6" />
      <rect x="4" y="7" width="9" height="9" rx="2" />
    </svg>
  );
}

function IconRequests() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 5h10" />
      <path d="M6 10h10" />
      <path d="M6 15h10" />
      <circle cx="3.5" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconMonetization() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 3v14" />
      <path d="M13.5 6.5c0-1.38-1.57-2.5-3.5-2.5S6.5 5.12 6.5 6.5 8.07 9 10 9s3.5 1.12 3.5 2.5S11.93 14 10 14s-3.5-1.12-3.5-2.5" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <circle cx="4" cy="10" r="1.7" />
      <circle cx="10" cy="10" r="1.7" />
      <circle cx="16" cy="10" r="1.7" />
    </svg>
  );
}

function IconPlans() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5.5h12" />
      <path d="M4 10h12" />
      <path d="M4 14.5h8" />
    </svg>
  );
}

function IconPayments() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="14" height="10" rx="2" />
      <path d="M3 8.5h14" />
      <path d="M7 12.2h2.8" />
    </svg>
  );
}

function IconInvoices() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3h6l3 3v11H6z" />
      <path d="M12 3v3h3" />
      <path d="M8 10h5" />
      <path d="M8 13h4" />
    </svg>
  );
}

function IconNotifications() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 4a3 3 0 0 1 3 3v1.4c0 .7.22 1.38.64 1.94l.86 1.16c.47.62.02 1.5-.76 1.5H6.26c-.78 0-1.23-.88-.76-1.5l.86-1.16A3.22 3.22 0 0 0 7 8.4V7a3 3 0 0 1 3-3Z" />
      <path d="M8.5 15a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

function WorkspaceButton(props: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  tone?: "default" | "subtle" | "primary";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`mx-xapp-workspace-link ${
        props.tone === "subtle" ? "is-subtle" : props.tone === "primary" ? "is-primary" : ""
      } ${props.active ? "is-active" : ""}`}
      aria-current={props.active ? "page" : undefined}
      onClick={props.onClick}
    >
      <span className="mx-xapp-workspace-link-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span>{props.children}</span>
    </button>
  );
}

function MoreMenuLink(props: {
  to: { pathname: string; search: string };
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      to={props.to as any}
      className={`mx-xapp-workspace-menu-item ${props.active ? "is-active" : ""}`}
      aria-current={props.active ? "page" : undefined}
    >
      <span className="mx-xapp-workspace-menu-item-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span>{props.children}</span>
    </Link>
  );
}

function MoreMenuGroup(props: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-xapp-workspace-menu-group">
      <div className="mx-xapp-workspace-menu-label">{props.label}</div>
      {props.children}
    </div>
  );
}

export function XappWorkspaceNav(props: XappWorkspaceNavProps) {
  const { t } = useMarketplaceI18n();
  const navigate = useNavigate();
  const loc = useLocation();
  const moreMenuRef = useRef<HTMLDetailsElement | null>(null);
  const overviewHref = buildOverviewHref({ ...props, pathname: loc.pathname });
  const openAppHref = buildOpenAppHref({ ...props, pathname: loc.pathname });
  const homeHref = buildHomeHref({ pathname: loc.pathname, token: props.token });
  const requestsHref = buildRequestsHref({ ...props, pathname: loc.pathname });
  const plansHref = buildPlansHref({ ...props, pathname: loc.pathname });
  const monetizationHref = buildMonetizationHref({ ...props, pathname: loc.pathname });
  const notificationsHref = buildNotificationsHref({ ...props, pathname: loc.pathname });
  const paymentsHref = buildBillingSurfaceHref({
    ...props,
    pathname: loc.pathname,
    surface: "payments",
  });
  const invoicesHref = buildBillingSurfaceHref({
    ...props,
    pathname: loc.pathname,
    surface: "invoices",
  });

  function handleOpenApp() {
    if (props.onOpenApp) {
      props.onOpenApp();
      return;
    }
    void navigate(openAppHref as any);
  }

  const monetizationActive = props.active === "billing" && props.billingActive === "monetization";
  const plansActive = props.active === "billing" && props.billingActive === "plans";
  const moreActive =
    monetizationActive ||
    plansActive ||
    props.billingActive === "payments" ||
    props.billingActive === "invoices" ||
    props.active === "notifications";

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const menuEl = moreMenuRef.current;
      if (!menuEl || !menuEl.open) return;
      const target = event.target;
      if (target instanceof Node && menuEl.contains(target)) return;
      menuEl.open = false;
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div className="mx-xapp-workspace-shell">
      <nav
        className="mx-xapp-workspace-nav"
        aria-label={t("xapp.workspace_navigation", undefined, "App workspace navigation")}
      >
        <WorkspaceLink to={homeHref} active={false} icon={<IconHome />} tone="subtle">
          {t("common.home", undefined, "Home")}
        </WorkspaceLink>
        <WorkspaceLink
          to={overviewHref}
          active={props.active === "overview"}
          icon={<IconOverview />}
        >
          {t("xapp.workspace_overview", undefined, "Overview")}
        </WorkspaceLink>
        <WorkspaceButton
          active={props.active === "open_app"}
          onClick={handleOpenApp}
          icon={<IconOpenApp />}
          tone="primary"
        >
          {t("xapp.workspace_open_app", undefined, "Open app")}
        </WorkspaceButton>
        <WorkspaceLink
          to={requestsHref}
          active={props.active === "requests"}
          icon={<IconRequests />}
        >
          {t("activity.requests_title", undefined, "Requests")}
        </WorkspaceLink>
        <details
          ref={moreMenuRef}
          className={`mx-xapp-workspace-menu ${moreActive ? "is-active" : ""}`}
        >
          <summary className="mx-xapp-workspace-link is-subtle">
            <span className="mx-xapp-workspace-link-icon" aria-hidden="true">
              <IconMore />
            </span>
            <span>{t("common.more", undefined, "More")}</span>
          </summary>
          <div className="mx-xapp-workspace-menu-panel">
            <MoreMenuGroup label={t("xapp.workspace_billing", undefined, "Billing")}>
              <MoreMenuLink
                to={monetizationHref}
                active={monetizationActive}
                icon={<IconMonetization />}
              >
                {t("activity.monetization_title", undefined, "Monetization")}
              </MoreMenuLink>
              <MoreMenuLink to={plansHref} active={plansActive} icon={<IconPlans />}>
                {t("widget.page.plan_options_tab", undefined, "Plans")}
              </MoreMenuLink>
              <MoreMenuLink
                to={paymentsHref}
                active={props.billingActive === "payments"}
                icon={<IconPayments />}
              >
                {t("activity.payments_title", undefined, "Payments")}
              </MoreMenuLink>
              <MoreMenuLink
                to={invoicesHref}
                active={props.billingActive === "invoices"}
                icon={<IconInvoices />}
              >
                {t("activity.invoices_title", undefined, "Invoices")}
              </MoreMenuLink>
            </MoreMenuGroup>
            <MoreMenuGroup label={t("common.activity", undefined, "Activity")}>
              <MoreMenuLink
                to={notificationsHref}
                active={props.active === "notifications"}
                icon={<IconNotifications />}
              >
                {t("activity.notifications_title", undefined, "Notifications")}
              </MoreMenuLink>
            </MoreMenuGroup>
          </div>
        </details>
      </nav>
    </div>
  );
}
