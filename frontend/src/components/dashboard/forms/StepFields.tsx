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
    FiLock,
    FiMail,
    FiPhone,
    FiPlus,
    FiToggleLeft,
    FiTrash2,
    FiMenu,
    FiMinus,
    FiStar,
    FiType,
} from "react-icons/fi";
import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {CSS, type Transform} from "@dnd-kit/utilities";
import type {FieldType, FormField} from "../../../types/forms";
import {DEFAULT_RATING_SCALE} from "../../form/fields/RatingField";
import type {FormDraft} from "./FormWizard";
import ConditionEditor from "./ConditionEditor";

// ── Type metadata ──────────────────────────────────────────────────────────

type TypeGroup = "text" | "choice" | "datetime" | "layout";

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
        iconCls: "text-[#31578F] bg-[#EAF1FB]"
    },
    TEXTAREA: {
        icon: FiAlignLeft,
        labelKey: "wizard.fields.types.TEXTAREA.label",
        descKey: "wizard.fields.types.TEXTAREA.desc",
        group: "text",
        iconCls: "text-[#31578F] bg-[#EAF1FB]"
    },
    NUMBER: {
        icon: FiHash,
        labelKey: "wizard.fields.types.NUMBER.label",
        descKey: "wizard.fields.types.NUMBER.desc",
        group: "text",
        iconCls: "text-[#31578F] bg-[#EAF1FB]"
    },
    EMAIL: {
        icon: FiMail,
        labelKey: "wizard.fields.types.EMAIL.label",
        descKey: "wizard.fields.types.EMAIL.desc",
        group: "text",
        iconCls: "text-[#31578F] bg-[#EAF1FB]"
    },
    PASSWORD: {
        icon: FiLock,
        labelKey: "wizard.fields.types.PASSWORD.label",
        descKey: "wizard.fields.types.PASSWORD.desc",
        group: "text",
        iconCls: "text-[#31578F] bg-[#EAF1FB]"
    },
    URL: {
        icon: FiLink,
        labelKey: "wizard.fields.types.URL.label",
        descKey: "wizard.fields.types.URL.desc",
        group: "text",
        iconCls: "text-[#31578F] bg-[#EAF1FB]"
    },
    PHONE: {
        icon: FiPhone,
        labelKey: "wizard.fields.types.PHONE.label",
        descKey: "wizard.fields.types.PHONE.desc",
        group: "text",
        iconCls: "text-[#31578F] bg-[#EAF1FB]"
    },
    SELECT: {
        icon: FiChevronDown,
        labelKey: "wizard.fields.types.SELECT.label",
        descKey: "wizard.fields.types.SELECT.desc",
        group: "choice",
        iconCls: "text-[#5B3E96] bg-[#F2EEFA]"
    },
    MULTI_SELECT: {
        icon: FiLayers,
        labelKey: "wizard.fields.types.MULTI_SELECT.label",
        descKey: "wizard.fields.types.MULTI_SELECT.desc",
        group: "choice",
        iconCls: "text-[#5B3E96] bg-[#F2EEFA]"
    },
    RADIO: {
        icon: FiCircle,
        labelKey: "wizard.fields.types.RADIO.label",
        descKey: "wizard.fields.types.RADIO.desc",
        group: "choice",
        iconCls: "text-[#5B3E96] bg-[#F2EEFA]"
    },
    CHECKBOX: {
        icon: FiCheckSquare,
        labelKey: "wizard.fields.types.CHECKBOX.label",
        descKey: "wizard.fields.types.CHECKBOX.desc",
        group: "choice",
        iconCls: "text-[#5B3E96] bg-[#F2EEFA]"
    },
    BOOLEAN: {
        icon: FiToggleLeft,
        labelKey: "wizard.fields.types.BOOLEAN.label",
        descKey: "wizard.fields.types.BOOLEAN.desc",
        group: "choice",
        iconCls: "text-[#5B3E96] bg-[#F2EEFA]"
    },
    DATE: {
        icon: FiCalendar,
        labelKey: "wizard.fields.types.DATE.label",
        descKey: "wizard.fields.types.DATE.desc",
        group: "datetime",
        iconCls: "text-[#3F6B4A] bg-[#EEF4EE]"
    },
    TIME: {
        icon: FiClock,
        labelKey: "wizard.fields.types.TIME.label",
        descKey: "wizard.fields.types.TIME.desc",
        group: "datetime",
        iconCls: "text-[#3F6B4A] bg-[#EEF4EE]"
    },
    DATETIME: {
        icon: FiCalendar,
        labelKey: "wizard.fields.types.DATETIME.label",
        descKey: "wizard.fields.types.DATETIME.desc",
        group: "datetime",
        iconCls: "text-[#3F6B4A] bg-[#EEF4EE]"
    },
    RATING: {
        icon: FiStar,
        labelKey: "wizard.fields.types.RATING.label",
        descKey: "wizard.fields.types.RATING.desc",
        group: "choice",
        iconCls: "text-[#92702A] bg-[#FBF3E4]"
    },
    SECTION_BREAK: {
        icon: FiMinus,
        labelKey: "wizard.fields.types.SECTION_BREAK.label",
        descKey: "wizard.fields.types.SECTION_BREAK.desc",
        group: "layout",
        iconCls: "text-[#55555F] bg-[#F0F0F2]"
    },
};

