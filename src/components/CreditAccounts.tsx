import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { financialApi } from "../api/financialApi";
import type {
  CreateCreditAccountRequest,
  CreditAccountDto,
  CreditTransactionDto,
  UpdateCreditAccountRequest,
} from "../types";
import { ConfirmationModal } from "./ConfirmationModal";
import { HintTooltip } from "./HintTooltip";

/** Сумма неоплаченных платежей по графику для данной карты (осталось оплатить). */
function getRemainingToPay(accountId: string, transactions: CreditTransactionDto[]): number {
  return transactions
    .filter((t) => t.creditAccountId === accountId)
    .reduce(
      (sum, t) =>
        sum +
        t.paymentSchedule.filter((p) => !p.isPaid).reduce((s, p) => s + p.paymentAmount, 0),
      0
    );
}

function getMonthWord(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "месяцев";
  }
  
  if (lastDigit === 1) {
    return "месяц";
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return "месяца";
  }
  
  return "месяцев";
}

export function CreditAccounts() {
  const [accounts, setAccounts] = useState<CreditAccountDto[]>([]);
  const [transactions, setTransactions] = useState<CreditTransactionDto[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [nameFieldError, setNameFieldError] = useState(false);
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
  const [form, setForm] = useState<CreateCreditAccountRequest>({
    name: "",
    accountType: "CreditCard",
    creditLimit: undefined,
    monthlyPayment: undefined,
    totalAmount: undefined,
    termMonths: undefined,
    paymentStartDate: undefined,
    currentBalance: 0,
    interestRate: undefined,
    notes: "",
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setIsBusy(true);
    try {
      const [accountsRes, transactionsRes] = await Promise.all([
        financialApi.getCreditAccounts(),
        financialApi.getCreditTransactions(),
      ]);
      setAccounts(accountsRes.data);
      setTransactions(transactionsRes.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      setNameFieldError(true);
      setError("Введите название счета");
      return;
    }
    setNameFieldError(false);

    setIsBusy(true);
    try {
      if (editingId) {
        const account = accounts.find((a) => a.id === editingId);
        if (!account) return;
        const updateRequest: UpdateCreditAccountRequest = {
          name: form.name,
          creditLimit: form.creditLimit,
          monthlyPayment: form.monthlyPayment,
          totalAmount: form.totalAmount,
          termMonths: form.termMonths,
          paymentStartDate: form.paymentStartDate,
          interestRate: form.interestRate,
          notes: form.notes,
          currentBalance: form.currentBalance ?? account.currentBalance,
          isActive: account.isActive,
        };
        await financialApi.updateCreditAccount(editingId, updateRequest);
      } else {
        await financialApi.createCreditAccount({
          ...form,
          currentBalance: form.currentBalance ?? 0,
        });
      }
      await loadAccounts();
      setForm({
        name: "",
        accountType: "CreditCard",
        creditLimit: undefined,
        monthlyPayment: undefined,
        totalAmount: undefined,
        termMonths: undefined,
        paymentStartDate: undefined,
        currentBalance: 0,
        interestRate: undefined,
        notes: "",
      });
      setEditingId(null);
      setShowModal(false);
      setError(null);
      setNameFieldError(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleEdit = (account: CreditAccountDto) => {
    setNameFieldError(false);
    setForm({
      name: account.name,
      accountType: account.accountType,
      creditLimit: account.creditLimit,
      monthlyPayment: account.monthlyPayment,
      totalAmount: account.totalAmount,
      termMonths: account.termMonths,
      paymentStartDate: account.paymentStartDate,
      currentBalance: account.currentBalance,
      interestRate: account.interestRate,
      notes: account.notes || "",
    });
    setError(null);
    setEditingId(account.id);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setConfirmationModal({
      isOpen: true,
      title: "Удаление кредитного счета",
      message: "Удалить кредитный счет?",
      onConfirm: async () => {
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
        setIsBusy(true);
        try {
          await financialApi.deleteCreditAccount(id);
          await loadAccounts();
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
    setNameFieldError(false);
    setForm({
      name: "",
      accountType: "CreditCard",
      creditLimit: undefined,
      monthlyPayment: undefined,
      totalAmount: undefined,
      termMonths: undefined,
      paymentStartDate: undefined,
      currentBalance: 0,
      interestRate: undefined,
      notes: "",
    });
    setShowModal(true);
  };

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>Кредитные счета</h2>
          <button onClick={handleNewClick}>Добавить кредитный счет</button>
        </div>
        {error && <div className="app__error">⚠️ {error}</div>}
        <div className="panel__content">
          {accounts.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
              Данных нет
            </div>
          ) : (
            <ul className="list">
              {accounts.map((account) => (
                <li key={account.id} style={{ position: "relative" }}>
                  <div style={{ position: "absolute", top: "0.75rem", right: "0.75rem", zIndex: 10 }}>
                    <span 
                      className={account.isActive ? "badge badge--success" : "badge badge--inactive"}
                      style={{ 
                        color: account.isActive ? "#fff" : "#fff",
                        fontWeight: "600",
                        fontSize: "0.8rem"
                      }}
                    >
                      {account.isActive ? "Активен" : "Неактивен"}
                    </span>
                  </div>
                  <div>
                    <strong>{account.name}</strong>
                    <span>{account.accountType === "CreditCard" ? "Кредитная карта" : "Кредит"}</span>
                    {account.accountType === "CreditCard" && account.creditLimit && (
                      <span>Лимит: {account.creditLimit.toFixed(2)} ₽</span>
                    )}
                    {account.accountType === "Loan" && account.totalAmount && (
                      <span>Сумма кредита: {account.totalAmount.toFixed(2)} ₽</span>
                    )}
                    {account.accountType === "Loan" && account.monthlyPayment && (
                      <span>Ежемесячный платёж: {account.monthlyPayment.toFixed(2)} ₽ <em style={{ color: "#94a3b8", fontSize: "0.9em" }}>(планируемый расход)</em></span>
                    )}
                    {account.accountType === "Loan" && account.termMonths && (
                      <span>Остаток: {account.termMonths} {getMonthWord(account.termMonths)}</span>
                    )}
                    {account.accountType === "Loan" && account.paymentStartDate && (
                      <span>Первый платеж: {dayjs(account.paymentStartDate).format("DD.MM.YYYY")}</span>
                    )}
                    {account.accountType === "CreditCard" && (
                      <>
                        {account.creditLimit != null && (
                          <span>
                            Доступно: {(account.creditLimit - account.currentBalance).toFixed(2)} ₽
                          </span>
                        )}
                        <span>
                          Осталось оплатить: {getRemainingToPay(account.id, transactions).toFixed(2)} ₽
                        </span>
                      </>
                    )}
                    {typeof account.interestRate === "number" && (
                      account.interestRate === 0 ? (
                        <span>Беспроцентная рассрочка</span>
                      ) : (
                        <span>Процент: {account.interestRate.toFixed(2)}%</span>
                      )
                    )}
                  </div>
                  <div style={{display: "flex", justifyContent: "end", flexDirection: "row"}}>
                    <button 
                      onClick={() => handleEdit(account)}
                      style={{ fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => handleDelete(account.id)}
                      style={{ fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
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
        <div className="modal-overlay" onClick={() => { setShowModal(false); setError(null); setNameFieldError(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editingId ? "Редактировать" : "Добавить"} кредитный счет</h2>
              <button onClick={() => { setShowModal(false); setError(null); setNameFieldError(false); }}>✕</button>
            </div>
            <div className="modal__content">
              {error && <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}
              <div className="form">
                <label>
                  Название счета
                  <input
                    value={form.name}
                    onChange={(e) => {
                      setNameFieldError(false);
                      setForm({ ...form, name: e.target.value });
                    }}
                    className={nameFieldError ? "form-field--error" : undefined}
                    placeholder="Например: Основная кредитка"
                  />
                </label>
                <label>
                  Тип счета
                  <select
                    value={form.accountType}
                    onChange={(e) => setForm({ ...form, accountType: e.target.value as "CreditCard" | "Loan" })}
                  >
                    <option value="CreditCard">Кредитная карта</option>
                    <option value="Loan">Кредит</option>
                  </select>
                </label>
                {form.accountType === "CreditCard" ? (
                  <label>
                    Кредитный лимит (необязательно)
                    <input
                      type="number"
                      value={form.creditLimit || ""}
                      onChange={(e) => setForm({ ...form, creditLimit: e.target.value ? Number(e.target.value) : undefined })}
                      min="0"
                      step="0.01"
                    />
                  </label>
                ) : (
                  <>
                    <label>
                      Общая сумма кредита
                      <input
                        type="number"
                        value={form.totalAmount || ""}
                        onChange={(e) => setForm({ ...form, totalAmount: e.target.value ? Number(e.target.value) : undefined })}
                        min="0"
                        step="0.01"
                        required
                      />
                    </label>
                    <label>
                      Ежемесячный платеж
                      <input
                        type="number"
                        value={form.monthlyPayment || ""}
                        onChange={(e) => setForm({ ...form, monthlyPayment: e.target.value ? Number(e.target.value) : undefined })}
                        min="0"
                        step="0.01"
                        required
                      />
                    </label>
                    <label>
                      Остаток месяцев до погашения
                      <input
                        type="number"
                        value={form.termMonths || ""}
                        onChange={(e) => setForm({ ...form, termMonths: e.target.value ? Number(e.target.value) : undefined })}
                        min="1"
                        step="1"
                        required
                      />
                    </label>
                    <label>
                      Дата первого платежа
                      <input
                        type="date"
                        value={form.paymentStartDate || ""}
                        onChange={(e) => setForm({ ...form, paymentStartDate: e.target.value || undefined })}
                        required
                      />
                    </label>
                  </>
                )}
                <label>
                  Процентная ставка (необязательно)
                  <input
                    type="number"
                    value={form.interestRate ?? ""}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value ? Number(e.target.value) : undefined })}
                    min="0"
                    step="0.01"
                  />
                </label>
                <label>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    Текущий баланс (задолженность)
                    <HintTooltip
                      text="Задайте текущую задолженность по счёту, чтобы вести расчёты с этого момента и устранить нестыковки."
                      ariaLabel="Подсказка по текущей задолженности"
                    />
                  </span>
                  <input
                    type="number"
                    value={form.currentBalance ?? ""}
                    onChange={(e) => setForm({ ...form, currentBalance: e.target.value !== "" ? Number(e.target.value) : 0 })}
                    step="0.01"
                    placeholder="0"
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
                  <button onClick={() => { setShowModal(false); setError(null); setNameFieldError(false); }}>Отмена</button>
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
