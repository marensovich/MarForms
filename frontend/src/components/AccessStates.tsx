import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {loginWithDiscord} from "../api/auth";
import {saveRedirectPath} from "../auth/redirectStorage";
import {FiAlertTriangle, FiArchive, FiArrowRight, FiLock, FiLogIn, FiRefreshCw, FiSearch,} from "react-icons/fi";
import {BsDiscord} from "react-icons/bs";

interface Props {
    formId?: string;
    /** Where to come back after login; defaults to the by-ID form link. */
    redirectPath?: string;
}

type AccentColor = "indigo" | "amber" | "slate" | "blue" | "red";

const ACCENT: Record<AccentColor, { iconBg: string; iconText: string; iconBorder: string }> = {
    indigo: {iconBg: "bg-[#EEF0FB]", iconText: "text-[#3730A3]", iconBorder: "border-[#E4E4E7]"},
    amber: {iconBg: "bg-[#FBF3E4]", iconText: "text-[#92702A]", iconBorder: "border-[#E4E4E7]"},
    slate: {iconBg: "bg-[#F0F0F2]", iconText: "text-[#6B6B76]", iconBorder: "border-[#E4E4E7]"},
    blue: {iconBg: "bg-[#EAF1FB]", iconText: "text-[#31578F]", iconBorder: "border-[#E4E4E7]"},
    red: {iconBg: "bg-[#F7EEEE]", iconText: "text-[#8B4A46]", iconBorder: "border-[#E4E4E7]"},
};

function StateLayout({
                         icon,
                         accent,
                         title,
                         description,
                         children,
                         badge,
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
            className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#F7F7F8] px-4">
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.45, ease: "easeOut"}}
                className="relative z-10 w-full max-w-[420px]"
            >
                <div className="overflow-hidden rounded-2xl border border-[#E4E4E7] bg-white">
                    <div className="px-8 py-9 text-center">
                        {/* Icon */}
                        <div className="mb-5 flex justify-center">
                            <div
                                className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${a.iconBorder} ${a.iconBg}`}>
                                <span className={a.iconText}>{icon}</span>
                            </div>
                        </div>

                        {/* Badge */}
                        {badge && (
                            <span
                                className="mb-4 inline-flex items-center rounded-full border border-[#E4E4E7] bg-[#F0F0F2] px-3 py-1 text-xs font-medium text-[#6B6B76]">
                                {badge}
                            </span>
                        )}

                        <h1 className="text-[1.4rem] font-bold tracking-tight text-[#1E1E24]">
                            {title}
                        </h1>
                        <p className="mt-2.5 text-sm leading-relaxed text-[#6B6B76]">
                            {description}
                        </p>

                        {children && <div className="mt-6">{children}</div>}
                    </div>
                </div>

                <p className="mt-4 text-center text-xs text-[#C7C7CE]">
                    {t("accessStates.footer")}
                </p>
            </motion.div>
        </div>
    );
}

export function NotAuthenticatedState({formId, redirectPath}: Props) {
    const {t} = useTranslation();
    const handleLogin = () => {
        if (redirectPath) saveRedirectPath(redirectPath);
        else if (formId) saveRedirectPath(`/forms/${formId}`);
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
                    whileHover={{scale: 1.015}}
                    whileTap={{scale: 0.985}}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#5865F2] px-6 py-3.5 font-semibold text-white transition-colors hover:bg-[#4752C4] focus:outline-none focus:ring-2 focus:ring-[#5865F2]/40 focus:ring-offset-2 focus:ring-offset-white"
                >
                    <BsDiscord size={18}/>
                    {t("accessStates.notAuthenticated.signIn")}
                </motion.button>
                <div className="flex items-center justify-center gap-2 text-xs text-[#8B8B96]">
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
                className="rounded-xl border border-[#EFDFC0] bg-[#FBF3E4] px-4 py-3 text-sm text-[#92702A]">
                {t("accessStates.notInGuild.hint")}
            </div>
        </StateLayout>
    );
}

export function FormInactiveState({reason}: { reason?: string | null }) {
    const {t} = useTranslation();
    return (
        <StateLayout
            icon={<FiArchive size={28}/>}
            accent="slate"
            title={t("accessStates.formInactive.title")}
            description={t("accessStates.formInactive.description")}
            badge={t("accessStates.formInactive.badge")}
        >
            <div className="rounded-xl border border-[#E4E4E7] bg-[#F7F7F8] px-4 py-3 text-sm text-[#6B6B76]">
                {reason ?? t("accessStates.formInactive.hint")}
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
            <div className="rounded-xl border border-[#E4E4E7] bg-[#F7F7F8] px-4 py-3 text-sm text-[#6B6B76]">
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
        >
            <motion.button
                onClick={() => window.location.reload()}
                whileHover={{scale: 1.015}}
                whileTap={{scale: 0.985}}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E4E4E7] bg-white px-6 py-3 text-sm font-medium text-[#55555F] transition-colors hover:bg-[#F0F0F2] hover:text-[#1E1E24]"
            >
                <FiRefreshCw size={14}/>
                {t("accessStates.formError.tryAgain")}
            </motion.button>
        </StateLayout>
    );
}