const TYPE_GROUPS: { id: TypeGroup; labelKey: string; types: FieldType[] }[] = [
    {id: "text", labelKey: "wizard.fields.groups.text", types: ["TEXT", "TEXTAREA", "NUMBER", "EMAIL", "URL", "PHONE"]},
    {id: "choice", labelKey: "wizard.fields.groups.choice", types: ["SELECT", "MULTI_SELECT", "RADIO", "CHECKBOX", "BOOLEAN", "RATING"]},
    {id: "datetime", labelKey: "wizard.fields.groups.datetime", types: ["DATE", "TIME", "DATETIME"]},
    {id: "layout", labelKey: "wizard.fields.groups.layout", types: ["SECTION_BREAK"]},
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
        // Conditions pointing at the removed field would no longer validate.
        const next = draft.fields.filter(f => f.id !== id)
            .map(f => f.condition?.fieldId === id ? {...f, condition: null} : f);
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

    const reorderField = (activeId: string, overId: string) => {
        const from = draft.fields.findIndex(f => f.id === activeId);
        const to = draft.fields.findIndex(f => f.id === overId);
        if (from < 0 || to < 0) return;
        setFields(arrayMove(draft.fields, from, to));
    };

    const selectedField = draft.fields.find(f => f.id === selectedId) ?? null;

    return (
        <div className="flex h-[540px]">
            {/* ── Left panel ─────────────────────────────────────────── */}
            <div className="flex w-72 flex-shrink-0 flex-col border-r border-[#E4E4E7]">
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
                            onReorder={reorderField}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* ── Right panel: editor ────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden bg-[#FAFAFB]">
                {selectedField ? (
                    <FieldEditor
                        key={selectedField.id}
                        field={selectedField}
                        allFields={draft.fields}
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
            <div className="flex flex-shrink-0 items-center gap-2 border-b border-[#E4E4E7] px-4 py-3">
                {showBack && (
                    <button
                        onClick={onBack}
                        className="rounded-lg p-1 text-[#8B8B96] transition-colors hover:bg-[#F0F0F2] hover:text-[#1E1E24]"
                    >
                        <FiArrowLeft size={13}/>
                    </button>
                )}
                <p className="text-xs font-medium text-[#55555F]">{t("wizard.fields.picker.title")}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {TYPE_GROUPS.map(group => (
                    <div key={group.id}>
                        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">
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
                                        className="flex flex-col gap-1.5 rounded-xl border border-[#E4E4E7] bg-white p-3 text-left transition-all hover:border-[#D8DCF5] hover:bg-[#EEF0FB]"
                                    >
                                        <div
                                            className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.iconCls}`}>
                                            <Icon size={14}/>
                                        </div>
                                        <p className="text-xs font-medium text-[#1E1E24] leading-tight">{t(meta.labelKey)}</p>
                                        <p className="text-[10px] text-[#8B8B96] leading-snug">{t(meta.descKey)}</p>
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
                       onReorder,
                   }: {
    fields: FormField[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onAdd: () => void;
    onRemove: (id: string) => void;
    onDuplicate: (id: string) => void;
    onReorder: (activeId: string, overId: string) => void;
}) {
    const {t} = useTranslation();
    // A small activation distance keeps plain clicks (select a field) from
    // being swallowed as drags; the keyboard sensor makes ordering
    // accessible without a mouse (focus the handle, Space, arrows, Space).
    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
    };

    return (
        <motion.div
            initial={{opacity: 0, x: 8}}
            animate={{opacity: 1, x: 0}}
            exit={{opacity: 0, x: 8}}
            transition={{duration: 0.15}}
            className="flex h-full flex-col"
        >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[#E4E4E7] px-4 py-3">
                <p className="text-xs text-[#8B8B96]">
                    {t("wizard.fields.list.fieldCount", {count: fields.length})}
                </p>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-1 rounded-lg bg-[#EEF0FB] px-2.5 py-1 text-[11px] font-medium text-[#3730A3] transition-colors hover:bg-[#D8DCF5]"
                >
                    <FiPlus size={11}/>
                    {t("wizard.fields.list.addField")}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}
                            modifiers={[restrictToVerticalAxis]}>
                    <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                        {fields.map(field => (
                            <SortableFieldRow
                                key={field.id}
                                field={field}
                                selected={selectedId === field.id}
                                onSelect={() => onSelect(field.id)}
                                onRemove={() => onRemove(field.id)}
                                onDuplicate={() => onDuplicate(field.id)}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </motion.div>
    );
}

function restrictToVerticalAxis({transform}: { transform: Transform }): Transform {
    return {...transform, x: 0};
}

function SortableFieldRow({
                              field,
                              selected,
                              onSelect,
                              onRemove,
                              onDuplicate,
                          }: {
    field: FormField;
    selected: boolean;
    onSelect: () => void;
    onRemove: () => void;
    onDuplicate: () => void;
}) {
    const {t} = useTranslation();
    const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging} =
        useSortable({id: field.id});
    const meta = TYPE_META[field.type];
    const Icon = meta.icon;

    return (
        <div
            ref={setNodeRef}
            style={{transform: CSS.Transform.toString(transform), transition}}
            onClick={onSelect}
            className={`group relative flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                isDragging
                    ? "z-10 border-[#D8DCF5] bg-white shadow-lg"
                    : selected
                        ? "border-[#D8DCF5] bg-[#EEF0FB]"
                        : "border-transparent hover:border-[#E4E4E7] hover:bg-[#FAFAFB]"
            }`}
        >
            {/* Drag handle */}
            <button
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                onClick={e => e.stopPropagation()}
                title={t("wizard.fields.list.dragToReorder")}
                aria-label={t("wizard.fields.list.dragToReorder")}
                className="flex-shrink-0 cursor-grab touch-none rounded p-0.5 text-[#C7C7CE] transition-colors hover:text-[#55555F] active:cursor-grabbing"
            >
                <FiMenu size={12}/>
            </button>

            {/* Icon */}
            <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${meta.iconCls}`}>
                <Icon size={11}/>
            </div>

            {/* Label */}
            <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-[#1E1E24] leading-tight">
                    {field.label || <span className="italic text-[#C7C7CE]">{t("wizard.fields.list.untitled")}</span>}
                </p>
                <p className="text-[10px] text-[#8B8B96] leading-tight">{t(meta.labelKey)}</p>
            </div>

            {/* Required dot */}
            {field.required && (
                <span className="flex-shrink-0 text-[8px] text-[#B56A65]" title="Required">●</span>
            )}

            {/* Actions */}
            <div
                className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onDuplicate}
                    title="Duplicate"
                    className="rounded p-1 text-[#C7C7CE] transition-colors hover:text-[#55555F]"
                >
                    <FiCopy size={10}/>
                </button>
                <button
                    onClick={onRemove}
                    title="Delete"
                    className="rounded p-1 text-[#C7C7CE] transition-colors hover:text-[#B56A65]"
                >
                    <FiTrash2 size={10}/>
                </button>
            </div>
        </div>
    );
}

// ── Empty editor state ─────────────────────────────────────────────────────

function EmptyEditor({onAddClick, hasFields}: { onAddClick: () => void; hasFields: boolean }) {
    const {t} = useTranslation();
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E4E4E7] bg-white">
                <FiList size={22} className="text-[#C7C7CE]"/>
            </div>
            <div>
                <p className="text-sm font-medium text-[#8B8B96]">
                    {hasFields ? t("wizard.fields.empty.selectField") : t("wizard.fields.empty.noFields")}
                </p>
                <p className="mt-1 text-xs text-[#C7C7CE]">
                    {hasFields
                        ? t("wizard.fields.empty.clickToEdit")
                        : t("wizard.fields.empty.addFirst")}
                </p>
            </div>
            {!hasFields && (
                <button
                    onClick={onAddClick}
                    className="mt-1 flex items-center gap-1.5 rounded-xl bg-[#EEF0FB] px-4 py-2 text-sm text-[#3730A3] transition-colors hover:bg-[#D8DCF5]"
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
    allFields: FormField[];
    onUpdate: (patch: Partial<FormField>) => void;
    onDelete: () => void;
    onDuplicate: () => void;
}

function FieldEditor({field, allFields, onUpdate, onDelete, onDuplicate}: FieldEditorProps) {
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
    const isRating = field.type === "RATING";
    const isSection = field.type === "SECTION_BREAK";

    const inputCls =
        "w-full rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5 text-sm text-[#1E1E24] placeholder-[#C7C7CE] outline-none transition-colors focus:border-[#3730A3]";

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
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[#E4E4E7] px-5 py-3">
                <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-md ${meta.iconCls}`}>
                        <Icon size={12}/>
                    </div>
                    <p className="text-xs font-medium text-[#6B6B76]">{t(meta.labelKey)}</p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onDuplicate}
                        title="Duplicate field"
                        className="rounded-lg p-1.5 text-[#C7C7CE] transition-colors hover:bg-[#F0F0F2] hover:text-[#55555F]"
                    >
                        <FiCopy size={12}/>
                    </button>
                    <button
                        onClick={onDelete}
                        title="Delete field"
                        className="rounded-lg p-1.5 text-[#C7C7CE] transition-colors hover:bg-[#F7EEEE] hover:text-[#8B4A46]"
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
                            className="flex w-full items-center gap-3 rounded-xl border border-[#E4E4E7] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#D4D4D9]"
                        >
                            <div
                                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${meta.iconCls}`}>
                                <Icon size={14}/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#1E1E24]">{t(meta.labelKey)}</p>
                                <p className="text-[11px] text-[#8B8B96]">{t(meta.descKey)}</p>
                            </div>
                            <FiChevronDown
                                size={13}
                                className={`flex-shrink-0 text-[#8B8B96] transition-transform duration-200 ${typePickerOpen ? "rotate-180" : ""}`}
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
                                        className="mt-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] p-3 space-y-3">
                                        {TYPE_GROUPS.map(group => (
                                            <div key={group.id}>
                                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">
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
                                                                        max: HAS_MIN_MAX.includes(type) ? field.max : type === "RATING" ? DEFAULT_RATING_SCALE : undefined,
                                                                        required: type === "SECTION_BREAK" ? false : field.required,
                                                                    });
                                                                    setTypePickerOpen(false);
                                                                }}
                                                                className={`flex flex-col gap-1 rounded-lg border p-2 text-left transition-all ${
                                                                    active
                                                                        ? "border-[#D8DCF5] bg-[#EEF0FB]"
                                                                        : "border-[#E4E4E7] hover:border-[#D4D4D9] hover:bg-white"
                                                                }`}
                                                            >
                                                                <div
                                                                    className={`flex h-5 w-5 items-center justify-center rounded-md ${m.iconCls}`}>
                                                                    <TIcon size={10}/>
                                                                </div>
                                                                <p className="text-[10px] font-medium text-[#1E1E24] leading-tight">{t(m.labelKey)}</p>
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
                {(hasPlaceholder || hasMinMax || hasOptions || isBoolean || isDateTime || isRating) && (
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
                            <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
                                <p className="text-xs text-[#8B8B96] leading-relaxed">
                                    {t("wizard.fields.editor.booleanInfo")}
                                </p>
                            </div>
                        )}

                        {/* Rating scale */}
                        {isRating && (
                            <EditorField
                                label={t("wizard.fields.editor.ratingScale")}
                                hint={t("wizard.fields.editor.ratingScaleHint")}
                            >
                                <select
                                    value={field.max ?? DEFAULT_RATING_SCALE}
                                    onChange={e => onUpdate({max: Number(e.target.value)})}
                                    className={inputCls}
                                >
                                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </EditorField>
                        )}

                        {/* Date/Time info */}
                        {isDateTime && (
                            <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
                                <p className="text-xs text-[#8B8B96] leading-relaxed">
                                    {dateTimeInfo()}
                                </p>
                            </div>
                        )}
                    </EditorSection>
                )}

                {/* ─ Section: Validation ──────────────────────────── */}
                {!isSection && <EditorSection label={t("wizard.fields.editor.sectionValidation")}>
                    <label
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E4E4E7] bg-white p-4 transition-colors hover:border-[#D4D4D9]">
                        <div className="mt-0.5 flex-shrink-0">
                            <div
                                onClick={() => onUpdate({required: !field.required})}
                                className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                                    field.required
                                        ? "border-[#3730A3] bg-[#3730A3]"
                                        : "border-[#D4D4D9] bg-transparent"
                                }`}
                            >
                                {field.required && <span className="text-[9px] font-bold text-white">✓</span>}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[#1E1E24]">{t("wizard.fields.editor.requiredField")}</p>
                            <p className="mt-0.5 text-xs text-[#8B8B96]">
                                {t("wizard.fields.editor.requiredFieldHint")}
                            </p>
                        </div>
                    </label>
                </EditorSection>}

                {/* ─ Section: Branching (E3.1) ─────────────────────── */}
                <EditorSection label={t("wizard.fields.condition.section")}>
                    <ConditionEditor field={field} allFields={allFields}
                                     onChange={condition => onUpdate({condition})}/>
                </EditorSection>
            </div>
        </div>
    );
}

// ── Editor layout helpers ──────────────────────────────────────────────────

function EditorSection({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">{label}</p>
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
                <p className="text-xs font-medium text-[#6B6B76]">
                    {label} {required && <span className="text-[#B56A65]">*</span>}
                </p>
                {hint && <p className="text-right text-[10px] text-[#C7C7CE] leading-tight">{hint}</p>}
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
                <p className="text-xs font-medium text-[#6B6B76]">
                    {t("wizard.fields.options.label")} <span className="text-[#B56A65]">*</span>
                </p>
                {HAS_CHOICE_HINT.includes(fieldType) && (
                    <p className="text-[10px] text-[#8B8B96]">{t(`wizard.fields.choiceHints.${fieldType}`)}</p>
                )}
            </div>

            {options.length === 0 && (
                <p className="mb-2 text-[11px] text-[#C99A3E]">
                    {t("wizard.fields.options.addAtLeastOne")}
                </p>
            )}

            <div className="mb-2 space-y-1.5">
                {options.map((opt, i) => (
                    <div key={i} className="group flex items-center gap-1.5">
                        {/* Reorder */}
                        <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100">
                            <button type="button" onClick={() => moveOption(i, -1)} disabled={i === 0}
                                    className="text-[8px] leading-none text-[#C7C7CE] hover:text-[#55555F] disabled:opacity-30">▲
                            </button>
                            <button type="button" onClick={() => moveOption(i, 1)} disabled={i === options.length - 1}
                                    className="text-[8px] leading-none text-[#C7C7CE] hover:text-[#55555F] disabled:opacity-30">▼
                            </button>
                        </div>

                        <span className="w-4 shrink-0 text-right text-[10px] text-[#C7C7CE]">{i + 1}</span>

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
                            className="flex-1 rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-sm text-[#1E1E24] placeholder-[#C7C7CE] outline-none transition-colors focus:border-[#3730A3]"
                        />

                        <button type="button" onClick={() => removeOption(i)}
                                className="p-1 text-[#C7C7CE] transition-colors hover:text-[#B56A65]">
                            <FiTrash2 size={11}/>
                        </button>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={() => addOption()}
                className="flex items-center gap-1 text-xs text-[#3730A3] transition-colors hover:text-[#2D2682]"
            >
                <FiPlus size={11}/>
                {t("wizard.fields.options.add")}
                <span className="ml-1 text-[10px] text-[#C7C7CE]">{t("wizard.fields.options.addHint")}</span>
            </button>
        </div>
    );
}
