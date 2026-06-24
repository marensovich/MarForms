import {useEffect, useRef, useState} from "react";
import {fetchSystemInfo, type SystemInfo} from "../../api/system";

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
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
}

function AreaChart({
    data,
    color,
    gradientId,
}: {
    data: number[];
    color: string;
    gradientId: string;
}) {
    const W = 400;
    const H = 72;

    const filled = Array.from({length: MAX_HISTORY}, (_, i) => data[i] ?? 0);

    const points = filled.map((v, i) => {
        const x = (i / (MAX_HISTORY - 1)) * W;
        const y = H - Math.max(0, Math.min(100, v)) / 100 * H;
        return [x, y] as [number, number];
    });

    const linePath = points
        .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ");

    const areaPath =
        `M 0,${H} ` +
        points.map(([x, y]) => `L ${x.toFixed(1)},${y.toFixed(1)}`).join(" ") +
        ` L ${W},${H} Z`;

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-full"
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
                    <stop offset="100%" stopColor={color} stopOpacity="0"/>
                </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gradientId})`}/>
            <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
    );
}

function StatCard({
    title,
    value,
    label,
    pct,
    color,
    history,
    gradientId,
}: {
    title: string;
    value: string;
    label: string;
    pct: number;
    color: string;
    history: number[];
    gradientId: string;
}) {
    const clampedPct = Math.max(0, Math.min(100, pct));

    return (
        <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 gap-4">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/60">{title}</span>
                <span className="text-xs text-white/30">{label}</span>
            </div>

            <div className="h-16 w-full overflow-hidden">
                <AreaChart data={history} color={color} gradientId={gradientId}/>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold text-white">{value}</span>
                    <span className="text-sm font-medium" style={{color}}>{clampedPct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{width: `${clampedPct}%`, backgroundColor: color}}
                    />
                </div>
            </div>
        </div>
    );
}

function InfoRow({label, value}: {label: string; value: string}) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
            <span className="text-sm text-white/40">{label}</span>
            <span className="text-sm text-white font-mono">{value}</span>
        </div>
    );
}

export default function SystemTab() {
    const [info, setInfo] = useState<SystemInfo | null>(null);
    const [cpuHistory, setCpuHistory] = useState<number[]>([]);
    const [ramHistory, setRamHistory] = useState<number[]>([]);
    const [error, setError] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const tick = () => {
        fetchSystemInfo()
            .then(data => {
                setInfo(data);
                setError(false);
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

    const ramPct = info && info.ramTotal > 0
        ? (info.ramUsed / info.ramTotal) * 100
        : 0;

    const diskPct = info && info.diskTotal > 0
        ? (info.diskUsed / info.diskTotal) * 100
        : 0;

    return (
        <div className="max-w-4xl">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">System Overview</h1>
                    <p className="mt-0.5 text-sm text-white/40">
                        Real-time server metrics — updates every 3 seconds
                    </p>
                </div>
                {info && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/40 font-mono">
                        v{info.appVersion}
                    </span>
                )}
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    Failed to fetch system info. Check backend connection.
                </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
                <StatCard
                    title="CPU Usage"
                    value={info ? `${info.cpuUsage.toFixed(1)}%` : "—"}
                    label="processor"
                    pct={info?.cpuUsage ?? 0}
                    color="#818cf8"
                    history={cpuHistory}
                    gradientId="grad-cpu"
                />
                <StatCard
                    title="RAM Usage"
                    value={info ? `${formatBytes(info.ramUsed)} / ${formatBytes(info.ramTotal)}` : "—"}
                    label="memory"
                    pct={ramPct}
                    color="#34d399"
                    history={ramHistory}
                    gradientId="grad-ram"
                />
                <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 gap-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/60">Disk Usage</span>
                        <span className="text-xs text-white/30">storage</span>
                    </div>

                    <div className="flex-1 flex items-center justify-center">
                        <DiskRing pct={diskPct}/>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-end justify-between">
                            <span className="text-lg font-bold text-white">
                                {info ? formatBytes(info.diskUsed) : "—"}
                            </span>
                            <span className="text-sm font-medium text-amber-400">
                                {diskPct.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-white/30">
                            <span>{info ? formatBytes(info.diskUsed) : "—"}</span>
                            <span>/</span>
                            <span>{info ? formatBytes(info.diskTotal) : "—"}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                                className="h-full rounded-full transition-all duration-500 bg-amber-400"
                                style={{width: `${diskPct}%`}}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* System info + update */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="mb-3 text-sm font-semibold text-white/60 uppercase tracking-wider">
                        System Information
                    </h2>
                    {info ? (
                        <div>
                            <InfoRow label="Operating System" value={`${info.osName} ${info.osVersion}`}/>
                            <InfoRow label="JVM Version" value={info.jvmVersion}/>
                            <InfoRow label="App Uptime" value={formatUptime(info.uptimeSeconds)}/>
                            <InfoRow label="App Version" value={`v${info.appVersion}`}/>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 animate-pulse">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-9 rounded-lg bg-white/5"/>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                        Updates
                    </h2>
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl">
                            ✓
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-white">
                                {info ? `v${info.appVersion}` : "—"}
                            </p>
                            <p className="mt-0.5 text-xs text-white/30">
                                You are on the current version
                            </p>
                        </div>
                        <button
                            disabled
                            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white/30 cursor-not-allowed"
                            title="Auto-update coming soon"
                        >
                            Check for updates
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DiskRing({pct}: {pct: number}) {
    const r = 28;
    const circ = 2 * Math.PI * r;
    const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ;

    return (
        <svg width="72" height="72" viewBox="0 0 72 72">
            <circle
                cx="36" cy="36" r={r}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="6"
            />
            <circle
                cx="36" cy="36" r={r}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="6"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform="rotate(-90 36 36)"
                style={{transition: "stroke-dasharray 0.5s ease"}}
            />
            <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="600" fill="white">
                {pct.toFixed(0)}%
            </text>
        </svg>
    );
}
