import { useEffect } from "react";
import { useMarketplaceI18n } from "../i18n";

export function ConfirmActionModal(props: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useMarketplaceI18n();
  const {
    open,
    title,
    description,
    confirmLabel = t("common.confirm", undefined, "Confirm"),
    cancelLabel = t("common.cancel", undefined, "Cancel"),
    onConfirm,
    onCancel,
  } = props;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="mx-detail-modal-backdrop" onClick={onCancel}>
      <div
        className="mx-sidebar-card mx-detail-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mx-confirm-action-title"
      >
        <div className="mx-detail-modal-head">
          <h2 id="mx-confirm-action-title" className="mx-section-title mx-section-title-tight">
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="mx-btn mx-btn-ghost"
            aria-label={t("common.close_dialog", undefined, "Close dialog")}
          >
            ×
          </button>
        </div>

        <div className="mx-detail-modal-body">
          {description ? (
            <div className="mx-detail-desc mx-detail-modal-copy">{description}</div>
          ) : null}
        </div>

        <div className="mx-detail-modal-actions">
          <button className="mx-btn mx-btn-outline" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="mx-btn mx-btn-outline" data-variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
