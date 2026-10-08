import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {FiEye, FiX} from "react-icons/fi";
import FormRenderer from "../../form/FormRenderer";
import type {FormDefinition, FormField} from "../../../types/forms";

/**
 * Builder preview (task #45): the real public renderer — same components,
 * order, required markers and validation — with submission disabled.
 */
export default function FormPreviewModal({title, description, fields, onClose}: {
    title: string;
    description: string;
    fields: FormField[];
    onClose: () => void;
}) {
    const {t} = useTranslation();
    const form: FormDefinition = {
        id: "preview",
        serverId: 0,
        channelsIds: [],
        schema: {title: title || t("preview.untitled"), description, fields},
        webhooks: [],
        active: true,
        createdAt: new Date().toISOString(),
    };

    return (
        <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="fixed inset-0 z-[60] overflow-y-auto bg-[#F7F7F8]"
        >
            <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#EFDFC0] bg-[#FBF3E4] px-6 py-2 text-xs text-[#92702A]">
                <span className="flex items-center gap-2">
                    <FiEye size={13}/>
                    {t("preview.banner")}
                </span>
                <button
                    onClick={onClose}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium transition-colors hover:bg-[#EFDFC0]"
                >
                    <FiX size={13}/>
                    {t("preview.close")}
                </button>
            </div>
            {/* key: remount on every open so answers typed into a previous preview don't linger */}
            <FormRenderer key={fields.map(f => f.id).join()} form={form} preview/>
        </motion.div>
    );
}
