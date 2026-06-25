import {useEffect, useRef, useState} from "react";
import {fetchSystemInfo, type SystemInfo} from "../../api/system";
import {FiAlertTriangle, FiCheckCircle, FiCpu, FiHardDrive, FiRefreshCw, FiServer} from "react-icons/fi";
import {useTranslation} from "react-i18next";

const MAX_HISTORY = 40;

function formatBytes(bytes: number): string {
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
}

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
}

function AreaChart({data, color, gradientId}: { data: number[]; color: string; gradientId: string }) {
    const W = 400;
    const H = 72;
    const filled = Array.from({length: MAX_HISTORY}, (_, i) => data[i] ?? 0);
    const points = filled.map((v, i) => [
        (i / (MAX_HISTORY - 1)) * W,
        H - Math.max(0, Math.min(100, v)) / 100 * H,
    ] as [number, number]);

    const linePath = points
        .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ");
    const areaPath =
        `M 0,${H} ` +
        points.map(([x, y]) => `L ${x.toFixed(1)},${y.toFixed(1)}`).join(" ") +
        ` L ${W},${H} Z`;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
                    <stop offset="100%" stopColor={color} stopOpacity="0"/>
                </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gradientId})`}/>
            <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
    );
}

function MetricCard({
                        title,
                        label,
                        value,
                        pct,
                        color,
                        history,
                        gradientId,
                    }: {
    title: string;
    label: string;
    value: string;
    pct: number;
    color: string;
    history: number[];
    gradientId: string;
}) {
    const clamped = Math.max(0, Math.min(100, pct));
    const alertLevel = clamped > 85 ? "high" : clamped > 65 ? "med" : "ok";

    return (
        <div
            className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div
                className="absolute bottom-0 left-0 h-px w-full"
                style={{background: `linear-gradient(to right, ${color}60, transparent 70%)`}}
            />
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/75">{title}</span>
                <div className="flex items-center gap-2">
                    {alertLevel === "high" && (
                        <FiAlertTriangle size={13} className="text-red-400" title="High usage"/>
                    )}
                    <span
                        className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-xs text-white/55">
                        {label}
                    </span>
                </div>
            </div>

            <div className="h-16 w-full overflow-hidden rounded-lg">
                <AreaChart data={history} color={color} gradientId={gradientId}/>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold tabular-nums text-white">{value}</span>
                    <span className="text-sm font-semibold tabular-nums" style={{color}}>
                        {clamped.toFixed(1)}%
                    </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{width: `${clamped}%`, backgroundColor: color}}
                    />
                </div>
            </div>
        </div>
    );
}

function DiskRing({pct}: { pct: number }) {
    const r = 30;
    const circ = 2 * Math.PI * r;
    const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ;
    const color = pct > 85 ? "#f87171" : pct > 65 ? "#fb923c" : "#fbbf24";

    return (
        <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
            <circle
                cx="40" cy="40" r={r}
                fill="none"
                stroke={color}
                strokeWidth="7"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{transition: "stroke-dasharray 0.5s ease"}}
            />
            <text x="40" y="44" textAnchor="middle" fontSize="13" fontWeight="700" fill="white">
                {pct.toFixed(0)}%
            </text>
        </svg>
    );
}

function InfoRow({label, value, mono = true}: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between border-b border-white/[0.04] py-3 last:border-0">
            <span className="text-sm text-white/65">{label}</span>
            <span className={`text-sm text-white ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
        </div>
    );
}

function LiveUptime({baseSeconds, isRunning}: { baseSeconds: number; isRunning: boolean }) {
    const [extra, setExtra] = useState(0);

    useEffect(() => {
        if (!isRunning) return;
        setExtra(0);
        const id = setInterval(() => setExtra(p => p + 1), 1000);
        return () => clearInterval(id);
    }, [baseSeconds, isRunning]);

    return <span>{formatUptime(baseSeconds + extra)}</span>;
}

