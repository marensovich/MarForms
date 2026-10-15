/** Joins class names, skipping falsy parts. */
export function cx(...parts: (string | false | null | undefined)[]): string {
    return parts.filter(Boolean).join(" ");
}

/** Colours for generated avatars and server icons — the sample palette of the mockups. */
export const AVATAR_COLORS = ["#0E7490", "#7C3AED", "#B45309", "#15803D", "#BE185D", "#2563EB", "#C2410C", "#475569"];

export function colorFor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name: string, letters = 1): string {
    const words = name.replace(/[#@].*$/, "").trim().split(/[\s_.-]+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (letters === 1) return words[0][0].toUpperCase();
    return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

/** A Discord role colour (integer, 0 = none) as CSS; no colour → secondary text. */
export function discordColor(color: number | null | undefined): string {
    return color ? `#${color.toString(16).padStart(6, "0")}` : "rgb(var(--mu))";
}
