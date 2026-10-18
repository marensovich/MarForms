import {type ReactNode, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiExternalLink, FiRefreshCw} from "react-icons/fi";
import {describeApiError} from "../../api/errors";
import {checkUpdates, fetchSystemInfo, fetchUpdates, type SystemInfo, type Updates} from "../../api/system";
import {AreaChart, Button, type ChartTone, cx, Gauge, Skeleton} from "../../ui";

// Docs: docs/design/mockups/AdminSystem.dc.html, AdminSystemError.dc.html; ТЗ 6.6, 7.3.

const POLL_MS = 3000;
/** Five minutes of 3-second readings, kept on the client. */
const HISTORY = 100;

interface Point {
    cpu: number;
    ram: number;
    disk: number;
}

/**
 * Платформа · Система (ТЗ 6.6, SYSTEM_ADMIN): «Обновляется каждые 3 секунды»;
 * CPU, RAM and disk with a ring, the details and five minutes of history;
 * «О системе», «Фоновые задачи» and «Обновления». When the backend stops
 * answering, a red banner says since when, the figures dim as stale, and it
 * keeps retrying, or «Повторить сейчас».
 */
export default function SystemTab() {
    const {t, i18n} = useTranslation();
    const [info, setInfo] = useState<SystemInfo | null>(null);
    const [history, setHistory] = useState<Point[]>([]);
    const [lastOk, setLastOk] = useState<number | null>(null);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [updates, setUpdates] = useState<Updates | null>(null);
    const [checking, setChecking] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);
    // «Повторить сейчас» restarts the loop at once.
    const [restart, setRestart] = useState(0);

    useEffect(() => {
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const tick = async () => {
            try {
                const next = await fetchSystemInfo();
                if (!alive) return;
                setInfo(next);
                setFailed(false);
                setLastOk(Date.now());
                setHistory(h => [...h, {
                    cpu: next.cpu.usage,
                    ram: pct(next.ram.used, next.ram.total),
                    disk: pct(next.disk.used, next.disk.total),
                }].slice(-HISTORY));
            } catch {
                if (alive) setFailed(true);
            }
            if (alive) timer = setTimeout(tick, POLL_MS);
        };
        timer = setTimeout(tick, 0);
        return () => {
            alive = false;
            clearTimeout(timer);
        };
    }, [restart]);

    useEffect(() => {
        const clock = setInterval(() => setNow(Date.now()), 1000);
        fetchUpdates().then(setUpdates).catch(() => undefined);
        return () => clearInterval(clock);
    }, []);

    const check = async () => {
        setChecking(true);
        setUpdateError(null);
        try {
            setUpdates(await checkUpdates());
        } catch (e) {
            setUpdateError(describeApiError(e, t("adminSystem.updates.failed")));
        } finally {
            setChecking(false);
        }
    };

    const gb = (bytes: number) => (bytes / 1024 ** 3).toLocaleString(i18n.language, {maximumFractionDigits: 1});
    const size = (bytes: number) => bytes >= 1024 ** 3 ? t("adminSystem.gb", {value: gb(bytes)})
        : t("adminSystem.mb", {value: (bytes / 1024 ** 2).toLocaleString(i18n.language, {maximumFractionDigits: 0})});
    const ago = lastOk ? Math.max(0, Math.round((now - lastOk) / 1000)) : null;
    const stale = failed && info !== null;

    const totalHooks = info ? info.webhooks.healthy + info.webhooks.degraded + info.webhooks.invalid : 0;
    const share = (v: number) => totalHooks ? Math.round(v / totalHooks * 100) : 0;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em]">{t("adminSystem.title")}</h1>
                    <p className="m-0 text-sm text-mu">{t("adminSystem.subtitle")}</p>
                </div>
                <span role="status" className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold",
                    failed ? "bg-rdb text-rdt" : "bg-gnb text-gnt")}>
                    <FiRefreshCw size={13} aria-hidden="true" className={cx(!failed && "motion-safe:animate-spin [animation-duration:1.2s]")}/>
                    {failed ? t("adminSystem.offline") : t("adminSystem.live")}
                </span>
            </div>

            {failed && (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[12px] border border-rdt/30 bg-rdb px-4 py-3 text-[13px] text-rdt">
                    <FiAlertTriangle size={16} aria-hidden="true" className="flex-none"/>
                    <span className="flex-1">
                        <b>{t("adminSystem.down")}</b>{" "}
                        {ago !== null ? t("adminSystem.lastAnswer", {count: ago}) : t("adminSystem.noAnswer")}{" "}
                        {stale && t("adminSystem.staleShown")} {t("adminSystem.retryIn", {count: POLL_MS / 1000})}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => setRestart(r => r + 1)}>{t("adminSystem.retryNow")}</Button>
                </div>
            )}

            <div className={cx("flex flex-col gap-5 transition", stale && "opacity-45 grayscale-[0.6]")} aria-busy={!info}>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
                    <Meter label="CPU" tone="pr" value={info?.cpu.usage} history={history.map(p => p.cpu)}
                           used={info && t("adminSystem.cores", {count: info.cpu.cores})}
                           sub={info && (info.cpu.loadAverage.length
                               ? t("adminSystem.load", {value: info.cpu.loadAverage.map(v => v.toLocaleString(i18n.language, {minimumFractionDigits: 2, maximumFractionDigits: 2})).join(" · ")})
                               : t("adminSystem.noLoad"))}/>
                    <Meter label="RAM" tone="wr" value={info ? pct(info.ram.used, info.ram.total) : undefined} history={history.map(p => p.ram)}
                           used={info && t("adminSystem.ofGb", {used: gb(info.ram.used), total: gb(info.ram.total)})}
                           sub={info && t("adminSystem.heap", {used: gb(info.ram.heapUsed), max: gb(info.ram.heapMax)})}/>
                    <Meter label={t("adminSystem.disk")} tone="ok" value={info ? pct(info.disk.used, info.disk.total) : undefined}
                           history={history.map(p => p.disk)}
                           used={info && t("adminSystem.ofGb", {used: gb(info.disk.used), total: gb(info.disk.total)})}
                           sub={info && [t("adminSystem.uploads", {value: size(info.disk.uploads)}),
                               info.disk.database !== null ? t("adminSystem.database", {value: size(info.disk.database)}) : null]
                               .filter(Boolean).join(" · ")}/>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
                    <Card title={t("adminSystem.about.title")}>
                        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13px]">
                            <Row term={t("adminSystem.about.os")} value={info?.about.os}/>
                            <Row term="JVM" value={info?.about.jvm}/>
                            <Row term={t("adminSystem.about.version")}
                                 value={info && <>marforms {info.about.version}{info.about.commit && <span className="font-mono text-mu"> ({info.about.commit})</span>}</>}/>
                            <Row term={t("adminSystem.about.uptime")} value={info && uptime(info.about.uptimeSeconds, t)}/>
                        </dl>
                    </Card>

                    <Card title={t("adminSystem.jobs.title")}>
                        <div className="grid grid-cols-3 gap-3">
                            <Stat label={t("adminSystem.jobs.queued")} value={info?.jobs.queued}/>
                            <Stat label={t("adminSystem.jobs.failed")} value={info?.jobs.failed} danger={!!info?.jobs.failed}/>
                            <Stat label={t("adminSystem.jobs.succeeded")} value={info?.jobs.succeeded24h}/>
                        </div>
                        <div className="flex flex-col gap-2 border-t border-bd pt-3">
                            <span className="text-xs font-semibold text-mu">{t("adminSystem.webhooks.title")}</span>
                            {info && totalHooks > 0 ? (
                                <>
                                    <div className="flex h-2 overflow-hidden rounded-full bg-s2" aria-hidden="true">
                                        <span className="bg-ok" style={{width: `${share(info.webhooks.healthy)}%`}}/>
                                        <span className="bg-wr" style={{width: `${share(info.webhooks.degraded)}%`}}/>
                                        <span className="bg-dg" style={{width: `${share(info.webhooks.invalid)}%`}}/>
                                    </div>
                                    <span className="text-[13px]">
                                        {t("adminSystem.webhooks.split", {
                                            healthy: share(info.webhooks.healthy), degraded: share(info.webhooks.degraded),
                                            invalid: share(info.webhooks.invalid), count: totalHooks,
                                        })}
                                    </span>
                                </>
                            ) : <span className="text-[13px] text-mu">{info ? t("adminSystem.webhooks.none") : "—"}</span>}
                        </div>
                    </Card>

                    <Card title={t("adminSystem.updates.title")}>
                        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13px]">
                            <Row term={t("adminSystem.updates.current")} value={updates?.current ?? info?.about.version}/>
                        </dl>
                        {updates?.available && updates.latest ? (
                            <p className="m-0 rounded-[10px] bg-prs px-3 py-2.5 text-[13px] text-prt">
                                <b>{t("adminSystem.updates.available", {version: updates.latest})}</b>
                                {updates.notes && <> {updates.notes}</>}
                                {updates.url && (
                                    <a href={updates.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 font-semibold underline">
                                        {t("adminSystem.updates.notes")}<FiExternalLink size={12} aria-hidden="true"/>
                                    </a>
                                )}
                            </p>
                        ) : updates && !updates.error ? (
                            <p className="m-0 text-[13px] text-gnt">{t("adminSystem.updates.upToDate")}</p>
                        ) : null}
                        {(updateError || updates?.error) && <p role="alert" className="m-0 text-[13px] text-rdt">{updateError ?? t("adminSystem.updates.failed")}</p>}
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-mu">
                                {updates ? t("adminSystem.updates.checked", {
                                    date: new Date(updates.checkedAt).toLocaleString(i18n.language, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}),
                                }) : "—"}
                            </span>
                            <Button size="sm" variant="secondary" loading={checking} onClick={check}>{t("adminSystem.updates.check")}</Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function pct(used: number, total: number) {
    return total > 0 ? Math.round(used / total * 1000) / 10 : 0;
}

