// src/api/forms.ts
import {apiRequest} from "./client";
import type {FormAccessMode, FormAnswers, FormDefinition, FormSchema, FormStatus} from "../types/forms";

export type ViewerAccess = "GRANTED" | "LOGIN_REQUIRED" | "NOT_IN_GUILD" | "BANNED";

/** What a respondent may see of a form — never webhooks or channels. */
export interface PublicForm {
    id: string;
    slug: string;
    schema: FormSchema;
    status: FormStatus;
    active: boolean;
    accessMode: FormAccessMode;
    acceptingSubmissions: boolean;
    notAcceptingReason: string | null;
    opensAt: string | null;
    closesAt: string | null;
    submissionLimitPerUser: number | null;
    guildName: string | null;
    viewerAccess: ViewerAccess;
}

export interface SubmissionReceipt {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVISION";
    createdAt: string;
}

export function fetchPublicForm(slug: string, signal?: AbortSignal): Promise<PublicForm> {
    return apiRequest<PublicForm>(`/public/forms/${encodeURIComponent(slug)}`, {signal});
}

/** Old `/forms/{id}` links → the form's public slug (works without a session). */
export function resolveFormLink(formId: string, signal?: AbortSignal): Promise<{ slug: string }> {
    return apiRequest(`/public/form-links/${formId}`, {signal});
}

/**
 * Submits answers. Pass the same `idempotencyKey` when retrying after a
 * network error: the server then returns the original submission instead
 * of creating a duplicate (#51).
 */
export function submitPublicForm(
    slug: string,
    answers: FormAnswers,
    idempotencyKey: string
): Promise<SubmissionReceipt> {
    return apiRequest<SubmissionReceipt>(`/public/forms/${encodeURIComponent(slug)}/submissions`, {
        method: "POST",
        body: {answers},
        headers: {"Idempotency-Key": idempotencyKey},
    });
}

export function fetchForm(
    formId: string,
    signal?: AbortSignal
): Promise<FormDefinition> {
    return apiRequest<FormDefinition>(`/forms/${formId}`, {signal});
}

export function checkFormAccess(
    formId: string,
    signal?: AbortSignal
): Promise<{ hasAccess: boolean }> {
    return apiRequest<{ hasAccess: boolean }>(`/forms/${formId}/access`, {
        signal,
    });
}

export function submitForm(
    formId: string,
    answers: FormAnswers,
    idempotencyKey?: string
): Promise<void> {
    return apiRequest<void>(`/forms/${formId}/submissions`, {
        method: "POST",
        body: {answers},
        headers: idempotencyKey ? {"Idempotency-Key": idempotencyKey} : undefined,
    });
}
