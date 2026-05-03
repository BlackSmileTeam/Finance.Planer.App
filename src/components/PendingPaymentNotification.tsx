import { useState } from "react";
import { financialApi } from "../api/financialApi";
import type { PendingCreditPaymentDto } from "../types";
import dayjs from "dayjs";

interface PendingPaymentNotificationProps {
  payment: PendingCreditPaymentDto;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function PendingPaymentNotification({
  payment,
  onConfirm,
  onDismiss,
}: PendingPaymentNotificationProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await financialApi.confirmCreditPayment(payment.paymentScheduleId);
      onConfirm();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Ошибка при подтверждении платежа");
    } finally {
      setIsBusy(false);
    }
  };

  const day = payment.scheduledDay ?? 1;
  const paymentDate = dayjs(`${payment.scheduledYear}-${String(payment.scheduledMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`).format("D MMMM YYYY");

  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
        <div className="modal__header">
          <h3>Подтверждение платежа</h3>
          <button onClick={onDismiss}>✕</button>
        </div>
        <div className="modal__content">
          {error && <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}
          <p style={{ marginBottom: "1rem" }}>
            Наступила дата платежа по кредиту/кредитной карте:
          </p>
          <div style={{ marginBottom: "1rem", padding: "1rem", background: "#1e293b", borderRadius: "8px" }}>
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Карта/Кредит:</strong> {payment.creditAccountName}
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Дата платежа:</strong> {paymentDate}
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <strong>Сумма (планируемый расход):</strong> <span style={{ color: "#ef4444", fontWeight: "bold" }}>{payment.paymentAmount.toFixed(2)} ₽</span>
            </div>
            <div>
              <strong>Категория:</strong> {payment.categoryName}
            </div>
          </div>
          <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#94a3b8" }}>
            При подтверждении платеж будет добавлен в факт расходов.
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
              {isBusy ? "Подтверждение..." : "Подтвердить платеж"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
