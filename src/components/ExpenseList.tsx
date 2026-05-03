import { useMemo, useState, Fragment } from "react";
import dayjs from "dayjs";
import type { CategoryDto, CreditAccountDto, ExpenseDto, LoanPaymentForMonthDto, PendingCreditPaymentDto, RecurringExpenseDto } from "../types";
import { ExpenseItem } from "./ExpenseItem";

type ExpenseListItem = 
  | (ExpenseDto & { date: string; isRecurring: false })
  | (Omit<RecurringExpenseDto, "id"> & { id: string; date: string; isRecurring: true; isPlanned?: boolean; recurringId?: string })
  | { id: string; date: string; categoryId: string; categoryName: string; subcategoryId?: string; subcategoryName?: string; amount: number; isRecurring: false; isPlanned: true; isCreditPayment: true; creditAccountType?: "CreditCard" | "Loan" }
  | { id: string; date: string; categoryId: string; categoryName: string; subcategoryId?: string; subcategoryName?: string; amount: number; isRecurring: false; isPlanned: true; isLoanPayment: true };

function getCategoryIcon(categories: CategoryDto[], categoryId: string, subcategoryId?: string | null): string {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return "📁";
  if (subcategoryId && cat.subcategories?.length) {
    const sub = cat.subcategories.find((s) => s.id === subcategoryId);
    if (sub?.icon) return sub.icon;
  }
  return cat.icon ?? "📁";
}

interface ExpenseListProps {
  expenses: ExpenseDto[];
  recurringExpenses: RecurringExpenseDto[];
  categories?: CategoryDto[];
  creditPayments?: PendingCreditPaymentDto[];
  loanPayments?: LoanPaymentForMonthDto[];
  creditAccounts?: CreditAccountDto[];
  selectedYear: number;
  selectedMonth: number;
  periodStartDate?: string;
  periodEndDate?: string;
  onEdit?: (expense: ExpenseDto) => void;
  onDelete?: (id: string) => void;
  onConfirmPlanned?: (id: string) => Promise<void>;
  onEditRecurring?: (recurringId: string) => void;
  onDeleteRecurring?: (recurringId: string) => void;
}

