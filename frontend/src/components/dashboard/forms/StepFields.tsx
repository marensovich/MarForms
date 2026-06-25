import {useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {
    FiAlignLeft,
    FiArrowLeft,
    FiCalendar,
    FiCheckSquare,
    FiChevronDown,
    FiCircle,
    FiClock,
    FiCopy,
    FiHash,
    FiLayers,
    FiLink,
    FiList,
    FiMail,
    FiPhone,
    FiPlus,
    FiToggleLeft,
    FiTrash2,
    FiType,
} from "react-icons/fi";
import type {FieldType, FormField} from "../../../types/forms";
import type {FormDraft} from "./FormWizard";

// ── Type metadata ──────────────────────────────────────────────────────────

type TypeGroup = "text" | "choice" | "datetime";

interface TypeMeta {
    icon: React.ElementType;
    labelKey: string;
    descKey: string;
    group: TypeGroup;
    iconCls: string;
}

const TYPE_META: Record<FieldType, TypeMeta> = {
    TEXT: {
        icon: FiType,
        labelKey: "wizard.fields.types.TEXT.label",
        descKey: "wizard.fields.types.TEXT.desc",
        group: "text",
        iconCls: "text-blue-300 bg-blue-500/10"
    },
    TEXTAREA: {
        icon: FiAlignLeft,
        labelKey: "wizard.fields.types.TEXTAREA.label",
        descKey: "wizard.fields.types.TEXTAREA.desc",
        group: "text",
        iconCls: "text-blue-300 bg-blue-500/10"
    },
    NUMBER: {
        icon: FiHash,
        labelKey: "wizard.fields.types.NUMBER.label",
        descKey: "wizard.fields.types.NUMBER.desc",
        group: "text",
        iconCls: "text-blue-300 bg-blue-500/10"
    },
    EMAIL: {
        icon: FiMail,
        labelKey: "wizard.fields.types.EMAIL.label",
        descKey: "wizard.fields.types.EMAIL.desc",
        group: "text",
        iconCls: "text-blue-300 bg-blue-500/10"
    },
    URL: {
        icon: FiLink,
        labelKey: "wizard.fields.types.URL.label",
        descKey: "wizard.fields.types.URL.desc",
        group: "text",
        iconCls: "text-blue-300 bg-blue-500/10"
    },
    PHONE: {
        icon: FiPhone,
        labelKey: "wizard.fields.types.PHONE.label",
        descKey: "wizard.fields.types.PHONE.desc",
        group: "text",
        iconCls: "text-blue-300 bg-blue-500/10"
    },
    SELECT: {
        icon: FiChevronDown,
        labelKey: "wizard.fields.types.SELECT.label",
        descKey: "wizard.fields.types.SELECT.desc",
        group: "choice",
        iconCls: "text-purple-300 bg-purple-500/10"
    },
    MULTI_SELECT: {
        icon: FiLayers,
        labelKey: "wizard.fields.types.MULTI_SELECT.label",
        descKey: "wizard.fields.types.MULTI_SELECT.desc",
        group: "choice",
        iconCls: "text-purple-300 bg-purple-500/10"
    },
    RADIO: {
        icon: FiCircle,
        labelKey: "wizard.fields.types.RADIO.label",
        descKey: "wizard.fields.types.RADIO.desc",
        group: "choice",
        iconCls: "text-purple-300 bg-purple-500/10"
    },
    CHECKBOX: {
        icon: FiCheckSquare,
        labelKey: "wizard.fields.types.CHECKBOX.label",
        descKey: "wizard.fields.types.CHECKBOX.desc",
        group: "choice",
        iconCls: "text-purple-300 bg-purple-500/10"
    },
    BOOLEAN: {
        icon: FiToggleLeft,
        labelKey: "wizard.fields.types.BOOLEAN.label",
        descKey: "wizard.fields.types.BOOLEAN.desc",
        group: "choice",
        iconCls: "text-purple-300 bg-purple-500/10"
    },
    DATE: {
        icon: FiCalendar,
        labelKey: "wizard.fields.types.DATE.label",
        descKey: "wizard.fields.types.DATE.desc",
        group: "datetime",
        iconCls: "text-emerald-300 bg-emerald-500/10"
    },
    TIME: {
        icon: FiClock,
        labelKey: "wizard.fields.types.TIME.label",
        descKey: "wizard.fields.types.TIME.desc",
        group: "datetime",
        iconCls: "text-emerald-300 bg-emerald-500/10"
    },
    DATETIME: {
        icon: FiCalendar,
        labelKey: "wizard.fields.types.DATETIME.label",
        descKey: "wizard.fields.types.DATETIME.desc",
        group: "datetime",
        iconCls: "text-emerald-300 bg-emerald-500/10"
    },
};

const TYPE_GROUPS: { id: TypeGroup; labelKey: string; types: FieldType[] }[] = [
    {id: "text", labelKey: "wizard.fields.groups.text", types: ["TEXT", "TEXTAREA", "NUMBER", "EMAIL", "URL", "PHONE"]},
    {id: "choice", labelKey: "wizard.fields.groups.choice", types: ["SELECT", "MULTI_SELECT", "RADIO", "CHECKBOX", "BOOLEAN"]},
    {id: "datetime", labelKey: "wizard.fields.groups.datetime", types: ["DATE", "TIME", "DATETIME"]},
];

// ── Helpers ────────────────────────────────────────────────────────────────

const HAS_OPTIONS: FieldType[] = ["SELECT", "MULTI_SELECT", "RADIO", "CHECKBOX"];
const HAS_PLACEHOLDER: FieldType[] = ["TEXT", "TEXTAREA", "NUMBER", "EMAIL", "URL", "PHONE"];
const HAS_MIN_MAX: FieldType[] = ["TEXT", "TEXTAREA", "NUMBER"];
const HAS_CHOICE_HINT: FieldType[] = ["SELECT", "MULTI_SELECT", "RADIO", "CHECKBOX"];

function makeField(type: FieldType): FormField {
    return {id: crypto.randomUUID(), type, label: "", required: false};
}

// ── Root component ─────────────────────────────────────────────────────────

interface Props {
    draft: FormDraft;
    onChange: (patch: Partial<FormDraft>) => void;
}

type LeftMode = "list" | "picker";

export default function StepFields({draft, onChange}: Props) {
    const [leftMode, setLeftMode] = useState<LeftMode>(draft.fields.length === 0 ? "picker" : "list");
    const [selectedId, setSelectedId] = useState<string | null>(draft.fields[0]?.id ?? null);

    const setFields = (fields: FormField[]) => onChange({fields});

    const addField = (type: FieldType) => {
        const f = makeField(type);
        const next = [...draft.fields, f];
        setFields(next);
        setSelectedId(f.id);
        setLeftMode("list");
    };

    const removeField = (id: string) => {
        const next = draft.fields.filter(f => f.id !== id);
        setFields(next);
        if (selectedId === id) setSelectedId(next[0]?.id ?? null);
    };

    const duplicateField = (id: string) => {
        const src = draft.fields.find(f => f.id === id);
        if (!src) return;
        const copy: FormField = {...src, id: crypto.randomUUID(), label: src.label ? `${src.label} (copy)` : ""};
        const idx = draft.fields.findIndex(f => f.id === id);
        const next = [...draft.fields];
        next.splice(idx + 1, 0, copy);
        setFields(next);
        setSelectedId(copy.id);
    };

    const updateField = (id: string, patch: Partial<FormField>) =>
        setFields(draft.fields.map(f => f.id === id ? {...f, ...patch} : f));

    const moveField = (idx: number, dir: -1 | 1) => {
        const next = [...draft.fields];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return;
        [next[idx], next[target]] = [next[target], next[idx]];
        setFields(next);
    };

    const selectedField = draft.fields.find(f => f.id === selectedId) ?? null;

    return (
        <div className="flex h-[540px]">
            {/* ── Left panel ─────────────────────────────────────────── */}
            <div className="flex w-72 flex-shrink-0 flex-col border-r border-white/[0.07]">
                <AnimatePresence mode="wait">
                    {leftMode === "picker" ? (
                        <TypePicker
                            key="picker"
                            showBack={draft.fields.length > 0}
                            onBack={() => setLeftMode("list")}
                            onSelect={addField}
                        />
                    ) : (
                        <FieldList
                            key="list"
                            fields={draft.fields}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onAdd={() => setLeftMode("picker")}
                            onRemove={removeField}
                            onDuplicate={duplicateField}
                            onMove={moveField}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* ── Right panel: editor ────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden bg-[#0d0d1a]">
                {selectedField ? (
                    <FieldEditor
                        key={selectedField.id}
                        field={selectedField}
                        onUpdate={patch => updateField(selectedField.id, patch)}
                        onDelete={() => removeField(selectedField.id)}
                        onDuplicate={() => duplicateField(selectedField.id)}
                    />
                ) : (
                    <EmptyEditor onAddClick={() => setLeftMode("picker")} hasFields={draft.fields.length > 0}/>
                )}
            </div>
        </div>
    );
}

// ── Type Picker ────────────────────────────────────────────────────────────

function TypePicker({
                        showBack,
                        onBack,
                        onSelect,
                    }: {
    showBack: boolean;
    onBack: () => void;
    onSelect: (fieldType: FieldType) => void;
}) {
    const {t} = useTranslation();
    return (
        <motion.div
            initial={{opacity: 0, x: -8}}
            animate={{opacity: 1, x: 0}}
            exit={{opacity: 0, x: -8}}
            transition={{duration: 0.15}}
            className="flex h-full flex-col"
        >
            <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/[0.07] px-4 py-3">
                {showBack && (
                    <button
                        onClick={onBack}
                        className="rounded-lg p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                        <FiArrowLeft size={13}/>
                    </button>
                )}
                <p className="text-xs font-medium text-white/70">{t("wizard.fields.picker.title")}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {TYPE_GROUPS.map(group => (
                    <div key={group.id}>
                        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                            {t(group.labelKey)}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                            {group.types.map(type => {
                                const meta = TYPE_META[type];
                                const Icon = meta.icon;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => onSelect(type)}
                                        className="flex flex-col gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all hover:border-indigo-500/40 hover:bg-indigo-500/[0.06]"
                                    >
                                        <div
                                            className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.iconCls}`}>
                                            <Icon size={14}/>
                                        </div>
                                        <p className="text-xs font-medium text-white leading-tight">{t(meta.labelKey)}</p>
                                        <p className="text-[10px] text-white/30 leading-snug">{t(meta.descKey)}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

// ── Field List ─────────────────────────────────────────────────────────────

function FieldList({
                       fields,
                       selectedId,
                       onSelect,
                       onAdd,
                       onRemove,
                       onDuplicate,
                       onMove,
                   }: {
    fields: FormField[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onAdd: () => void;
    onRemove: (id: string) => void;
    onDuplicate: (id: string) => void;
    onMove: (idx: number, dir: -1 | 1) => void;
}) {
    const {t} = useTranslation();
    return (
        <motion.div
            initial={{opacity: 0, x: 8}}
            animate={{opacity: 1, x: 0}}
            exit={{opacity: 0, x: 8}}
            transition={{duration: 0.15}}
            className="flex h-full flex-col"
        >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
                <p className="text-xs text-white/40">
                    {t("wizard.fields.list.fieldCount", {count: fields.length})}
                </p>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600/20 px-2.5 py-1 text-[11px] font-medium text-indigo-400 transition-colors hover:bg-indigo-600/30 hover:text-indigo-300"
                >
                    <FiPlus size={11}/>
                    {t("wizard.fields.list.addField")}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {fields.map((field, idx) => {
                    const meta = TYPE_META[field.type];
                    const Icon = meta.icon;
                    const selected = selectedId === field.id;
                    return (
                        <div
                            key={field.id}
                            onClick={() => onSelect(field.id)}
                            className={`group flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition-all ${
                                selected
                                    ? "border-indigo-500/35 bg-indigo-500/[0.09]"
                                    : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]"
                            }`}
                        >
                            {/* Move buttons */}
                            <div className="flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        onMove(idx, -1);
                                    }}
                                    disabled={idx === 0}
                                    className="text-[8px] leading-none text-white/25 hover:text-white disabled:opacity-20"
                                >▲
                                </button>
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        onMove(idx, 1);
                                    }}
                                    disabled={idx === fields.length - 1}
                                    className="text-[8px] leading-none text-white/25 hover:text-white disabled:opacity-20"
                                >▼
                                </button>
                            </div>

                            {/* Icon */}
                            <div
                                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${meta.iconCls}`}>
                                <Icon size={11}/>
                            </div>

                            {/* Label */}
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-xs font-medium text-white leading-tight">
                                    {field.label || <span className="italic text-white/25">{t("wizard.fields.list.untitled")}</span>}
                                </p>
                                <p className="text-[10px] text-white/30 leading-tight">{t(meta.labelKey)}</p>
                            </div>

                            {/* Required dot */}
                            {field.required && (
                                <span className="flex-shrink-0 text-[8px] text-red-400" title="Required">●</span>
                            )}

                            {/* Actions */}
                            <div
                                className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={e => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => onDuplicate(field.id)}
                                    title="Duplicate"
                                    className="rounded p-1 text-white/25 transition-colors hover:text-white/70"
                                >
                                    <FiCopy size={10}/>
                                </button>
                                <button
                                    onClick={() => onRemove(field.id)}
                                    title="Delete"
                                    className="rounded p-1 text-white/25 transition-colors hover:text-red-400"
                                >
                                    <FiTrash2 size={10}/>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}

// ── Empty editor state ─────────────────────────────────────────────────────

function EmptyEditor({onAddClick, hasFields}: { onAddClick: () => void; hasFields: boolean }) {
    const {t} = useTranslation();
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                <FiList size={22} className="text-white/15"/>
            </div>
            <div>
                <p className="text-sm font-medium text-white/35">
                    {hasFields ? t("wizard.fields.empty.selectField") : t("wizard.fields.empty.noFields")}
                </p>
                <p className="mt-1 text-xs text-white/20">
                    {hasFields
                        ? t("wizard.fields.empty.clickToEdit")
                        : t("wizard.fields.empty.addFirst")}
                </p>
            </div>
            {!hasFields && (
                <button
                    onClick={onAddClick}
                    className="mt-1 flex items-center gap-1.5 rounded-xl bg-indigo-600/20 px-4 py-2 text-sm text-indigo-400 transition-colors hover:bg-indigo-600/30 hover:text-indigo-300"
                >
                    <FiPlus size={13}/>
                    {t("wizard.fields.empty.addFirstBtn")}
                </button>
            )}
        </div>
    );
}

// ── Field Editor ───────────────────────────────────────────────────────────

interface FieldEditorProps {
    field: FormField;
    onUpdate: (patch: Partial<FormField>) => void;
    onDelete: () => void;
    onDuplicate: () => void;
}

function FieldEditor({field, onUpdate, onDelete, onDuplicate}: FieldEditorProps) {
    const {t} = useTranslation();
    const [typePickerOpen, setTypePickerOpen] = useState(false);

    const meta = TYPE_META[field.type];
    const Icon = meta.icon;
    const hasOptions = HAS_OPTIONS.includes(field.type);
    const hasPlaceholder = HAS_PLACEHOLDER.includes(field.type);
    const hasMinMax = HAS_MIN_MAX.includes(field.type);
    const isNumber = field.type === "NUMBER";
    const isBoolean = field.type === "BOOLEAN";
    const isDateTime = ["DATE", "TIME", "DATETIME"].includes(field.type);

    const inputCls =
        "w-full rounded-xl border border-white/[0.09] bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-indigo-500/60 focus:bg-white/[0.07]";

    const placeholderForType = () => {
        switch (field.type) {
            case "EMAIL": return t("wizard.fields.editor.placeholderEmail");
            case "URL": return t("wizard.fields.editor.placeholderUrl");
            case "PHONE": return t("wizard.fields.editor.placeholderPhone");
            case "NUMBER": return t("wizard.fields.editor.placeholderNumber");
            case "TEXTAREA": return t("wizard.fields.editor.placeholderTextarea");
            default: return t("wizard.fields.editor.placeholderDefault");
        }
    };

    const dateTimeInfo = () => {
        switch (field.type) {
            case "DATE": return t("wizard.fields.editor.dateInfo");
            case "TIME": return t("wizard.fields.editor.timeInfo");
            default: return t("wizard.fields.editor.datetimeInfo");
        }
    };

    return (
        <div className="flex h-full flex-col">
            {/* Editor header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-3">
                <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-md ${meta.iconCls}`}>
                        <Icon size={12}/>
                    </div>
                    <p className="text-xs font-medium text-white/60">{t(meta.labelKey)}</p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onDuplicate}
                        title="Duplicate field"
                        className="rounded-lg p-1.5 text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/60"
                    >
                        <FiCopy size={12}/>
                    </button>
                    <button
                        onClick={onDelete}
                        title="Delete field"
                        className="rounded-lg p-1.5 text-white/25 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                        <FiTrash2 size={12}/>
                    </button>
                </div>
            </div>

            {/* Editor body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">

                {/* ─ Section: Content ─────────────────────────────── */}
                <EditorSection label={t("wizard.fields.editor.sectionContent")}>
                    <EditorField
                        label={t("wizard.fields.editor.label")}
                        required
                        hint={t("wizard.fields.editor.labelHint")}
                    >
                        <input
                            type="text"
                            value={field.label}
                            onChange={e => onUpdate({label: e.target.value})}
                            placeholder={t("wizard.fields.editor.labelPlaceholder")}
                            className={inputCls}
                            autoFocus
                        />
                    </EditorField>

                    <EditorField
                        label={t("wizard.fields.editor.helperText")}
                        hint={t("wizard.fields.editor.helperTextHint")}
                    >
                        <input
                            type="text"
                            value={field.description ?? ""}
                            onChange={e => onUpdate({description: e.target.value || undefined})}
                            placeholder={t("wizard.fields.editor.helperTextPlaceholder")}
                            className={inputCls}
                        />
                    </EditorField>
                </EditorSection>

                {/* ─ Section: Type ────────────────────────────────── */}
                <EditorSection label={t("wizard.fields.editor.sectionType")}>
                    <div>
                        {/* Type toggle button */}
                        <button
                            onClick={() => setTypePickerOpen(v => !v)}
                            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.05] px-3 py-2.5 text-left transition-colors hover:border-white/[0.18]"
                        >
                            <div
                                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${meta.iconCls}`}>
                                <Icon size={14}/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white">{t(meta.labelKey)}</p>
                                <p className="text-[11px] text-white/30">{t(meta.descKey)}</p>
                            </div>
                            <FiChevronDown
                                size={13}
                                className={`flex-shrink-0 text-white/25 transition-transform duration-200 ${typePickerOpen ? "rotate-180" : ""}`}
                            />
                        </button>

                        {/* Inline type picker */}
                        <AnimatePresence>
                            {typePickerOpen && (
                                <motion.div
                                    initial={{opacity: 0, height: 0}}
                                    animate={{opacity: 1, height: "auto"}}
                                    exit={{opacity: 0, height: 0}}
                                    transition={{duration: 0.18}}
                                    className="overflow-hidden"
                                >
                                    <div
                                        className="mt-2 rounded-xl border border-white/[0.07] bg-[#090912] p-3 space-y-3">
                                        {TYPE_GROUPS.map(group => (
                                            <div key={group.id}>
                                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                                                    {t(group.labelKey)}
                                                </p>
                                                <div className="grid grid-cols-3 gap-1">
                                                    {group.types.map(type => {
                                                        const m = TYPE_META[type];
                                                        const TIcon = m.icon;
                                                        const active = field.type === type;
                                                        return (
                                                            <button
                                                                key={type}
                                                                onClick={() => {
                                                                    onUpdate({
                                                                        type,
                                                                        options: HAS_OPTIONS.includes(type) ? (field.options ?? []) : undefined,
                                                                        placeholder: HAS_PLACEHOLDER.includes(type) ? field.placeholder : undefined,
                                                                        min: HAS_MIN_MAX.includes(type) ? field.min : undefined,
                                                                        max: HAS_MIN_MAX.includes(type) ? field.max : undefined,
                                                                    });
                                                                    setTypePickerOpen(false);
                                                                }}
                                                                className={`flex flex-col gap-1 rounded-lg border p-2 text-left transition-all ${
                                                                    active
                                                                        ? "border-indigo-500/50 bg-indigo-500/10"
                                                                        : "border-white/[0.05] hover:border-white/[0.18] hover:bg-white/[0.04]"
                                                                }`}
                                                            >
                                                                <div
                                                                    className={`flex h-5 w-5 items-center justify-center rounded-md ${m.iconCls}`}>
                                                                    <TIcon size={10}/>
                                                                </div>
                                                                <p className="text-[10px] font-medium text-white leading-tight">{t(m.labelKey)}</p>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </EditorSection>

                {/* ─ Section: Parameters (type-specific) ──────────── */}
                {(hasPlaceholder || hasMinMax || hasOptions || isBoolean || isDateTime) && (
                    <EditorSection label={t("wizard.fields.editor.sectionParameters")}>

                        {/* Placeholder */}
                        {hasPlaceholder && (
                            <EditorField
                                label={t("wizard.fields.editor.placeholder")}
                                hint={t("wizard.fields.editor.placeholderHint")}
                            >
                                <input
                                    type="text"
                                    value={field.placeholder ?? ""}
                                    onChange={e => onUpdate({placeholder: e.target.value || undefined})}
                                    placeholder={placeholderForType()}
                                    className={inputCls}
                                />
                            </EditorField>
                        )}

                        {/* Min / Max */}
                        {hasMinMax && (
                            <div className="grid grid-cols-2 gap-3">
                                <EditorField
                                    label={isNumber ? t("wizard.fields.editor.minValue") : t("wizard.fields.editor.minLength")}
                                    hint={isNumber ? t("wizard.fields.editor.minValueHint") : t("wizard.fields.editor.minLengthHint")}
                                >
                                    <input
                                        type="number"
                                        value={field.min ?? ""}
                                        onChange={e => onUpdate({min: e.target.value ? Number(e.target.value) : undefined})}
                                        placeholder="—"
                                        className={inputCls}
                                    />
                                </EditorField>
                                <EditorField
                                    label={isNumber ? t("wizard.fields.editor.maxValue") : t("wizard.fields.editor.maxLength")}
                                    hint={isNumber ? t("wizard.fields.editor.maxValueHint") : t("wizard.fields.editor.maxLengthHint")}
                                >
                                    <input
                                        type="number"
                                        value={field.max ?? ""}
                                        onChange={e => onUpdate({max: e.target.value ? Number(e.target.value) : undefined})}
                                        placeholder="—"
                                        className={inputCls}
                                    />
                                </EditorField>
                            </div>
                        )}

                        {/* Options for choice fields */}
                        {hasOptions && (
                            <OptionsEditor
                                options={field.options ?? []}
                                onChange={opts => onUpdate({options: opts})}
                                fieldType={field.type}
                            />
                        )}

                        {/* Boolean info */}
                        {isBoolean && (
                            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                                <p className="text-xs text-white/40 leading-relaxed">
                                    {t("wizard.fields.editor.booleanInfo")}
                                </p>
                            </div>
                        )}

                        {/* Date/Time info */}
                        {isDateTime && (
                            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                                <p className="text-xs text-white/40 leading-relaxed">
                                    {dateTimeInfo()}
                                </p>
                            </div>
                        )}
                    </EditorSection>
                )}

                {/* ─ Section: Validation ──────────────────────────── */}
                <EditorSection label={t("wizard.fields.editor.sectionValidation")}>
                    <label
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]">
                        <div className="mt-0.5 flex-shrink-0">
                            <div
                                onClick={() => onUpdate({required: !field.required})}
                                className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                                    field.required
                                        ? "border-indigo-500 bg-indigo-600"
                                        : "border-white/20 bg-transparent"
                                }`}
                            >
                                {field.required && <span className="text-[9px] font-bold text-white">✓</span>}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">{t("wizard.fields.editor.requiredField")}</p>
                            <p className="mt-0.5 text-xs text-white/35">
                                {t("wizard.fields.editor.requiredFieldHint")}
                            </p>
                        </div>
                    </label>
                </EditorSection>
            </div>
        </div>
    );
}

// ── Editor layout helpers ──────────────────────────────────────────────────

function EditorSection({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/25">{label}</p>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function EditorField({
                         label, required, hint, children,
                     }: {
    label: string;
    required?: boolean;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-white/55">
                    {label} {required && <span className="text-red-400">*</span>}
                </p>
                {hint && <p className="text-right text-[10px] text-white/20 leading-tight">{hint}</p>}
            </div>
            {children}
        </div>
    );
}

// ── Options Editor ─────────────────────────────────────────────────────────

function OptionsEditor({
                           options,
                           onChange,
                           fieldType,
                       }: {
    options: string[];
    onChange: (opts: string[]) => void;
    fieldType: FieldType;
}) {
    const {t} = useTranslation();
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const addOption = (afterIdx?: number) => {
        const next = [...options];
        const at = afterIdx !== undefined ? afterIdx + 1 : next.length;
        next.splice(at, 0, "");
        onChange(next);
        setTimeout(() => inputRefs.current[at]?.focus(), 0);
    };

    const removeOption = (i: number) => {
        onChange(options.filter((_, j) => j !== i));
        setTimeout(() => inputRefs.current[Math.max(0, i - 1)]?.focus(), 0);
    };

    const updateOption = (i: number, val: string) =>
        onChange(options.map((o, j) => (j === i ? val : o)));

    const moveOption = (i: number, dir: -1 | 1) => {
        const next = [...options];
        const swapIdx = i + dir;
        if (swapIdx < 0 || swapIdx >= next.length) return;
        [next[i], next[swapIdx]] = [next[swapIdx], next[i]];
        onChange(next);
        setTimeout(() => inputRefs.current[swapIdx]?.focus(), 0);
    };

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-white/55">
                    {t("wizard.fields.options.label")} <span className="text-red-400">*</span>
                </p>
                {HAS_CHOICE_HINT.includes(fieldType) && (
                    <p className="text-[10px] text-white/25">{t(`wizard.fields.choiceHints.${fieldType}`)}</p>
                )}
            </div>

            {options.length === 0 && (
                <p className="mb-2 text-[11px] text-amber-400/70">
                    {t("wizard.fields.options.addAtLeastOne")}
                </p>
            )}

            <div className="mb-2 space-y-1.5">
                {options.map((opt, i) => (
                    <div key={i} className="group flex items-center gap-1.5">
                        {/* Reorder */}
                        <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100">
                            <button type="button" onClick={() => moveOption(i, -1)} disabled={i === 0}
                                    className="text-[8px] leading-none text-white/20 hover:text-white/60 disabled:opacity-20">▲
                            </button>
                            <button type="button" onClick={() => moveOption(i, 1)} disabled={i === options.length - 1}
                                    className="text-[8px] leading-none text-white/20 hover:text-white/60 disabled:opacity-20">▼
                            </button>
                        </div>

                        <span className="w-4 shrink-0 text-right text-[10px] text-white/20">{i + 1}</span>

                        <input
                            ref={el => {
                                inputRefs.current[i] = el;
                            }}
                            type="text"
                            value={opt}
                            onChange={e => updateOption(i, e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addOption(i);
                                }
                                if (e.key === "Backspace" && opt === "") {
                                    e.preventDefault();
                                    removeOption(i);
                                }
                            }}
                            placeholder={t("wizard.fields.options.optionPlaceholder", {n: i + 1})}
                            className="flex-1 rounded-lg border border-white/[0.09] bg-white/[0.05] px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none transition-colors focus:border-indigo-500/60"
                        />

                        <button type="button" onClick={() => removeOption(i)}
                                className="p-1 text-white/20 transition-colors hover:text-red-400">
                            <FiTrash2 size={11}/>
                        </button>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={() => addOption()}
                className="flex items-center gap-1 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
            >
                <FiPlus size={11}/>
                {t("wizard.fields.options.add")}
                <span className="ml-1 text-[10px] text-white/20">{t("wizard.fields.options.addHint")}</span>
            </button>
        </div>
    );
}
