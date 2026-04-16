export type SubjectProfileGuardRefreshInput = {
  providerKey: string;
  source: string;
  toolName: string;
  payload: Record<string, unknown>;
};

export const subjectProfileGuardSurfaceStyles: string;

export function createSubjectProfileOverlay(options?: {
  locale?: string;
  title?: string;
  subtitle?: string;
  themeTokens?: unknown;
  onClose?: () => void;
}): {
  root: HTMLElement;
  overlay: HTMLElement;
  destroy: () => void;
};

export function renderSubjectProfileGuardSurface(
  root: Element,
  input: unknown,
  options?: {
    locale?: unknown;
    title?: unknown;
    subtitle?: unknown;
    notice?: unknown;
    error?: unknown;
    showHeader?: boolean;
    includeStyles?: boolean;
    interactive?: boolean;
    onResolve?: ((payload: Record<string, unknown>) => void) | null;
    onCancel?: (() => void) | null;
    onRefreshSource?:
      | ((input: SubjectProfileGuardRefreshInput) => Promise<unknown> | unknown)
      | null;
  },
): { destroy: () => void };
