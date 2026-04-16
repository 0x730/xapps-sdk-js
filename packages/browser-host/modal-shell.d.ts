export function buildModalShellTheme(input?: { themeTokens?: unknown }): {
  overlayBg: string;
  panelBg: string;
  panelBorder: string;
  panelRadius: string;
  panelShadow: string;
  headerBg: string;
  headerBorder: string;
  titleColor: string;
  subtitleColor: string;
  closeBg: string;
  closeBorder: string;
  closeText: string;
  bodyBg: string;
};

export function buildModalShellLayout(): {
  overlayPadding: string;
  overlayBlur: string;
  panelWidth: string;
  panelMaxWidth: string;
  panelMaxHeight: string;
  panelGap: string;
  headerGap: string;
  headerPadding: string;
  bodyPadding: string;
  bodyMaxHeight: string;
  titleFont: string;
  titleLetterSpacing: string;
  subtitleMarginTop: string;
  subtitleFont: string;
  closeButtonSize: string;
  closeButtonRadius: string;
  closeButtonFont: string;
  closeButtonLineHeight: string;
  closeButtonShadow: string;
};

export function createModalShell(options?: {
  title?: unknown;
  subtitle?: unknown;
  closeLabel?: unknown;
  themeTokens?: unknown;
  onClose?: (() => void) | null;
  panelWidth?: unknown;
  panelMaxWidth?: unknown;
  panelMaxHeight?: unknown;
  bodyPadding?: unknown;
  bodyMaxHeight?: unknown;
  zIndex?: unknown;
}): {
  overlay: HTMLElement;
  panel: HTMLElement;
  header: HTMLElement;
  titleWrap: HTMLElement;
  titleEl: HTMLElement;
  subtitleEl: HTMLElement;
  actions: HTMLElement;
  closeButton: HTMLButtonElement;
  body: HTMLElement;
  destroy: () => void;
};
