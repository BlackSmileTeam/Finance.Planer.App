import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { financialApi } from "../api/financialApi";
import type {
  CategoryDto,
  CreateRecurringExpenseRequest,
  RecurringExpenseDto,
  UpdateRecurringExpenseRequest,
} from "../types";
import { ConfirmationModal } from "./ConfirmationModal";

interface RecurringExpensesProps {
  categories: CategoryDto[];
  onUpdate?: () => void;
}

export function RecurringExpenses({ categories, onUpdate }: RecurringExpensesProps) {
  const [expenses, setExpenses] = useState<RecurringExpenseDto[]>([]);
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
  const [form, setForm] = useState<CreateRecurringExpenseRequest>({
    categoryId: "",
    subcategoryId: undefined,
    title: "",
    amount: 0,
    startDate: dayjs().format("YYYY-MM-DD"),
    endDate: undefined,
    frequency: "Monthly",
    notes: "",
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    setIsBusy(true);
    try {
      const response = await financialApi.getRecurringExpenses();
      setExpenses(response.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.categoryId || !form.title || form.amount <= 0) {
      setError("Заполните все обязательные поля");
      return;
    }

    setIsBusy(true);
    try {
      if (editingId) {
        const updateRequest: UpdateRecurringExpenseRequest = {
          ...form,
          isActive: expenses.find((e) => e.id === editingId)?.isActive ?? true,
        };
        await financialApi.updateRecurringExpense(editingId, updateRequest);
      } else {
        await financialApi.createRecurringExpense(form);
      }
      await loadExpenses();
      onUpdate?.();
      setForm({
        categoryId: "",
        subcategoryId: undefined,
        title: "",
        amount: 0,
        startDate: dayjs().format("YYYY-MM-DD"),
        endDate: undefined,
        frequency: "Monthly",
        notes: "",
      });
      setEditingId(null);
      setShowModal(false);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleEdit = (expense: RecurringExpenseDto) => {
    setError(null);
    setForm({
      categoryId: expense.categoryId,
      subcategoryId: expense.subcategoryId,
      title: expense.title,
      amount: expense.amount,
      startDate: expense.startDate,
      endDate: expense.endDate,
      frequency: expense.frequency,
      notes: expense.notes || "",
    });
    setEditingId(expense.id);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setConfirmationModal({
      isOpen: true,
      title: "Удаление повторяющегося расхода",
      message: "Удалить повторяющийся расход?",
      onConfirm: async () => {
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
        setIsBusy(true);
        try {
          await financialApi.deleteRecurringExpense(id);
          await loadExpenses();
          onUpdate?.();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsBusy(false);
        }
      },
    });
  };

  const handleNewClick = () => {
    setEditingId(null);
    setError(null);
    setForm({
      categoryId: "",
      subcategoryId: undefined,
      title: "",
      amount: 0,
      startDate: dayjs().format("YYYY-MM-DD"),
      endDate: undefined,
      frequency: "Monthly",
      notes: "",
    });
    setShowModal(true);
  };

  const getFrequencyLabel = (frequency: string): string => {
    const labels: Record<string, string> = {
      Weekly: "Еженедельно",
      BiWeekly: "Раз в 2 недели",
      Monthly: "Ежемесячно",
      Quarterly: "Ежеквартально",
      Yearly: "Ежегодно",
    };
    return labels[frequency] || frequency;
  };

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const subcategories = selectedCategory?.subcategories || [];

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>Повторяющиеся расходы</h2>
          <button onClick={handleNewClick}>Добавить повторяющийся расход</button>
        </div>
        {error && <div className="app__error">⚠️ {error}</div>}
        <div className="panel__content">
          {expenses.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              Данных нет
            </div>
          ) : (
            <ul className="list list--table" style={{ margin: "0 auto", maxWidth: "800px" }}>
              {expenses.map((expense) => (
                <li key={expense.id}>
                  <div>
                    <strong>
                      {expense.categoryName}
                      {expense.subcategoryName && ` / ${expense.subcategoryName}`}
                    </strong>
                    <span>{expense.title} • {getFrequencyLabel(expense.frequency)}</span>
                  </div>
                  <div>
                    <span>{dayjs(expense.startDate).format("DD.MM")}</span>
                    <strong>{expense.amount.toFixed(2)} ₽</strong>
                    <button
                      onClick={() => handleEdit(expense)}
                      style={{ marginLeft: "0.5rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      style={{ marginLeft: "0.25rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setError(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editingId ? "Редактировать" : "Добавить"} повторяющийся расход</h2>
              <button onClick={() => { setShowModal(false); setError(null); }}>✕</button>
            </div>
            <div className="modal__content">
              {error && <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}
              <div className="form">
                <label>
                  Категория
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm({ ...form, categoryId: e.target.value, subcategoryId: undefined })
                    }
                  >
                    <option value="">Выберите категорию</option>
                    {categories
                      .filter((c) => !c.parentId)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                  </select>
                </label>
                {subcategories.length > 0 && (
                  <label>
                    Подкатегория
                    <select
                      value={form.subcategoryId || ""}
                      onChange={(e) =>
                        setForm({ ...form, subcategoryId: e.target.value || undefined })
                      }
                    >
                      <option value="">Нет подкатегории</option>
                      {subcategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.icon} {sub.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Название
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Например: Аренда квартиры"
                  />
                </label>
                <label>
                  Сумма
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                  />
                </label>
                <label>
                  Дата начала
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </label>
                <label>
                  Дата окончания (необязательно)
                  <input
                    type="date"
                    value={form.endDate || ""}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })}
                  />
                </label>
                <label>
                  Частота
                  <select
                    value={form.frequency}
                    onChange={(e) =>
                      setForm({ ...form, frequency: e.target.value as any })
                    }
                  >
                    <option value="Weekly">Еженедельно</option>
                    <option value="BiWeekly">Раз в 2 недели</option>
                    <option value="Monthly">Ежемесячно</option>
                    <option value="Quarterly">Ежеквартально</option>
                    <option value="Yearly">Ежегодно</option>
                  </select>
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
