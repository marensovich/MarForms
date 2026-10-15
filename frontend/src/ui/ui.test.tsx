// @vitest-environment jsdom
import {act, cleanup, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {useState} from "react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {
    Combobox,
    ConfirmDialog,
    DataTable,
    DateTimePicker,
    Field,
    Input,
    Modal,
    pageList,
    SegmentedControl,
    Switch,
    Tabs,
    ToastProvider,
    useToast,
} from "./index";
import {areaPoints, monthGrid, parseLocal, timeSlots} from "./helpers";

// Without an i18n instance react-i18next returns keys; the tests check behaviour, not copy.
afterEach(cleanup);

describe("Modal", () => {
    function Harness({onClose}: { onClose: () => void }) {
        const [open, setOpen] = useState(false);
        return (
            <>
                <button onClick={() => setOpen(true)}>open</button>
                <Modal open={open} onClose={() => { onClose(); setOpen(false); }} title="Title"
                       footer={<><button>first</button><button>last</button></>}/>
            </>
        );
    }

    it("traps Tab, closes on Escape and returns focus to the opener", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Harness onClose={onClose}/>);
        const opener = screen.getByText("open");
        await user.click(opener);
        const dialog = screen.getByRole("dialog");
        expect(dialog.contains(document.activeElement)).toBe(true);

        for (let i = 0; i < 5; i++) await user.tab();
        expect(dialog.contains(document.activeElement)).toBe(true);
        await user.tab({shift: true});
        expect(dialog.contains(document.activeElement)).toBe(true);

        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledOnce();
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.activeElement).toBe(opener);
    });
});

describe("ConfirmDialog", () => {
    it("keeps confirm disabled until the slug is typed", async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(<ConfirmDialog open title="Delete" confirmLabel="Delete it" onConfirm={onConfirm} onCancel={() => {}}
                              requireText="lspd-academy"/>);
        const confirm = screen.getByRole("button", {name: "Delete it"});
        expect(confirm).toHaveProperty("disabled", true);
        await user.keyboard("lspd");
        expect(confirm).toHaveProperty("disabled", true);
        await user.keyboard("-academy");
        expect(confirm).toHaveProperty("disabled", false);
        await user.click(confirm);
        expect(onConfirm).toHaveBeenCalledOnce();
    });
});

describe("Combobox", () => {
    const options = [
        {value: "1", label: "Стажёр LSPD", meta: "48"},
        {value: "2", label: "Старший офицер"},
        {value: "3", label: "Стафф", disabled: true, disabledReason: "уже в запрещённых"},
        {value: "4", label: "Гражданин"},
    ];

    it("filters, skips disabled options with arrows and picks with Enter", async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(<Combobox options={options} onSelect={onSelect} ariaLabel="Роль" emptyText="none"/>);
        await user.click(screen.getByRole("combobox"));
        await user.keyboard("Ста");
        expect(screen.getAllByRole("option")).toHaveLength(3);
        await user.keyboard("{ArrowDown}{ArrowDown}");
        // 0 → 1, then 2 is disabled → wraps to 0
        await user.keyboard("{Enter}");
        expect(onSelect).toHaveBeenCalledWith("1");
    });

    it("Escape closes the list without selecting", async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(<Combobox options={options} onSelect={onSelect} ariaLabel="Роль" emptyText="none"/>);
        await user.click(screen.getByRole("combobox"));
        expect(screen.getByRole("listbox")).toBeTruthy();
        await user.keyboard("{Escape}");
        expect(screen.queryByRole("listbox")).toBeNull();
        expect(onSelect).not.toHaveBeenCalled();
    });
});

describe("Tabs and SegmentedControl", () => {
    it("tabs move with arrow keys and wrap around", async () => {
        const user = userEvent.setup();
        function Harness() {
            const [v, setV] = useState<"a" | "b" | "c">("a");
            return <Tabs ariaLabel="t" value={v} onChange={setV}
                         items={[{id: "a", label: "A"}, {id: "b", label: "B", count: 12}, {id: "c", label: "C"}]}/>;
        }
        render(<Harness/>);
        await user.click(screen.getByRole("tab", {name: "A"}));
        await user.keyboard("{ArrowRight}");
        expect(screen.getByRole("tab", {name: /B/}).getAttribute("aria-selected")).toBe("true");
        expect(document.activeElement).toBe(screen.getByRole("tab", {name: /B/}));
        await user.keyboard("{ArrowLeft}{ArrowLeft}");
        expect(screen.getByRole("tab", {name: "C"}).getAttribute("aria-selected")).toBe("true");
    });

    it("segmented control is a radio group driven by arrows", async () => {
        const user = userEvent.setup();
        function Harness() {
            const [v, setV] = useState<"all" | "users">("all");
            return <SegmentedControl ariaLabel="view" value={v} onChange={setV}
                                     options={[{value: "all", label: "Все"}, {value: "users", label: "По пользователям"}]}/>;
        }
        render(<Harness/>);
        await user.click(screen.getByRole("radio", {name: "Все"}));
        await user.keyboard("{ArrowRight}");
        expect(screen.getByRole("radio", {name: "По пользователям"}).getAttribute("aria-checked")).toBe("true");
    });
});

describe("Switch", () => {
    it("toggles with Space and Enter", async () => {
        const user = userEvent.setup();
        function Harness() {
            const [on, setOn] = useState(false);
            return <Switch checked={on} onChange={setOn} ariaLabel="Включено"/>;
        }
        render(<Harness/>);
        const sw = screen.getByRole("switch");
        sw.focus();
        await user.keyboard(" ");
        expect(sw.getAttribute("aria-checked")).toBe("true");
        await user.keyboard("{Enter}");
        expect(sw.getAttribute("aria-checked")).toBe("false");
    });
});

