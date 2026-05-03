import { useState, useEffect } from "react";
import { financialApi } from "../api/financialApi";
import type { PendingPlannedTransactionDto } from "../types";
import dayjs from "dayjs";

interface PlannedTransactionNotificationProps {
  transaction: PendingPlannedTransactionDto;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function PlannedTransactionNotification({
  transaction,
  onConfirm,
  onDismiss,
}: PlannedTransactionNotificationProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualAmount, setActualAmount] = useState<string>(transaction.amount.toFixed(2));
  const [showAmountEdit, setShowAmountEdit] = useState(false);

  // При смене транзакции (следующий в списке) подставляем сумму именно этой записи, а не первой
  useEffect(() => {
    setActualAmount(transaction.amount.toFixed(2));
    setShowAmountEdit(false);
    setError(null);
  }, [transaction.id, transaction.amount]);

  const handleConfirm = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const amount = parseFloat(actualAmount);
      if (isNaN(amount) || amount < 0) {
        setError("Введите корректную сумму (0 или больше)");
        setIsBusy(false);
        return;
      }

      const requestBody = amount !== transaction.amount ? { amount } : null;

      if (transaction.type === "Expense") {
        await financialApi.confirmPlannedExpense(transaction.id, requestBody);
      } else {
        await financialApi.confirmPlannedIncome(transaction.id, requestBody);
      }
      onConfirm();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Ошибка при подтверждении");
    } finally {
      setIsBusy(false);
    }
  };

  const transactionDate = dayjs(transaction.date).format("DD.MM.YYYY");
  const isExpense = transaction.type === "Expense";

  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
        <div className="modal__header">
          <h3>Подтверждение {isExpense ? "расхода" : "дохода"}</h3>
          <button onClick={onDismiss}>✕</button>
        </div>
        <div className="modal__content">
          {error && <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}
          <p style={{ marginBottom: "1rem" }}>
            Наступила дата планируемого {isExpense ? "расхода" : "дохода"}:
          </p>
          <div style={{ marginBottom: "1rem", padding: "1rem", background: "#1e293b", borderRadius: "8px" }}>
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Название:</strong> {transaction.title}
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Дата:</strong> {transactionDate}
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <strong>Сумма:</strong>
                {showAmountEdit ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={actualAmount}
                      onChange={(e) => setActualAmount(e.target.value)}
                      style={{
                        padding: "0.5rem",
                        borderRadius: "6px",
                        border: "1px solid #334155",
                        background: "#0f172a",
                        color: "#fff",
                        fontSize: "0.95rem",
                        width: "120px",
                      }}
                      autoFocus
                    />
                    <span style={{ color: "#94a3b8" }}>₽</span>
                <button
                  onClick={() => {
                    setActualAmount(transaction.amount.toFixed(2));
                    setShowAmountEdit(false);
                  }}
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    border: "none",
                    background: "#64748b",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Отмена
                </button>
                    <button
                      onClick={() => {
                        const amount = parseFloat(actualAmount);
                        if (isNaN(amount) || amount < 0) {
                          setError("Введите корректную сумму (0 или больше)");
                          return;
                        }
                        setShowAmountEdit(false);
                      }}
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    border: "none",
                    background: "#3b82f6",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  ✓
                </button>
                  </div>
                ) : (
                  <>
                    <span style={{ color: isExpense ? "#ef4444" : "#10b981", fontWeight: "bold" }}>
                      {isExpense ? "-" : "+"}{actualAmount} ₽
                    </span>
                    <button
                      onClick={() => setShowAmountEdit(true)}
                      style={{
                        marginLeft: "0.5rem",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        border: "none",
                        background: "#475569",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                      }}
                      title="Изменить сумму"
                    >
                      ✏️
                    </button>
                  </>
                )}
              </div>
              {showAmountEdit && (
                <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  Планируемая сумма: {transaction.amount.toFixed(2)} ₽
                </div>
              )}
            </div>
            {transaction.categoryName && (
              <div style={{ marginBottom: "0.5rem" }}>
                <strong>Категория:</strong> {transaction.categoryName}
              </div>
            )}
            {transaction.description && (
              <div>
                <strong>Описание:</strong> {transaction.description}
              </div>
            )}
          </div>
          <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#94a3b8" }}>
            При подтверждении {isExpense ? "расход" : "доход"} будет добавлен в факт.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button 
              onClick={onDismiss} 
              disabled={isBusy}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "12px",
                border: "none",
                background: "#64748b",
                color: "#fff",
                cursor: isBusy ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "0.95rem",
                transition: "all 0.2s ease",
                opacity: isBusy ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isBusy) {
                  e.currentTarget.style.background = "#475569";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.2)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isBusy) {
                  e.currentTarget.style.background = "#64748b";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              Позже
            </button>
            <button 
              onClick={handleConfirm} 
              disabled={isBusy}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "12px",
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                cursor: isBusy ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "0.95rem",
                transition: "all 0.2s ease",
                opacity: isBusy ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isBusy) {
                  e.currentTarget.style.background = "#2563eb";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.2)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isBusy) {
                  e.currentTarget.style.background = "#3b82f6";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              {isBusy ? "Подтверждение..." : "Подтвердить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
