// src/api/forms.ts
import {API, ApiError, apiRequest} from "./client";
import type {FormAccessMode, FormAnswers, FormDefinition, FormSchema, FormStatus} from "../types/forms";

export type ViewerAccess = "GRANTED" | "LOGIN_REQUIRED" | "NOT_IN_GUILD" | "BANNED"
    | "ROLE_REQUIRED" | "ROLE_DENIED" | "ROLES_UNAVAILABLE";

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
    idempotencyKey: string,
    anonymousToken?: string
): Promise<SubmissionReceipt> {
    return apiRequest<SubmissionReceipt>(`/public/forms/${encodeURIComponent(slug)}/submissions`, {
        method: "POST",
        body: {answers},
        headers: {
            "Idempotency-Key": idempotencyKey,
            ...(anonymousToken ? {"Anonymous-Token": anonymousToken} : {}),
        },
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

/** An uploaded file; its id is the FILE_UPLOAD field's answer (E3.2). */
export interface UploadedFile {
    id: string;
    fieldId: string;
    name: string;
    contentType: string | null;
    size: number;
}

/**
 * Uploads a file for a FILE_UPLOAD field while the form is being filled in.
 * XMLHttpRequest rather than fetch: fetch can't report upload progress.
 */
export function uploadFormFile(
    slug: string,
    fieldId: string,
    file: File,
    onProgress: (fraction: number) => void
): {promise: Promise<UploadedFile>; abort: () => void} {
    const xhr = new XMLHttpRequest();
    const promise = new Promise<UploadedFile>((resolve, reject) => {
        xhr.open("POST", `${API}/api/v1/public/forms/${encodeURIComponent(slug)}/files`);
        const token = localStorage.getItem("jwt");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = e => {
            if (e.lengthComputable) onProgress(e.loaded / e.total);
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText) as UploadedFile);
            } else {
                reject(new ApiError(xhr.status, xhr.responseText || "Upload failed"));
            }
        };
        xhr.onerror = () => reject(new ApiError(0, "Network error"));
        xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));
        const body = new FormData();
        body.append("fieldId", fieldId);
        body.append("file", file);
        xhr.send(body);
    });
    return {promise, abort: () => xhr.abort()};
}
