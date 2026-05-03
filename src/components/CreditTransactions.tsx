import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { financialApi } from "../api/financialApi";
import type {
  CreditAccountDto,
  CreditTransactionDto,
  CreateCreditTransactionRequest,
} from "../types";
import { ConfirmationModal } from "./ConfirmationModal";

interface CreditTransactionsProps {
  creditAccounts: CreditAccountDto[];
  /** Вызывается после записи транзакции как доход — чтобы обновить блок «Доходы» и «Входящие платежи» */
  onRecordAsIncome?: () => void | Promise<void>;
  /** Вызывается после создания кредитной транзакции, чтобы обновить список повторяющихся расходов (график платежей) */
  onRecurringExpensesChanged?: () => void | Promise<void>;
}

export function CreditTransactions({
  creditAccounts,
  onRecordAsIncome,
  onRecurringExpensesChanged,
}: CreditTransactionsProps) {
  const [transactions, setTransactions] = useState<CreditTransactionDto[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [form, setForm] = useState<CreateCreditTransactionRequest>({
    creditAccountId: "",
    categoryId: "",
    subcategoryId: undefined,
    transactionDate: dayjs().format("YYYY-MM-DD"),
    amount: 0,
    description: "",
    recordAsIncome: true,
    paymentMonths: 6,
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  // Если кредитная карта всего одна — выбираем её по умолчанию при открытии формы
  useEffect(() => {
    if (showModal && creditAccounts.length === 1) {
      setForm((prev) => ({ ...prev, creditAccountId: creditAccounts[0].id }));
    }
  }, [showModal, creditAccounts]);

  const loadTransactions = async () => {
    setIsBusy(true);
    try {
      const response = await financialApi.getCreditTransactions();
      setTransactions(response.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.creditAccountId || form.amount <= 0) {
      setError("Заполните все обязательные поля");
      return;
    }

    setIsBusy(true);
    try {
      // Prepare request - convert empty strings to undefined for optional fields
      const request = {
        ...form,
        categoryId: form.categoryId && form.categoryId.trim() !== "" ? form.categoryId : undefined,
        subcategoryId: form.subcategoryId && form.subcategoryId.trim() !== "" ? form.subcategoryId : undefined,
      };
      await financialApi.createCreditTransaction(request);
      await loadTransactions();
      if (form.recordAsIncome) {
        await onRecordAsIncome?.();
      }
      await onRecurringExpensesChanged?.();
      setForm({
        creditAccountId: "",
        categoryId: "",
        subcategoryId: undefined,
        transactionDate: dayjs().format("YYYY-MM-DD"),
        amount: 0,
        description: "",
        recordAsIncome: true,
        paymentMonths: 6,
      });
      setShowModal(false);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmationModal({
      isOpen: true,
      title: "Удаление транзакции",
      message: "Удалить транзакцию?",
      onConfirm: async () => {
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
        setIsBusy(true);
        try {
          await financialApi.deleteCreditTransaction(id);
          await loadTransactions();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsBusy(false);
        }
      },
    });
  };

  const handleRecordAsIncome = async (id: string) => {
    setIsBusy(true);
    try {
      await financialApi.recordCreditTransactionAsIncome(id);
      await loadTransactions();
      await onRecordAsIncome?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleNewClick = () => {
    setError(null);
    setForm({
      creditAccountId: "",
      categoryId: "",
      subcategoryId: undefined,
      transactionDate: dayjs().format("YYYY-MM-DD"),
      amount: 0,
      description: "",
      recordAsIncome: true,
      paymentMonths: 6,
    });
    setShowModal(true);
  };

  // Group transactions by credit account
  const transactionsByAccount = creditAccounts.map((account) => ({
    account,
    transactions: transactions.filter((t) => t.creditAccountId === account.id),
  }));

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>Кредитные транзакции</h2>
          <button onClick={handleNewClick}>Добавить транзакцию</button>
        </div>
        {error && <div className="app__error">⚠️ {error}</div>}
        <div className="panel__content">
          {transactions.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              Данных нет
            </div>
          ) : (
            <>
              <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#94a3b8" }}>
                Платежи по графику — это планируемые расходы; они учитываются в разделе «План/Факт» и становятся фактом после подтверждения.
              </p>
              <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Счет</th>
                    <th>Категория</th>
                    <th>Описание</th>
                    <th>Дата</th>
                    <th>Сумма</th>
                    <th>Платежей</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionsByAccount.map(({ account, transactions: accountTransactions }) =>
                    accountTransactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{account.name}</td>
                        <td>
                          {transaction.categoryName}
                          {transaction.subcategoryName && ` / ${transaction.subcategoryName}`}
                        </td>
                        <td>{transaction.description || "—"}</td>
                        <td>{dayjs(transaction.transactionDate).format("DD.MM.YYYY")}</td>
                        <td>{transaction.amount.toFixed(2)} ₽</td>
                        <td>{transaction.paymentSchedule.length} мес.</td>
                        <td>
                          {transaction.isIncomeRecorded ? (
                            <span className="badge badge--success">Доход записан</span>
                          ) : (
                            <span className="badge badge--warning">Не учтено как доход</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            {!transaction.isIncomeRecorded && (
                              <button
                                onClick={() => handleRecordAsIncome(transaction.id)}
                                title="Записать как доход"
                              >
                                💰
                              </button>
                            )}
                            <button onClick={() => handleDelete(transaction.id)}>
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </section>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setError(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>Добавить кредитную транзакцию</h2>
              <button onClick={() => { setShowModal(false); setError(null); }}>✕</button>
            </div>
            <div className="modal__content">
              {error && <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}
              <div className="form">
                <label>
                  Кредитная карта
                  <select
                    value={form.creditAccountId}
                    onChange={(e) => setForm({ ...form, creditAccountId: e.target.value })}
                  >
                    <option value="">Выберите карту</option>
                    {creditAccounts
                      // Credit transactions are withdrawals/charges from credit cards, not loan accounts
                      .filter((a) => a.isActive && a.accountType === "CreditCard")
                      .map((account) => {
                        const available = (account.creditLimit || 0) - account.currentBalance;
                        return (
                          <option key={account.id} value={account.id}>
                            {account.name} (Доступно: {available.toFixed(2)} ₽)
                          </option>
                        );
                      })}
                  </select>
                </label>
                <label>
                  Дата транзакции
                  <input
                    type="date"
                    value={form.transactionDate}
                    onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
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
                  Описание
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </label>
                <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={form.recordAsIncome}
                    onChange={(e) => setForm({ ...form, recordAsIncome: e.target.checked })}
                  />
                  <span>Записать как доход в текущем месяце</span>
                </label>
                <label>
                  Количество месяцев для погашения (макс. 6)
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={form.paymentMonths}
                    onChange={(e) => setForm({ ...form, paymentMonths: Number(e.target.value) })}
                  />
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={handleSubmit} disabled={isBusy}>
                    Создать транзакцию
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
