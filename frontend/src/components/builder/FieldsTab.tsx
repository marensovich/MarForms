import {type KeyboardEvent, useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiCopy, FiGitBranch, FiMenu, FiPlus, FiTrash2, FiX} from "react-icons/fi";
import {closestCenter, DndContext, type DragEndEvent, type DragOverEvent, KeyboardSensor, PointerSensor, useSensor, useSensors} from "@dnd-kit/core";
import {arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import type {ConditionOperator, FieldCondition, FieldType, FormField} from "../../types/forms";
import {isInputField} from "../../types/forms";
import {ConfirmDialog, cx, Switch} from "../../ui";
import {fieldProblem, newField, PALETTE, TYPE_ICON, WITH_LENGTH, WITH_OPTIONS, WITH_PLACEHOLDER, WITH_RANGE, WITH_SELECTED} from "./fieldTypes";

// Docs: docs/design/mockups/FormEdit.dc.html, Wizard2.dc.html; ТЗ 5.3.

/** The operators that make sense for the field a condition looks at (the server re-checks). */
function operatorsFor(field: FormField): ConditionOperator[] {
    if (field.type === "BOOLEAN" || field.type === "FILE_UPLOAD") return ["NOT_EMPTY"];
    if (WITH_OPTIONS.includes(field.type)) return ["EQUALS", "NOT_EQUALS", "NOT_EMPTY"];
    if (field.type === "NUMBER" || field.type === "RATING") return ["EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN", "NOT_EMPTY"];
    return ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_EMPTY"];
}

const input = "h-[38px] rounded-[10px] border border-bd bg-sf px-3 text-sm text-tx outline-none focus:border-pr";
const small = "h-9 w-full rounded-[9px] border border-bd bg-sf px-2.5 font-mono text-[13px] text-tx outline-none focus:border-pr";

function ListItem({field, index, selected, insertBefore, onSelect, onMove}: {
    field: FormField;
    index: number;
    selected: boolean;
    insertBefore: boolean;
    onSelect: () => void;
    onMove: (delta: number) => void;
}) {
    const {t} = useTranslation();
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: field.id});
    const Icon = TYPE_ICON[field.type];
    const problem = fieldProblem(field);
    const onKey = (e: KeyboardEvent) => {
        // ⌥↑ / ⌥↓ move the field (ТЗ ФТ-5.3.1).
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            onMove(e.key === "ArrowUp" ? -1 : 1);
        }
    };
    return (
        <li ref={setNodeRef} style={{transform: CSS.Transform.toString(transform), transition}} className={cx(isDragging && "z-10 opacity-60")}>
            {insertBefore && <div className="mb-0.5 h-1 rounded bg-pr opacity-60" aria-hidden="true"/>}
            <div className={cx("flex h-[38px] items-center gap-2 rounded-[9px] px-2 text-[13px]",
                selected ? "bg-prs font-semibold text-prt" : "text-tx hover:bg-s2")}>
                <button type="button" {...attributes} {...listeners} aria-label={t("builder.fields.drag", {label: field.label || index + 1})}
                        className="cursor-grab text-mu"><FiMenu size={14} aria-hidden="true"/></button>
                <button type="button" onClick={onSelect} onKeyDown={onKey} aria-current={selected || undefined}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <Icon size={14} aria-hidden="true" className="flex-none text-mu"/>
                    <span className="min-w-0 flex-1 truncate">
                        {field.type === "SECTION_BREAK" ? <b>{field.label || t("builder.fields.untitledSection")}</b>
                            : field.label || <span className="italic text-mu">{t("builder.fields.untitled")}</span>}
                        {field.required && <span className="text-rdt"> *</span>}
                    </span>
                    {field.condition && (
                        <span title={t("builder.fields.conditional")}
                              className="rounded-[5px] bg-prs px-[5px] py-px font-mono text-[10px] font-bold text-prt">IF</span>
                    )}
                    {problem && <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#F59E0B]" title={t(`builder.problem.${problem}`)}/>}
                </button>
            </div>
        </li>
    );
}

