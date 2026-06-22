export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                discord: {
                    DEFAULT: "#5865F2",
                    hover: "#4752C4",
                },
            },
            backdropBlur: {
                xs: "2px",
            },
        },
    },
    plugins: [],
};