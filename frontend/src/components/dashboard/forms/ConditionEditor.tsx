import {useTranslation} from "react-i18next";
import {FiGitBranch} from "react-icons/fi";
import {type ConditionOperator, type FieldCondition, type FormField, isInputField} from "../../../types/forms";

const CHOICE_TYPES = ["SELECT", "MULTI_SELECT", "RADIO", "CHECKBOX"];

/** Which comparisons make sense for the controlling field's type. */
function operatorsFor(field: FormField): ConditionOperator[] {
    const hasOptions = CHOICE_TYPES.includes(field.type) && (field.options?.length ?? 0) > 0;
    if (hasOptions) return ["EQUALS", "NOT_EQUALS", "NOT_EMPTY", "EMPTY"];
    if (field.type === "BOOLEAN" || field.type === "CHECKBOX" || field.type === "FILE_UPLOAD") return ["NOT_EMPTY", "EMPTY"];
    if (field.type === "NUMBER" || field.type === "RATING") {
        return ["EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN", "NOT_EMPTY", "EMPTY"];
    }
    return ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_EMPTY", "EMPTY"];
}

function operatorLabelKey(op: ConditionOperator, controller: FormField): string {
    if (controller.type === "FILE_UPLOAD") return `wizard.fields.condition.operators.file.${op}`;
    if (controller.type === "BOOLEAN" || (controller.type === "CHECKBOX" && !(controller.options?.length))) {
        return `wizard.fields.condition.operators.checkbox.${op}`;
    }
    return `wizard.fields.condition.operators.${op}`;
}

const selectCls = "w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-sm text-[#1E1E24] outline-none focus:border-[#3730A3]";

/**
 * "Show this field only if …" (E3.1). The server re-checks the condition
 * (it must point at another field, with a sensible value, without loops).
 */
export default function ConditionEditor({field, allFields, onChange}: {
    field: FormField;
    allFields: FormField[];
    onChange: (condition: FieldCondition | null) => void;
}) {
    const {t} = useTranslation();
    const candidates = allFields.filter(f => f.id !== field.id && isInputField(f));
    const condition = field.condition ?? null;
    const controller = condition ? candidates.find(f => f.id === condition.fieldId) ?? null : null;

    const start = (controllerField: FormField) => {
        const op = operatorsFor(controllerField)[0];
        onChange({
            fieldId: controllerField.id,
            operator: op,
            value: op === "EQUALS" && controllerField.options?.length ? controllerField.options[0] : "",
        });
    };

    if (candidates.length === 0) {
        return <p className="text-xs text-[#8B8B96]">{t("wizard.fields.condition.noCandidates")}</p>;
    }

    return (
        <div className="space-y-3 rounded-xl border border-[#E4E4E7] bg-white p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#1E1E24]">
                <input
                    type="checkbox"
                    checked={!!condition}
                    onChange={e => (e.target.checked ? start(candidates[0]) : onChange(null))}
                    className="accent-[#3730A3]"
                />
                <FiGitBranch size={13} className="text-[#8B8B96]"/>
                {t("wizard.fields.condition.toggle")}
            </label>

            {condition && (
                <div className="space-y-2">
                    <select
                        value={controller?.id ?? ""}
                        onChange={e => {
                            const next = candidates.find(f => f.id === e.target.value);
                            if (next) start(next);
                        }}
                        className={selectCls}
                    >
                        {!controller && <option value="">{t("wizard.fields.condition.missingField")}</option>}
                        {candidates.map(f => (
                            <option key={f.id} value={f.id}>{f.label || t("wizard.fields.condition.untitled")}</option>
                        ))}
                    </select>

                    {controller && (
                        <>
                            <select
                                value={condition.operator}
                                onChange={e => onChange({...condition, operator: e.target.value as ConditionOperator})}
                                className={selectCls}
                            >
                                {operatorsFor(controller).map(op => (
                                    <option key={op} value={op}>{t(operatorLabelKey(op, controller))}</option>
                                ))}
                            </select>

                            {condition.operator !== "EMPTY" && condition.operator !== "NOT_EMPTY" && (
                                controller.options?.length && CHOICE_TYPES.includes(controller.type)
                                && (condition.operator === "EQUALS" || condition.operator === "NOT_EQUALS") ? (
                                    <select
                                        value={condition.value ?? ""}
                                        onChange={e => onChange({...condition, value: e.target.value})}
                                        className={selectCls}
                                    >
                                        {controller.options.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type={controller.type === "NUMBER" || controller.type === "RATING" ? "number" : "text"}
                                        value={condition.value ?? ""}
                                        onChange={e => onChange({...condition, value: e.target.value})}
                                        placeholder={t("wizard.fields.condition.valuePlaceholder")}
                                        className={selectCls}
                                    />
                                )
                            )}
                        </>
                    )}
                    <p className="text-[11px] text-[#8B8B96]">{t("wizard.fields.condition.hint")}</p>
                </div>
            )}
        </div>
    );
}
