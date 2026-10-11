import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ApiError, apiRequest, BanError} from "./client";

// The API client reads the session token from localStorage, which Node lacks.
const store = new Map<string, string>();
beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
    });
});
afterEach(() => vi.unstubAllGlobals());

function respond(status: number, body: unknown = null) {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
        status === 204 || body === null ? null : JSON.stringify(body),
        {status, headers: {"Content-Type": "application/json"}},
    ));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("apiRequest", () => {
    it("sends the stored token and returns the JSON body", async () => {
        store.set("jwt", "tok");
        const fetchMock = respond(200, {ok: true});
        await expect(apiRequest("/me")).resolves.toEqual({ok: true});
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
    });

    it("turns a 401 into an ApiError the session logic can recognise", async () => {
        respond(401, {error: "nope"});
        await expect(apiRequest("/me")).rejects.toMatchObject({status: 401});
        await expect(apiRequest("/me")).rejects.toBeInstanceOf(ApiError);
    });

    it("turns a banned 403 into a BanError", async () => {
        respond(403, {banned: true, message: "Banned", contact: "admin"});
        await expect(apiRequest("/me")).rejects.toBeInstanceOf(BanError);
    });

    it("returns nothing for 204", async () => {
        respond(204);
        await expect(apiRequest("/auth/logout", {method: "POST"})).resolves.toBeUndefined();
    });

    it("sends cookies only when asked to", async () => {
        const fetchMock = respond(200, {token: "t"});
        await apiRequest("/auth/exchange", {method: "POST", body: {code: "c"}, credentials: "include"});
        expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
    });
});
