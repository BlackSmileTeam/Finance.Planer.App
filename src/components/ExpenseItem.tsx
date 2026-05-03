import dayjs from "dayjs";
import type { ExpenseDto, RecurringExpenseDto } from "../types";

function formatAmount(amount: number, currency?: string): string {
  const getCurrencySymbol = (curr?: string): string => {
    switch (curr) {
      case "USD": return "$";
      case "EUR": return "€";
      case "GBP": return "£";
      case "RUB":
      default:
        return "₽";
    }
  };

  const symbol = getCurrencySymbol(currency);
  const formatted = Math.abs(amount).toFixed(2);
  
  return `${formatted} ${symbol}`;
}

type ExpenseListItem = 
  | (ExpenseDto & { date: string; isRecurring: false })
  | (Omit<RecurringExpenseDto, "id"> & { id: string; date: string; isRecurring: true; isPlanned?: boolean; recurringId?: string })
  | ({ id: string; date: string; categoryName: string; subcategoryName?: string; amount: number; isRecurring: false; isPlanned: true; isCreditPayment?: true; creditAccountType?: "CreditCard" | "Loan" })
  | ({ id: string; date: string; categoryName: string; subcategoryName?: string; amount: number; isRecurring: false; isPlanned: true; isLoanPayment?: true });

interface ExpenseItemProps {
  expense: ExpenseListItem;
  categoryIcon?: string;
  /** Подпись слева вместо категории/подкатегории (одна запись в подкатегории) */
  leftLabel?: string;
  /** Только описание (или fallback) и сумма, без категории/подкатегории */
  compactMode?: boolean;
  /** Текст при compactMode, если нет описания */
  compactFallbackLabel?: string;
  onEdit?: (expense: ExpenseDto) => void;
  onDelete?: (id: string) => void;
  onConfirmPlanned?: (id: string) => Promise<void>;
  onEditRecurring?: (recurringId: string) => void;
  onDeleteRecurring?: (recurringId: string) => void;
  /** Отступ слева (rem) для одной записи в подкатегории */
  indentRem?: number;
}

