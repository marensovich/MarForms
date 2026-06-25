import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {loginWithDiscord} from "../api/auth";
import {saveRedirectPath} from "../auth/redirectStorage";
import {SceneBackground} from "./LoadingScreen";
import {FiAlertTriangle, FiArchive, FiArrowRight, FiLock, FiLogIn, FiRefreshCw, FiSearch,} from "react-icons/fi";
import {BsDiscord} from "react-icons/bs";

interface Props {
    formId?: string;
}

type AccentColor = "indigo" | "amber" | "slate" | "blue" | "red";

const ACCENT: Record<AccentColor, { iconBg: string; iconText: string; iconBorder: string; glow: string }> = {
    indigo: {
        iconBg: "bg-indigo-500/15",
        iconText: "text-indigo-400",
        iconBorder: "border-indigo-500/25",
        glow: "bg-indigo-500/15",
    },
    amber: {
        iconBg: "bg-amber-500/15",
        iconText: "text-amber-400",
        iconBorder: "border-amber-500/25",
        glow: "bg-amber-500/12",
    },
    slate: {
        iconBg: "bg-white/[0.08]",
        iconText: "text-white/55",
        iconBorder: "border-white/[0.12]",
        glow: "bg-white/[0.05]",
    },
    blue: {
        iconBg: "bg-blue-500/15",
        iconText: "text-blue-400",
        iconBorder: "border-blue-500/25",
        glow: "bg-blue-500/12",
    },
    red: {
        iconBg: "bg-red-500/15",
        iconText: "text-red-400",
        iconBorder: "border-red-500/25",
        glow: "bg-red-500/12",
    },
};

function StateLayout({
                         icon,
                         accent,
                         title,
                         description,
                         children,
                         badge,
                         sceneVariant = "default",
                     }: {
    icon: React.ReactNode;
    accent: AccentColor;
    title: string;
    description: string;
    children?: React.ReactNode;
    badge?: string;
    sceneVariant?: "default" | "danger" | "warning";
}) {
    const {t} = useTranslation();
    const a = ACCENT[accent];

    return (
        <div
            className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0f0f21] px-4">
            <SceneBackground variant={sceneVariant}/>

            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.45, ease: "easeOut"}}
                className="relative z-10 w-full max-w-[420px]"
            >
                <div className="overflow-hidden rounded-2xl border border-white/[0.10] bg-[#141428] shadow-2xl">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"/>

                    <div className="px-8 py-9 text-center">
                        {/* Icon */}
                        <div className="mb-5 flex justify-center">
                            <div className="relative">
                                <div className={`absolute inset-0 scale-[2.2] rounded-full blur-2xl ${a.glow}`}/>
                                <div
                                    className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border ${a.iconBorder} ${a.iconBg}`}>
                                    <span className={a.iconText}>{icon}</span>
                                </div>
                            </div>
                        </div>

                        {/* Badge */}
                        {badge && (
                            <span
                                className="mb-4 inline-flex items-center rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/55">
                                {badge}
                            </span>
                        )}

                        <h1 className="text-[1.4rem] font-bold tracking-tight text-white">
                            {title}
                        </h1>
                        <p className="mt-2.5 text-sm leading-relaxed text-white/60">
                            {description}
                        </p>

                        {children && <div className="mt-6">{children}</div>}
                    </div>
                </div>

                <p className="mt-4 text-center text-xs text-white/30">
                    {t("accessStates.footer")}
                </p>
            </motion.div>
        </div>
    );
}

export function NotAuthenticatedState({formId}: Props) {
    const {t} = useTranslation();
    const handleLogin = () => {
        if (formId) saveRedirectPath(`/forms/${formId}`);
        loginWithDiscord();
    };

    return (
        <StateLayout
            icon={<FiLogIn size={28}/>}
            accent="indigo"
            title={t("accessStates.notAuthenticated.title")}
            description={t("accessStates.notAuthenticated.description")}
            badge={t("accessStates.notAuthenticated.badge")}
        >
            <div className="flex flex-col gap-3">
                <motion.button
                    onClick={handleLogin}
                    whileHover={{scale: 1.025}}
                    whileTap={{scale: 0.97}}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#5865F2] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#5865F2]/25 transition-colors hover:bg-[#4752C4] focus:outline-none focus:ring-2 focus:ring-[#5865F2]/50 focus:ring-offset-2 focus:ring-offset-[#0f0f21]"
                >
                    <BsDiscord size={18}/>
                    {t("accessStates.notAuthenticated.signIn")}
                </motion.button>
                <div className="flex items-center justify-center gap-2 text-xs text-white/40">
                    <FiArrowRight size={11}/>
                    <span>{t("accessStates.notAuthenticated.redirectNote")}</span>
                </div>
            </div>
        </StateLayout>
    );
}

export function NotInGuildState() {
    const {t} = useTranslation();
    return (
        <StateLayout
            icon={<FiLock size={28}/>}
            accent="amber"
            title={t("accessStates.notInGuild.title")}
            description={t("accessStates.notInGuild.description")}
            badge={t("accessStates.notInGuild.badge")}
        >
            <div
                className="rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-200/80">
                {t("accessStates.notInGuild.hint")}
            </div>
        </StateLayout>
    );
}

export function FormInactiveState() {
    const {t} = useTranslation();
    return (
        <StateLayout
            icon={<FiArchive size={28}/>}
            accent="slate"
            title={t("accessStates.formInactive.title")}
            description={t("accessStates.formInactive.description")}
            badge={t("accessStates.formInactive.badge")}
        >
            <div className="rounded-xl border border-white/[0.10] bg-white/[0.05] px-4 py-3 text-sm text-white/55">
                {t("accessStates.formInactive.hint")}
            </div>
        </StateLayout>
    );
}

export function FormNotFoundState() {
    const {t} = useTranslation();
    return (
        <StateLayout
            icon={<FiSearch size={28}/>}
            accent="blue"
            title={t("accessStates.formNotFound.title")}
            description={t("accessStates.formNotFound.description")}
            badge={t("accessStates.formNotFound.badge")}
        >
            <div className="rounded-xl border border-white/[0.10] bg-white/[0.05] px-4 py-3 text-sm text-white/55">
                {t("accessStates.formNotFound.hint")}
            </div>
        </StateLayout>
    );
}

export function FormErrorState() {
    const {t} = useTranslation();
    return (
        <StateLayout
            icon={<FiAlertTriangle size={28}/>}
            accent="red"
            title={t("accessStates.formError.title")}
            description={t("accessStates.formError.description")}
            badge={t("accessStates.formError.badge")}
            sceneVariant="warning"
        >
            <motion.button
                onClick={() => window.location.reload()}
                whileHover={{scale: 1.025}}
                whileTap={{scale: 0.97}}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-6 py-3 text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.09] hover:text-white"
            >
                <FiRefreshCw size={14}/>
                {t("accessStates.formError.tryAgain")}
            </motion.button>
        </StateLayout>
    );
}
