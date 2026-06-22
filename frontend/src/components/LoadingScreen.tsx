import {motion} from "framer-motion";

interface LoadingScreenProps {
    label?: string;
}

export default function LoadingScreen({label = "Loading..."}: LoadingScreenProps) {
    return (
        <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a0f]">
            <BackgroundGlow/>
            <div className="relative z-10 flex flex-col items-center gap-5">
                <motion.div
                    className="h-12 w-12 rounded-full border-2 border-white/10 border-t-indigo-400"
                    animate={{rotate: 360}}
                    transition={{duration: 0.9, repeat: Infinity, ease: "linear"}}
                />
                <motion.p
                    className="text-sm font-medium tracking-wide text-white/60"
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    transition={{delay: 0.2}}
                >
                    {label}
                </motion.p>
            </div>
        </div>
    );
}

export function BackgroundGlow() {
    return (
        <div className="pointer-events-none absolute inset-0">
            <div
                className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/20 blur-[120px]"/>
            <div
                className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-purple-600/20 blur-[120px]"/>
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03]"/>
        </div>
    );
}