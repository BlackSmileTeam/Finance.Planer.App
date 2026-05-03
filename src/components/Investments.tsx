import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { financialApi } from "../api/financialApi";
import type {
  CreateInvestmentRequest,
  InvestmentDto,
  UpdateInvestmentRequest,
} from "../types";
import { ConfirmationModal } from "./ConfirmationModal";

interface InvestmentsProps {
  onNewClick?: () => void; // Reserved for future use
  onEdit?: (investment: InvestmentDto) => void; // Reserved for future use
  onDelete: (id: string) => void;
  investments: InvestmentDto[];
}

export function Investments({ onDelete, investments }: InvestmentsProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [form, setForm] = useState<CreateInvestmentRequest>({
    title: "",
    investmentType: "Stock",
    amount: 0,
    purchaseDate: dayjs().format("YYYY-MM-DD"),
    currentValue: undefined,
    notes: "",
  });

  const handleNewClick = () => {
    setError(null);
    setEditingId(null);
    setForm({
      title: "",
      investmentType: "Stock",
      amount: 0,
      purchaseDate: dayjs().format("YYYY-MM-DD"),
      currentValue: undefined,
      notes: "",
    });
    setShowModal(true);
  };

  useEffect(() => {
    const handleNew = () => {
      handleNewClick();
    };
    window.addEventListener('investment:new', handleNew);
    return () => window.removeEventListener('investment:new', handleNew);
  }, []);


  const handleSubmit = async () => {
    if (!form.title || form.amount <= 0) {
      setError("Заполните все обязательные поля");
      return;
    }

    setIsBusy(true);
    try {
      if (editingId) {
        const updateRequest: UpdateInvestmentRequest = { ...form };
        await financialApi.updateInvestment(editingId, updateRequest);
      } else {
        await financialApi.createInvestment(form);
      }
      setForm({
        title: "",
        investmentType: "Stock",
        amount: 0,
        purchaseDate: dayjs().format("YYYY-MM-DD"),
        currentValue: undefined,
        notes: "",
      });
      setEditingId(null);
      setShowModal(false);
      setError(null);
      // Reload will be handled by parent
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleEdit = (investment: InvestmentDto) => {
    setError(null);
    setForm({
      title: investment.title,
      investmentType: investment.investmentType,
      amount: investment.amount,
      purchaseDate: investment.purchaseDate,
      currentValue: investment.currentValue,
      notes: investment.notes || "",
    });
    setEditingId(investment.id);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setConfirmationModal({
      isOpen: true,
      title: "Удаление инвестиции",
      message: "Удалить инвестицию?",
      onConfirm: async () => {
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
        setIsBusy(true);
        try {
          await financialApi.deleteInvestment(id);
          onDelete(id);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsBusy(false);
        }
      },
    });
  };

  const getInvestmentTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      Stock: "Акции",
      Bond: "Облигации",
      ETF: "ETF",
      Crypto: "Криптовалюта",
      RealEstate: "Недвижимость",
      Other: "Другое",
    };
    return labels[type] || type;
  };

  return (
    <>
      {error && <div className="app__error">⚠️ {error}</div>}
      {investments.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
          Данных нет
        </div>
      ) : (
        <ul className="list list--table" style={{ margin: "0 auto", maxWidth: "800px" }}>
          {investments.map((investment) => {
            const profit = investment.currentValue
              ? investment.currentValue - investment.amount
              : null;

            return (
              <li key={investment.id}>
                <div>
                  <strong>{investment.title}</strong>
                  <span>{getInvestmentTypeLabel(investment.investmentType)} • {investment.amount.toFixed(2)} ₽</span>
                </div>
                <div>
                  <span>{dayjs(investment.purchaseDate).format("DD.MM")}</span>
                  {profit !== null && (
                    <strong style={{ color: profit >= 0 ? "#10b981" : "#ef4444", marginLeft: "0.5rem" }}>
                      {profit >= 0 ? "+" : ""}{profit.toFixed(2)} ₽
                    </strong>
                  )}
                  <button
                    onClick={() => handleEdit(investment)}
                    style={{ marginLeft: "0.5rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(investment.id)}
                    style={{ marginLeft: "0.25rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
                  >
                    🗑️
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editingId ? "Редактировать" : "Добавить"} инвестицию</h2>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal__content">
              {error && <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}
              <div className="form">
                <label>
                  Название
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Например: Сбербанк акции"
                  />
                </label>
                <label>
                  Тип инвестиции
                  <select
                    value={form.investmentType}
                    onChange={(e) => setForm({ ...form, investmentType: e.target.value as any })}
                  >
                    <option value="Stock">Акции</option>
                    <option value="Bond">Облигации</option>
                    <option value="ETF">ETF</option>
                    <option value="Crypto">Криптовалюта</option>
                    <option value="RealEstate">Недвижимость</option>
                    <option value="Other">Другое</option>
                  </select>
                </label>
                <label>
                  Сумма инвестиции
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                  />
                </label>
                <label>
                  Дата покупки
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                  />
                </label>
                <label>
                  Текущая стоимость (необязательно)
                  <input
                    type="number"
                    value={form.currentValue || ""}
                    onChange={(e) =>
                      setForm({ ...form, currentValue: e.target.value ? Number(e.target.value) : undefined })
                    }
                    min="0"
                    step="0.01"
                  />
                </label>
                <label>
                  Заметки
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={handleSubmit} disabled={isBusy}>
                    {editingId ? "Обновить" : "Создать"}
                  </button>
                  <button onClick={() => { setShowModal(false); setError(null); }}>Отмена</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        onConfirm={confirmationModal.onConfirm}
        onCancel={() => setConfirmationModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}
