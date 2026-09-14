import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";

type SceneVariant = "default" | "danger" | "warning" | "success";

/**
 * Kept as a component (with its old variant prop) so call sites don't need
 * to change, but the brand is flat — no ambient glow/vignette/noise.
 */
export function SceneBackground(_props: { variant?: SceneVariant }) {
    return null;
}

/** Kept for backward-compat — used by DashboardPage */
export function BackgroundGlow() {
    return null;
}

export default function LoadingScreen({label}: { label?: string }) {
    const {t} = useTranslation();
    const displayLabel = label ?? t("common.loading");
    return (
        <div className="relative flex h-screen w-full items-center justify-center bg-[#F7F7F8]">
            <div className="relative z-10 flex flex-col items-center gap-5">
                <motion.div
                    className="h-8 w-8 rounded-full border-2 border-[#E4E4E7] border-t-[#3730A3]"
                    animate={{rotate: 360}}
                    transition={{duration: 0.8, repeat: Infinity, ease: "linear"}}
                />
                <motion.p
                    className="text-sm font-medium tracking-wide text-[#8B8B96]"
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    transition={{delay: 0.25}}
                >
                    {displayLabel}
                </motion.p>
            </div>
        </div>
    );
}
