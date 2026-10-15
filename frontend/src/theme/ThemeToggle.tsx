import {useTranslation} from "react-i18next";
import {FiMonitor, FiMoon, FiSun} from "react-icons/fi";
import {type ThemePreference, useTheme} from "./theme";

const OPTIONS: { value: ThemePreference; icon: typeof FiSun }[] = [
    {value: "light", icon: FiSun},
    {value: "dark", icon: FiMoon},
    {value: "system", icon: FiMonitor},
];

/** Light / dark / system switch (ТЗ 8.3). Lives in the sidebar once the shell lands (#106). */
export default function ThemeToggle() {
    const {t} = useTranslation();
    const {preference, setPreference} = useTheme();
    return (
        <div role="radiogroup" aria-label={t("theme.label")}
             className="inline-flex items-center gap-0.5 rounded-[10px] border border-bd bg-sf p-0.5">
            {OPTIONS.map(({value, icon: Icon}) => (
                <button key={value} type="button" role="radio" aria-checked={preference === value}
                        aria-label={t(`theme.${value}`)} title={t(`theme.${value}`)}
                        onClick={() => setPreference(value)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-prs ${
                            preference === value ? "bg-prs text-prt" : "text-mu hover:bg-s2 hover:text-tx"}`}>
                    <Icon size={14} aria-hidden="true"/>
                </button>
            ))}
        </div>
    );
}
