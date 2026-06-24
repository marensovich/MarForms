import {motion} from "framer-motion";

type SceneVariant = "default" | "danger" | "warning" | "success";

const SCENE_COLORS: Record<SceneVariant, { primary: string; secondary: string }> = {
    default: {primary: "rgba(99,102,241,0.14)", secondary: "rgba(139,92,246,0.10)"},
    danger: {primary: "rgba(239,68,68,0.13)", secondary: "rgba(248,113,113,0.08)"},
    warning: {primary: "rgba(251,146,60,0.12)", secondary: "rgba(239,68,68,0.08)"},
    success: {primary: "rgba(52,211,153,0.12)", secondary: "rgba(16,185,129,0.08)"},
};

export function SceneBackground({variant = "default"}: { variant?: SceneVariant }) {
    const {primary, secondary} = SCENE_COLORS[variant];
    const gridId = `grid-${variant}`;

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* Top arch gradient */}
            <div
                className="absolute inset-0"
                style={{background: `radial-gradient(ellipse 90% 45% at 50% -5%, ${primary}, transparent)`}}
            />
            {/* Left ambient orb */}
            <div
                className="absolute -left-32 top-1/3 h-[600px] w-[600px] rounded-full"
                style={{background: `radial-gradient(circle, ${primary}, transparent 65%)`}}
            />
            {/* Right ambient orb */}
            <div
                className="absolute -right-24 bottom-1/4 h-[450px] w-[450px] rounded-full"
                style={{background: `radial-gradient(circle, ${secondary}, transparent 65%)`}}
            />
            {/* Subtle grid */}
            <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id={gridId} width="48" height="48" patternUnits="userSpaceOnUse">
                        <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.35"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#${gridId})`} opacity="0.025"/>
            </svg>
            {/* Edge vignette */}
            <div
                className="absolute inset-0"
                style={{background: "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 35%, rgba(5,5,12,0.80))"}}
            />
            {/* Noise */}
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.025]"/>
        </div>
    );
}

/** Kept for backward-compat — used by DashboardPage */
export function BackgroundGlow() {
    return <SceneBackground variant="default"/>;
}

export default function LoadingScreen({label = "Loading..."}: { label?: string }) {
    return (
        <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#0f0f21]">
            <SceneBackground/>
            <div className="relative z-10 flex flex-col items-center gap-7">
                {/* Double-ring spinner */}
                <div className="relative h-12 w-12">
                    <motion.div
                        className="absolute inset-0 rounded-full border-2 border-white/[0.07] border-t-indigo-400"
                        animate={{rotate: 360}}
                        transition={{duration: 0.9, repeat: Infinity, ease: "linear"}}
                    />
                    <motion.div
                        className="absolute inset-2 rounded-full border border-indigo-500/20 border-b-purple-400/50"
                        animate={{rotate: -360}}
                        transition={{duration: 1.4, repeat: Infinity, ease: "linear"}}
                    />
                </div>
                <motion.p
                    className="text-sm font-medium tracking-wide text-white/35"
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    transition={{delay: 0.25}}
                >
                    {label}
                </motion.p>
            </div>
        </div>
    );
}
