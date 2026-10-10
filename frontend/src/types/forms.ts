export type FieldType =
    | "TEXT"
    | "TEXTAREA"
    | "NUMBER"
    | "EMAIL"
    | "PASSWORD"
    | "URL"
    | "PHONE"
    | "SELECT"
    | "MULTI_SELECT"
    | "RADIO"
    | "CHECKBOX"
    | "BOOLEAN"
    | "DATE"
    | "TIME"
    | "DATETIME"
    | "RATING"
    | "SECTION_BREAK";

/** Not an input: a heading + text that splits a form into sections. */
export const isInputField = (field: { type: FieldType }) => field.type !== "SECTION_BREAK";

export type FormStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";

export type FormAccessMode = "OPEN" | "AUTHENTICATED" | "ROLE_GATED" | "ANONYMOUS";

export interface FormFieldOption {
    label: string;
    value: string;
}

export interface FormField {
    id: string;
    type: FieldType;
    label: string;
    required: boolean;
    options?: string[];
    max?: number;
    min?: number;
    placeholder?: string;
    description?: string;
    /** Show only when another field's answer matches (E3.1); absent = always. */
    condition?: FieldCondition | null;
}

export type ConditionOperator =
    | "EQUALS"
    | "NOT_EQUALS"
    | "CONTAINS"
    | "EMPTY"
    | "NOT_EMPTY"
    | "GREATER_THAN"
    | "LESS_THAN";

export interface FieldCondition {
    fieldId: string;
    operator: ConditionOperator;
    value?: string | null;
}

export interface FormSchema {
    title: string;
    description: string;
    fields: FormField[];
}

export interface FormDefinition {
    id: string;
    serverId: number;
    channelsIds: number[];
    schema: FormSchema;
    webhooks: WebhookConfig[];
    active: boolean;
    createdAt: string;
    status?: FormStatus;
    accessMode?: FormAccessMode;
    slug?: string | null;
    submissionLimitPerUser?: number | null;
    opensAt?: string | null;
    closesAt?: string | null;
    updatedAt?: string;
    createdByDiscordId?: string;
    createdByDiscordUsername?: string;
}

export type FormAnswers = Record<string, string | boolean | number | string[]>;

export interface WebhookConfig {
    url: string;
    // Message-level
    botName?: string;
    avatarUrl?: string;
    content?: string;
    // Embed: header
    color?: number;
    embedTitle?: string;
    embedDescription?: string;
    // Embed: author
    authorName?: string;
    authorIconUrl?: string;
    authorUrl?: string;
    // Embed: images
    thumbnailUrl?: string;
    imageUrl?: string;
    // Embed: fields display
    fieldsInline?: boolean;
    // System-managed delivery status (E2.4)
    invalid?: boolean | null;
    lastError?: string | null;
    health?: WebhookHealth | null;
    healthReason?: string | null;
    healthCheckedAt?: string | null;
}

/** Whether a webhook's notifications are getting through (E2.4). */
export type WebhookHealth = "HEALTHY" | "DEGRADED" | "INVALID";