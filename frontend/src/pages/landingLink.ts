const CODE = /^[A-Za-z0-9_-]+$/;

/**
 * The page to open for what a respondent pasted into «Открыть форму по ссылке»
 * (ТЗ ФТ-3.1.2): a full or schemeless `…/f/<slug>` link, an old `…/forms/<id>`
 * link, or a bare form code. Null when it is none of these.
 */
export function parseFormLink(input: string): string | null {
    const value = input.trim();
    if (!value) return null;
    if (CODE.test(value)) return `/f/${value}`;

    // "marforms.app/f/…" has no scheme; the URL parser needs one.
    let path: string;
    try {
        path = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`).pathname;
    } catch {
        return null;
    }
    const match = path.match(/^\/(f|forms)\/([^/]+)\/?$/);
    if (!match || !CODE.test(match[2])) return null;
    return `/${match[1]}/${match[2]}`;
}