/** A field on the canvas as the respondent will see it, without inputs that work. */
function CanvasField({field, fields}: { field: FormField; fields: FormField[] }) {
    const {t} = useTranslation();
    const box = "rounded-[10px] border border-bd bg-bg";
    const condition = field.condition && fields.find(f => f.id === field.condition!.fieldId);
    return (
        <>
            {condition && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-prt">
                    <FiGitBranch size={12} aria-hidden="true"/>
                    {t("builder.fields.shownIf", {
                        field: condition.label,
                        op: t(`builder.condition.op.${field.condition!.operator}`),
                        value: field.condition!.value ?? "",
                    })}
                </span>
            )}
            {field.type === "SECTION_BREAK" ? (
                <span className="text-lg font-bold">{field.label || t("builder.fields.untitledSection")}</span>
            ) : (
                <span className="text-sm font-semibold">
                    {field.label || <span className="italic text-mu">{t("builder.fields.untitled")}</span>}
                    {field.required && <span className="text-[#DC2626]"> *</span>}
                </span>
            )}
            {field.description && <span className="whitespace-pre-wrap text-[13px] text-mu">{field.description}</span>}
            {field.type === "TEXTAREA" && <span className={cx(box, "h-24")}/>}
            {["TEXT", "NUMBER", "EMAIL", "URL", "PHONE", "PASSWORD", "DATE", "TIME", "DATETIME", "SELECT"].includes(field.type) && (
                <span className={cx(box, "flex h-10 items-center px-3 text-[13px] text-mu")}>{field.placeholder}</span>
            )}
            {["RADIO", "CHECKBOX", "MULTI_SELECT"].includes(field.type) && (
                <span className="flex flex-wrap gap-2">
                    {(field.options ?? []).map((o, i) => (
                        <span key={i} className="rounded-[10px] border border-bd px-4 py-2 text-[13px]">{o || "…"}</span>
                    ))}
                </span>
            )}
            {field.type === "BOOLEAN" && (
                <span className="flex gap-2">
                    <span className="rounded-[10px] border border-bd px-4 py-2 text-[13px]">{t("form.boolean.yes", {defaultValue: "Да"})}</span>
                    <span className="rounded-[10px] border border-bd px-4 py-2 text-[13px]">{t("form.boolean.no", {defaultValue: "Нет"})}</span>
                </span>
            )}
            {field.type === "RATING" && <span className="text-lg tracking-[0.2em] text-mu">{"★".repeat(field.max ?? 5)}</span>}
            {field.type === "FILE_UPLOAD" && (
                <span className="grid h-[72px] place-items-center rounded-[10px] border-[1.5px] border-dashed border-bd text-[13px] text-mu">
                    {t("builder.fields.dropHere")}
                </span>
            )}
        </>
    );
}

function NumberInput({label, value, onChange, min}: { label: string; value?: number; onChange: (v: number | undefined) => void; min?: number }) {
    return (
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-mu">
            {label}
            <input type="number" min={min} value={value ?? ""} className={small}
                   onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))}/>
        </label>
    );
}

function OptionsEditor({options, onChange}: { options: string[]; onChange: (options: string[]) => void }) {
    const {t} = useTranslation();
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">{t("builder.inspector.options")}</span>
            {options.map((o, i) => (
                <span key={i} className="flex items-center gap-1.5">
                    <input value={o} aria-label={t("builder.inspector.option", {n: i + 1})} className={cx(input, "min-w-0 flex-1 h-9")}
                           onChange={e => onChange(options.map((x, j) => (j === i ? e.target.value : x)))}/>
                    <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))} disabled={options.length <= 2}
                            aria-label={t("builder.inspector.removeOption", {n: i + 1})}
                            className="grid h-8 w-8 place-items-center rounded-lg text-mu hover:bg-s2 disabled:opacity-40">
                        <FiX size={14} aria-hidden="true"/>
                    </button>
                </span>
            ))}
            <button type="button" onClick={() => onChange([...options, t("builder.optionN", {n: options.length + 1})])}
                    className="self-start text-[13px] font-semibold text-prt hover:underline">+ {t("builder.inspector.addOption")}</button>
        </div>
    );
}

const FILE_TYPES = ["png", "jpg", "jpeg", "pdf", "gif", "webp", "txt", "doc", "docx", "xls", "xlsx", "zip"];