export function ExpenseList({
  expenses,
  recurringExpenses,
  categories = [],
  creditPayments = [],
  loanPayments = [],
  creditAccounts = [],
  selectedYear,
  selectedMonth,
  periodStartDate,
  periodEndDate,
  onEdit,
  onDelete,
  onConfirmPlanned,
  onEditRecurring,
  onDeleteRecurring,
}: ExpenseListProps) {
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<{ planned: boolean; actual: boolean }>({ planned: false, actual: false });

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryKey)) next.delete(categoryKey);
      else next.add(categoryKey);
      return next;
    });
  };

  const toggleSection = (section: "planned" | "actual") => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const allExpensesForMonth = useMemo(() => {
    const recurringExpensesForMonth: ExpenseListItem[] = [];

    recurringExpenses
      .filter((re) => re.isActive)
      .forEach((re) => {
        const start = dayjs(re.startDate);
        const end = re.endDate ? dayjs(re.endDate) : null;
        
        // Skip if start date is invalid
        if (!start.isValid()) return;
        
        // Skip if end date exists and is before start
        if (end && end.isBefore(start)) return;

        const selectedMonthStart = dayjs(`${selectedYear}-${selectedMonth}-01`);
        const selectedMonthEnd = selectedMonthStart.endOf("month");
        
        // Skip if start is after selected month end (for non-planned expenses)
        if (!re.isPlanned && start.isAfter(selectedMonthEnd)) return;
        
        // Calculate the iteration limit: for planned expenses, go until endDate or selectedMonthEnd + one period
        // For actual expenses, stop after selectedMonthEnd
        let iterationLimit: dayjs.Dayjs;
        const getPeriodUnit = () => {
          switch (re.frequency) {
            case "Weekly":
            case "BiWeekly":
              return "week";
            case "Monthly":
            case "Quarterly":
              return "month";
            case "Yearly":
              return "year";
            default:
              return "month";
          }
        };
        
        if (re.isPlanned) {
          // For planned expenses, iterate until endDate (if specified) or selectedMonthEnd + one period
          if (end) {
            iterationLimit = end.isBefore(selectedMonthEnd) ? end : selectedMonthEnd.add(1, getPeriodUnit());
          } else {
            // No endDate - iterate until selectedMonthEnd + one period
            iterationLimit = selectedMonthEnd.add(1, getPeriodUnit());
          }
        } else {
          // For actual expenses, only iterate until selectedMonthEnd
          iterationLimit = selectedMonthEnd;
        }
        
        // Safety: limit iterations to prevent infinite loops (max 1000 iterations)
        const maxIterations = 1000;
        let iterations = 0;
        let current = start;

        // If start is far in the past, fast-forward to ~1 year before selected month
        // to avoid 1000+ iterations (e.g. weekly recurrence since 2010)
        const safeStart = selectedMonthStart.subtract(1, "year");
        if (current.isBefore(safeStart)) {
          current = safeStart;
        }
        
        // Skip if current is already after iteration limit
        if (current.isAfter(iterationLimit)) return;
        
        while (current.isBefore(iterationLimit) || current.isSame(iterationLimit, "day")) {
          // Safety check: prevent infinite loops
          iterations++;
          if (iterations > maxIterations) {
            break;
          }
          
          // Stop if we've passed the end date
          if (end && current.isAfter(end)) break;
          
          // If this period falls in the selected month, add it (с учётом уже существующих фактов)
          if (current.month() + 1 === selectedMonth && current.year() === selectedYear) {
            const currentDateStr = current.format("YYYY-MM-DD");

            // Если по этой дате и категории уже есть хотя бы один фактический расход — плановую строку не показываем (план «исполнен»)
            const hasActualForThisDateAndCategory = expenses.some(
              (e) =>
                !e.isPlanned &&
                dayjs(e.expenseDate).format("YYYY-MM-DD") === currentDateStr &&
                e.categoryId === re.categoryId &&
                (e.subcategoryId ?? null) === (re.subcategoryId ?? null)
            );
            if (hasActualForThisDateAndCategory) continue;

            // Пропускаем повторяющийся расход «Кредиты», если его сумма совпадает с плановым платежом по кредиту — избегаем дублирования
            const isCreditRecurring =
              (re.categoryName?.toLowerCase() === "кредиты" || re.title?.toLowerCase() === "кредиты") ?? false;
            const matchesLoanPayment = loanPayments.some(
              (p) => Math.abs(p.paymentAmount - re.amount) < 0.01
            );
            const matchesCreditPayment = creditPayments.some(
              (p) => Math.abs(p.paymentAmount - re.amount) < 0.01
            );
            const isDuplicateOfCreditPayment = isCreditRecurring && (matchesLoanPayment || matchesCreditPayment);

            if (!isDuplicateOfCreditPayment) {
              recurringExpensesForMonth.push({
                id: `${re.id}-${currentDateStr}`,
                recurringId: re.id,
                date: currentDateStr,
                categoryId: re.categoryId,
                categoryName: re.categoryName,
                subcategoryId: re.subcategoryId,
                subcategoryName: re.subcategoryName,
                title: re.title,
                amount: re.amount,
                startDate: re.startDate,
                endDate: re.endDate,
                frequency: re.frequency,
                isActive: re.isActive,
                notes: re.notes,
                isRecurring: true,
                isPlanned: re.isPlanned || false,
              });
            }
          }

          // Move to next period
          const previousCurrent = current;
          switch (re.frequency) {
            case "Weekly":
              current = current.add(1, "week");
              break;
            case "BiWeekly":
              current = current.add(2, "weeks");
              break;
            case "Monthly":
              current = current.add(1, "month");
              break;
            case "Quarterly":
              current = current.add(3, "months");
              break;
            case "Yearly":
              current = current.add(1, "year");
              break;
            default:
              // Unknown frequency - break to prevent infinite loop
              console.warn(`ExpenseList: Unknown frequency "${re.frequency}" for recurring expense ${re.id}`);
              break;
          }
          
          // Safety check: ensure current is actually advancing
          if (current.isSame(previousCurrent) || current.isBefore(previousCurrent)) {
            console.warn(`ExpenseList: Date not advancing for recurring expense ${re.id}. Stopping iteration.`);
            break;
          }
          
          // Break if we've passed the iteration limit
          if (current.isAfter(iterationLimit)) break;
        }
      });

    // IDs of credit accounts/schedules that already have a factual expense this month
    const paidCreditScheduleIds = new Set(
      expenses
        .filter((e): e is ExpenseDto & { creditPaymentScheduleId: string } =>
          !!e.creditPaymentScheduleId
        )
        .map((e) => e.creditPaymentScheduleId)
    );
    const creditAccountTypeById = Object.fromEntries(creditAccounts.map((a) => [a.id, a.accountType]));
    const paidCreditAccountIds = new Set(
      expenses
        .filter((e): e is ExpenseDto & { creditAccountId: string } =>
          !!e.creditAccountId && creditAccountTypeById[e.creditAccountId] === "Loan"
        )
        .map((e) => e.creditAccountId)
    );

    // Convert credit payments to expense list format (плановые платежи по кредиту/кредитной карте)
    // Exclude planned payments that already have a confirmed (factual) expense
    const creditPaymentItems: ExpenseListItem[] = creditPayments
      .filter((p) => !paidCreditScheduleIds.has(p.paymentScheduleId))
      .map((p) => ({
        id: `credit-${p.paymentScheduleId}`,
        date: `${p.scheduledYear}-${String(p.scheduledMonth).padStart(2, "0")}-${String(p.scheduledDay ?? 1).padStart(2, "0")}`,
        categoryId: p.categoryId,
        categoryName: `${p.categoryName} (${p.creditAccountName})`,
        subcategoryId: p.subcategoryId ?? undefined,
        subcategoryName: p.subcategoryName ?? undefined,
        amount: p.paymentAmount,
        isRecurring: false as const,
        isPlanned: true,
        isCreditPayment: true as const,
        creditAccountType: p.creditAccountType ?? "CreditCard",
      }));

    // Convert loan payments to expense list format (плановые платежи по кредиту — Loan)
    // Exclude planned payments that already have a confirmed (factual) expense for that credit
    const loanPaymentItems: ExpenseListItem[] = loanPayments
      .filter((p) => !paidCreditAccountIds.has(p.creditAccountId))
      .map((p) => ({
        id: `loan-${p.creditAccountId}`,
        date: `${p.scheduledYear}-${String(p.scheduledMonth).padStart(2, "0")}-${String(p.scheduledDay ?? 1).padStart(2, "0")}`,
        categoryId: p.creditAccountId,
        categoryName: `Платеж по кредиту ${p.creditAccountName}`,
        subcategoryId: undefined,
        subcategoryName: undefined,
        amount: p.paymentAmount,
        isRecurring: false as const,
        isPlanned: true,
        isLoanPayment: true as const,
      }));

    // Combine expenses, recurring expenses, credit payments, and loan payments
    // Фактические расходы: по расписанию (CreditPaymentScheduleId) — платёж по карте/кредиту; по CreditAccountId — только Loan считаем «Платеж по кредиту», CreditCard — обычный расход (оплата картой)
    let combined = [
      ...expenses.map((e) => ({
        ...e,
        date: e.expenseDate,
        isRecurring: false as const,
        isPlanned: e.isPlanned || false,
        ...(e.creditPaymentScheduleId && { isCreditPayment: true as const, creditAccountType: "CreditCard" as const }),
        ...(e.creditAccountId && creditAccountTypeById[e.creditAccountId] === "Loan" && { isLoanPayment: true as const }),
      })),
      ...recurringExpensesForMonth,
      ...creditPaymentItems,
      ...loanPaymentItems,
    ];

    // Filter by period (1–15 or 16–end) when specified.
    // Платежи по кредиту/займу — помесячные, без привязки к дню полумесяца; всегда включаем их в «Планируемые расходы» за месяц.
    if (periodStartDate && periodEndDate) {
      const periodStart = dayjs(periodStartDate).startOf("day");
      const periodEnd = dayjs(periodEndDate).endOf("day");
      const isPlannedCreditOrLoan = (item: ExpenseListItem) =>
        !item.isRecurring &&
        (("isCreditPayment" in item && item.isCreditPayment) || ("isLoanPayment" in item && item.isLoanPayment));
      combined = combined.filter((item) => {
        if (isPlannedCreditOrLoan(item)) return true;
        const d = dayjs(item.date);
        return !d.isBefore(periodStart) && !d.isAfter(periodEnd);
      });
    }

    // Sort: by date, and внутри даты сначала план, потом факт
    return combined.sort((a, b) => {
      const da = dayjs(a.date).valueOf();
      const db = dayjs(b.date).valueOf();
      if (da !== db) return da - db;
      const ap = a.isPlanned ? 1 : 0;
      const bp = b.isPlanned ? 1 : 0;
      if (ap !== bp) return bp - ap; // плановые (1) выше факта (0)
      return 0;
    });
  }, [expenses, recurringExpenses, creditPayments, loanPayments, selectedYear, selectedMonth, periodStartDate, periodEndDate]);

  if (allExpensesForMonth.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
        Данные отсутствуют
      </div>
    );
  }

  const isItemPlanned = (x: ExpenseListItem) => "isPlanned" in x && !!(x as { isPlanned?: boolean }).isPlanned;
  const plannedItems = useMemo(() => allExpensesForMonth.filter(isItemPlanned), [allExpensesForMonth]);
  const actualItems = useMemo(() => allExpensesForMonth.filter((x) => !isItemPlanned(x)), [allExpensesForMonth]);

  type SubGroup = { groupId: string; categoryId: string; title: string; total: number; items: ExpenseListItem[]; icon: string };
  type CategoryGroup = { categoryId: string; categoryName: string; categoryIcon: string; total: number; subGroups: SubGroup[] };

  const groupItems = (items: ExpenseListItem[], idPrefix: string): { categoryGroups: CategoryGroup[]; creditLoanGroup: { groupId: string; title: string; total: number; items: ExpenseListItem[] } | null } => {
    const creditLoanItems = items.filter(
      (x) => !x.isRecurring && (("isCreditPayment" in x && x.isCreditPayment) || ("isLoanPayment" in x && x.isLoanPayment))
    );
    const categoryItems = items.filter(
      (x) =>
        !x.isRecurring &&
        !("isCreditPayment" in x && x.isCreditPayment) &&
        !("isLoanPayment" in x && x.isLoanPayment)
    );
    const recurringItems = items.filter((x) => x.isRecurring);
    // Группируем по (categoryId, subcategoryId)
    const byCategoryAndSub = new Map<string, ExpenseListItem[]>();
    const key = (cid: string, sid?: string | null) => `${cid}\t${sid ?? ""}`;
    for (const item of [...categoryItems, ...recurringItems]) {
      const k = key(item.categoryId, "subcategoryId" in item ? item.subcategoryId : undefined);
      const list = byCategoryAndSub.get(k) ?? [];
      list.push(item);
      byCategoryAndSub.set(k, list);
    }
    // Собираем по категориям, внутри — подгруппы по подкатегории
    const byCategory = new Map<string, { subcategoryId: string | null; items: ExpenseListItem[] }[]>();
    for (const [k, list] of byCategoryAndSub.entries()) {
      const [categoryId, subId] = k.split("\t");
      const subcategoryId = subId || null;
      const arr = byCategory.get(categoryId) ?? [];
      arr.push({ subcategoryId, items: list });
      byCategory.set(categoryId, arr);
    }
    const categoryGroups: CategoryGroup[] = Array.from(byCategory.entries())
      .map(([categoryId, subLists]) => {
        const firstItem = subLists[0]?.items[0];
        const categoryName = firstItem?.categoryName ?? categories.find((c) => c.id === categoryId)?.name ?? "Расходы";
        const categoryIcon = getCategoryIcon(categories, categoryId, undefined);
        const subGroups: SubGroup[] = subLists
          .map(({ subcategoryId, items: list }) => {
            const sortedItems = [...list].sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
            const total = sortedItems.reduce((sum, x) => sum + (x.amount || 0), 0);
            const first = sortedItems[0];
            const title = subcategoryId && first && "subcategoryName" in first && first.subcategoryName
              ? first.subcategoryName
              : categoryName;
            const icon = getCategoryIcon(categories, categoryId, subcategoryId);
            return {
              groupId: `${idPrefix}cat-${categoryId}-${subcategoryId ?? "main"}`,
              categoryId,
              title,
              total,
              items: sortedItems,
              icon,
            };
          })
          .sort((a, b) => {
            // Сначала без подкатегории (title === categoryName), потом по title
            const aNoSub = a.title === categoryName ? 0 : 1;
            const bNoSub = b.title === categoryName ? 0 : 1;
            if (aNoSub !== bNoSub) return aNoSub - bNoSub;
            return (a.title || "").localeCompare(b.title || "", "ru");
          });
        const total = subGroups.reduce((s, g) => s + g.total, 0);
        return { categoryId, categoryName, categoryIcon, total, subGroups };
      })
      .sort((a, b) => (a.categoryName || "").localeCompare(b.categoryName || "", "ru"));
    const creditLoanGroup =
      creditLoanItems.length > 0
        ? {
            groupId: `${idPrefix}credit-loan`,
            title: "Платежи по кредитам",
            total: creditLoanItems.reduce((sum, x) => sum + (x.amount || 0), 0),
            items: [...creditLoanItems].sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()),
          }
        : null;
    return { categoryGroups, creditLoanGroup };
  };

  const plannedGrouped = useMemo(() => groupItems(plannedItems, "planned-"), [plannedItems]);
  const actualGrouped = useMemo(() => groupItems(actualItems, "actual-"), [actualItems]);
  const plannedTotal = plannedItems.reduce((sum, x) => sum + (x.amount || 0), 0);
  const actualTotal = actualItems.reduce((sum, x) => sum + (x.amount || 0), 0);

  const renderGroup = (
    groupId: string,
    title: string,
    total: number,
    items: ExpenseListItem[],
    icon: string,
    indent?: number,
    options?: { compactMode?: boolean; compactFallbackLabel?: string; itemIndentRem?: number }
  ) => {
    const isExpanded = expandedGroupIds.has(groupId);
    const compactMode = options?.compactMode;
    const compactFallbackLabel = options?.compactFallbackLabel;
    const itemIndentRem = options?.itemIndentRem;
    return (
      <Fragment key={groupId}>
        <li style={indent != null ? { paddingLeft: `${indent}rem` } : undefined}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={() => toggleGroup(groupId)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: 0,
                  fontSize: "0.9rem",
                  lineHeight: 1,
                }}
                title={isExpanded ? "Свернуть" : "Развернуть"}
              >
                {isExpanded ? "▼" : "▶"}
              </button>
              <strong>
                <span style={{ marginRight: "0.35rem" }}>{icon}</span>
                {title}
              </strong>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "end", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
            <strong style={{ color: "#ef4444" }}>-{total.toFixed(2)} ₽</strong>
          </div>
        </li>

        {isExpanded &&
          items.map((expense) => (
            <ExpenseItem
              key={expense.id}
              expense={expense}
              categoryIcon={compactMode ? undefined : getCategoryIcon(categories, expense.categoryId, "subcategoryId" in expense ? expense.subcategoryId : undefined)}
              compactMode={compactMode}
              compactFallbackLabel={compactFallbackLabel}
              indentRem={itemIndentRem}
              onEdit={onEdit}
              onDelete={onDelete}
              onConfirmPlanned={onConfirmPlanned}
              onEditRecurring={onEditRecurring}
              onDeleteRecurring={onDeleteRecurring}
            />
          ))}
      </Fragment>
    );
  };

  const renderSection = (
    section: "planned" | "actual",
    title: string,
    total: number,
    count: number,
    categoryGroups: CategoryGroup[],
    creditLoanGroup: { groupId: string; title: string; total: number; items: ExpenseListItem[] } | null
  ) => {
    const idPrefix = section === "planned" ? "planned-" : "actual-";
    const isExpanded = expandedSections[section];
    return (
      <div
        key={section}
        style={{
          marginBottom: "1rem",
          border: "1px solid #334155",
          borderRadius: "8px",
          overflow: "hidden",
          background: "rgba(15, 23, 42, 0.5)",
        }}
      >
        <button
          type="button"
          onClick={() => toggleSection(section)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.6rem 0.75rem",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#e2e8f0",
            textAlign: "left",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>{isExpanded ? "▼" : "▶"}</span>
            <strong>{title}</strong>
          </span>
          <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
            −{total.toFixed(2)} ₽ · {count}
          </span>
        </button>
        {isExpanded && (
          <ul className="list list--table" style={{ width: "100%", borderTop: "1px solid #334155" }}>
            {categoryGroups.map((cat) => {
              const categoryKey = `${idPrefix}cat-${cat.categoryId}`;
              const isCategoryExpanded = expandedCategoryIds.has(categoryKey);
              return (
                <Fragment key={categoryKey}>
                  <li>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <button
                          type="button"
                          onClick={() => toggleCategory(categoryKey)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "#94a3b8",
                            padding: 0,
                            fontSize: "0.9rem",
                            lineHeight: 1,
                          }}
                          title={isCategoryExpanded ? "Свернуть" : "Развернуть"}
                        >
                          {isCategoryExpanded ? "▼" : "▶"}
                        </button>
                        <strong>
                          <span style={{ marginRight: "0.35rem" }}>{cat.categoryIcon}</span>
                          {cat.categoryName}
                        </strong>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "end", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                      <strong style={{ color: "#ef4444" }}>-{cat.total.toFixed(2)} ₽</strong>
                    </div>
                  </li>
                  {isCategoryExpanded &&
                    cat.subGroups.map((g) =>
                      g.items.length === 1 ? (
                        <ExpenseItem
                          key={g.groupId}
                          expense={g.items[0]}
                          categoryIcon={g.icon}
                          leftLabel={g.title}
                          indentRem={2.25}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onConfirmPlanned={onConfirmPlanned}
                          onEditRecurring={onEditRecurring}
                          onDeleteRecurring={onDeleteRecurring}
                        />
                      ) : (
                        renderGroup(g.groupId, g.title, g.total, g.items, g.icon, 1.5, {
                          compactMode: true,
                          compactFallbackLabel: g.title,
                          itemIndentRem: 2.25,
                        })
                      )
                    )}
                </Fragment>
              );
            })}
            {creditLoanGroup &&
              renderGroup(creditLoanGroup.groupId, creditLoanGroup.title, creditLoanGroup.total, creditLoanGroup.items, "💳")}
          </ul>
        )}
      </div>
    );
  };

  return (
    <>
      {plannedItems.length > 0 &&
        renderSection(
          "planned",
          "Планируемые расходы",
          plannedTotal,
          plannedItems.length,
          plannedGrouped.categoryGroups,
          plannedGrouped.creditLoanGroup
        )}
      {actualItems.length > 0 &&
        renderSection(
          "actual",
          "Фактические расходы",
          actualTotal,
          actualItems.length,
          actualGrouped.categoryGroups,
          actualGrouped.creditLoanGroup
        )}
    </>
  );
}
