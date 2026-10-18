import {API, apiRequest} from "./client";
import type {PageResponse} from "./dashboard";
import type {AuditAction, AuditLogEntry} from "../types/logs";

// The platform journal (ТЗ 6.5, #146).

export interface LogFilters {
    actions?: AuditAction[];
    /** A Discord ID: who acted or who was acted on. */
    participant?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
}

export interface LogStats {
    total: number;
    today: number;
    decisions: number;
    restrictions: number;
    rights: number;
}

export function getAuditLogs(f: LogFilters): Promise<PageResponse<AuditLogEntry>> {
    const p = new URLSearchParams({page: String(f.page ?? 0), size: String(f.size ?? 25)});
    f.actions?.forEach(a => p.append("actions", a));
    if (f.participant) p.set("participant", f.participant);
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    return apiRequest(`/admin/logs?${p}`);
}

export function getLogStats(): Promise<LogStats> {
    return apiRequest("/admin/logs/stats");
}

/**
 * «Live»: new entries as they are written. EventSource can't send the JWT
 * header, so the server-sent events are read from a fetch stream. Resolves
 * when the stream ends (the server closes it every 30 minutes) and rejects
 * when it can't open; the caller reconnects.
 *
 * @param onEntry called with each new entry
 * @param onOpen  called once the stream is open
 * @param signal  aborts the stream
 */
export async function streamAuditLogs(onEntry: (entry: AuditLogEntry) => void, onOpen: () => void,
                                      signal: AbortSignal): Promise<void> {
    const token = localStorage.getItem("jwt");
    const response = await fetch(`${API}/api/v1/admin/logs/stream`, {
        headers: {Accept: "text/event-stream", ...(token ? {Authorization: `Bearer ${token}`} : {})},
        signal,
    });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
    onOpen();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
        const {done, value} = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, {stream: true}).replace(/\r\n/g, "\n");
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            let event = "message";
            const data: string[] = [];
            for (const line of frame.split("\n")) {
                if (line.startsWith("event:")) event = line.slice(6).trim();
                else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
            }
            if (event === "entry" && data.length) {
                try {
                    onEntry(JSON.parse(data.join("\n")) as AuditLogEntry);
                } catch {
                    // A broken frame is skipped; the next one still comes.
                }
            }
        }
    }
}
