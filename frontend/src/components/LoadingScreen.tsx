import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";

export default function LoadingScreen({label}: { label?: string }) {
    const {t} = useTranslation();
    const displayLabel = label ?? t("common.loading");
    return (
        <div className="relative flex h-screen w-full items-center justify-center bg-s2">
            <div className="relative z-10 flex flex-col items-center gap-5">
                <motion.div
                    className="h-8 w-8 rounded-full border-2 border-bd border-t-pr"
                    animate={{rotate: 360}}
                    transition={{duration: 0.8, repeat: Infinity, ease: "linear"}}
                />
                <motion.p
                    className="text-sm font-medium tracking-wide text-mu"
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
