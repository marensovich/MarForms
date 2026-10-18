import {useEffect, useState} from "react";
import {apiRequest} from "../../api/client";

// ТЗ 5.2, #135.

const SLUG = /^[a-z0-9-]{3,64}$/;

type SlugCheck = { slug: string; problem: "FORMAT" | "TAKEN" | null };

/** Whether an address is free — checked as the owner types (ТЗ 5.2, #135). */
export function useSlugCheck(slug: string, formId: string | null, savedSlug: string) {
    const [check, setCheck] = useState<SlugCheck | null>(null);
    useEffect(() => {
        if (!slug || slug === savedSlug || !SLUG.test(slug)) return;
        const controller = new AbortController();
        const id = setTimeout(() => {
            apiRequest<{ available: boolean; reason: "FORMAT" | "TAKEN" | null }>(
                `/forms/slug-available?slug=${encodeURIComponent(slug)}${formId ? `&formId=${formId}` : ""}`,
                {signal: controller.signal})
                .then(r => setCheck({slug, problem: r.available ? null : r.reason}))
                .catch(() => undefined);
        }, 300);
        return () => {
            clearTimeout(id);
            controller.abort();
        };
    }, [slug, formId, savedSlug]);
    if (!slug || slug === savedSlug) return null;
    if (!SLUG.test(slug)) return "FORMAT";
    return check?.slug === slug ? check.problem : null;
}