function uptime(seconds: number, t: (k: string, o?: Record<string, unknown>) => string) {
    const d = Math.floor(seconds / 86400), h = Math.floor(seconds % 86400 / 3600), m = Math.floor(seconds % 3600 / 60);
    return t("adminSystem.uptime", {d, h, m});
}

/** A CPU / RAM / disk card: ring, used of total, details, five minutes of history. */
function Meter({label, tone, value, used, sub, history}: {
    label: string;
    tone: ChartTone;
    value?: number;
    used?: ReactNode;
    sub?: ReactNode;
    history: number[];
}) {
    const {t} = useTranslation();
    return (
        <section aria-label={label} className="flex flex-col gap-3 rounded-[14px] border border-bd bg-sf p-[18px]">
            <div className="flex items-center gap-4">
                {value === undefined ? <Skeleton className="h-[72px] w-[72px] rounded-full"/> : <Gauge value={value} label={label} tone={tone}/>}
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-bold">{label}</span>
                    <span className="text-[13px]">{used ?? "—"}</span>
                    <span className="text-xs text-mu">{sub ?? ""}</span>
                </div>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-[11px] text-mu">{t("adminSystem.lastFive")}</span>
                <AreaChart values={history} max={100} tone={tone} height={48} className="w-full"/>
            </div>
        </section>
    );
}

function Card({title, children}: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-3.5 rounded-[14px] border border-bd bg-sf p-[18px]">
            <h2 className="m-0 text-[15px] font-bold">{title}</h2>
            {children}
        </section>
    );
}

function Row({term, value}: { term: string; value?: ReactNode }) {
    return (
        <>
            <dt className="text-mu">{term}</dt>
            <dd className="m-0 min-w-0 break-words font-medium">{value ?? "—"}</dd>
        </>
    );
}

function Stat({label, value, danger}: { label: string; value?: number; danger?: boolean }) {
    const {i18n} = useTranslation();
    return (
        <div className="flex flex-col gap-0.5">
            <span className={cx("text-xl font-bold tabular-nums", danger && "text-rdt")}>{value === undefined ? "—" : value.toLocaleString(i18n.language)}</span>
            <span className="text-xs text-mu">{label}</span>
        </div>
    );
}
