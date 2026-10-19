import {apiRequest} from "./client";

// «Обратная связь» (2026-10-19): about MarForms itself, not a form of the forms system.

export type FeedbackType = "BUG" | "IDEA" | "PROBLEM" | "OTHER";

export interface FeedbackQuestion {
    id: string;
    kind: "line" | "text" | "choice";
    required: boolean;
    max: number;
    options?: string[];
}

/** Each kind's questions, as the server checks them (FeedbackService.QUESTIONS). */
export const FEEDBACK_QUESTIONS: Record<FeedbackType, FeedbackQuestion[]> = {
    BUG: [
        {id: "title", kind: "line", required: true, max: 120},
        {id: "steps", kind: "text", required: true, max: 2000},
        {id: "expected", kind: "text", required: false, max: 1000},
        {id: "actual", kind: "text", required: true, max: 1000},
        {id: "severity", kind: "choice", required: true, max: 40, options: ["BLOCKER", "ANNOYING", "MINOR"]},
        {id: "where", kind: "line", required: false, max: 300},
    ],
    IDEA: [
        {id: "title", kind: "line", required: true, max: 120},
        {id: "problem", kind: "text", required: true, max: 1500},
        {id: "proposal", kind: "text", required: true, max: 2000},
        {id: "audience", kind: "line", required: false, max: 500},
    ],
    PROBLEM: [
        {id: "title", kind: "line", required: true, max: 120},
        {id: "area", kind: "choice", required: true, max: 40, options: ["SECURITY", "DATA", "ABUSE", "USABILITY", "OTHER"]},
        {id: "description", kind: "text", required: true, max: 2000},
        {id: "impact", kind: "text", required: false, max: 1000},
        {id: "suggestion", kind: "text", required: false, max: 1000},
    ],
    OTHER: [
        {id: "subject", kind: "line", required: true, max: 120},
        {id: "message", kind: "text", required: true, max: 2000},
    ],
};

export function sendFeedback(type: FeedbackType, answers: Record<string, string>, page?: string): Promise<{ id: string; delivered: boolean }> {
    return apiRequest("/feedback", {method: "POST", body: {type, answers, page}});
}

/** The platform's feedback webhook (Настройки · Обратная связь). */
export function getFeedbackWebhook(): Promise<{ webhookUrl: string }> {
    return apiRequest("/settings/feedback");
}

export function setFeedbackWebhook(webhookUrl: string): Promise<{ webhookUrl: string }> {
    return apiRequest("/settings/feedback", {method: "PUT", body: {webhookUrl}});
}

export function testFeedbackWebhook(webhookUrl?: string): Promise<{ ok: boolean }> {
    return apiRequest("/settings/feedback/test", {method: "POST", body: webhookUrl ? {webhookUrl} : {}});
}
