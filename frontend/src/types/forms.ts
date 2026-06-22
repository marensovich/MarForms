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
  options?: string[]; // backend отдаёт string[], не {label,value}[]
  max?: number;
  min?: number;
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
}

export type FormAnswers = Record<string, string | boolean | number | string[]>;