export default function SystemTab() {
    const {t} = useTranslation();
    const [info, setInfo] = useState<SystemInfo | null>(null);
    const [cpuHistory, setCpuHistory] = useState<number[]>([]);
    const [ramHistory, setRamHistory] = useState<number[]>([]);
    const [error, setError] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const tick = () => {
        fetchSystemInfo()
            .then(data => {
                setInfo(data);
                setError(false);
                setLastUpdated(new Date());
                setCpuHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), data.cpuUsage]);
                setRamHistory(prev => {
                    const pct = data.ramTotal > 0 ? (data.ramUsed / data.ramTotal) * 100 : 0;
                    return [...prev.slice(-(MAX_HISTORY - 1)), pct];
                });
            })
            .catch(() => setError(true));
    };

    useEffect(() => {
        tick();
        intervalRef.current = setInterval(tick, 3000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const ramPct = info && info.ramTotal > 0 ? (info.ramUsed / info.ramTotal) * 100 : 0;
    const diskPct = info && info.diskTotal > 0 ? (info.diskUsed / info.diskTotal) * 100 : 0;

    return (
        <div className="max-w-4xl">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">{t("system.title")}</h1>
                    <p className="mt-0.5 text-sm text-white/65">
                        {t("system.subtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="flex items-center gap-1.5 text-xs text-white/55">
                            <FiRefreshCw size={11} className="text-emerald-400"/>
                            {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    {info && (
                        <span
                            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-mono text-white/65">
                            v{info.appVersion}
                        </span>
                    )}
                </div>
            </div>

            {error && (
                <div
                    className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    <FiAlertTriangle size={15}/>
                    {t("system.failedFetch")}
                </div>
            )}

            {/* Metric cards */}
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard
                    title={t("system.cpu.title")}
                    label={t("system.cpu.label")}
                    value={info ? `${info.cpuUsage.toFixed(1)}%` : "—"}
                    pct={info?.cpuUsage ?? 0}
                    color="#818cf8"
                    history={cpuHistory}
                    gradientId="grad-cpu"
                />
                <MetricCard
                    title={t("system.ram.title")}
                    label={t("system.ram.label")}
                    value={info ? `${formatBytes(info.ramUsed)}` : "—"}
                    pct={ramPct}
                    color="#34d399"
                    history={ramHistory}
                    gradientId="grad-ram"
                />
                {/* Disk card */}
                <div
                    className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                    <div className="absolute bottom-0 left-0 h-px w-full"
                         style={{background: "linear-gradient(to right, #fbbf2460, transparent 70%)"}}
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/75">{t("system.disk.title")}</span>
                        <span
                            className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-xs text-white/55">
                            <FiHardDrive size={11}/>
                            {t("system.disk.label")}
                        </span>
                    </div>
                    <div className="flex items-center justify-center py-2">
                        <DiskRing pct={diskPct}/>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-end justify-between">
                            <span className="text-lg font-bold text-white">
                                {info ? formatBytes(info.diskUsed) : "—"}
                            </span>
                            <span className="text-sm font-medium text-amber-400">
                                {t("system.of")} {info ? formatBytes(info.diskTotal) : "—"}
                            </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                                style={{width: `${diskPct}%`}}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Info + updates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <FiServer size={14} className="text-white/65"/>
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/65">
                            {t("system.info.title")}
                        </h2>
                    </div>
                    {info ? (
                        <>
                            <InfoRow label={t("system.info.os")} value={`${info.osName} ${info.osVersion}`}/>
                            <InfoRow label={t("system.info.jvm")} value={info.jvmVersion}/>
                            <InfoRow label={t("system.info.appVersion")} value={`v${info.appVersion}`}/>
                            <div
                                className="flex items-center justify-between border-b border-white/[0.04] py-3 last:border-0">
                                <span className="text-sm text-white/65">{t("system.info.uptime")}</span>
                                <span className="font-mono text-sm text-white">
                                    <LiveUptime baseSeconds={info.uptimeSeconds} isRunning={!error}/>
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col gap-2 animate-pulse">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-10 rounded-lg bg-white/[0.03]"/>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <FiCpu size={14} className="text-white/65"/>
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/65">
                            {t("system.updates.title")}
                        </h2>
                    </div>
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
                        <div
                            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                            <FiCheckCircle size={24} className="text-emerald-400"/>
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-white">
                                {info ? `v${info.appVersion}` : "—"}
                            </p>
                            <p className="mt-1 text-xs text-white/55">
                                {t("system.updates.currentVersion")}
                            </p>
                        </div>
                        <button
                            disabled
                            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-2 text-sm font-medium text-white/25 cursor-not-allowed"
                            title="Auto-update coming soon"
                        >
                            {t("system.updates.checkUpdates")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
