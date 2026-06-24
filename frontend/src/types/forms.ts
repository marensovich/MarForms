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
    | "DATETIME";

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
    active: boolean;
    createdAt: string;
    createdByDiscordId?: string;
    createdByDiscordUsername?: string;
}

export type FormAnswers = Record<string, string | boolean | number | string[]>;

export interface WebhookConfig {
    url: string;
    botName?: string;
    avatarUrl?: string;
    content?: string;
    color?: number;
    embedTitle?: string;
    embedDescription?: string;
}