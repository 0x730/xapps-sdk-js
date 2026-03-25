import { Route, Routes } from "react-router-dom";
import { CatalogPage } from "./pages/CatalogPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { RequestDetailPage } from "./pages/RequestDetailPage";
import { RequestsPage } from "./pages/RequestsPage";
import { XappDetailPage } from "./pages/XappDetailPage";
import { WidgetView } from "./pages/WidgetView";
import { PublishersPage } from "./pages/PublishersPage";
import { PublisherDetailPage } from "./pages/PublisherDetailPage";

export function MarketplaceApp() {
  return (
    <Routes>
      {/*
        IMPORTANT: These routes must be mountable under arbitrary bases (Portal: /marketplace,
        Embed: /embed/catalog). Therefore, we use relative paths (no leading "/").
      */}
      <Route path="" element={<CatalogPage />} />
      <Route path="publishers" element={<PublishersPage />} />
      <Route path="publishers/:publisherSlug" element={<PublisherDetailPage />} />
      <Route path="xapps/:xappId" element={<XappDetailPage />} />
      <Route path="requests" element={<RequestsPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="invoices" element={<InvoicesPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="requests/:id" element={<RequestDetailPage />} />
      <Route path="widget/:installationId/:widgetId" element={<WidgetView />} />
      <Route path="*" element={<CatalogPage />} />
    </Routes>
  );
}
