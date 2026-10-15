// Colour names mirror the mockup tokens (docs/design/README.md): bg-sf, text-mu,
// border-bd, bg-prs text-prt… — so an artboard's `var(--sf)` maps to `bg-sf`.
const token = name => `rgb(var(--${name}) / <alpha-value>)`;
const TOKENS = ["bg", "sf", "s2", "tx", "mu", "bd", "pr", "prh", "prs", "prt", "amb", "amt", "rdb", "rdt",
    "gnb", "gnt", "inb", "int", "dg", "dgh", "ok", "okh", "wr", "wrh"];

export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    darkMode: ["selector", '[data-theme="dark"]'],
    theme: {
        extend: {
            colors: {
                ...Object.fromEntries(TOKENS.map(name => [name, token(name)])),
                ov: "var(--ov)",
                // Only for the "Войти через Discord" button (ТЗ 3.2, ФТ-3.2.1).
                discord: {
                    DEFAULT: "#5865F2",
                    hover: "#4752C4",
                },
            },
            fontFamily: {
                sans: ["Onest", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
                mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
            },
            backdropBlur: {
                xs: "2px",
            },
        },
    },
    plugins: [],
};