export function ExpenseItem({
  expense,
  categoryIcon,
  leftLabel,
  compactMode,
  compactFallbackLabel,
  onEdit,
  onDelete,
  onConfirmPlanned,
  onEditRecurring,
  onDeleteRecurring,
  indentRem,
}: ExpenseItemProps) {
  const currency = ("currency" in expense ? expense.currency : undefined);
  const showCurrency = expense.amount > 0 && currency && currency !== "RUB";
  const amountStr = showCurrency
    ? formatAmount(expense.amount, currency)
    : expense.amount.toFixed(2) + (expense.amount > 0 && !showCurrency ? " ₽" : "");
  
  const isPlanned = "isPlanned" in expense ? (expense.isPlanned ?? false) : false;
  const isRecurring = expense.isRecurring;
  const isCreditPayment = "isCreditPayment" in expense && expense.isCreditPayment;
  const isLoanPayment = "isLoanPayment" in expense && expense.isLoanPayment;
  const isFactualCreditPayment = "creditPaymentScheduleId" in expense && !!expense.creditPaymentScheduleId;

  const descText = ("description" in expense && expense.description) || ("notes" in expense && expense.notes) || ("title" in expense ? expense.title : "") || "";
  const titleLine = compactMode
    ? (descText || compactFallbackLabel || expense.categoryName)
    : leftLabel != null
      ? leftLabel
      : `${expense.categoryName}${expense.subcategoryName ? ` / ${expense.subcategoryName}` : ""}`;
  const showDescBelow = !compactMode && descText;
  const showIcon = !compactMode && !isCreditPayment && !isLoanPayment && !isFactualCreditPayment && (categoryIcon || leftLabel != null) && categoryIcon;

  const leftBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", justifyContent: "flex-start", alignItems: "flex-start" }}>
      <strong>
        {!compactMode && isRecurring && <span style={{ marginRight: "0.5rem" }}>🔄</span>}
        {!compactMode && (isCreditPayment || isLoanPayment || isFactualCreditPayment) && <span style={{ marginRight: "0.5rem" }}>💳</span>}
        {showIcon && <span style={{ marginRight: "0.5rem" }}>{categoryIcon}</span>}
        {titleLine}
      </strong>
      {showDescBelow ? (
        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{descText}</div>
      ) : null}
      <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{dayjs(expense.date).format("DD.MM")}</span>
    </div>
  );

  const amountAndButtons = (
    <div style={{ display: "flex", justifyContent: "flex-end", flexDirection: "row", alignItems: "center" }}>
      <strong style={{ color: "#ef4444" }}>-{amountStr}</strong>
      {!isRecurring && !isCreditPayment && !isLoanPayment ? (
        <>
          {onEdit && "categoryId" in expense && (
            <button
              onClick={() => onEdit(expense as ExpenseDto)}
              style={{ marginLeft: "0.5rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
            >
              ✏️
            </button>
          )}
          {onDelete && !isCreditPayment && (
            <button
              onClick={() => onDelete(expense.id)}
              style={{ marginLeft: "0.25rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
            >
              🗑️
            </button>
          )}
        </>
      ) : !isCreditPayment && !isLoanPayment ? (
        <>
          {onEditRecurring && ("recurringId" in expense ? expense.recurringId : expense.id.split("-").slice(0, -3).join("-")) && (
            <button
              onClick={() => {
                const recurringId = ("recurringId" in expense ? expense.recurringId : expense.id.split("-").slice(0, -3).join("-")) as string;
                if (onEditRecurring) {
                  onEditRecurring(recurringId);
                }
              }}
              style={{ marginLeft: "0.5rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
              title="Редактировать повторяющийся расход"
            >
              ✏️
            </button>
          )}
          {onDeleteRecurring && ("recurringId" in expense ? expense.recurringId : expense.id.split("-").slice(0, -3).join("-")) && (
            <button
              onClick={() => {
                const recurringId = ("recurringId" in expense ? expense.recurringId : expense.id.split("-").slice(0, -3).join("-")) as string;
                if (onDeleteRecurring) {
                  onDeleteRecurring(recurringId);
                }
              }}
              style={{ marginLeft: "0.25rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
              title="Удалить повторяющийся расход"
            >
              🗑️
            </button>
          )}
        </>
      ) : null}
    </div>
  );

  return (
    <li style={indentRem != null ? { paddingLeft: `${indentRem}rem` } : undefined}>
      {leftBlock}
      <div style={{ display: "flex", justifyContent: "flex-end", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
        {isFactualCreditPayment && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{
              fontSize: "0.75rem",
              padding: "0.15rem 0.4rem",
              backgroundColor: "#10b981",
              color: "#fff",
              borderRadius: "4px",
              fontWeight: "normal"
            }}>
              Фактический платёж по кредиту
            </span>
          </div>
        )}
        {isPlanned && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{
              fontSize: "0.75rem",
              padding: "0.15rem 0.4rem",
              backgroundColor: "#fbbf24",
              color: "#1e293b",
              borderRadius: "4px",
              fontWeight: "normal"
            }}>
              {isLoanPayment
                ? "Плановый платёж по кредиту"
                : isCreditPayment
                  ? (("creditAccountType" in expense && expense.creditAccountType === "Loan")
                      ? "Плановый платёж по кредиту"
                      : "Плановый платёж по кредитной карте")
                  : "Плановый"}
            </span>
            {onConfirmPlanned && (
              <button
                onClick={async () => {
                  await onConfirmPlanned(expense.id);
                }}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.15rem 0.4rem",
                  background: "#10b981",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
                title="Подтвердить расход"
              >
                ✓
              </button>
            )}
          </div>
        )}
        {amountAndButtons}
      </div>
    </li>
  );
}
