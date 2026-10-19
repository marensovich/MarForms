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
    | "SECTION_BREAK"
    | "FILE_UPLOAD";

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
    /** FILE_UPLOAD: allowed extensions without the dot; empty = platform defaults. */
    allowedExtensions?: string[];
    /** FILE_UPLOAD: size limit in MB (platform max 25, default 10). */
    maxFileSizeMb?: number;
    /** FILE_UPLOAD: how many files, 1–10 (default 3). */
    maxFiles?: number;
    /** TEXT/TEXTAREA: answer length bounds; older forms keep them in min/max. */
    minLength?: number;
    maxLength?: number;
    /** MULTI_SELECT/CHECKBOX: how many may be chosen. */
    minSelected?: number;
    maxSelected?: number;
    /** DATE/TIME/DATETIME: the allowed range, inclusive, in the answer's format. */
    minDate?: string;
    maxDate?: string;
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
    /** How long a review usually takes, shown on the success page ("обычно 1–2 дня", #114). */
    reviewTime?: string | null;
    fields: FormField[];
}

export interface FormDefinition {
    id: string;
    /** Snowflakes arrive as strings: they don't fit a JS number. */
    serverId: string;
    channelsIds: string[];
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
    /** Optimistic-locking version; sent back on save. */
    version?: number;
    /** RoleGate (ROLE_GATED forms): one of these Discord roles is required, if any are set. */
    allowedRoleIds?: string[];
    /** RoleGate: any of these Discord roles refuses access; wins over the allow list. */
    deniedRoleIds?: string[];
    /** Edits not yet published (ТЗ ФТ-5.6.2); the editor shows these instead of `schema`. */
    draftSchema?: FormSchema | null;
    hasUnpublishedChanges?: boolean;
    /** Who saved last (Discord ID). */
    updatedBy?: string | null;
    createdByDiscordId?: string;
    createdByDiscordUsername?: string;
    /** Responses are reviewed on the site (2026-10-19); off: they only go to Discord. */
    reviewEnabled?: boolean;
    /** The text above the report in every channel, before each channel's own. */
    discordMessage?: string | null;
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
    /** SUBMISSION, DECISION; empty = both (ТЗ ФТ-5.5.1). */
    events?: string[] | null;
    /** The channel the bot made it in. */
    channelId?: string | null;
    channelName?: string | null;
    /** When a notification last got through. */
    lastDeliveredAt?: string | null;
}

/** Whether a webhook's notifications are getting through (E2.4). */
export type WebhookHealth = "HEALTHY" | "DEGRADED" | "INVALID";