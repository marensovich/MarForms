import {type KeyboardEvent, type ReactNode} from "react";
import {FiArrowDown, FiArrowUp, FiChevronLeft, FiChevronRight} from "react-icons/fi";
import {useTranslation} from "react-i18next";
import {cx} from "./cx";
import {ErrorState, Skeleton} from "./Display";
import {pageList} from "./helpers";

// Docs: docs/design/mockups/Components.dc.html — "Таблица · bulk, сортировка, hover, пагинация"; ТЗ 6.0.

export interface Column<T> {
    key: string;
    header: ReactNode;
    /** CSS width of the column (px or %); the rest share what is left. */
    width?: string;
    sortable?: boolean;
    align?: "left" | "right" | "center";
    render: (row: T) => ReactNode;
}

export interface SortState {
    key: string;
    dir: "asc" | "desc";
}

export interface PaginationState {
    /** 0-based, as the API's Spring pages. */
    page: number;
    pageCount: number;
    total: number;
    onPageChange: (page: number) => void;
}

export function Pagination({page, pageCount, total, onPageChange}: PaginationState) {
    const {t} = useTranslation();
    if (pageCount <= 0) return null;
    const current = page + 1;
    const btn = "grid h-7 min-w-7 place-items-center rounded-md px-1.5 tabular-nums hover:bg-s2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr disabled:opacity-40 disabled:hover:bg-transparent";
    return (
        <nav aria-label={t("ui.pagination")} className="flex items-center justify-between gap-3 border-t border-bd px-3 py-2 text-xs text-mu">
            <span>{t("ui.pageOf", {page: current, pages: pageCount, total})}</span>
            <span className="flex items-center gap-0.5">
                <button type="button" className={btn} disabled={current === 1} onClick={() => onPageChange(page - 1)}
                        aria-label={t("ui.prevPage")}><FiChevronLeft size={14} aria-hidden="true"/></button>
                {pageList(current, pageCount).map((p, i) => p === "…"
                    ? <span key={`gap-${i}`} className="px-1">…</span>
                    : <button key={p} type="button" className={cx(btn, p === current && "font-bold text-prt")}
                              aria-current={p === current ? "page" : undefined} onClick={() => onPageChange(p - 1)}>{p}</button>)}
                <button type="button" className={btn} disabled={current === pageCount} onClick={() => onPageChange(page + 1)}
                        aria-label={t("ui.nextPage")}><FiChevronRight size={14} aria-hidden="true"/></button>
            </span>
        </nav>
    );
}

export interface DataTableProps<T> {
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    /** Accessible name of the table. */
    caption: string;
    loading?: boolean;
    skeletonRows?: number;
    error?: { message: ReactNode; code?: string } | null;
    onRetry?: () => void;
    /** Shown when there are no rows (EmptyState). */
    empty?: ReactNode;
    sort?: SortState | null;
    onSortChange?: (sort: SortState) => void;
    selectable?: boolean;
    selected?: Set<string>;
    onSelectedChange?: (selected: Set<string>) => void;
    /** Bulk actions, shown above the table while rows are selected. */
    bulkActions?: ReactNode;
    /** Row actions, revealed on hover or keyboard focus. */
    rowActions?: (row: T) => ReactNode;
    onRowClick?: (row: T) => void;
    pagination?: PaginationState;
    /** Lets the header stick: the table scrolls inside a box of this height. */
    maxHeight?: number | string;
    /** Below this width the table scrolls sideways inside its box (1024 px, ТЗ 8.2). */
    minWidth?: number;
}

