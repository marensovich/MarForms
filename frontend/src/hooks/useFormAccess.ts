import {useEffect, useState} from "react";
import {useAuth} from "./useAuth";
import {checkFormAccess, fetchForm} from "../api/forms";
import {ApiError} from "../api/client";
import type {FormDefinition} from "../types/forms";

export type FormAccessStatus =
    | "loading"
    | "not_authenticated"
    | "not_in_guild"
    | "form_inactive"
    | "not_found"
    | "error"
    | "granted";

export interface UseFormAccessResult {
    status: FormAccessStatus;
    form: FormDefinition | null;
}

export function useFormAccess(formId: string): UseFormAccessResult {
    const {user, loading: authLoading} = useAuth(); // добавляем loading
    const [status, setStatus] = useState<FormAccessStatus>("loading");
    const [form, setForm] = useState<FormDefinition | null>(null);

    useEffect(() => {
        // Ждём пока AuthProvider закончит инициализацию
        if (authLoading) {
            setStatus("loading");
            return;
        }

        if (!user) {
            setStatus("not_authenticated");
            return;
        }

        const controller = new AbortController();

        async function checkAccess() {
            setStatus("loading");

            try {
                const formData = await fetchForm(formId, controller.signal);

                if (!formData.active) {
                    setStatus("form_inactive");
                    return;
                }

                setForm(formData);

                const {hasAccess} = await checkFormAccess(formId, controller.signal);
                setStatus(hasAccess ? "granted" : "not_in_guild");
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }
                if (err instanceof ApiError) {
                    if (err.status === 404) {
                        setStatus("not_found");
                        return;
                    }
                    if (err.status === 403) {
                        setStatus("not_in_guild");
                        return;
                    }
                }
                setStatus("error");
            }
        }

        checkAccess();

        return () => controller.abort();
    }, [formId, user, authLoading]); // добавляем authLoading в deps

    return {status, form};
}