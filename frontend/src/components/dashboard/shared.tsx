export function TabSkeleton() {
    return (
        <div className="flex flex-col gap-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-white/5"/>
            ))}
        </div>
    );
}

export function EmptyState({message}: { message: string }) {
    return (
        <div
            className="flex h-48 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-white/30">
            {message}
        </div>
    );
}

export function TabHeader({
                              title,
                              count,
                              noun,
                              action,
                          }: {
    title: string;
    count: number;
    noun: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="mb-6 flex items-center justify-between">
            <div>
                <h1 className="text-xl font-semibold text-white">{title}</h1>
                <p className="mt-0.5 text-sm text-white/40">
                    {count} {noun}{count !== 1 ? "s" : ""}
                </p>
            </div>
            {action}
        </div>
    );
}

export function Badge({
                          children,
                          color = "default",
                      }: {
    children: React.ReactNode;
    color?: "default" | "green" | "red" | "orange" | "indigo";
}) {
    const colors = {
        default: "bg-white/10 text-white/50",
        green: "bg-emerald-500/20 text-emerald-400",
        red: "bg-red-500/20 text-red-400",
        orange: "bg-orange-500/20 text-orange-400",
        indigo: "bg-indigo-500/20 text-indigo-300",
    };

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[color]}`}
        >
      {children}
    </span>
    );
}