export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                // Kept only for the literal "Continue with Discord" button —
                // not used as the app's own brand accent (see `brand`).
                discord: {
                    DEFAULT: "#5865F2",
                    hover: "#4752C4",
                },
                brand: {
                    DEFAULT: "#3730A3",
                    soft: "#EEF0FB",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
            },
            backdropBlur: {
                xs: "2px",
            },
        },
    },
    plugins: [],
};