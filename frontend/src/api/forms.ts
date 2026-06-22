// src/api/forms.ts
import {apiRequest} from "./client";
import type {FormAnswers, FormDefinition} from "../types/forms";

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
    answers: FormAnswers
): Promise<void> {
    return apiRequest<void>(`/forms/${formId}/submissions`, {
        method: "POST",
        body: {answers},
    });
}