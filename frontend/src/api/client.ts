export const API = "http://localhost:8090";

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
}

export async function apiRequest<T>(
    path: string,
    options: RequestOptions = {}
): Promise<T> {
    const token = localStorage.getItem("jwt");
    console.log("apiRequest token:", token ? "present" : "missing", path);

    const response = await fetch(`${API}/api/v1${path}`, {
        method: options.method ?? "GET",
        headers: {
            "Content-Type": "application/json",
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
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