describe("Field", () => {
    it("ties the error to the control", () => {
        render(<Field label="Возраст" error="Введите число"><Input/></Field>);
        const input = screen.getByLabelText("Возраст");
        expect(input.getAttribute("aria-invalid")).toBe("true");
        const describedBy = input.getAttribute("aria-describedby")!;
        expect(document.getElementById(describedBy)?.textContent).toContain("Введите число");
    });
});

describe("DataTable", () => {
    const rows = [{id: "a", title: "Набор в LSPD", n: 1284}, {id: "b", title: "Набор в EMS", n: 642}];
    const columns = [
        {key: "title", header: "Название", render: (r: typeof rows[0]) => r.title},
        {key: "n", header: "Заявки", sortable: true, render: (r: typeof rows[0]) => r.n},
    ];

    it("sorts, selects all and opens a row with Enter", async () => {
        const user = userEvent.setup();
        const onSort = vi.fn();
        const onSelected = vi.fn();
        const onRow = vi.fn();
        render(<DataTable caption="Формы" columns={columns} rows={rows} rowKey={r => r.id} onSortChange={onSort}
                          selectable selected={new Set()} onSelectedChange={onSelected} onRowClick={onRow}/>);
        await user.click(screen.getByRole("button", {name: "Заявки"}));
        expect(onSort).toHaveBeenCalledWith({key: "n", dir: "desc"});
        await user.click(screen.getByRole("checkbox", {name: "ui.selectAll"}));
        expect([...onSelected.mock.calls[0][0]]).toEqual(["a", "b"]);
        screen.getByText("Набор в EMS").closest("tr")!.focus();
        await user.keyboard("{Enter}");
        expect(onRow).toHaveBeenCalledWith(rows[1]);
    });

    it("shows the error state with retry instead of rows", async () => {
        const user = userEvent.setup();
        const onRetry = vi.fn();
        render(<DataTable caption="Формы" columns={columns} rows={rows} rowKey={r => r.id}
                          error={{message: "Сервер не ответил", code: "ERR 502"}} onRetry={onRetry}/>);
        expect(screen.queryByText("Набор в LSPD")).toBeNull();
        await user.click(screen.getByRole("button", {name: "ui.retry"}));
        expect(onRetry).toHaveBeenCalledOnce();
    });

    it("lists pages with gaps around the current one", () => {
        expect(pageList(2, 14)).toEqual([1, 2, 3, "…", 14]);
        expect(pageList(7, 14)).toEqual([1, "…", 6, 7, 8, "…", 14]);
        expect(pageList(3, 5)).toEqual([1, 2, 3, 4, 5]);
    });
});

describe("DateTimePicker", () => {
    it("builds a Monday-first month and time slots with 23:59", () => {
        const oct = monthGrid(2026, 9); // 1 Oct 2026 is a Thursday
        expect(oct.slice(0, 3)).toEqual([null, null, null]);
        expect(oct[3]?.getDate()).toBe(1);
        expect(oct.filter(Boolean)).toHaveLength(31);
        expect(timeSlots(30)).toHaveLength(49);
        expect(timeSlots(30).at(-1)).toBe("23:59");
        expect(parseLocal("2026-10-31T23:59:00")).toEqual({date: "2026-10-31", time: "23:59"});
        expect(parseLocal(null)).toBeNull();
    });

    it("picks a day with the keyboard and keeps the time", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<DateTimePicker value="2026-10-15T18:00" onChange={onChange} ariaLabel="Закрытие"/>);
        await user.click(screen.getByRole("button", {name: "Закрытие"}));
        await user.keyboard("{ArrowRight}{ArrowDown}{Enter}");
        expect(onChange).toHaveBeenLastCalledWith("2026-10-23T18:00");
        await user.click(screen.getByRole("option", {name: "23:59"}));
        expect(onChange).toHaveBeenLastCalledWith("2026-10-15T23:59");
        await user.keyboard("{Escape}");
    });
});

describe("Toast", () => {
    it("shows a message with an action and hides after the action", async () => {
        const user = userEvent.setup();
        const undo = vi.fn();
        function Trigger() {
            const toast = useToast();
            return <button onClick={() => toast({text: "Заявка принята", action: {label: "Отменить", onClick: undo}})}>go</button>;
        }
        render(<ToastProvider><Trigger/></ToastProvider>);
        await user.click(screen.getByText("go"));
        expect(screen.getByText("Заявка принята")).toBeTruthy();
        await user.click(screen.getByRole("button", {name: "Отменить"}));
        expect(undo).toHaveBeenCalledOnce();
        expect(screen.queryByText("Заявка принята")).toBeNull();
    });

    it("disappears on its own", () => {
        vi.useFakeTimers();
        function Trigger() {
            const toast = useToast();
            return <button onClick={() => toast({text: "Сохранено", duration: 1000})}>go</button>;
        }
        render(<ToastProvider><Trigger/></ToastProvider>);
        act(() => screen.getByText("go").click());
        expect(screen.getByText("Сохранено")).toBeTruthy();
        act(() => { vi.advanceTimersByTime(1100); });
        expect(screen.queryByText("Сохранено")).toBeNull();
        vi.useRealTimers();
    });
});

describe("areaPoints", () => {
    it("scales values into the box, highest at the top padding", () => {
        expect(areaPoints([0, 50, 100], 160, 50)).toEqual([[0, 50], [80, 27], [160, 4]]);
        expect(areaPoints([], 160, 50)).toEqual([]);
    });
});