export function DataTable<T>(props: DataTableProps<T>) {
    const {t} = useTranslation();
    const {columns, rows, rowKey, caption, loading, skeletonRows = 5, error, onRetry, empty, sort, onSortChange,
        selectable, selected = new Set<string>(), onSelectedChange, bulkActions, rowActions, onRowClick, pagination,
        maxHeight, minWidth = 720} = props;

    const pageKeys = rows.map(rowKey);
    const allSelected = pageKeys.length > 0 && pageKeys.every(k => selected.has(k));
    const someSelected = pageKeys.some(k => selected.has(k));
    const toggleAll = () => {
        const next = new Set(selected);
        pageKeys.forEach(k => allSelected ? next.delete(k) : next.add(k));
        onSelectedChange?.(next);
    };
    const toggle = (key: string) => {
        const next = new Set(selected);
        if (next.has(key)) next.delete(key); else next.add(key);
        onSelectedChange?.(next);
    };
    const onSort = (key: string) => onSortChange?.({key, dir: sort?.key === key && sort.dir === "desc" ? "asc" : "desc"});
    const onRowKey = (e: KeyboardEvent, row: T) => {
        if (onRowClick && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onRowClick(row);
        }
    };
    const span = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
    const alignCls = (a?: string) => a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

    return (
        <div className="flex flex-col gap-2">
            {selectable && selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-prs bg-prs px-3 py-2 text-[13px] text-prt">
                    <span className="font-semibold">{t("ui.selected", {count: selected.size})}</span>
                    <span className="flex flex-1 flex-wrap gap-2">{bulkActions}</span>
                    <button type="button" onClick={() => onSelectedChange?.(new Set())}
                            className="rounded font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr">
                        {t("ui.clearSelection")}
                    </button>
                </div>
            )}
            <div className="overflow-hidden rounded-xl border border-bd bg-sf text-[13px]">
                <div className="overflow-auto" style={{maxHeight}}>
                    <table aria-label={caption} aria-busy={loading || undefined}
                           className="w-full table-fixed border-collapse" style={{minWidth}}>
                        <colgroup>
                            {selectable && <col style={{width: 36}}/>}
                            {columns.map(c => <col key={c.key} style={c.width ? {width: c.width} : undefined}/>)}
                            {rowActions && <col style={{width: 140}}/>}
                        </colgroup>
                        <thead className="sticky top-0 z-10 bg-s2 text-xs font-semibold text-mu">
                        <tr>
                            {selectable && (
                                <th scope="col" className="px-3 py-[9px] text-left">
                                    <input type="checkbox" className="h-3.5 w-3.5 accent-pr" aria-label={t("ui.selectAll")}
                                           checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                           onChange={toggleAll} disabled={rows.length === 0}/>
                                </th>
                            )}
                            {columns.map(c => {
                                const active = sort?.key === c.key;
                                return (
                                    <th key={c.key} scope="col" className={cx("px-3 py-[9px] font-semibold", alignCls(c.align))}
                                        aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                                        {c.sortable && onSortChange ? (
                                            <button type="button" onClick={() => onSort(c.key)}
                                                    className={cx("inline-flex items-center gap-1 rounded hover:text-tx focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr",
                                                        active && "text-tx")}>
                                                {c.header}
                                                {active && (sort!.dir === "asc" ? <FiArrowUp size={12} aria-hidden="true"/> : <FiArrowDown size={12} aria-hidden="true"/>)}
                                            </button>
                                        ) : c.header}
                                    </th>
                                );
                            })}
                            {rowActions && <th scope="col"><span className="sr-only">{t("ui.actions")}</span></th>}
                        </tr>
                        </thead>
                        <tbody>
                        {loading && Array.from({length: skeletonRows}, (_, i) => (
                            <tr key={`sk-${i}`} className="border-t border-bd">
                                {selectable && <td className="px-3 py-3"><Skeleton className="h-3.5 w-3.5 rounded"/></td>}
                                {columns.map((c, j) => (
                                    <td key={c.key} className="px-3 py-3"><Skeleton className={cx("h-2.5", j === 0 ? "w-3/5" : "w-2/5")}/></td>
                                ))}
                                {rowActions && <td/>}
                            </tr>
                        ))}
                        {!loading && error && (
                            <tr className="border-t border-bd"><td colSpan={span} className="p-3">
                                <ErrorState title={t("ui.loadFailed")} text={error.message} code={error.code}
                                            onRetry={onRetry} retryLabel={t("ui.retry")}/>
                            </td></tr>
                        )}
                        {!loading && !error && rows.length === 0 && empty && (
                            <tr className="border-t border-bd"><td colSpan={span} className="p-3">{empty}</td></tr>
                        )}
                        {!loading && !error && rows.map(row => {
                            const key = rowKey(row);
                            const isSelected = selected.has(key);
                            return (
                                <tr key={key} tabIndex={onRowClick ? 0 : undefined}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined} onKeyDown={e => onRowKey(e, row)}
                                    aria-selected={selectable ? isSelected : undefined}
                                    className={cx("group border-t border-bd align-middle transition-colors",
                                        isSelected ? "bg-prs" : "hover:bg-bg",
                                        onRowClick && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pr")}>
                                    {selectable && (
                                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" className="h-3.5 w-3.5 accent-pr" checked={isSelected}
                                                   onChange={() => toggle(key)} aria-label={t("ui.selectRow")}/>
                                        </td>
                                    )}
                                    {columns.map(c => (
                                        <td key={c.key} className={cx("truncate px-3 py-2.5 text-tx", alignCls(c.align))}>{c.render(row)}</td>
                                    ))}
                                    {rowActions && (
                                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                                {rowActions(row)}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
                {pagination && !error && <Pagination {...pagination}/>}
            </div>
        </div>
    );
}

/** Small bordered button for table row actions ("Открыть", "Удал."). */
export function RowAction({children, onClick, danger, label}: { children: ReactNode; onClick: () => void; danger?: boolean; label?: string }) {
    return (
        <button type="button" onClick={onClick} aria-label={label}
                className={cx("rounded-md border border-bd bg-sf px-1.5 py-[3px] text-[11px] hover:bg-s2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pr",
                    danger ? "text-rdt" : "text-mu hover:text-tx")}>
            {children}
        </button>
    );
}
