import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {readPreference, resolveTheme, setThemePreference, THEME_STORAGE_KEY} from "./theme";

describe("resolveTheme", () => {
    it("follows the system while the preference is system", () => {
        expect(resolveTheme("system", true)).toBe("dark");
        expect(resolveTheme("system", false)).toBe("light");
    });

    it("a manual choice wins over the system", () => {
        expect(resolveTheme("light", true)).toBe("light");
        expect(resolveTheme("dark", false)).toBe("dark");
    });
});

describe("theme preference", () => {
    let store: Record<string, string>;

    beforeEach(() => {
        store = {};
        vi.stubGlobal("localStorage", {
            getItem: (k: string) => store[k] ?? null,
            setItem: (k: string, v: string) => { store[k] = v; },
            removeItem: (k: string) => { delete store[k]; },
        });
        vi.stubGlobal("document", {documentElement: {dataset: {} as Record<string, string>}});
        vi.stubGlobal("window", {matchMedia: () => ({matches: true})});
    });

    afterEach(() => vi.unstubAllGlobals());

    it("is system by default and ignores junk", () => {
        expect(readPreference()).toBe("system");
        store[THEME_STORAGE_KEY] = "sepia";
        expect(readPreference()).toBe("system");
    });

    it("stores a manual choice and applies it", () => {
        setThemePreference("light");
        expect(store[THEME_STORAGE_KEY]).toBe("light");
        expect(document.documentElement.dataset.theme).toBe("light");
    });

    it("system clears the stored choice and follows the OS", () => {
        setThemePreference("light");
        setThemePreference("system");
        expect(store[THEME_STORAGE_KEY]).toBeUndefined();
        expect(document.documentElement.dataset.theme).toBe("dark");
    });

    it("survives storage that throws (private mode)", () => {
        vi.stubGlobal("localStorage", {
            getItem: () => { throw new Error("denied"); },
            setItem: () => { throw new Error("denied"); },
            removeItem: () => { throw new Error("denied"); },
        });
        expect(readPreference()).toBe("system");
        expect(() => setThemePreference("dark")).not.toThrow();
    });
});
