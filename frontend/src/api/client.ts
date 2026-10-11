/**
 * The backend's origin, set at build time (`VITE_API_URL`). Empty means the
 * same origin as the app — behind a reverse proxy that serves both (see
 * frontend/nginx.conf).
 */
export const API: string = import.meta.env.VITE_API_URL ?? "http://localhost:8090";

export class ApiError extends Error {
    public status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = "ApiError";
    }
}

export interface BannedError {
    banned: true;
    message: string;
    contact: string;
}

export class BanError extends Error {
    public data: BannedError;

    constructor(data: BannedError) {
        super(data.message);
        this.data = data;
        this.name = "BanError";
    }
}

interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    /** "include" to send cookies cross-origin (the sign-in code exchange). */
    credentials?: RequestCredentials;
}

export async function apiRequest<T>(
    path: string,
    options: RequestOptions = {}
): Promise<T> {
    const token = localStorage.getItem("jwt");

    const response = await fetch(`${API}/api/v1${path}`, {
        method: options.method ?? "GET",
        headers: {
            "Content-Type": "application/json",
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
            ...(options.headers ?? {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
        credentials: options.credentials,
    });

    if (response.status === 403) {
        const data = await response.json().catch(() => null);
        if (data?.banned) {
            throw new BanError(data);
        }
    }

    if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        throw new ApiError(response.status, message || "Request failed");
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

/**
 * Downloads a file from an authenticated endpoint. A plain link can't send
 * the JWT header, so the file is fetched and handed to the browser as a
 * blob, named from the response's Content-Disposition when present.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
    const token = localStorage.getItem("jwt");
    const response = await fetch(`${API}/api/v1${path}`, {
        headers: token ? {Authorization: `Bearer ${token}`} : {},
    });
    if (!response.ok) {
        throw new ApiError(response.status, await response.text().catch(() => "Download failed"));
    }
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
    const name = encoded ? decodeURIComponent(encoded) : plain ?? fallbackName;

    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