/** «Свойства поля»: everything about the selected field (ТЗ ФТ-5.3.3–5.3.6). */
function Inspector({field, fields, onUpdate}: { field: FormField; fields: FormField[]; onUpdate: (patch: Partial<FormField>) => void }) {
    const {t} = useTranslation();
    const ids = {label: useId(), hint: useId(), placeholder: useId()};
    const above = fields.slice(0, fields.findIndex(f => f.id === field.id)).filter(isInputField);
    const condition = field.condition ?? null;
    const controller = condition ? above.find(f => f.id === condition.fieldId) ?? null : null;
    const dateInput = field.type === "DATE" ? "date" : field.type === "TIME" ? "time" : "datetime-local";

    const startCondition = (target: FormField) => {
        const op = operatorsFor(target)[0];
        onUpdate({condition: {fieldId: target.id, operator: op, value: op === "EQUALS" && target.options?.length ? target.options[0] : ""}});
    };
    const setCondition = (patch: Partial<FieldCondition>) => condition && onUpdate({condition: {...condition, ...patch}});

    return (
        <>
            <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold">{t("builder.inspector.title")}</span>
                <span className="rounded-md bg-s2 px-2 py-0.5 font-mono text-[11px] text-mu">{field.type.toLowerCase()}</span>
            </div>
            <label htmlFor={ids.label} className="flex flex-col gap-1.5 text-[13px] font-semibold">
                {field.type === "SECTION_BREAK" ? t("builder.inspector.heading") : t("builder.inspector.question")}
                <input id={ids.label} value={field.label} onChange={e => onUpdate({label: e.target.value})} className={input}/>
            </label>
            <label htmlFor={ids.hint} className="flex flex-col gap-1.5 text-[13px] font-semibold">
                {t("builder.inspector.hint")}
                <textarea id={ids.hint} rows={2} value={field.description ?? ""} onChange={e => onUpdate({description: e.target.value})}
                          className="resize-none rounded-[10px] border border-bd bg-sf px-3 py-2 text-[13px] text-tx outline-none focus:border-pr"/>
            </label>
            {field.type !== "SECTION_BREAK" && (
                <span className="flex items-center justify-between text-sm font-medium">
                    {t("builder.inspector.required")}
                    <Switch checked={field.required} onChange={required => onUpdate({required})} ariaLabel={t("builder.inspector.required")}/>
                </span>
            )}
            {WITH_PLACEHOLDER.includes(field.type) && (
                <label htmlFor={ids.placeholder} className="flex flex-col gap-1.5 text-[13px] font-semibold">
                    {t("builder.inspector.placeholder")}
                    <input id={ids.placeholder} value={field.placeholder ?? ""} onChange={e => onUpdate({placeholder: e.target.value})} className={input}/>
                </label>
            )}
            {WITH_LENGTH.includes(field.type) && (
                <div className="grid grid-cols-2 gap-2.5">
                    <NumberInput label={t("builder.inspector.minLength")} min={0} value={field.minLength ?? field.min}
                                 onChange={v => onUpdate({minLength: v, min: undefined})}/>
                    <NumberInput label={t("builder.inspector.maxLength")} min={1} value={field.maxLength ?? field.max}
                                 onChange={v => onUpdate({maxLength: v, max: undefined})}/>
                </div>
            )}
            {field.type === "NUMBER" && (
                <div className="grid grid-cols-2 gap-2.5">
                    <NumberInput label={t("builder.inspector.minValue")} value={field.min} onChange={v => onUpdate({min: v})}/>
                    <NumberInput label={t("builder.inspector.maxValue")} value={field.max} onChange={v => onUpdate({max: v})}/>
                </div>
            )}
            {field.type === "RATING" && (
                <NumberInput label={t("builder.inspector.scale")} min={2} value={field.max ?? 5} onChange={v => onUpdate({max: v})}/>
            )}
            {WITH_OPTIONS.includes(field.type) && (
                <OptionsEditor options={field.options ?? []} onChange={options => onUpdate({options})}/>
            )}
            {WITH_SELECTED.includes(field.type) && (
                <div className="grid grid-cols-2 gap-2.5">
                    <NumberInput label={t("builder.inspector.minSelected")} min={0} value={field.minSelected} onChange={v => onUpdate({minSelected: v})}/>
                    <NumberInput label={t("builder.inspector.maxSelected")} min={1} value={field.maxSelected} onChange={v => onUpdate({maxSelected: v})}/>
                </div>
            )}
            {WITH_RANGE.includes(field.type) && (
                <div className="grid grid-cols-2 gap-2.5">
                    {(["minDate", "maxDate"] as const).map(k => (
                        <label key={k} className="flex flex-col gap-1.5 text-xs font-semibold text-mu">
                            {t(`builder.inspector.${k}`)}
                            <input type={dateInput} value={field[k] ?? ""} className={small}
                                   onChange={e => onUpdate({[k]: e.target.value || undefined})}/>
                        </label>
                    ))}
                </div>
            )}
            {field.type === "FILE_UPLOAD" && (
                <fieldset className="m-0 flex flex-col gap-2.5 border-0 border-t border-bd p-0 pt-3">
                    <legend className="text-[13px] font-semibold">{t("builder.inspector.fileLimits")}</legend>
                    <div className="flex flex-wrap gap-1.5">
                        {FILE_TYPES.map(ext => {
                            const on = (field.allowedExtensions ?? []).includes(ext);
                            return (
                                <button key={ext} type="button" aria-pressed={on}
                                        onClick={() => onUpdate({allowedExtensions: on
                                                ? (field.allowedExtensions ?? []).filter(e => e !== ext)
                                                : [...(field.allowedExtensions ?? []), ext]})}
                                        className={cx("rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase",
                                            on ? "border-pr bg-prs text-prt" : "border-bd text-mu")}>
                                    {ext}
                                </button>
                            );
                        })}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                        <NumberInput label={t("builder.inspector.maxFiles")} min={1} value={field.maxFiles ?? 3} onChange={v => onUpdate({maxFiles: v})}/>
                        <NumberInput label={t("builder.inspector.maxSize")} min={1} value={field.maxFileSizeMb ?? 10} onChange={v => onUpdate({maxFileSizeMb: v})}/>
                    </div>
                </fieldset>
            )}

            {field.type !== "SECTION_BREAK" && (
                <div className={cx("flex flex-col gap-2.5 rounded-xl border p-3.5", condition ? "border-pr bg-prs" : "border-bd")}>
                    <span className="flex items-center justify-between text-[13px] font-bold text-prt">
                        {t("builder.condition.title")}
                        <Switch checked={!!condition} disabled={above.length === 0}
                                onChange={on => (on ? startCondition(above[above.length - 1]) : onUpdate({condition: null}))}
                                ariaLabel={t("builder.condition.toggle")}/>
                    </span>
                    {above.length === 0 && <span className="text-xs text-mu">{t("builder.condition.noneAbove")}</span>}
                    {condition && (
                        <>
                            <span className="text-[13px] text-tx">{t("builder.condition.showIf")}</span>
                            <select value={controller?.id ?? ""} aria-label={t("builder.condition.field")}
                                    onChange={e => {
                                        const next = above.find(f => f.id === e.target.value);
                                        if (next) startCondition(next);
                                    }} className={cx(input, "h-9")}>
                                {!controller && <option value="">{t("builder.condition.missing")}</option>}
                                {above.map(f => <option key={f.id} value={f.id}>{f.label || t("builder.fields.untitled")}</option>)}
                            </select>
                            {controller && (
                                <div className="grid grid-cols-2 gap-1.5">
                                    <select value={condition.operator} aria-label={t("builder.condition.operator")}
                                            onChange={e => setCondition({operator: e.target.value as ConditionOperator})} className={cx(input, "h-9")}>
                                        {operatorsFor(controller).map(op => <option key={op} value={op}>{t(`builder.condition.op.${op}`)}</option>)}
                                    </select>
                                    {condition.operator !== "NOT_EMPTY" && (
                                        WITH_OPTIONS.includes(controller.type) ? (
                                            <select value={condition.value ?? ""} aria-label={t("builder.condition.value")}
                                                    onChange={e => setCondition({value: e.target.value})} className={cx(input, "h-9")}>
                                                {(controller.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        ) : (
                                            <input value={condition.value ?? ""} aria-label={t("builder.condition.value")}
                                                   type={controller.type === "NUMBER" || controller.type === "RATING" ? "number" : "text"}
                                                   onChange={e => setCondition({value: e.target.value})} className={cx(input, "h-9")}/>
                                        )
                                    )}
                                </div>
                            )}
                            <span className="text-xs text-mu">{t("builder.condition.operators")}</span>
                        </>
                    )}
                </div>
            )}
        </>
    );
}

/**
 * «Поля» (ТЗ 5.3): the fields on the left (drag or ⌥↑/⌥↓ to order, «+ Добавить
 * поле»), the form on the canvas as respondents see it, the selected field's
 * properties on the right. Removing a field others depend on asks first and
 * drops those conditions.
 */
export default function FieldsTab({fields, onChange, focusFieldId}: {
    fields: FormField[];
    onChange: (fields: FormField[]) => void;
    /** A field to select (e.g. from a publishing error). */
    focusFieldId?: string | null;
}) {
    const {t} = useTranslation();
    const [selectedId, setSelectedId] = useState<string | null>(focusFieldId ?? fields[0]?.id ?? null);
    const [lastFocus, setLastFocus] = useState(focusFieldId);
    if (focusFieldId !== lastFocus) {
        setLastFocus(focusFieldId);
        if (focusFieldId) setSelectedId(focusFieldId);
    }
    const [overId, setOverId] = useState<string | null>(null);
    const [removing, setRemoving] = useState<FormField | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}));
    const selected = fields.find(f => f.id === selectedId) ?? null;

    const add = (type: FieldType) => {
        const field = newField(type, t(`builder.newLabel.${type}`), n => t("builder.optionN", {n}));
        const at = selected ? fields.indexOf(selected) + 1 : fields.length;
        onChange([...fields.slice(0, at), field, ...fields.slice(at)]);
        setSelectedId(field.id);
    };
    const update = (id: string, patch: Partial<FormField>) => onChange(fields.map(f => (f.id === id ? {...f, ...patch} : f)));
    const move = (id: string, delta: number) => {
        const from = fields.findIndex(f => f.id === id);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= fields.length) return;
        onChange(arrayMove(fields, from, to));
    };
    const duplicate = (field: FormField) => {
        const copy = {...structuredClone(field), id: `f_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
            label: field.label ? t("builder.fields.copyOf", {label: field.label}) : ""};
        const at = fields.indexOf(field) + 1;
        onChange([...fields.slice(0, at), copy, ...fields.slice(at)]);
        setSelectedId(copy.id);
    };
    const dependents = (field: FormField) => fields.filter(f => f.condition?.fieldId === field.id);
    const remove = (field: FormField) => {
        const next = fields.filter(f => f.id !== field.id)
            .map(f => (f.condition?.fieldId === field.id ? {...f, condition: null} : f));
        onChange(next);
        if (selectedId === field.id) setSelectedId(next[0]?.id ?? null);
    };
    const askRemove = (field: FormField) => (dependents(field).length ? setRemoving(field) : remove(field));

    const onDragOver = (e: DragOverEvent) => setOverId(e.over ? String(e.over.id) : null);
    const onDragEnd = (e: DragEndEvent) => {
        setOverId(null);
        if (!e.over || e.active.id === e.over.id) return;
        const from = fields.findIndex(f => f.id === e.active.id);
        const to = fields.findIndex(f => f.id === e.over!.id);
        if (from >= 0 && to >= 0) onChange(arrayMove(fields, from, to));
    };

    return (
        <div className="flex flex-1 flex-wrap items-stretch">
            <aside className="box-border flex max-w-full flex-[1_1_260px] flex-col gap-2.5 border-r border-bd bg-sf px-3 py-4">
                <div className="flex items-center justify-between px-1.5">
                    <span className="text-xs font-bold uppercase tracking-[0.06em] text-mu">{t("builder.fields.count", {count: fields.length})}</span>
                    <span className="text-[11px] text-mu">{t("builder.fields.orderHint")}</span>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={onDragOver} onDragEnd={onDragEnd}
                            onDragCancel={() => setOverId(null)}>
                    <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                        <ol className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label={t("builder.fields.list")}>
                            {fields.map((f, i) => (
                                <ListItem key={f.id} field={f} index={i} selected={f.id === selectedId} insertBefore={overId === f.id}
                                          onSelect={() => setSelectedId(f.id)} onMove={delta => move(f.id, delta)}/>
                            ))}
                        </ol>
                    </SortableContext>
                </DndContext>
                {fields.length === 0 && <p className="m-0 px-1.5 text-[13px] text-mu">{t("builder.fields.empty")}</p>}
                <div className="mt-1.5 flex flex-col gap-2 rounded-xl border border-dashed border-bd p-2.5">
                    <span className="text-xs font-semibold text-mu"><FiPlus className="inline" size={12} aria-hidden="true"/> {t("builder.fields.add")}</span>
                    <div className="grid grid-cols-2 gap-1">
                        {PALETTE.map(type => {
                            const Icon = TYPE_ICON[type];
                            return (
                                <button key={type} type="button" onClick={() => add(type)}
                                        className="flex h-8 items-center gap-1.5 rounded-lg border border-bd bg-sf px-2 text-left text-xs text-tx hover:border-pr hover:bg-prs">
                                    <Icon size={13} aria-hidden="true" className="flex-none text-mu"/>
                                    <span className="truncate">{t(`wizard.fields.types.${type}.label`)}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </aside>

            <section aria-label={t("builder.fields.canvas")} className="flex min-w-0 flex-[999_1_460px] justify-center bg-bg px-6 py-7">
                <div className="flex w-full max-w-[640px] flex-col gap-3">
                    {fields.map(f => {
                        const isSelected = f.id === selectedId;
                        return (
                            <div key={f.id}>
                                {overId === f.id && <div className="mb-3 h-1 rounded bg-pr opacity-60" aria-hidden="true"/>}
                                <div role="button" tabIndex={0} onClick={() => setSelectedId(f.id)}
                                     onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelectedId(f.id))}
                                     aria-pressed={isSelected}
                                     className={cx("relative flex cursor-pointer flex-col gap-2 rounded-[14px] bg-sf px-6 py-[18px] text-left",
                                         isSelected ? "border-2 border-pr shadow-[0_0_0_4px_rgb(var(--prs))]" : "border border-bd hover:border-pr")}>
                                    {isSelected && (
                                        <>
                                            <span className="absolute -top-[11px] left-4 rounded-md bg-pr px-2 py-0.5 text-[11px] font-semibold text-white">
                                                {t("builder.fields.selected", {type: t(`wizard.fields.types.${f.type}.label`)})}
                                            </span>
                                            <span className="absolute right-2.5 top-2.5 flex gap-0.5">
                                                <button type="button" onClick={e => (e.stopPropagation(), duplicate(f))} aria-label={t("builder.fields.duplicate")}
                                                        className="grid h-7 w-7 place-items-center rounded-[7px] bg-s2 text-mu hover:text-tx">
                                                    <FiCopy size={14} aria-hidden="true"/>
                                                </button>
                                                <button type="button" onClick={e => (e.stopPropagation(), askRemove(f))} aria-label={t("builder.fields.remove")}
                                                        className="grid h-7 w-7 place-items-center rounded-[7px] bg-s2 text-mu hover:text-rdt">
                                                    <FiTrash2 size={14} aria-hidden="true"/>
                                                </button>
                                            </span>
                                        </>
                                    )}
                                    <CanvasField field={f} fields={fields}/>
                                </div>
                            </div>
                        );
                    })}
                    {fields.length === 0 && (
                        <div className="grid h-40 place-items-center rounded-[14px] border border-dashed border-bd text-sm text-mu">
                            {t("builder.fields.emptyCanvas")}
                        </div>
                    )}
                </div>
            </section>

            <aside aria-label={t("builder.inspector.label")}
                   className="box-border flex max-w-full flex-[1_1_320px] flex-col gap-4 border-l border-bd bg-sf p-[18px]">
                {selected
                    ? <Inspector key={selected.id} field={selected} fields={fields} onUpdate={patch => update(selected.id, patch)}/>
                    : <p className="m-0 text-sm text-mu">{t("builder.inspector.none")}</p>}
            </aside>

            <ConfirmDialog open={removing !== null} title={t("builder.fields.removeTitle")}
                           text={removing && t("builder.fields.removeText", {
                               label: removing.label, count: dependents(removing).length,
                               list: dependents(removing).map(f => `«${f.label}»`).join(", "),
                           })}
                           confirmLabel={t("builder.fields.remove")}
                           onConfirm={() => {
                               if (removing) remove(removing);
                               setRemoving(null);
                           }}
                           onCancel={() => setRemoving(null)}/>
        </div>
    );
}

