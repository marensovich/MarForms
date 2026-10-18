import {useCallback, useEffect, useRef, useState} from "react";
import {ApiError} from "../../api/client";
import {getForm, updateForm, type UpdateFormPayload} from "../../api/dashboard";
import type {FormAccessMode, FormDefinition, FormField, WebhookConfig} from "../../types/forms";

// ТЗ 5.1 (autosave and its indicator), 5.7 (a form saved elsewhere).

/** What the editor changes; a published form's schema part lands in its draft (#134). */
export interface EditorState {
    title: string;
    description: string;
    reviewTime: string;
    slug: string;
    fields: FormField[];
    webhooks: WebhookConfig[];
    accessMode: FormAccessMode;
    submissionLimitPerUser: number | null;
    opensAt: string;
    closesAt: string;
    allowedRoleIds: string[];
    deniedRoleIds: string[];
}

export type SaveStatus =
    | { kind: "saved"; at: Date }
    | { kind: "saving" }
    | { kind: "unsaved"; error?: string }
    /** Someone else saved the form (ТЗ 5.7): autosave stops, the edits stay on screen. */
    | { kind: "conflict"; by: string | null; at: string | null };

const AUTOSAVE_MS = 1200;

/** Backend LocalDateTime → <input type="datetime-local"> value. */
const toInput = (v?: string | null) => (v ? v.slice(0, 16) : "");

export function stateOf(def: FormDefinition): EditorState {
    const schema = def.draftSchema ?? def.schema;
    return {
        title: schema.title,
        description: schema.description ?? "",
        reviewTime: schema.reviewTime ?? "",
        slug: def.slug ?? "",
        fields: schema.fields ?? [],
        webhooks: def.webhooks ?? [],
        accessMode: def.accessMode ?? "AUTHENTICATED",
        submissionLimitPerUser: def.submissionLimitPerUser ?? null,
        opensAt: toInput(def.opensAt),
        closesAt: toInput(def.closesAt),
        allowedRoleIds: def.allowedRoleIds ?? [],
        deniedRoleIds: def.deniedRoleIds ?? [],
    };
}

function payloadOf(state: EditorState, saved: EditorState, version: number | undefined): UpdateFormPayload {
    const access = (s: EditorState) => JSON.stringify([s.accessMode, s.submissionLimitPerUser, s.opensAt, s.closesAt,
        s.allowedRoleIds, s.deniedRoleIds]);
    return {
        version,
        schema: {title: state.title.trim(), description: state.description, reviewTime: state.reviewTime || null, fields: state.fields},
        webhooks: state.webhooks.filter(w => w.url.trim()),
        ...(state.slug && state.slug !== saved.slug ? {slug: state.slug} : {}),
        ...(access(state) !== access(saved) ? {
            settings: {
                accessMode: state.accessMode,
                submissionLimitPerUser: state.accessMode === "ANONYMOUS" ? null : state.submissionLimitPerUser,
                opensAt: state.opensAt || null,
                closesAt: state.closesAt || null,
                allowedRoleIds: state.accessMode === "ROLE_GATED" ? state.allowedRoleIds : [],
                deniedRoleIds: state.accessMode === "ROLE_GATED" ? state.deniedRoleIds : [],
            },
        } : {}),
    };
}

/**
 * The editor's form: loads it, keeps the edits, and saves them a moment
 * after the last change (one request: fields, notifications, access and the
 * address together). A save the server refuses as outdated stops autosave.
 */
export function useFormEditor(formId: string) {
    const [definition, setDefinition] = useState<FormDefinition | null>(null);
    const [state, setState] = useState<EditorState | null>(null);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [status, setStatus] = useState<SaveStatus>({kind: "saved", at: new Date()});
    const [saved, setSaved] = useState<EditorState | null>(null);
    const version = useRef<number | undefined>(undefined);
    const inFlight = useRef<Promise<unknown> | null>(null);

    const accept = useCallback((def: FormDefinition) => {
        setDefinition(def);
        version.current = def.version;
        setSaved(stateOf(def));
    }, []);

    useEffect(() => {
        let cancelled = false;
        getForm(formId)
            .then(def => {
                if (cancelled) return;
                accept(def);
                setState(stateOf(def));
            })
            .catch(e => !cancelled && setLoadError(e));
        return () => {
            cancelled = true;
        };
    }, [formId, accept]);

    const dirty = state !== null && saved !== null && JSON.stringify(state) !== JSON.stringify(saved);

    const save = useCallback(async (): Promise<boolean> => {
        if (!state || !saved) return false;
        if (JSON.stringify(state) === JSON.stringify(saved)) return true;
        if (!state.title.trim()) {
            setStatus({kind: "unsaved"});
            return false;
        }
        const sent = state;
        setStatus({kind: "saving"});
        const request = updateForm(formId, payloadOf(sent, saved, version.current));
        inFlight.current = request;
        try {
            const def = await request;
            // The server's answer is now what is saved; edits made while it was on the way stay.
            accept(def);
            setStatus({kind: "saved", at: new Date()});
            return true;
        } catch (e) {
            if (e instanceof ApiError && e.status === 409) {
                let body: { updatedBy?: string | null; updatedAt?: string | null } = {};
                try {
                    body = JSON.parse(e.message);
                } catch {
                    // a plain-text 409
                }
                if ("updatedBy" in body) {
                    setStatus({kind: "conflict", by: body.updatedBy ?? null, at: body.updatedAt ?? null});
                    return false;
                }
            }
            setStatus({kind: "unsaved", error: e instanceof Error ? e.message : String(e)});
            return false;
        } finally {
            inFlight.current = null;
        }
    }, [formId, state, saved, accept]);

    // Autosave a moment after the last change — not after a conflict.
    useEffect(() => {
        if (!dirty || status.kind === "conflict" || status.kind === "saving") return;
        const id = setTimeout(() => {
            void save();
        }, AUTOSAVE_MS);
        return () => clearTimeout(id);
    }, [dirty, state, status.kind, save]);

    const update = useCallback((patch: Partial<EditorState>) => {
        setState(s => (s ? {...s, ...patch} : s));
        setStatus(st => (st.kind === "conflict" ? st : {kind: "unsaved"}));
    }, []);

    /** Saves now (before publishing or leaving); false if it couldn't. */
    const flush = useCallback(async () => {
        if (inFlight.current) await inFlight.current.catch(() => undefined);
        return save();
    }, [save]);

    return {definition, state, loadError, status, dirty, update, flush, accept, setDefinition};
}
