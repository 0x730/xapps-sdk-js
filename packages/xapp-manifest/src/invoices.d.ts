export type InvoiceDefinition = {
    name: string;
    provider_key?: string;
    providerKey?: string;
    effect_kind?: string;
    effectKind?: string;
    execution_mode?: string;
    executionMode?: string;
    provider_scope?: string;
    providerScope?: string;
    provider_execution?: string;
    providerExecution?: string;
    failure_policy?: string;
    failurePolicy?: string;
    idempotency_scope?: string;
    idempotencyScope?: string;
    invoice_template_ref?: string;
    invoiceTemplateRef?: string;
    invoice?: Record<string, unknown>;
    template?: Record<string, unknown>;
    [key: string]: unknown;
};
export type InvoiceTemplate = {
    name: string;
    title?: string;
    text?: string;
    html?: string;
    [key: string]: unknown;
};
export type InvoiceRefResolutionSource = "consumer_manifest" | "owner_manifest";
export type InvoiceTemplateResolutionSource = InvoiceRefResolutionSource | "owner_settings";
export type InvoiceRefResolution = {
    invoice_ref: string;
    definition_name: string;
    source: InvoiceRefResolutionSource;
    invoice_template_ref?: string | null;
    template_name?: string | null;
    template_source?: InvoiceTemplateResolutionSource | null;
};
export type ResolvedInvoiceConfigResult = {
    ok: true;
    config: Record<string, unknown>;
    resolution: InvoiceRefResolution;
} | {
    ok: false;
    reason: string;
    message: string;
    details: Record<string, unknown>;
};
export declare function buildInvoiceDefinitionRegistry(definitions: unknown): Map<string, InvoiceDefinition>;
export declare function buildInvoiceTemplateRegistry(templates: unknown): Map<string, InvoiceTemplate>;
export declare function readInvoiceRef(config: unknown): string;
export declare function readInvoiceTemplateRef(config: unknown): string;
export declare function resolveInvoiceConfigWithGovernance(input: {
    guardConfig: Record<string, unknown>;
    definition: InvoiceDefinition;
    source: InvoiceRefResolutionSource;
    templates?: Map<string, InvoiceTemplate>;
}): ResolvedInvoiceConfigResult;
//# sourceMappingURL=invoices.d.ts.map