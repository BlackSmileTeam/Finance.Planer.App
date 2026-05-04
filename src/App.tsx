import React, { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import { financialApi } from "./api/financialApi";
import type {
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CreateExpenseRequest,
  ExpenseDto,
  MonthlySummaryDto,
  CreditAccountDto,
  AccountDto,
  CreateAccountRequest,
  IncomeCycleDto,
  AccountTransactionDto,
  RecurringExpenseDto,
  IncomeRecordDto,
  InvestmentDto,
} from "./types";
import { CreditAccounts } from "./components/CreditAccounts";
import { CreditTransactions } from "./components/CreditTransactions";
import { Investments } from "./components/Investments";
import { IncomeRecords } from "./components/IncomeRecords";
import { ExpenseList } from "./components/ExpenseList";
import { FinancesPanel } from "./components/FinancesPanel";
import { PlanVsActual } from "./components/PlanVsActual";
import { Login } from "./components/Login";
import { Calendar } from "./components/Calendar";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { NotificationModal } from "./components/NotificationModal";
import { PendingPaymentNotification } from "./components/PendingPaymentNotification";
import { PlannedTransactionNotification } from "./components/PlannedTransactionNotification";
import { removeToken } from "./api/client";
import type { LoanPaymentForMonthDto, PendingCreditPaymentDto, PendingPlannedTransactionDto } from "./types";
import { CATEGORY_EMOJI_PRESETS } from "./constants/categoryEmojis";

type TabType = "overview" | "finances" | "credits" | "reports" | "planvsactual";

/** Разрешает только цифры и один разделитель (запятая или точка). */
function filterAmountInput(raw: string): string {
  let hasSep = false;
  let result = "";
  for (const c of raw) {
    if (c >= "0" && c <= "9") result += c;
    else if ((c === "," || c === ".") && !hasSep) {
      hasSep = true;
      result += c;
    }
  }
  return result;
}

/** Парсит строку суммы (запятая или точка как десятичный разделитель). */
function parseAmountStr(s: string): number {
  if (s === "" || s === "," || s === ".") return 0;
  const n = parseFloat(s.replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

/// <summary>
/// <para>Top-level application component that orchestrates data fetching and UI.</para>
/// </summary>
function App() {
  const now = dayjs();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [selectedYear, setSelectedYear] = useState(now.year());
  const [selectedMonth, setSelectedMonth] = useState(now.month() + 1);
  const [useHalfMonth, setUseHalfMonth] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"full" | "first" | "second">("first");
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [creditPaymentsForMonth, setCreditPaymentsForMonth] = useState<PendingCreditPaymentDto[]>([]);
  const [loanPaymentsForMonth, setLoanPaymentsForMonth] = useState<LoanPaymentForMonthDto[]>([]);
  const [summaries, setSummaries] = useState<MonthlySummaryDto[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<CreditAccountDto[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpenseDto[]>([]);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecordDto[]>([]);
  const [incomeCycles, setIncomeCycles] = useState<IncomeCycleDto[]>([]);
  const [investments, setInvestments] = useState<InvestmentDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingCreditPaymentDto[]>([]);
  const [currentPaymentIndex, setCurrentPaymentIndex] = useState(0);
  const [pendingPlannedTransactions, setPendingPlannedTransactions] = useState<PendingPlannedTransactionDto[]>([]);
  const [currentPlannedTransactionIndex, setCurrentPlannedTransactionIndex] = useState(0);
  const [accountTransactions] = useState<AccountTransactionDto[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [newAccount, setNewAccount] = useState<CreateAccountRequest>({
    name: "",
    accountNumber: "",
    accountType: "Card",
    balance: 0,
    cardHolderName: "",
    expiryDate: "",
    color: "#3b82f6",
    currency: "RUB",
  });
  const [categoryForm, setCategoryForm] = useState<CreateCategoryRequest>({
    name: "",
    hexColor: "#3B82F6",
    icon: undefined,
    parentId: undefined,
  });
  const [expenseForm, setExpenseForm] = useState<CreateExpenseRequest & { paymentMonths?: number }>({
    categoryId: "",
    subcategoryId: undefined,
    expenseDate: dayjs().format("YYYY-MM-DD"),
    amount: 0,
    description: "",
    currency: "RUB",
    accountId: undefined,
    isPlanned: false,
    creditAccountId: undefined,
    paymentMonths: 6,
  });
  /** Строка для поля ввода суммы (пустая = показываем "0", запятая разрешена). */
  const [expenseAmountInput, setExpenseAmountInput] = useState("");
  /** Режим «Банк → Кредит»: погашение кредита с выбранного банковского счёта. */
  const [isBankToLoanMode, setIsBankToLoanMode] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [confirmExpenseAmountModal, setConfirmExpenseAmountModal] = useState<{
    isOpen: boolean;
    expenseId: string;
    plannedAmount: number;
    actualAmount: string;
    isRecurring: boolean;
    recurringId?: string;
    expenseDate?: string;
    onConfirm: (amount: number) => Promise<void>;
  }>({
    isOpen: false,
    expenseId: "",
    plannedAmount: 0,
    actualAmount: "0",
    isRecurring: false,
    onConfirm: async () => {},
  });
  const [isConfirmingExpense, setIsConfirmingExpense] = useState(false);
  const [confirmExpenseModalError, setConfirmExpenseModalError] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFields, setRecurringFields] = useState({
    frequency: "Monthly" as "Weekly" | "BiWeekly" | "Monthly" | "Quarterly" | "Yearly",
    startDate: dayjs().format("YYYY-MM-DD"),
    endDate: undefined as string | undefined,
    notes: "",
    isPlanned: false,
  });
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryIconPickerOpen, setCategoryIconPickerOpen] = useState(false);
  const categoryIconFieldRef = useRef<HTMLDivElement>(null);
  const categoryColorInputRef = useRef<HTMLInputElement>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(new Set());
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("authToken");
  });
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: "danger" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "danger",
  });
  const [notificationModal, setNotificationModal] = useState<{
    isOpen: boolean;
    message: string;
    type?: "success" | "error" | "info";
  }>({
    isOpen: false,
    message: "",
    type: "success",
  });

  /// <summary>
  /// <para>Listens for logout events.</para>
  /// </summary>
  useEffect(() => {
    const handleLogout = () => {
      setIsAuthenticated(false);
    };
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  useEffect(() => {
    if (!showCategoryModal) {
      setCategoryIconPickerOpen(false);
    }
  }, [showCategoryModal]);

  useEffect(() => {
    if (!categoryIconPickerOpen) {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      const el = categoryIconFieldRef.current;
      if (el && !el.contains(e.target as Node)) {
        setCategoryIconPickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [categoryIconPickerOpen]);

  /// <summary>
  /// <para>Loads initial reference data.</para>
  /// </summary>
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    setIsBusy(true);
    Promise.all([
      financialApi.getCategories(),
      financialApi.getSummaries(selectedYear),
      financialApi.getCreditAccounts(),
      financialApi.getRecurringExpenses(),
      financialApi.getIncomeRecords(selectedYear),
      financialApi.getIncomeCycles(selectedYear),
      financialApi.getInvestments(),
      financialApi.getAccounts(),
      financialApi.getPendingCreditPayments(),
      financialApi.getPendingPlannedExpenses(),
      financialApi.getPendingPlannedIncome(),
    ])
      .then(([categoryResponse, summaryResponse, creditAccountsResponse, recurringExpensesResponse, incomeRecordsResponse, incomeCyclesResponse, investmentsResponse, accountsResponse, pendingPaymentsResponse, pendingExpensesResponse, pendingIncomeResponse]) => {
        const cats = categoryResponse.data;
        setCategories(cats);
        // Категории с подкатегориями свернуты по умолчанию
        const parentIdsToCollapse = cats.filter((c) => c.subcategories && c.subcategories.length > 0).map((c) => c.id);
        setCollapsedCategoryIds(new Set(parentIdsToCollapse));
        setSummaries(summaryResponse.data);
        setCreditAccounts(creditAccountsResponse.data);
        setRecurringExpenses(recurringExpensesResponse.data);
        setIncomeRecords(incomeRecordsResponse.data);
        setIncomeCycles(incomeCyclesResponse.data);
        setInvestments(investmentsResponse.data);
        setAccounts(accountsResponse.data);
        setPendingPayments(pendingPaymentsResponse.data);
        setCurrentPaymentIndex(0);
        // Combine pending expenses and income
        const allPending = [...pendingExpensesResponse.data, ...pendingIncomeResponse.data];
        setPendingPlannedTransactions(allPending);
        setCurrentPlannedTransactionIndex(0);
        if (categoryResponse.data.length > 0) {
          const firstCategory = categoryResponse.data.find((c) => !c.parentId) || categoryResponse.data[0];
          setExpenseForm((prev) => ({
            ...prev,
            categoryId: firstCategory.id,
          }));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsBusy(false));
  }, [selectedYear, isAuthenticated]);

  /// <summary>
  /// <para>Loads month-specific data whenever selection changes.</para>
  /// </summary>
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (activeTab === "finances" || activeTab === "planvsactual" || activeTab === "overview") {
      setIsBusy(true);
      Promise.all([
        financialApi.getExpenses(selectedYear, selectedMonth),
        financialApi.getCreditPaymentsForMonth(selectedYear, selectedMonth),
        financialApi.getLoanPaymentsForMonth(selectedYear, selectedMonth),
      ])
        .then(([expensesRes, creditPaymentsRes, loanPaymentsRes]) => {
          setExpenses(expensesRes.data);
          setCreditPaymentsForMonth(creditPaymentsRes.data);
          setLoanPaymentsForMonth(loanPaymentsRes.data);
        })
        .catch((err) => setError(err.message))
        .finally(() => setIsBusy(false));
    }
  }, [selectedYear, selectedMonth, activeTab, isAuthenticated]);

  // Объединённый список счетов для расхода: банковские + кредитные карты (в одном поле «Счет»)
  type ExpenseAccountOption = { id: string; name: string; isCreditCard: boolean; currency: string; balance?: number };
  const expenseAccounts = useMemo<ExpenseAccountOption[]>(() => {
    const bank = accounts
      .filter((acc) => acc.isActive && acc.accountType !== "Savings")
      .map((a) => ({ id: a.id, name: a.name, isCreditCard: false, currency: a.currency || "RUB", balance: a.balance }));
    const credit = (creditAccounts || [])
      .filter((a) => a.accountType === "CreditCard" && a.isActive)
      .map((a) => ({ id: a.id, name: a.name, isCreditCard: true, currency: "RUB" }));
    return [...bank, ...credit];
  }, [accounts, creditAccounts]);
  const bankAccountsOnly = useMemo(() => expenseAccounts.filter((a) => !a.isCreditCard), [expenseAccounts]);
  const loanAccountsOnly = useMemo(() => (creditAccounts || []).filter((a) => a.accountType === "Loan" && a.isActive), [creditAccounts]);
  const expenseAccountValue = isBankToLoanMode ? "__bank_to_loan__" : (expenseForm.accountId || expenseForm.creditAccountId || "");
  const selectedExpenseAccount = useMemo(
    () => (expenseAccountValue ? expenseAccounts.find((a) => a.id === expenseAccountValue) : undefined),
    [expenseAccountValue, expenseAccounts]
  );
  const prevShowExpenseModal = React.useRef(false);
  useEffect(() => {
    const justOpened = showExpenseModal && !prevShowExpenseModal.current;
    prevShowExpenseModal.current = showExpenseModal;
    if (justOpened) {
      if (!editingExpenseId) setExpenseAmountInput("");
      if (!editingExpenseId && expenseAccounts.length > 0) {
        const first = expenseAccounts[0];
        setExpenseForm((prev) => ({
          ...prev,
          accountId: first.isCreditCard ? undefined : first.id,
          creditAccountId: first.isCreditCard ? first.id : undefined,
          currency: first.currency || "RUB",
        }));
      }
    }
  }, [showExpenseModal, editingExpenseId, expenseAccounts]);

  /// <summary>
  // Removed body scroll blocking - modal can be scrolled independently

  /// <summary>
  /// <para>Provides chart data for plan versus actual amounts.</para>
  /// </summary>
  const summaryChartData = useMemo(
    () =>
      summaries.map((summary) => ({
        name: dayjs()
          .month(summary.month - 1)
          .format("MMM"),
        planned: summary.plannedExpense,
        actual: summary.actualExpense,
        balance: summary.closingBalance,
        color: summary.alertColor,
      })),
    [summaries]
  );

  /// <summary>
  /// <para>Provides per-category expenses for the selected month.</para>
  /// </summary>
  const categorySpendChart = useMemo(() => {
    const map = new Map<string, { name: string; amount: number }>();
    expenses
      .filter((e) => !e.isPlanned)
      .forEach((expense) => {
        const key = expense.categoryId;
        const current = map.get(key) ?? {
          name: expense.categoryName,
          amount: 0,
        };
        current.amount += expense.amount;
        map.set(key, current);
      });
    return Array.from(map.values());
  }, [expenses]);

  /// <summary>
  /// <para>Loads categories from the backend.</para>
  /// </summary>
  const loadCategories = async () => {
    try {
      const response = await financialApi.getCategories();
      setCategories(response.data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  /// <summary>
  /// <para>Persists a new category to the backend.</para>
  /// </summary>
  const handleAddCategory = async () => {
    if (!categoryForm.name.trim()) {
      setError("Введите название категории.");
      return;
    }
    setIsBusy(true);
    try {
      // Ensure hexColor is in correct format (#RRGGBB)
      const hexColor = categoryForm.hexColor.startsWith('#') 
        ? categoryForm.hexColor 
        : `#${categoryForm.hexColor}`;
      
      if (editingCategoryId) {
        const updatePayload: UpdateCategoryRequest = {
          name: categoryForm.name.trim(),
          hexColor: hexColor,
          icon: categoryForm.icon || undefined,
          parentId: categoryForm.parentId || null,
        };
        await financialApi.updateCategory(editingCategoryId, updatePayload);
      } else {
        const createPayload: CreateCategoryRequest = {
          name: categoryForm.name.trim(),
          hexColor: hexColor,
          icon: categoryForm.icon || undefined,
          parentId: categoryForm.parentId || undefined,
        };
        await financialApi.createCategory(createPayload);
      }
      await loadCategories();
      setCategoryForm({ name: "", hexColor: "#3B82F6", icon: undefined, parentId: undefined });
      setEditingCategoryId(null);
      setShowCategoryModal(false);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Ошибка при создании категории");
    } finally {
      setIsBusy(false);
    }
  };

  /// <summary>
  /// <para>Persists a new expense to the backend.</para>
  /// </summary>
  const handleAddExpense = async () => {
    if (!expenseForm.categoryId || expenseForm.amount <= 0) {
      setError("Заполните категорию и сумму");
      return;
    }
    if (isBankToLoanMode && (!expenseForm.accountId || !expenseForm.creditAccountId)) {
      setError("Выберите счёт списания и кредит для погашения");
      return;
    }

    setIsBusy(true);
    try {
      if (isRecurring) {
        // Создаем или обновляем повторяющийся расход
        if (editingExpenseId) {
          const recurringExpense = recurringExpenses.find(re => re.id === editingExpenseId);
          await financialApi.updateRecurringExpense(editingExpenseId, {
            categoryId: expenseForm.categoryId,
            subcategoryId: expenseForm.subcategoryId,
            title: expenseForm.description ?? "",
            amount: Number(expenseForm.amount),
            startDate: recurringFields.startDate,
            endDate: recurringFields.endDate,
            frequency: recurringFields.frequency,
            notes: recurringFields.notes || undefined,
            isActive: recurringExpense?.isActive ?? true,
            isPlanned: recurringFields.isPlanned || false,
          });
        } else {
          await financialApi.createRecurringExpense({
            categoryId: expenseForm.categoryId,
            subcategoryId: expenseForm.subcategoryId,
            title: expenseForm.description ?? "",
            amount: Number(expenseForm.amount),
            startDate: recurringFields.startDate,
            endDate: recurringFields.endDate,
            frequency: recurringFields.frequency,
            notes: recurringFields.notes || undefined,
            isPlanned: recurringFields.isPlanned || false,
          });
        }
        // Reload recurring expenses
        const refreshedRecurring = await financialApi.getRecurringExpenses();
        setRecurringExpenses(refreshedRecurring.data);
      } else {
        // Создаем или обновляем обычный расход
        if (editingExpenseId) {
          // Проверяем, не является ли editingExpenseId ID повторяющегося расхода
          const isRecurringId = recurringExpenses.some(re => re.id === editingExpenseId);
          if (isRecurringId) {
            // Это повторяющийся расход, обновляем его
            const recurringExpense = recurringExpenses.find(re => re.id === editingExpenseId);
            await financialApi.updateRecurringExpense(editingExpenseId, {
              categoryId: expenseForm.categoryId,
              subcategoryId: expenseForm.subcategoryId,
              title: expenseForm.description ?? "",
              amount: Number(expenseForm.amount),
              startDate: recurringFields.startDate,
              endDate: recurringFields.endDate,
              frequency: recurringFields.frequency,
              notes: recurringFields.notes || undefined,
              isActive: recurringExpense?.isActive ?? true,
            });
            const refreshedRecurring = await financialApi.getRecurringExpenses();
            setRecurringExpenses(refreshedRecurring.data);
          } else {
            // Это обычный расход
            await financialApi.updateExpense(editingExpenseId, {
              categoryId: expenseForm.categoryId,
              subcategoryId: expenseForm.subcategoryId,
              expenseDate: expenseForm.expenseDate,
              amount: Number(expenseForm.amount),
              description: expenseForm.description,
              plannedBudgetId: expenseForm.plannedBudgetId,
              currency: expenseForm.currency,
              accountId: expenseForm.accountId || null,
              creditAccountId: expenseForm.creditAccountId || null,
              isPlanned: expenseForm.isPlanned || false,
            });
          }
        } else {
          await financialApi.createExpense({
            ...expenseForm,
            amount: Number(expenseForm.amount),
            creditAccountId: expenseForm.creditAccountId || undefined,
            paymentMonths: expenseForm.creditAccountId ? (expenseForm.paymentMonths ?? 6) : undefined,
          });
        }
      }
      // Переключаем на месяц созданного расхода, чтобы пользователь увидел новую запись
      const dateToShow = isRecurring ? recurringFields.startDate : expenseForm.expenseDate;
      const createdDate = dayjs(dateToShow);
      const targetYear = createdDate.year();
      const targetMonth = createdDate.month() + 1;
      setSelectedYear(targetYear);
      setSelectedMonth(targetMonth);

      const [refreshedExpenses, pendingExpensesResponse, pendingIncomeResponse, summaryResponse, creditPaymentsRes, loanPaymentsRes] = await Promise.all([
        financialApi.getExpenses(targetYear, targetMonth),
        financialApi.getPendingPlannedExpenses(),
        financialApi.getPendingPlannedIncome(),
        financialApi.getSummaries(targetYear),
        financialApi.getCreditPaymentsForMonth(targetYear, targetMonth),
        financialApi.getLoanPaymentsForMonth(targetYear, targetMonth),
      ]);
      setExpenses(refreshedExpenses.data);
      const allPending = [...pendingExpensesResponse.data, ...pendingIncomeResponse.data];
      setPendingPlannedTransactions(allPending);
      setSummaries(summaryResponse.data);
      setCreditPaymentsForMonth(creditPaymentsRes.data);
      setLoanPaymentsForMonth(loanPaymentsRes.data);
      setExpenseForm((prev) => ({ ...prev, amount: 0, description: "", subcategoryId: undefined, currency: "RUB", accountId: undefined, creditAccountId: undefined, paymentMonths: 6, isPlanned: false }));
      setIsBankToLoanMode(false);
      setExpenseAmountInput("");
      setEditingExpenseId(null);
      setIsRecurring(false);
      setRecurringFields({
        frequency: "Monthly",
        startDate: dayjs().format("YYYY-MM-DD"),
        endDate: undefined,
        notes: "",
        isPlanned: false,
      });
      setShowExpenseModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const matchId = (id: string | undefined | null, list: { id: string }[]) =>
    id != null ? list.find((x) => x.id.toLowerCase() === String(id).toLowerCase())?.id ?? String(id) : undefined;

  const applyExpenseToForm = (data: ExpenseDto) => {
    const currency =
      data.currency ||
      (data.creditAccountId ? "RUB" : undefined) ||
      (data.accountId ? accounts.find((a) => a.id.toLowerCase() === String(data.accountId).toLowerCase())?.currency : undefined) ||
      "RUB";
    const rawDate = data.expenseDate;
    const expenseDateStr =
      typeof rawDate === "string"
        ? rawDate.slice(0, 10)
        : rawDate && typeof rawDate === "object" && rawDate !== null && "year" in (rawDate as object)
          ? (() => {
              const d = rawDate as { year: number; month: number; day: number };
              return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
            })()
          : "";
    const amountNum = Number(data.amount);
    const accountIdStr = matchId(data.accountId, expenseAccounts);
    const creditAccountIdStr = matchId(data.creditAccountId, expenseAccounts);
    const categoryIdStr = matchId(data.categoryId, parentCategories) ?? "";
    const subsForCategory = parentCategories.find((c) => c.id === categoryIdStr)?.subcategories ?? [];
    const subcategoryIdStr = matchId(data.subcategoryId, subsForCategory);
    setExpenseForm({
      categoryId: categoryIdStr,
      subcategoryId: subcategoryIdStr,
      expenseDate: expenseDateStr,
      amount: amountNum,
      description: data.description ?? "",
      currency,
      accountId: accountIdStr,
      plannedBudgetId: data.plannedBudgetId != null ? String(data.plannedBudgetId) : undefined,
      isPlanned: data.isPlanned ?? false,
      creditAccountId: creditAccountIdStr,
    });
    setExpenseAmountInput(amountNum === 0 ? "" : String(amountNum).replace(".", ","));
  };

  const handleEditExpense = async (expense: ExpenseDto) => {
    setError(null);
    setEditingExpenseId(expense.id);
    setIsRecurring(false);
    try {
      const res = await financialApi.getExpense(expense.id);
      const data = res.data;
      applyExpenseToForm(data);
      setShowExpenseModal(true);
    } catch (err: unknown) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Не удалось загрузить расход");
      setEditingExpenseId(null);
    }
  };

  const handleDeleteExpense = (id: string) => {
    setConfirmationModal({
      isOpen: true,
      title: "Удаление расхода",
      message: "Удалить расход?",
      onConfirm: async () => {
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
        setIsBusy(true);
        try {
          await financialApi.deleteExpense(id);
          const [refreshed, summaryResponse, creditPaymentsRes, loanPaymentsRes] = await Promise.all([
            financialApi.getExpenses(selectedYear, selectedMonth),
            financialApi.getSummaries(selectedYear),
            financialApi.getCreditPaymentsForMonth(selectedYear, selectedMonth),
            financialApi.getLoanPaymentsForMonth(selectedYear, selectedMonth),
          ]);
          setExpenses(refreshed.data);
          setSummaries(summaryResponse.data);
          setCreditPaymentsForMonth(creditPaymentsRes.data);
          setLoanPaymentsForMonth(loanPaymentsRes.data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsBusy(false);
        }
      },
    });
  };

  const selectedCategory = categories.find((c) => c.id === expenseForm.categoryId);
  const subcategories = selectedCategory?.subcategories || [];
  const parentCategories = categories.filter((c) => !c.parentId);

  // Calculate monthly summary for sidebar (до early return — все хуки должны вызываться до return)
  const currentSummary = summaries.find(
    (s) => s.year === selectedYear && s.month === selectedMonth
  );

  // Диапазон дат: 8–23 или 24–7 (24 текущего по 7 следующего) при useHalfMonth
  const { periodStartDate, periodEndDate } = useMemo(() => {
    const start = dayjs(`${selectedYear}-${selectedMonth}-01`);
    const end = start.endOf("month");
    if (!useHalfMonth) {
      return { periodStartDate: start.format("YYYY-MM-DD"), periodEndDate: end.format("YYYY-MM-DD") };
    }
    if (selectedPeriod === "first") {
      return { periodStartDate: start.date(8).format("YYYY-MM-DD"), periodEndDate: start.date(23).format("YYYY-MM-DD") };
    }
    // 24 текущего — 7 следующего
    const nextMonth = start.add(1, "month");
    return { periodStartDate: start.date(24).format("YYYY-MM-DD"), periodEndDate: nextMonth.date(7).format("YYYY-MM-DD") };
  }, [selectedYear, selectedMonth, selectedPeriod, useHalfMonth]);
  
  // Вычисляем доходы и расходы по валютам (за месяц или за полумесяц при useHalfMonth)
  const incomeByCurrency = useMemo(() => {
    const incomeMap: Record<string, number> = {};
    const start = dayjs(periodStartDate).startOf("day");
    const end = dayjs(periodEndDate).endOf("day");

    incomeRecords
      .filter((record) => {
        const recordDate = dayjs(record.receivedDate);
        return (recordDate.isAfter(start) || recordDate.isSame(start, "day"))
          && (recordDate.isBefore(end) || recordDate.isSame(end, "day"))
          && !record.isPlanned;
      })
      .forEach((record) => {
        const currency = record.currency || "RUB";
        incomeMap[currency] = (incomeMap[currency] || 0) + record.amount;
      });

    return incomeMap;
  }, [incomeRecords, periodStartDate, periodEndDate]);

  const expensesByCurrency = useMemo(() => {
    const expenseMap: Record<string, number> = {};
    const start = dayjs(periodStartDate).startOf("day");
    const end = dayjs(periodEndDate).endOf("day");

    expenses
      .filter((expense) => {
        const expenseDate = dayjs(expense.expenseDate);
        return (expenseDate.isAfter(start) || expenseDate.isSame(start, "day"))
          && (expenseDate.isBefore(end) || expenseDate.isSame(end, "day"))
          && !expense.isPlanned;
      })
      .forEach((expense) => {
        const currency = expense.currency || "RUB";
        expenseMap[currency] = (expenseMap[currency] || 0) + expense.amount;
      });

    return expenseMap;
  }, [expenses, periodStartDate, periodEndDate]);

  // Доход/расход за период: при полумесяцах — сумма по отфильтрованным данным, иначе — из сводки по месяцу
  const monthlyIncome = useHalfMonth
    ? Object.values(incomeByCurrency).reduce((a, b) => a + b, 0)
    : (currentSummary?.actualIncome ?? 0);
  const monthlyExpense = useHalfMonth
    ? Object.values(expensesByCurrency).reduce((a, b) => a + b, 0)
    : (currentSummary?.actualExpense ?? 0);
  
  // Calculate total balance from all accounts grouped by currency (excluding Savings/Investments)
  const balancesByCurrency = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts
      .filter((acc) => acc.accountType !== "Savings" && acc.isActive)
      .forEach((acc) => {
        const currency = acc.currency || "RUB";
        balances[currency] = (balances[currency] || 0) + acc.balance;
      });
    return balances;
  }, [accounts]);

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }
  
  // Доступные средства за месяц = входящие − траты (те же источники, что и в карточках «Входящие» и «Траты»)
  const availableFromMonthRUB = (incomeByCurrency["RUB"] ?? 0) - (expensesByCurrency["RUB"] ?? 0);

  // Note: Expense list calculation moved to ExpenseList component

  // Tab icons mapping
  const tabIcons: Record<TabType, string> = {
    overview: "📊",
    finances: "💰",
    credits: "💳",
    reports: "📋",
    planvsactual: "📊",
  };

  // Function to detect payment system from card number and return JSX with official logos
  const getPaymentSystemIcon = (accountNumber: string): { type: "MIR" | "VISA" | "MC" | "UNKNOWN"; element: React.ReactElement } => {
    if (!accountNumber) {
      return {
        type: "UNKNOWN",
        element: <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#94a3b8" }}>💳</span>
      };
    }
    const cleanNumber = accountNumber.replace(/\s/g, "");
    const firstDigit = cleanNumber[0];
    const firstFour = cleanNumber.substring(0, 4);
    
    // MIR: 2200-2204
    if (firstFour >= "2200" && firstFour <= "2204") {
      return {
        type: "MIR",
        element: (
          <svg width="36" height="24" viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
            <rect width="36" height="24" rx="3" fill="#FF6B35"/>
            <text x="18" y="15" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="700" fill="white" textAnchor="middle" letterSpacing="0.5px">МИР</text>
          </svg>
        )
      };
    }
    // Visa: starts with 4
    if (firstDigit === "4") {
      return {
        type: "VISA",
        element: (
          <svg width="36" height="24" viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
            <rect width="36" height="24" rx="3" fill="#1434CB"/>
            <text x="18" y="16" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" fill="white" textAnchor="middle" letterSpacing="1.5px">VISA</text>
          </svg>
        )
      };
    }
    // Mastercard: starts with 5 or 2 (but not MIR range)
    if (firstDigit === "5" || (firstDigit === "2" && (firstFour < "2200" || firstFour > "2204"))) {
      return {
        type: "MC",
        element: (
          <svg width="36" height="24" viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
            <rect width="36" height="24" rx="3" fill="#1A1F71"/>
            <circle cx="13" cy="12" r="5.5" fill="#EB001B"/>
            <circle cx="23" cy="12" r="5.5" fill="#F79E1B"/>
            <path d="M18 7.5C19.5 9 20.5 10.5 20.5 12C20.5 13.5 19.5 15 18 16.5C16.5 15 15.5 13.5 15.5 12C15.5 10.5 16.5 9 18 7.5Z" fill="#FF5F00"/>
          </svg>
        )
      };
    }
    return {
      type: "UNKNOWN",
      element: <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#94a3b8" }}>💳</span>
    };
  };

  // SVG иконка карандаша для редактирования
  const EditIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.3333 2.00001C11.5084 1.8249 11.7163 1.68601 11.9444 1.59123C12.1726 1.49646 12.4163 1.44775 12.6625 1.44775C12.9087 1.44775 13.1524 1.49646 13.3806 1.59123C13.6087 1.68601 13.8166 1.8249 13.9917 2.00001C14.1668 2.17512 14.3057 2.38302 14.4005 2.61113C14.4952 2.83924 14.5439 3.08298 14.5439 3.32918C14.5439 3.57538 14.4952 3.81912 14.4005 4.04723C14.3057 4.27534 14.1668 4.48324 13.9917 4.65835L4.6625 13.9875L1.33333 14.6667L2.0125 11.3375L11.3333 2.00001Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const ChevronDownIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const ChevronRightIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const PlusIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 3V11M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const toggleCategoryCollapse = (categoryId: string) => {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  // Функция для получения символа валюты
  const getCurrencySymbol = (currency?: string): string => {
    switch (currency) {
      case "USD": return "$";
      case "EUR": return "€";
      case "GBP": return "£";
      case "RUB":
      default:
        return "₽";
    }
  };

  // Функция для форматирования суммы с валютой
  const formatAmount = (amount: number, currency?: string): string => {
    const symbol = getCurrencySymbol(currency);
    return `${amount.toFixed(2)} ${symbol}`;
  };

  return (
    <div className="app">
      {/* Logo - на уровне с шестеренкой */}
      <div className="app__logo-top">
        <div className="app__logo-icon">e</div>
        <span>ethereal</span>
      </div>

      {/* Floating Navigation Island at Top - зафиксировано */}
      <nav className="app__floating-nav-top">
        <div className="app__floating-nav-top__tabs">
            <button
              className={`app__floating-nav-top__tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <span className="app__floating-nav-top__tab-icon">{tabIcons.overview}</span>
              <span>Обзор</span>
            </button>
            <button
              className={`app__floating-nav-top__tab ${activeTab === "finances" ? "active" : ""}`}
              onClick={() => setActiveTab("finances")}
            >
              <span className="app__floating-nav-top__tab-icon">{tabIcons.finances}</span>
              <span>Финансы</span>
            </button>
            <button
              className={`app__floating-nav-top__tab ${activeTab === "credits" ? "active" : ""}`}
              onClick={() => setActiveTab("credits")}
            >
              <span className="app__floating-nav-top__tab-icon">{tabIcons.credits}</span>
              <span>Кредиты</span>
            </button>
            <button
              className={`app__floating-nav-top__tab ${activeTab === "planvsactual" ? "active" : ""}`}
              onClick={() => setActiveTab("planvsactual")}
            >
              <span className="app__floating-nav-top__tab-icon">{tabIcons.planvsactual}</span>
              <span>План/Факт</span>
            </button>
          </div>
        <div className="app__floating-nav-top__indicator" style={{ 
          left: `${['overview', 'finances', 'credits', 'planvsactual'].indexOf(activeTab) * (100 / 4)}%`,
          width: `${100 / 4}%`
        }} />
      </nav>

      {/* Main Content Area */}
      <main className="app__main">
        <header className="app__header" style={{ marginTop: "0" }}>
        <div>
          <h1>Мой дашборд</h1>
        </div>
      </header>


      {isBusy && <div className="app__loading">Загрузка...</div>}

      {activeTab === "overview" && (
        <>
          {/* Dashboard Cards Row: слева — Доступные средства (большая), справа — Входящие и Траты друг под другом */}
          <div className="app__dashboard-cards">
            {/* Доступные средства — слева, крупная карточка */}
            <div className="dashboard-card" style={{ minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div className="dashboard-card__title">Доступные средства</div>
              <div className="dashboard-card__amount">
                <div style={{ fontSize: "2rem", fontWeight: 700 }}>
                  {availableFromMonthRUB >= 0 ? "+" : ""}{formatAmount(availableFromMonthRUB, "RUB")}
                </div>
              </div>
              <div className="dashboard-card__subtitle">
                {availableFromMonthRUB >= 0
                  ? (useHalfMonth
                      ? `Входящие − траты за ${selectedPeriod === "first" ? "8–23" : "24–7"}`
                      : "Входящие − траты за месяц")
                  : (useHalfMonth
                      ? `Траты превышают входящие за ${selectedPeriod === "first" ? "8–23" : "24–7"}`
                      : "Траты превышают входящие за месяц")}
                <span style={{ display: "block", fontSize: "0.75rem", opacity: 0.7, marginTop: "0.25rem" }}>
                  (доходы и расходы только в рублях)
                </span>
                {Object.keys(balancesByCurrency).length > 0 && (
                  <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.85, marginTop: "0.35rem" }}>
                    Остаток на счетах и картах на сейчас (без накопительных): {formatAmount(balancesByCurrency["RUB"] ?? 0, "RUB")}
                    <span style={{ display: "block", fontSize: "0.7rem", opacity: 0.7, marginTop: "0.2rem" }}>
                      — это то, что уже лежит на счетах; «Доступные средства» выше — результат за выбранный месяц (входящие − траты).
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Справа: Входящие платежи и Траты — один столбец, друг под другом */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="income-card">
                <div className="income-card__label">Входящие платежи</div>
                {monthlyIncome === 0 && Object.keys(incomeByCurrency).length === 0 ? (
                  <div className="income-card__amount" style={{ fontSize: "1rem", color: "#94a3b8", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60px" }}>
                    Данные отсутствуют
                  </div>
                ) : (
                  <>
                    <div className="income-card__amount">
                      {Object.keys(incomeByCurrency).length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {Object.entries(incomeByCurrency)
                            .filter(([, amount]) => amount > 0)
                            .map(([currency, amount]) => {
                              const showCurrency = currency && currency !== "RUB";
                              return (
                                <div key={currency} style={{ fontSize: currency === "RUB" ? "2rem" : "1.5rem", fontWeight: 700 }}>
                                  +{showCurrency ? formatAmount(amount, currency) : `${amount.toFixed(2)} ₽`}
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        `+${formatAmount(monthlyIncome, "RUB")}`
                      )}
                    </div>
                    <div className="income-card__subtitle">
                      {useHalfMonth ? `Доходы за ${selectedPeriod === "first" ? "8–23" : "24–7"}` : "Доходы за месяц"}
                    </div>
                    <div className="income-card__badge">
                      {currentSummary?.plannedIncome && currentSummary.plannedIncome > 0
                        ? `+${((monthlyIncome / currentSummary.plannedIncome - 1) * 100).toFixed(1)}%`
                        : "+0%"}
                    </div>
                  </>
                )}
              </div>

              <div className="expense-card">
                <div className="expense-card__label">Траты</div>
                {monthlyExpense === 0 && Object.keys(expensesByCurrency).length === 0 ? (
                  <div className="expense-card__amount" style={{ fontSize: "1rem", color: "#94a3b8", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60px" }}>
                    Данные отсутствуют
                  </div>
                ) : (
                  <>
                    <div className="expense-card__amount">
                      {Object.keys(expensesByCurrency).length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {Object.entries(expensesByCurrency)
                            .filter(([, amount]) => amount > 0)
                            .map(([currency, amount]) => {
                              const showCurrency = currency && currency !== "RUB";
                              return (
                                <div key={currency} style={{ fontSize: currency === "RUB" ? "2rem" : "1.5rem", fontWeight: 700 }}>
                                  -{showCurrency ? formatAmount(amount, currency) : `${amount.toFixed(2)} ₽`}
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        `-${formatAmount(monthlyExpense, "RUB")}`
                      )}
                    </div>
                    <div className="expense-card__subtitle">
                      {useHalfMonth ? `Расходы за ${selectedPeriod === "first" ? "8–23" : "24–7"}` : "Расходы за месяц"}
                    </div>
                    <div className="expense-card__badge">
                      {currentSummary?.plannedExpense && currentSummary.plannedExpense > 0
                        ? `${((monthlyExpense / currentSummary.plannedExpense - 1) * 100).toFixed(1)}%`
                        : "0%"}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="app__charts-row">
            <section className="panel">
              <div className="panel__header">
                <h2>Поток доходов</h2>
              </div>
              <div className="panel__content">
                <div className="chart">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={summaryChartData}>
                      <defs>
                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        stroke="#8b5cf6"
                        fillOpacity={1}
                        fill="url(#colorActual)"
                        name="Доходы"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel__header">
                <h2>Расходы по категориям</h2>
              </div>
              <div className="panel__content">
                <div className="chart">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categorySpendChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                      <Legend />
                      <Bar dataKey="amount" fill="#10b981" name="Расходы" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </div>
        </>
      )}

      {activeTab === "finances" && (
        <>
          <FinancesPanel
            incomeSection={
              <section className="panel">
                <div className="panel__header">
                  <h2>
                    {useHalfMonth && selectedPeriod === "first"
                      ? "Доходы за 8–23"
                      : useHalfMonth && selectedPeriod === "second"
                        ? "Доходы за 24–7"
                        : "Доходы"}
                  </h2>
                  <button onClick={() => {
                    const event = new CustomEvent('income:new');
                    window.dispatchEvent(event);
                  }}>Добавить доход</button>
                </div>
                <div className="panel__content">
                  <IncomeRecords 
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    periodStartDate={periodStartDate}
                    periodEndDate={periodEndDate}
                    records={incomeRecords}
                    incomeCycles={incomeCycles}
                    accounts={accounts}
                    onSuccess={(message) => {
                      setNotificationModal({
                        isOpen: true,
                        message: message,
                        type: "success",
                      });
                    }}
                    onConfirmPlanned={async () => {
                      const [pendingExpensesResponse, pendingIncomeResponse, recordsResponse, cyclesResponse] = await Promise.all([
                        financialApi.getPendingPlannedExpenses(),
                        financialApi.getPendingPlannedIncome(),
                        financialApi.getIncomeRecords(selectedYear),
                        financialApi.getIncomeCycles(selectedYear),
                      ]);
                      const allPending = [...pendingExpensesResponse.data, ...pendingIncomeResponse.data];
                      setPendingPlannedTransactions(allPending);
                      setIncomeRecords(recordsResponse.data);
                      setIncomeCycles(cyclesResponse.data);
                    }}
                    onNewClick={async () => {
                      const [recordsResponse, cyclesResponse] = await Promise.all([
                        financialApi.getIncomeRecords(selectedYear),
                        financialApi.getIncomeCycles(selectedYear),
                      ]);
                      setIncomeRecords(recordsResponse.data);
                      setIncomeCycles(cyclesResponse.data);
                    }}
                    onEdit={async () => {
                      const [recordsResponse, cyclesResponse] = await Promise.all([
                        financialApi.getIncomeRecords(selectedYear),
                        financialApi.getIncomeCycles(selectedYear),
                      ]);
                      setIncomeRecords(recordsResponse.data);
                      setIncomeCycles(cyclesResponse.data);
                    }}
                    onDelete={async (_id) => {
                      const [recordsResponse, cyclesResponse] = await Promise.all([
                        financialApi.getIncomeRecords(selectedYear),
                        financialApi.getIncomeCycles(selectedYear),
                      ]);
                      setIncomeRecords(recordsResponse.data);
                      setIncomeCycles(cyclesResponse.data);
                    }}
                  />
                </div>
              </section>
            }
            expenseSection={
              <section className="panel">
                <div className="panel__header">
                  <h2>
                    {useHalfMonth && selectedPeriod === "first"
                      ? "Расходы за 8–23"
                      : useHalfMonth && selectedPeriod === "second"
                        ? "Расходы за 24–7"
                        : "Расходы за месяц"}
                  </h2>
                  <button onClick={() => { setError(null); setShowExpenseModal(true); }}>Добавить расход</button>
                </div>
                <div className="panel__content">
                  <ExpenseList
                expenses={expenses}
                recurringExpenses={recurringExpenses}
                categories={categories}
                creditPayments={creditPaymentsForMonth}
                loanPayments={loanPaymentsForMonth}
                creditAccounts={creditAccounts}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                periodStartDate={periodStartDate}
                periodEndDate={periodEndDate}
                onEdit={handleEditExpense}
                onDelete={handleDeleteExpense}
                onConfirmPlanned={async (id: string) => {
                  // Credit payment: confirm directly without modal
                  if (id.startsWith("credit-")) {
                    const paymentScheduleId = id.replace("credit-", "");
                    try {
                      await financialApi.confirmCreditPayment(paymentScheduleId);
                      const [refreshedExpenses, refreshedCreditPayments] = await Promise.all([
                        financialApi.getExpenses(selectedYear, selectedMonth),
                        financialApi.getCreditPaymentsForMonth(selectedYear, selectedMonth),
                      ]);
                      setExpenses(refreshedExpenses.data);
                      setCreditPaymentsForMonth(refreshedCreditPayments.data);
                      setNotificationModal({
                        isOpen: true,
                        message: "Платеж подтвержден и добавлен в расходы",
                        type: "success",
                      });
                    } catch (err: any) {
                      setError(err.message);
                    }
                    return;
                  }
                  // Loan payment: confirm and create expense
                  if (id.startsWith("loan-")) {
                    const creditAccountId = id.replace("loan-", "");
                    const loanPayment = loanPaymentsForMonth.find((p) => p.creditAccountId === creditAccountId);
                    if (!loanPayment) return;
                    try {
                      await financialApi.confirmLoanPayment(
                        creditAccountId,
                        selectedYear,
                        selectedMonth,
                        loanPayment.scheduledDay ?? 1,
                        loanPayment.paymentAmount
                      );
                      const [refreshedExpenses, refreshedLoanPayments] = await Promise.all([
                        financialApi.getExpenses(selectedYear, selectedMonth),
                        financialApi.getLoanPaymentsForMonth(selectedYear, selectedMonth),
                      ]);
                      setExpenses(refreshedExpenses.data);
                      setLoanPaymentsForMonth(refreshedLoanPayments.data);
                      setNotificationModal({
                        isOpen: true,
                        message: "Платеж по кредиту подтвержден и добавлен в расходы",
                        type: "success",
                      });
                    } catch (err: any) {
                      setError(err.message);
                    }
                    return;
                  }
                  // Find the expense to get its amount
                  const expense = expenses.find(e => e.id === id);
                  const recurringExpense = recurringExpenses.find(re => {
                    // Check if id matches recurring expense pattern
                    const parts = id.split("-");
                    if (parts.length >= 5) {
                      const recurringId = parts.slice(0, -3).join("-");
                      return re.id === recurringId;
                    }
                    return false;
                  });

                  let plannedAmount = expense?.amount || 0;
                  let isRecurring = false;
                  let recurringId: string | undefined;
                  let expenseDate: string | undefined;

                  // Check if this is a recurring expense ID (format: {recurringId}-{date})
                  const parts = id.split("-");
                  if (parts.length >= 5 && recurringExpense) {
                    isRecurring = true;
                    expenseDate = parts.slice(-3).join("-"); // Last 3 parts form YYYY-MM-DD
                    recurringId = parts.slice(0, -3).join("-"); // Everything before date
                    plannedAmount = recurringExpense.amount;
                  } else if (expense) {
                    plannedAmount = expense.amount;
                  }

                  setConfirmExpenseModalError(null);
                  setConfirmExpenseAmountModal({
                    isOpen: true,
                    expenseId: id,
                    plannedAmount: plannedAmount,
                    actualAmount: plannedAmount === 0 ? "" : plannedAmount.toFixed(2).replace(".", ","),
                    isRecurring: isRecurring,
                    recurringId: recurringId,
                    expenseDate: expenseDate,
                    onConfirm: async (amount: number) => {
                      try {
                        const requestBody = amount !== plannedAmount ? { amount } : null;

                        if (isRecurring && recurringId && expenseDate) {
                          await financialApi.confirmPlannedRecurringExpense(recurringId, expenseDate, requestBody);
                        } else {
                          await financialApi.confirmPlannedExpense(id, requestBody);
                        }
                        
                        const [refreshedExpenses, pendingExpensesResponse, pendingIncomeResponse] = await Promise.all([
                          financialApi.getExpenses(selectedYear, selectedMonth),
                          financialApi.getPendingPlannedExpenses(),
                          financialApi.getPendingPlannedIncome(),
                        ]);
                        setExpenses(refreshedExpenses.data);
                        const allPending = [...pendingExpensesResponse.data, ...pendingIncomeResponse.data];
                        setPendingPlannedTransactions(allPending);
                        setConfirmExpenseAmountModal((prev) => ({ ...prev, isOpen: false }));
                        setNotificationModal({
                          isOpen: true,
                          message: "Расход подтвержден",
                          type: "success",
                        });
                      } catch (err: any) {
                        const msg = err?.response?.data?.message ?? err?.message ?? "Ошибка при подтверждении";
                        setError(msg);
                        setConfirmExpenseModalError(msg);
                        throw err;
                      }
                    },
                  });
                }}
                onEditRecurring={(recurringId: string) => {
                  const recurringExpense = recurringExpenses.find(re => re.id === recurringId);
                  if (recurringExpense) {
                    setError(null);
                    setIsRecurring(true);
                    const isPlanned = !!recurringExpense.isPlanned;
                    setExpenseForm({
                      categoryId: recurringExpense.categoryId,
                      subcategoryId: recurringExpense.subcategoryId,
                      expenseDate: dayjs().format("YYYY-MM-DD"),
                      amount: recurringExpense.amount,
                      description: recurringExpense.title,
                      currency: "RUB",
                      accountId: undefined,
                      isPlanned,
                    });
                    setRecurringFields({
                      frequency: recurringExpense.frequency,
                      startDate: recurringExpense.startDate,
                      endDate: recurringExpense.endDate,
                      notes: recurringExpense.notes || "",
                      isPlanned,
                    });
                    setEditingExpenseId(recurringId);
                    setShowExpenseModal(true);
                  }
                }}
                onDeleteRecurring={(recurringId: string) => {
                  setConfirmationModal({
                    isOpen: true,
                    title: "Удаление повторяющегося расхода",
                    message: "Удалить повторяющийся расход? Все связанные записи будут удалены.",
                    onConfirm: async () => {
                      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
                      setIsBusy(true);
                      try {
                        await financialApi.deleteRecurringExpense(recurringId);
                        const refreshed = await financialApi.getRecurringExpenses();
                        setRecurringExpenses(refreshed.data);
                      } catch (err: any) {
                        setError(err.message);
                      } finally {
                        setIsBusy(false);
                      }
                    },
                  });
                }}
              />
            </div>
          </section>
            }
            investmentSection={
              <section className="panel">
                <div className="panel__header">
                  <h2>Инвестиции</h2>
                  <button onClick={() => {
                    const event = new CustomEvent('investment:new');
                    window.dispatchEvent(event);
                  }}>Добавить инвестиции</button>
                </div>
                <div className="panel__content">
                  <Investments 
                    investments={investments}
                    onNewClick={async () => {
                      const response = await financialApi.getInvestments();
                      setInvestments(response.data);
                    }}
                    onEdit={async () => {
                      const response = await financialApi.getInvestments();
                      setInvestments(response.data);
                    }}
                    onDelete={async (id) => {
                      await financialApi.deleteInvestment(id);
                      const response = await financialApi.getInvestments();
                      setInvestments(response.data);
                    }}
                  />
                </div>
              </section>
            }
          />

          {/* Expense Modal */}
          {showExpenseModal && (
            <div className="modal-overlay" onClick={() => { setShowExpenseModal(false); setError(null); setEditingExpenseId(null); setIsBankToLoanMode(false); }}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal__header">
                  <h2>{editingExpenseId ? "Редактировать" : "Добавить"} расход</h2>
                  <button onClick={() => { setShowExpenseModal(false); setError(null); setEditingExpenseId(null); setIsBankToLoanMode(false); }}>✕</button>
                </div>
                <div className="modal__content">
                  {error && <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}
                  <div className="form">
                  <label>
                    Категория
                    <select
                      value={expenseForm.categoryId}
                      onChange={(e) =>
                        setExpenseForm({ ...expenseForm, categoryId: e.target.value, subcategoryId: undefined })
                      }
                    >
                      <option value="">Выберите категорию</option>
                      {parentCategories.map((category) => (
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
                        value={expenseForm.subcategoryId || ""}
                        onChange={(e) =>
                          setExpenseForm({ ...expenseForm, subcategoryId: e.target.value || undefined })
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
                    Дата
                    <input
                      type="date"
                      value={expenseForm.expenseDate}
                      onChange={(e) =>
                        setExpenseForm({ ...expenseForm, expenseDate: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Сумма
                    <input
                      type="text"
                      inputMode="decimal"
                      value={expenseAmountInput || "0"}
                      onFocus={(e) => {
                        if (expenseAmountInput === "" || expenseAmountInput === "0") e.target.select();
                      }}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const filtered = filterAmountInput(raw);
                        setExpenseAmountInput(filtered);
                        setExpenseForm({
                          ...expenseForm,
                          amount: parseAmountStr(filtered),
                        });
                      }}
                      placeholder="0"
                    />
                  </label>
                  <label>
                    Тип платежа / Счет
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <select
                        value={expenseAccountValue}
                        onChange={(e) => {
                          const id = e.target.value || undefined;
                          if (id === "__bank_to_loan__") {
                            setIsBankToLoanMode(true);
                            setExpenseForm({ ...expenseForm, accountId: undefined, creditAccountId: undefined, paymentMonths: 6, currency: "RUB" });
                            return;
                          }
                          setIsBankToLoanMode(false);
                          const acc = expenseAccounts.find((a) => a.id === id);
                          if (!acc) {
                            setExpenseForm({ ...expenseForm, accountId: undefined, creditAccountId: undefined, paymentMonths: 6, currency: expenseForm.currency || "RUB" });
                            return;
                          }
                          setExpenseForm({
                            ...expenseForm,
                            accountId: acc.isCreditCard ? undefined : acc.id,
                            creditAccountId: acc.isCreditCard ? acc.id : undefined,
                            currency: acc.currency || "RUB",
                            paymentMonths: acc.isCreditCard ? (expenseForm.paymentMonths ?? 6) : undefined,
                          });
                        }}
                        style={{ flex: "1", minWidth: "0" }}
                      >
                        <option value="">Не указывать</option>
                        <option value="__bank_to_loan__">Банк → Кредит (погашение)</option>
                        {expenseAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.isCreditCard ? `💳 Кредитная карта: ${account.name}` : `${account.name} (${formatAmount(account.balance ?? 0, account.currency)})`}
                          </option>
                        ))}
                      </select>
                      {selectedExpenseAccount ? (
                        <span style={{ color: "#cbd5e1", whiteSpace: "nowrap" }}>
                          {getCurrencySymbol(selectedExpenseAccount.currency)}
                          {selectedExpenseAccount.currency || "RUB"}
                        </span>
                      ) : (
                        <select
                          value={expenseForm.currency || "RUB"}
                          onChange={(e) =>
                            setExpenseForm({ ...expenseForm, currency: e.target.value })
                          }
                          style={{ width: "auto" }}
                        >
                          <option value="RUB">₽ RUB</option>
                          <option value="USD">$ USD</option>
                          <option value="EUR">€ EUR</option>
                          <option value="GBP">£ GBP</option>
                        </select>
                      )}
                    </div>
                    {isBankToLoanMode && (
                      <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label>
                          Счёт списания
                          <select
                            value={expenseForm.accountId || ""}
                            onChange={(e) => {
                              const id = e.target.value || undefined;
                              setExpenseForm({ ...expenseForm, accountId: id });
                            }}
                            style={{ width: "100%", marginTop: "0.25rem" }}
                          >
                            <option value="">Выберите счёт</option>
                            {bankAccountsOnly.map((a) => (
                              <option key={a.id} value={a.id}>{a.name} ({formatAmount(a.balance ?? 0, a.currency)})</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Кредит (погашение)
                          <select
                            value={expenseForm.creditAccountId || ""}
                            onChange={(e) => {
                              const id = e.target.value || undefined;
                              const loan = id ? loanAccountsOnly.find((l) => l.id === id) : null;
                              setExpenseForm({
                                ...expenseForm,
                                creditAccountId: id,
                                amount: loan?.monthlyPayment ?? 0,
                                description: loan ? `Платеж по кредиту ${loan.name}` : expenseForm.description,
                                categoryId: (categories.find((c) => c.name === "Кредиты")?.id) || expenseForm.categoryId,
                                subcategoryId: undefined,
                              });
                              setExpenseAmountInput(loan?.monthlyPayment != null ? String(loan.monthlyPayment) : "");
                            }}
                            style={{ width: "100%", marginTop: "0.25rem" }}
                          >
                            <option value="">Выберите кредит</option>
                            {loanAccountsOnly.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} {a.monthlyPayment != null ? `(${a.monthlyPayment.toFixed(0)} ₽/мес)` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                          Сумма и описание подставятся по выбранному кредиту; при необходимости измените.
                        </span>
                      </div>
                    )}
                    {selectedExpenseAccount?.isCreditCard && (
                      <>
                        <label style={{ display: "block", marginTop: "0.5rem" }}>
                          Срок погашения (мес.)
                          <select
                            value={expenseForm.paymentMonths ?? 6}
                            onChange={(e) =>
                              setExpenseForm({ ...expenseForm, paymentMonths: Number(e.target.value) })
                            }
                            style={{ marginLeft: "0.5rem", minWidth: "6rem" }}
                          >
                            {[3, 6, 12, 18, 24].map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </label>
                        <span style={{ fontSize: "0.85rem", color: "#94a3b8", display: "block", marginTop: "0.25rem" }}>
                          Будет создана транзакция по карте; в общий баланс расход не войдёт (учтётся при погашении)
                        </span>
                      </>
                    )}
                  </label>
                  <label>
                    {isRecurring ? "Название (описание)" : "Описание"}
                    <input
                      value={expenseForm.description}
                      onChange={(e) =>
                        setExpenseForm({ ...expenseForm, description: e.target.value })
                      }
                      placeholder={isRecurring ? "Например: Аренда квартиры" : undefined}
                    />
                  </label>
                  <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={isRecurring ? (recurringFields.isPlanned || false) : (expenseForm.isPlanned || false)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (isRecurring) {
                          setRecurringFields((prev) => ({ ...prev, isPlanned: checked }));
                        } else {
                          setExpenseForm((prev) => ({ ...prev, isPlanned: checked }));
                        }
                      }}
                    />
                    <span>Планируемый</span>
                  </label>
                  <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          setRecurringFields((prev) => ({ ...prev, isPlanned: expenseForm.isPlanned || false }));
                        } else {
                          setExpenseForm((prev) => ({ ...prev, isPlanned: recurringFields.isPlanned || false }));
                        }
                        setIsRecurring(checked);
                      }}
                    />
                    <span>Повторяющийся расход</span>
                  </label>
                  {isRecurring && (
                    <>
                      <label>
                        Дата начала
                        <input
                          type="date"
                          value={recurringFields.startDate}
                          onChange={(e) =>
                            setRecurringFields({ ...recurringFields, startDate: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Дата окончания (необязательно)
                        <input
                          type="date"
                          value={recurringFields.endDate || ""}
                          onChange={(e) =>
                            setRecurringFields({ ...recurringFields, endDate: e.target.value || undefined })
                          }
                        />
                      </label>
                      <label>
                        Частота
                        <select
                          value={recurringFields.frequency}
                          onChange={(e) =>
                            setRecurringFields({
                              ...recurringFields,
                              frequency: e.target.value as any,
                            })
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
                          value={recurringFields.notes}
                          onChange={(e) =>
                            setRecurringFields({ ...recurringFields, notes: e.target.value })
                          }
                        />
                      </label>
                    </>
                  )}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={handleAddExpense} disabled={isBusy}>
                        {editingExpenseId ? "Обновить" : isRecurring ? "Создать повторяющийся расход" : "Создать расход"}
                      </button>
                      <button onClick={() => { setShowExpenseModal(false); setError(null); setEditingExpenseId(null); setIsBankToLoanMode(false); }}>Отмена</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </>
      )}

      {activeTab === "planvsactual" && (
        <>
          {/* PlanVsActual Component */}
          <PlanVsActual />
        </>
      )}

      {activeTab === "credits" && (
        <>
          <CreditAccounts />
          <CreditTransactions
            creditAccounts={creditAccounts}
            onRecordAsIncome={async () => {
              const [recordsResponse, summaryResponse] = await Promise.all([
                financialApi.getIncomeRecords(selectedYear),
                financialApi.getSummaries(selectedYear),
              ]);
              setIncomeRecords(recordsResponse.data);
              setSummaries(summaryResponse.data);
            }}
            onRecurringExpensesChanged={async () => {
              const refreshed = await financialApi.getRecurringExpenses();
              setRecurringExpenses(refreshed.data);
            }}
          />
        </>
      )}

      {activeTab === "reports" && <PlanVsActual />}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="modal-overlay modal-overlay--nested" onClick={() => { setShowCategoryModal(false); setError(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editingCategoryId ? "Редактировать категорию" : categoryForm.parentId ? "Добавить подкатегорию" : "Добавить категорию"}</h2>
              <button onClick={() => { setShowCategoryModal(false); setError(null); }}>✕</button>
            </div>
            <div className="modal__content">
              <div className="form">
                <label>
                  Название
                  <input
                    value={categoryForm.name}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Родительская категория (для подкатегории)
                  <select
                    value={categoryForm.parentId || ""}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        parentId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Нет (основная категория)</option>
                    {parentCategories
                      .filter((c) => c.id !== editingCategoryId)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.icon} {category.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Иконка
                  <div className="category-icon-field" ref={categoryIconFieldRef}>
                    <div className="category-icon-field__row">
                      <input
                        className="category-icon-field__input"
                        value={categoryForm.icon ?? ""}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            icon: e.target.value.trim() === "" ? undefined : e.target.value,
                          })
                        }
                        placeholder="Введите эмодзи или откройте список"
                        autoComplete="off"
                        aria-expanded={categoryIconPickerOpen}
                        aria-haspopup="listbox"
                        onFocus={() => setCategoryIconPickerOpen(false)}
                      />
                      <button
                        type="button"
                        className="category-icon-field__toggle"
                        aria-label={categoryIconPickerOpen ? "Закрыть список эмодзи" : "Открыть список эмодзи"}
                        aria-expanded={categoryIconPickerOpen}
                        onClick={() => setCategoryIconPickerOpen((open) => !open)}
                      >
                        <span className="category-icon-field__chevron" aria-hidden>
                          ▼
                        </span>
                      </button>
                    </div>
                    {categoryIconPickerOpen && (
                      <div className="category-icon-field__dropdown" role="listbox" aria-label="Готовые эмодзи">
                        <div className="category-icon-field__dropdown-scroll category-emoji-picker--scroll">
                          <div className="category-icon-field__emoji-grid">
                            {CATEGORY_EMOJI_PRESETS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className={
                                  categoryForm.icon === emoji
                                    ? "category-emoji-picker__btn category-emoji-picker__btn--selected"
                                    : "category-emoji-picker__btn"
                                }
                                title={emoji}
                                role="option"
                                aria-selected={categoryForm.icon === emoji}
                                onClick={() => {
                                  setCategoryForm({ ...categoryForm, icon: emoji });
                                  setCategoryIconPickerOpen(false);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="category-emoji-picker__clear"
                    onClick={() => {
                      setCategoryForm({ ...categoryForm, icon: undefined });
                      setCategoryIconPickerOpen(false);
                    }}
                  >
                    Без иконки
                  </button>
                </label>
                {!categoryForm.parentId && (
                  <label className="category-color-label">
                    Цвет
                    <div className="category-color-field">
                      <input
                        ref={categoryColorInputRef}
                        type="color"
                        className="category-color-field__native"
                        value={categoryForm.hexColor}
                        onChange={(e) =>
                          setCategoryForm({ ...categoryForm, hexColor: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="category-color-field__swatch"
                        style={{ backgroundColor: categoryForm.hexColor }}
                        aria-label="Выбрать цвет категории"
                        onClick={() => categoryColorInputRef.current?.click()}
                      />
                    </div>
                  </label>
                )}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={handleAddCategory}>Сохранить</button>
                  <button onClick={() => { setShowCategoryModal(false); setError(null); }}>Отмена</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right Sidebar - Accounts/Cards */}
      <aside className="app__right-sidebar">
        <div className="app__right-sidebar__content">
          {/* Мои счета - сверху */}
          <div className="app__right-sidebar__section">
          <div className="app__right-sidebar__header">
            <h2>Мои счета {accounts.length > 0 && `(${accounts.length})`}</h2>
            <button className="app__right-sidebar__add-button" onClick={() => { setError(null); setShowAccountModal(true); }}>
              Добавить +
            </button>
          </div>

          {/* Account Cards Stack */}
        <div style={{ marginBottom: "2rem", overflow: "visible" }}>
          {accounts.length === 0 ? (
            <div className="account-card account-card--empty">
              <div className="account-card__empty-text">Карты отсутствуют</div>
            </div>
          ) : (
            [...accounts]
              .filter((acc, idx, self) => self.findIndex(a => a.id === acc.id) === idx) // Убираем дубликаты по ID
              .reverse()
              .map((account, index) => {
              // Функция для создания градиента из цвета с изменением тона
              const createGradientFromColor = (color: string): string => {
                // Парсим цвет в RGB
                const hex = color.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                
                // Преобразуем RGB в HSL для изменения тона
                const rgbToHsl = (r: number, g: number, b: number) => {
                  r /= 255;
                  g /= 255;
                  b /= 255;
                  const max = Math.max(r, g, b);
                  const min = Math.min(r, g, b);
                  let h = 0, s = 0, l = (max + min) / 2;
                  
                  if (max !== min) {
                    const d = max - min;
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                    switch (max) {
                      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                      case g: h = ((b - r) / d + 2) / 6; break;
                      case b: h = ((r - g) / d + 4) / 6; break;
                    }
                  }
                  return [h * 360, s * 100, l * 100];
                };
                
                const hslToRgb = (h: number, s: number, l: number) => {
                  h /= 360;
                  s /= 100;
                  l /= 100;
                  let r, g, b;
                  
                  if (s === 0) {
                    r = g = b = l;
                  } else {
                    const hue2rgb = (p: number, q: number, t: number) => {
                      if (t < 0) t += 1;
                      if (t > 1) t -= 1;
                      if (t < 1/6) return p + (q - p) * 6 * t;
                      if (t < 1/2) return q;
                      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                      return p;
                    };
                    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                    const p = 2 * l - q;
                    r = hue2rgb(p, q, h + 1/3);
                    g = hue2rgb(p, q, h);
                    b = hue2rgb(p, q, h - 1/3);
                  }
                  
                  return [
                    Math.round(r * 255),
                    Math.round(g * 255),
                    Math.round(b * 255)
                  ];
                };
                
                // Получаем HSL исходного цвета
                const [h, s, l] = rgbToHsl(r, g, b);
                
                // Изменяем тон на 30 градусов (создаем более интересный градиент)
                const newH = (h + 30) % 360;
                // Немного увеличиваем яркость и уменьшаем насыщенность для второй части
                const newS = Math.max(0, s - 10);
                const newL = Math.min(100, l + 20);
                
                // Преобразуем обратно в RGB
                const [r2, g2, b2] = hslToRgb(newH, newS, newL);
                
                const toHex = (n: number) => n.toString(16).padStart(2, '0');
                return `linear-gradient(135deg, ${color} 0%, #${toHex(r2)}${toHex(g2)}${toHex(b2)} 100%)`;
              };
              
              // Используем цвет из account.color, если он задан, иначе используем класс по умолчанию
              const defaultCardClass = index % 3 === 0 ? "account-card--orange" : index % 3 === 1 ? "account-card--blue" : "account-card--purple";
              const cardClass = account.color ? "" : defaultCardClass;
              const cardStyle = account.color ? {
                background: createGradientFromColor(account.color),
              } : {};
              const isSelected = selectedAccountId === account.id;
              const isCash = account.accountType === "Cash";
              const paymentSystem = isCash ? null : getPaymentSystemIcon(account.accountNumber || "");
              
              // Проверяем, выбрана ли карта выше текущей (чтобы показать номер текущей карты)
              // Если выбрана карта с index 1, то карта с index 2 должна показать свой номер
              const reversedAccounts = [...accounts].reverse();
              const cardAboveIndex = index - 1;
              const cardAboveSelected = cardAboveIndex >= 0 && selectedAccountId === reversedAccounts[cardAboveIndex]?.id;
              
              // Первая карта (index 0) должна быть внизу, вторая над ней, третья над второй
              const zIndex = isSelected ? 100 : index + 1; // Первая карта z-index: 1, вторая: 2, третья: 3
              // Первая карта (index 0) без marginTop, остальные накладываются сверху
              const marginTop = index > 0 ? "-60px" : "0";
              
              return (
                <div key={account.id} style={{ position: "relative", zIndex: zIndex, marginBottom: "0" }}>
                  <div
                    className={`account-card ${cardClass}`}
                    style={{
                      marginTop: marginTop,
                      position: "relative",
                      cursor: "pointer",
                      ...cardStyle,
                    }}
                    onClick={() => setSelectedAccountId(isSelected ? null : account.id)}
                  >
                    {/* Иконка платежной системы или денег в левом верхнем углу */}
                    <div style={{ 
                      position: "absolute", 
                      top: "0.75rem", 
                      left: "0.75rem"
                    }}>
                      {isCash ? (
                        <span style={{ fontSize: "1.5rem" }}>💰</span>
                      ) : (
                        paymentSystem?.element
                      )}
                    </div>
                    
                    {/* Номер карты или "Наличные" в правом верхнем углу - поднимаем выше если карта под другой или если карта выше выбрана */}
                    <div style={{ 
                      position: "absolute", 
                      top: (index > 0 || cardAboveSelected) ? "0.25rem" : "0.75rem", 
                      right: "0.75rem",
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      color: "#fff",
                      letterSpacing: "1px",
                      zIndex: cardAboveSelected ? 101 : 10 // Если карта выше выбрана, номер должен быть виден
                    }}>
                      {isCash ? (
                        "Наличные"
                      ) : (
                        (() => {
                          const cleanNumber = (account.accountNumber || "").replace(/\s/g, "");
                          if (cleanNumber.length > 4) {
                            // Показываем последние 4 цифры, разбитые по 4 разряда
                            const lastFour = cleanNumber.slice(-4);
                            return `**** ${lastFour}`;
                          }
                          // Если номер короткий, разбиваем по 4 разряда
                          return cleanNumber.match(/.{1,4}/g)?.join(" ") || cleanNumber;
                        })()
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {/* Данные карты - после всех карт */}
          {selectedAccountId && (() => {
            const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
            if (!selectedAccount) return null;
            
            return (
              <div className="account-card__details" style={{ 
                marginTop: "1rem", 
                padding: "1rem", 
                background: "#1e293b", 
                borderRadius: "12px",
                border: "1px solid #334155"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.9rem", color: "#fff", marginBottom: "0.5rem", fontWeight: 500, letterSpacing: "0.5px" }}>
                      {selectedAccount.accountType === "Cash" || !selectedAccount.accountNumber ? (
                        "Наличные"
                      ) : (
                        (() => {
                          const cleanNumber = (selectedAccount.accountNumber || "").replace(/\s/g, "");
                          return cleanNumber.match(/.{1,4}/g)?.join(" ") || cleanNumber;
                        })()
                      )}
                    </div>
                    {selectedAccount.cardHolderName && (
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <div style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
                          {selectedAccount.cardHolderName}
                        </div>
                        {selectedAccount.expiryDate && (
                          <div style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
                            {(() => {
                              // Преобразуем дату в формат MM/YY
                              const dateStr = selectedAccount.expiryDate;
                              if (dateStr.includes('/')) {
                                const parts = dateStr.split('/');
                                if (parts.length >= 2) {
                                  const month = parts[0].padStart(2, '0');
                                  const year = parts[1].length === 4 ? parts[1].slice(-2) : parts[1];
                                  return `${month}/${year}`;
                                }
                              }
                              // Если формат другой, пытаемся распарсить
                              const date = dayjs(dateStr);
                              if (date.isValid()) {
                                return date.format('MM/YY');
                              }
                              return dateStr;
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      padding: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: "1rem",
                    }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setEditingAccountId(selectedAccount.id);
                      // Заполняем форму данными карты
                      // Форматируем номер карты по 4 символа при загрузке
                      const accountNumber = selectedAccount.accountNumber || "";
                      const formattedNumber = accountNumber.replace(/\s/g, "").match(/.{1,4}/g)?.join(" ") || accountNumber;
                      setNewAccount({
                        name: selectedAccount.name,
                        accountNumber: formattedNumber,
                        accountType: selectedAccount.accountType,
                        balance: selectedAccount.balance,
                        cardHolderName: selectedAccount.cardHolderName || "",
                        expiryDate: selectedAccount.expiryDate || "",
                        color: selectedAccount.color || "#3b82f6",
                        currency: (selectedAccount as any).currency || "RUB",
                      });
                      setShowAccountModal(true);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.3333 2.00001C11.5084 1.8249 11.7163 1.68601 11.9444 1.59123C12.1726 1.49646 12.4163 1.44775 12.6625 1.44775C12.9087 1.44775 13.1524 1.49646 13.3806 1.59123C13.6087 1.68601 13.8166 1.8249 13.9917 2.00001C14.1668 2.17512 14.3057 2.38302 14.4005 2.61113C14.4952 2.83924 14.5439 3.08298 14.5439 3.32918C14.5439 3.57538 14.4952 3.81912 14.4005 4.04723C14.3057 4.27534 14.1668 4.48324 13.9917 4.65835L4.6625 13.9875L1.33333 14.6667L2.0125 11.3375L11.3333 2.00001Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #334155" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.5rem" }}>Операции</div>
                  {accountTransactions.length === 0 ? (
                    <div style={{ padding: "0.5rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                      Нет операций
                    </div>
                  ) : (
                    accountTransactions
                      .filter((t) => t.accountId === selectedAccount.id)
                      .slice(0, 5)
                      .map((transaction) => (
                        <div key={transaction.id} className="transaction-item" style={{ marginBottom: "0.5rem" }}>
                          <div className="transaction-item__left">
                            <div className="transaction-item__icon">
                              {transaction.type === "Income" ? "💰" : transaction.type === "Expense" ? "💳" : "↔️"}
                            </div>
                            <div className="transaction-item__info">
                              <div className="transaction-item__name">
                                {transaction.categoryName || transaction.description || "Операция"}
                              </div>
                              <div className="transaction-item__details">
                                {dayjs(transaction.transactionDate).format("DD.MM.YYYY HH:mm")}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`transaction-item__amount ${
                              transaction.type === "Income"
                                ? "transaction-item__amount--positive"
                                : "transaction-item__amount--negative"
                            }`}
                          >
                            {transaction.type === "Income" ? "+" : "-"}
                            {formatAmount(transaction.amount, selectedAccount.accountType === "Cash" ? undefined : (selectedAccount as any).currency)}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        </div>

          {/* Calendar Section */}
          <div className="app__right-sidebar__section">
            <Calendar
              recurringExpenses={recurringExpenses}
              expenses={expenses}
              creditPayments={creditPaymentsForMonth}
              loanPayments={loanPaymentsForMonth}
              incomeRecords={incomeRecords}
              incomeCycles={incomeCycles}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              useHalfMonth={useHalfMonth}
              onUseHalfMonthChange={setUseHalfMonth}
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              hideHalfMonthOptions={activeTab === "planvsactual"}
              onYearChange={setSelectedYear}
              onMonthChange={setSelectedMonth}
              onAddExpense={(date) => {
                setActiveTab("finances");
                setExpenseForm({ ...expenseForm, expenseDate: date });
                setShowExpenseModal(true);
              }}
            />
          </div>

        </div>
      </aside>

      {/* Settings button - верхний правый угол */}
      <button className="app__right-sidebar__settings" onClick={() => setShowSettingsModal(true)}>
        ⚙️
      </button>

      {/* Account Modal */}
      {showAccountModal && (
        <div className="modal-overlay" onClick={() => { setShowAccountModal(false); setError(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editingAccountId ? "Редактировать счет" : "Добавить счет"}</h2>
              <button onClick={() => { 
                setShowAccountModal(false); 
                setError(null);
                setEditingAccountId(null);
                setNewAccount({
                  name: "",
                  accountNumber: "",
                  accountType: "Card",
                  balance: 0,
                  cardHolderName: "",
                  expiryDate: "",
                  color: "#3b82f6",
                  currency: "RUB",
                });
              }}>✕</button>
            </div>
            <div className="modal__content">
              {error && <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}
              <div className="form">
                <label>
                  Название счета
                  <input
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    placeholder="Например: Основная карта"
                  />
                </label>
                <label>
                  Тип счета
                  <select
                    value={newAccount.accountType}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        accountType: e.target.value as "Cash" | "Bank" | "Card" | "Savings",
                      })
                    }
                  >
                    <option value="Card">Карта</option>
                    <option value="Bank">Банковский счет</option>
                    <option value="Cash">Наличные</option>
                    <option value="Savings">Сбережения</option>
                  </select>
                </label>
                {newAccount.accountType !== "Cash" && (
                  <label>
                    Номер счета/карты
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <input
                        value={newAccount.accountNumber}
                        onChange={(e) => {
                          // Убираем все пробелы и нецифровые символы
                          const cleanValue = e.target.value.replace(/\s/g, "").replace(/\D/g, "");
                          // Разбиваем по 4 цифры
                          const formatted = cleanValue.match(/.{1,4}/g)?.join(" ") || cleanValue;
                          setNewAccount({ ...newAccount, accountNumber: formatted });
                        }}
                        placeholder="4156 6727 1439 6902"
                        maxLength={19} // 16 цифр + 3 пробела
                        style={{ flex: 1, width: "100%" }}
                      />
                      {newAccount.accountType === "Card" && newAccount.accountNumber && (
                        <div style={{ flexShrink: 0 }}>
                          {getPaymentSystemIcon(newAccount.accountNumber.replace(/\s/g, "")).element}
                        </div>
                      )}
                    </div>
                  </label>
                )}
                {newAccount.accountType === "Card" && (
                  <>
                    <label>
                      Имя владельца
                      <input
                        value={newAccount.cardHolderName || ""}
                        onChange={(e) => setNewAccount({ ...newAccount, cardHolderName: e.target.value })}
                        placeholder="Micky Larson"
                      />
                    </label>
                    <label>
                      Срок действия
                      <input
                        value={newAccount.expiryDate || ""}
                        onChange={(e) => {
                          // Убираем все нецифровые символы
                          const cleanValue = e.target.value.replace(/\D/g, "");
                          // Форматируем как MM/YY
                          let formatted = cleanValue;
                          if (cleanValue.length > 2) {
                            formatted = cleanValue.substring(0, 2) + "/" + cleanValue.substring(2, 4);
                          }
                          if (cleanValue.length > 4) {
                            formatted = cleanValue.substring(0, 2) + "/" + cleanValue.substring(2, 4);
                          }
                          setNewAccount({ ...newAccount, expiryDate: formatted });
                        }}
                        placeholder="09/24"
                        maxLength={5}
                      />
                    </label>
                  </>
                )}
                <label>
                  Цвет карты
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="color"
                      value={newAccount.color || "#3b82f6"}
                      onChange={(e) => setNewAccount({ ...newAccount, color: e.target.value })}
                      style={{ width: "50px", height: "40px", cursor: "pointer", borderRadius: "4px", border: "1px solid #334155" }}
                    />
                    <span style={{ color: "#cbd5e1", fontSize: "0.9rem" }}>
                      {newAccount.color || "#3b82f6"}
                    </span>
                  </div>
                </label>
                <label>
                  {editingAccountId ? "Текущий баланс" : "Начальный баланс"}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      type="number"
                      value={newAccount.balance}
                      onChange={(e) => setNewAccount({ ...newAccount, balance: Number(e.target.value) || 0 })}
                      step="0.01"
                      style={{ flex: 1 }}
                    />
                    <select
                      value={newAccount.currency || "RUB"}
                      onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value })}
                      style={{ width: "80px" }}
                    >
                      <option value="RUB">₽</option>
                      <option value="USD">$</option>
                      <option value="EUR">€</option>
                      <option value="GBP">£</option>
                    </select>
                  </div>
                  {editingAccountId && (
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.25rem", display: "block" }}>
                      Измените баланс, чтобы скорректировать нестыковки с реальным остатком. Можно указать отрицательное значение (овердрафт).
                    </span>
                  )}
                </label>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between" }}>
                  {editingAccountId && (
                    <button
                      onClick={() => {
                        setConfirmationModal({
                          isOpen: true,
                          title: "Удаление счета",
                          message: "Вы уверены, что хотите удалить этот счет? Это действие нельзя отменить.",
                          variant: "danger",
                          onConfirm: async () => {
                            setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
                            setIsBusy(true);
                            try {
                              await financialApi.deleteAccount(editingAccountId);
                              setAccounts((prev) => prev.filter(acc => acc.id !== editingAccountId));
                              setSelectedAccountId(null);
                              setShowAccountModal(false);
                              setEditingAccountId(null);
                              setNewAccount({
                                name: "",
                                accountNumber: "",
                                accountType: "Card",
                                balance: 0,
                                cardHolderName: "",
                                expiryDate: "",
                                color: "#3b82f6",
                              });
                              setError(null);
                            } catch (err: any) {
                              setError(err.response?.data?.message || err.message || "Ошибка при удалении счета");
                            } finally {
                              setIsBusy(false);
                            }
                          },
                        });
                      }}
                      disabled={isBusy}
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "8px",
                        cursor: isBusy ? "not-allowed" : "pointer",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      {isBusy ? "Удаление..." : "Удалить"}
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!newAccount.name.trim()) {
                        setError("Введите название счета");
                        return;
                      }
                      
                      // Проверка на дубликаты
                      const trimmedName = newAccount.name.trim();
                      const trimmedAccountNumber = newAccount.accountNumber?.trim();
                      
                      if (editingAccountId) {
                        // При обновлении проверяем, что название не совпадает с другими счетами (кроме текущего)
                        const duplicateName = accounts.find(
                          acc => acc.id !== editingAccountId && acc.name.toLowerCase() === trimmedName.toLowerCase()
                        );
                        if (duplicateName) {
                          setError("Счет с таким названием уже существует");
                          return;
                        }
                        
                        // Проверяем номер карты, если он указан
                        if (trimmedAccountNumber) {
                          const duplicateNumber = accounts.find(
                            acc => acc.id !== editingAccountId && 
                                   acc.accountNumber && 
                                   acc.accountNumber.toLowerCase() === trimmedAccountNumber.toLowerCase()
                          );
                          if (duplicateNumber) {
                            setError("Карта с таким номером уже существует");
                            return;
                          }
                        }
                      } else {
                        // При создании проверяем, что название уникально
                        const duplicateName = accounts.find(
                          acc => acc.name.toLowerCase() === trimmedName.toLowerCase()
                        );
                        if (duplicateName) {
                          setError("Счет с таким названием уже существует");
                          return;
                        }
                        
                        // Проверяем номер карты, если он указан
                        if (trimmedAccountNumber) {
                          const duplicateNumber = accounts.find(
                            acc => acc.accountNumber && 
                                   acc.accountNumber.toLowerCase() === trimmedAccountNumber.toLowerCase()
                          );
                          if (duplicateNumber) {
                            setError("Карта с таким номером уже существует");
                            return;
                          }
                        }
                      }
                      
                      setIsBusy(true);
                      try {
                        if (editingAccountId) {
                          // Обновление существующего счета
                          const response = await financialApi.updateAccount(editingAccountId, {
                            name: newAccount.name,
                            accountNumber: newAccount.accountNumber?.trim() || undefined,
                            accountType: newAccount.accountType,
                          balance: newAccount.balance,
                          cardHolderName: newAccount.cardHolderName?.trim() || undefined,
                          expiryDate: newAccount.expiryDate?.trim() || undefined,
                          color: newAccount.color || undefined,
                          currency: newAccount.currency || "RUB",
                          isActive: true,
                        });
                          setAccounts((prev) => prev.map(acc => acc.id === editingAccountId ? response.data : acc));
                        } else {
                          // Создание нового счета
                          const response = await financialApi.createAccount({
                            name: newAccount.name,
                            accountNumber: newAccount.accountNumber?.trim() || undefined,
                            accountType: newAccount.accountType,
                            balance: newAccount.balance,
                            cardHolderName: newAccount.cardHolderName?.trim() || undefined,
                            expiryDate: newAccount.expiryDate?.trim() || undefined,
                            color: newAccount.color || undefined,
                            currency: newAccount.currency || undefined,
                          });
                          setAccounts((prev) => {
                            // Проверяем, нет ли уже такого счета (по ID)
                            if (prev.some(acc => acc.id === response.data.id)) {
                              return prev;
                            }
                            return [...prev, response.data];
                          });
                        }
                        setShowAccountModal(false);
                        setEditingAccountId(null);
                        setNewAccount({
                          name: "",
                          accountNumber: "",
                          accountType: "Card",
                          balance: 0,
                          cardHolderName: "",
                          expiryDate: "",
                          color: "#3b82f6",
                          currency: "RUB",
                        });
                        setError(null);
                      } catch (err: any) {
                        const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || (editingAccountId ? "Ошибка при обновлении счета" : "Ошибка при создании счета");
                        setError(errorMessage);
                      } finally {
                        setIsBusy(false);
                      }
                    }}
                    disabled={isBusy}
                    style={{ marginLeft: editingAccountId ? "auto" : "0" }}
                  >
                    {isBusy ? (editingAccountId ? "Сохранение..." : "Добавление...") : (editingAccountId ? "Сохранить" : "Добавить")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px", maxHeight: "90vh" }}>
            <div className="modal__header">
              <h2>Настройки</h2>
              <button onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>
            <div className="modal__content">
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                {/* Categories Section */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3>Категории</h3>
                    <button 
                      onClick={() => {
                        setEditingCategoryId(null);
                        setCategoryForm({ name: "", hexColor: "#3B82F6", icon: undefined, parentId: undefined });
                        setError(null);
                        setShowCategoryModal(true);
                      }}
                      style={{ padding: "0.5rem 1rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "500" }}
                    >
                      Добавить категорию
                    </button>
                  </div>
                  {parentCategories.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                      Данные отсутствуют
                    </div>
                  ) : (
                    <ul className="list list--categories" style={{ margin: "0 auto", maxWidth: "100%" }}>
                      {parentCategories.map((category) => (
                        <React.Fragment key={category.id}>
                          <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1", flexDirection: "row" }}>
                              {category.subcategories && category.subcategories.length > 0 ? (
                                <button
                                  onClick={() => toggleCategoryCollapse(category.id)}
                                  style={{ padding: "0.2rem", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "transparent", border: "none", color: "#94a3b8" }}
                                  title={collapsedCategoryIds.has(category.id) ? "Развернуть подкатегории" : "Свернуть подкатегории"}
                                >
                                  {collapsedCategoryIds.has(category.id) ? <ChevronRightIcon /> : <ChevronDownIcon />}
                                </button>
                              ) : (
                                <span style={{ width: "14px", display: "inline-block" }} />
                              )}
                              <span
                                className="badge"
                                style={{ backgroundColor: (category.hexColor || "#3B82F6").startsWith("#") ? category.hexColor : `#${category.hexColor}`, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "24px", height: "24px" }}
                              >
                                {category.icon || "📁"}
                              </span>
                              <span style={{ whiteSpace: "nowrap" }}>{category.name}</span>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexShrink: 0, justifyContent: "flex-end", flexDirection: "row", marginLeft: "auto" }}>
                              <button
                                onClick={() => {
                                  setEditingCategoryId(null);
                                  const hex = (category.hexColor || "#3B82F6").startsWith("#") ? category.hexColor : `#${category.hexColor}`;
                                  setCategoryForm({ name: "", hexColor: hex, icon: undefined, parentId: category.id });
                                  setError(null);
                                  setShowCategoryModal(true);
                                }}
                                style={{ fontSize: "0.85rem", padding: "0.25rem 0.5rem", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "transparent", border: "none", color: "#94a3b8" }}
                                title="Добавить подкатегорию"
                              >
                                <PlusIcon />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingCategoryId(category.id);
                                  const hex = (category.hexColor || "#3B82F6").startsWith("#") ? category.hexColor : `#${category.hexColor}`;
                                  setCategoryForm({
                                    name: category.name,
                                    hexColor: hex,
                                    icon: category.icon,
                                    parentId: category.parentId,
                                  });
                                  setError(null);
                        setShowCategoryModal(true);
                                }}
                                style={{ fontSize: "0.85rem", padding: "0.25rem 0.5rem", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "transparent", border: "none", color: "#fff" }}
                              >
                                <EditIcon />
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmationModal({
                                    isOpen: true,
                                    title: "Удаление категории",
                                    message: "Удалить категорию?",
                                    variant: "danger",
                                    onConfirm: async () => {
                                      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
                                      try {
                                        await financialApi.deleteCategory(category.id);
                                        await loadCategories();
                                      } catch (err: any) {
                                        setError(err.message);
                                      }
                                    },
                                  });
                                }}
                                style={{ fontSize: "0.85rem", padding: "0.25rem 0.5rem", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                              >
                                🗑️
                              </button>
                            </div>
                          </li>
                          {category.subcategories && category.subcategories.length > 0 && !collapsedCategoryIds.has(category.id) && (
                            <>
                              {category.subcategories.map((sub) => (
                                <li key={sub.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem", color: "#cbd5e1", flexWrap: "nowrap", marginLeft: "1.5rem" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1" , flexDirection:"row"}}>
                                    <span
                                      className="badge"
                                      style={{ backgroundColor: (() => { const c = sub.hexColor || category.hexColor || "#3B82F6"; return c.startsWith("#") ? c : `#${c}`; })(), display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "24px", height: "24px" }}
                                    >
                                      {sub.icon || "📄"}
                                    </span>
                                    <span style={{ whiteSpace: "nowrap" }}>{sub.name}</span>
                                  </div>
                                  <div style={{ display: "flex", gap: "0.5rem", flexDirection:"row", justifyContent: "flex-end", alignItems: "center", flexShrink: 0, marginLeft: "auto" }}>
                                    <button
                                      onClick={() => {
                                        setEditingCategoryId(sub.id);
                                        const rawHex = sub.hexColor || category.hexColor || "#3B82F6";
                                        const hex = rawHex.startsWith("#") ? rawHex : `#${rawHex}`;
                                        setCategoryForm({
                                          name: sub.name,
                                          hexColor: hex,
                                          icon: sub.icon,
                                          parentId: category.id,
                                        });
                                        setError(null);
                        setShowCategoryModal(true);
                                      }}
                                      style={{ fontSize: "0.85rem", padding: "0.25rem 0.5rem", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "transparent", border: "none", color: "#fff" }}
                                    >
                                      <EditIcon />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setConfirmationModal({
                                          isOpen: true,
                                          title: "Удаление подкатегории",
                                          message: "Удалить подкатегорию?",
                                          variant: "danger",
                                          onConfirm: async () => {
                                            setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
                                            try {
                                              await financialApi.deleteCategory(sub.id);
                                              await loadCategories();
                                            } catch (err: any) {
                                              setError(err.message);
                                            }
                                          },
                                        });
                                      }}
                                      style={{ fontSize: "0.85rem", padding: "0.25rem 0.5rem", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </>
                          )}
                        </React.Fragment>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Dangerous reset section */}
                <div style={{ borderTop: "1px solid #1f2937", paddingTop: "1.5rem" }}>
                  <h3 style={{ color: "#f97316", marginBottom: "0.75rem" }}>Сброс фактических данных</h3>
                  <p style={{ fontSize: "0.9rem", color: "#e5e7eb", marginBottom: "0.5rem" }}>
                    Удаляет все фактические доходы и расходы. Планируемые и повторяемые операции будут
                    сдвинуты так, чтобы их даты не были раньше сегодняшнего дня.
                  </p>
                  <p style={{ fontSize: "0.85rem", color: "#fca5a5", marginBottom: "1rem" }}>
                    Действие необратимо. Перед сбросом запишите текущие остатки по счетам и кредитам, чтобы
                    затем ввести их в поле «Текущий баланс».
                  </p>
                  <button
                    onClick={() => {
                      setConfirmationModal({
                        isOpen: true,
                        title: "Сброс фактических данных",
                        message:
                          "Все фактические доходы и расходы будут удалены, а планируемые операции сдвинуты вперёд. Продолжить?",
                        variant: "danger",
                        onConfirm: async () => {
                          setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
                          setIsBusy(true);
                          try {
                            await financialApi.resetActualData();
                            // Обновляем приложение, чтобы отобразить изменения.
                            window.location.reload();
                          } catch (err: any) {
                            setError(
                              err.response?.data?.detail ||
                                err.response?.data?.message ||
                                err.message ||
                                "Ошибка при сбросе фактических данных"
                            );
                          } finally {
                            setIsBusy(false);
                          }
                        },
                      });
                    }}
                    style={{
                      padding: "0.75rem 1.5rem",
                      background: "#b91c1c",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      cursor: isBusy ? "not-allowed" : "pointer",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      opacity: isBusy ? 0.6 : 1,
                    }}
                    disabled={isBusy}
                  >
                    Обнулить фактические данные
                  </button>
                </div>

                {/* Security Section */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3>Безопасность</h3>
                    <button 
                      onClick={() => { setError(null); setShowPasswordModal(true); }}
                      style={{ padding: "0.5rem 1rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "500" }}
                    >
                      Изменить пароль
                    </button>
                  </div>
                </div>

                {/* Profile Section */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3>Профиль</h3>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <button 
                      onClick={() => {
                        removeToken();
                        setShowSettingsModal(false);
                        setIsAuthenticated(false);
                      }}
                      style={{ 
                        padding: "0.75rem 1.5rem", 
                        background: "#ef4444", 
                        color: "#fff", 
                        border: "none", 
                        borderRadius: "8px", 
                        cursor: "pointer", 
                        fontSize: "1rem", 
                        fontWeight: "500",
                        width: "100%"
                      }}
                    >
                      Выход
                    </button>
                    <p style={{ color: "#94a3b8", fontSize: "0.9rem", textAlign: "center" }}>
                      Выйти из текущего профиля и вернуться на страницу входа
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay modal-overlay--nested" onClick={() => { setShowPasswordModal(false); setError(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>Изменить пароль</h2>
              <button onClick={() => { setShowPasswordModal(false); setError(null); }}>✕</button>
            </div>
            <div className="modal__content">
              {error && <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}
              <div className="form">
                <label>
                  Текущий пароль
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  />
                </label>
                <label>
                  Новый пароль
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  />
                </label>
                <label>
                  Подтвердите новый пароль
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  />
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={async () => {
                      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                        setError("Пароли не совпадают");
                        return;
                      }
                      if (passwordForm.newPassword.length < 6) {
                        setError("Пароль должен быть не менее 6 символов");
                        return;
                      }
                      setIsBusy(true);
                      try {
                        await financialApi.updatePassword({
                          currentPassword: passwordForm.currentPassword,
                          newPassword: passwordForm.newPassword,
                        });
                        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                        setShowPasswordModal(false);
                        setError(null);
                        setNotificationModal({
                          isOpen: true,
                          message: "Пароль успешно изменен",
                          type: "success",
                        });
                      } catch (err: any) {
                        setError(err.response?.data?.message || err.message || "Ошибка при изменении пароля");
                      } finally {
                        setIsBusy(false);
                      }
                    }}
                    disabled={isBusy}
                  >
                    {isBusy ? "Сохранение..." : "Сохранить"}
                  </button>
                  <button onClick={() => { setShowPasswordModal(false); setError(null); }} disabled={isBusy}>Отмена</button>
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
        variant={confirmationModal.variant}
        onConfirm={confirmationModal.onConfirm}
        onCancel={() => setConfirmationModal((prev) => ({ ...prev, isOpen: false }))}
      />
      <NotificationModal
        isOpen={notificationModal.isOpen}
        message={notificationModal.message}
        type={notificationModal.type}
        onClose={() => setNotificationModal((prev) => ({ ...prev, isOpen: false }))}
      />
      {pendingPayments.length > 0 && currentPaymentIndex < pendingPayments.length && (
        <PendingPaymentNotification
          payment={pendingPayments[currentPaymentIndex]}
          onConfirm={async () => {
            // Reload pending payments, expenses, and credit payments for month
            try {
              const [pendingPaymentsResponse, expensesResponse, creditPaymentsResponse] = await Promise.all([
                financialApi.getPendingCreditPayments(),
                financialApi.getExpenses(selectedYear, selectedMonth),
                financialApi.getCreditPaymentsForMonth(selectedYear, selectedMonth),
              ]);
              setPendingPayments(pendingPaymentsResponse.data);
              setExpenses(expensesResponse.data);
              setCreditPaymentsForMonth(creditPaymentsResponse.data);
              if (currentPaymentIndex + 1 < pendingPayments.length) {
                setCurrentPaymentIndex(currentPaymentIndex + 1);
              } else {
                setCurrentPaymentIndex(0);
                setPendingPayments(pendingPaymentsResponse.data);
              }
              setNotificationModal({
                isOpen: true,
                message: "Платеж подтвержден и добавлен в расходы",
                type: "success",
              });
            } catch (err: any) {
              setError(err.message);
            }
          }}
          onDismiss={() => {
            if (currentPaymentIndex + 1 < pendingPayments.length) {
              setCurrentPaymentIndex(currentPaymentIndex + 1);
            } else {
              setCurrentPaymentIndex(0);
              setPendingPayments([]);
            }
          }}
        />
      )}
      {pendingPlannedTransactions.length > 0 && currentPlannedTransactionIndex < pendingPlannedTransactions.length && (
        <PlannedTransactionNotification
          transaction={pendingPlannedTransactions[currentPlannedTransactionIndex]}
          onConfirm={async () => {
            // Reload pending transactions and expenses/income
            try {
              const currentTransaction = pendingPlannedTransactions[currentPlannedTransactionIndex];
              const [pendingExpensesResponse, pendingIncomeResponse, expensesResponse, incomeRecordsResponse] = await Promise.all([
                financialApi.getPendingPlannedExpenses(),
                financialApi.getPendingPlannedIncome(),
                financialApi.getExpenses(selectedYear, selectedMonth),
                financialApi.getIncomeRecords(selectedYear),
              ]);
              const allPending = [...pendingExpensesResponse.data, ...pendingIncomeResponse.data];
              
              // Update state first
              setExpenses(expensesResponse.data);
              setIncomeRecords(incomeRecordsResponse.data);
              
              // Show notification
              setNotificationModal({
                isOpen: true,
                message: currentTransaction.type === "Expense" 
                  ? "Расход подтвержден и добавлен в факт" 
                  : "Доход подтвержден и добавлен в факт",
                type: "success",
              });
              
              // Update pending transactions and close modal if no more pending
              if (allPending.length === 0) {
                setPendingPlannedTransactions([]);
                setCurrentPlannedTransactionIndex(0);
              } else if (currentPlannedTransactionIndex + 1 < allPending.length) {
                setPendingPlannedTransactions(allPending);
                setCurrentPlannedTransactionIndex(currentPlannedTransactionIndex + 1);
              } else {
                // Last item was confirmed, close modal
                setPendingPlannedTransactions([]);
                setCurrentPlannedTransactionIndex(0);
              }
            } catch (err: any) {
              setError(err.message);
            }
          }}
          onDismiss={() => {
            if (currentPlannedTransactionIndex + 1 < pendingPlannedTransactions.length) {
              setCurrentPlannedTransactionIndex(currentPlannedTransactionIndex + 1);
            } else {
              setCurrentPlannedTransactionIndex(0);
              setPendingPlannedTransactions([]);
            }
          }}
        />
      )}
      {confirmExpenseAmountModal.isOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!isConfirmingExpense) {
              setConfirmExpenseModalError(null);
              setConfirmExpenseAmountModal((prev) => ({ ...prev, isOpen: false }));
            }
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
            <div className="modal__header">
              <h3>Подтверждение расхода</h3>
              <button
                onClick={() => {
                  if (!isConfirmingExpense) {
                    setConfirmExpenseModalError(null);
                    setConfirmExpenseAmountModal((prev) => ({ ...prev, isOpen: false }));
                  }
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal__content">
              <p style={{ marginBottom: "1rem" }}>
                Введите фактическую сумму расхода (может отличаться от планируемой):
              </p>
              {confirmExpenseModalError && (
                <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {confirmExpenseModalError}</div>
              )}
              <label style={{ marginBottom: "1rem" }}>
                Планируемая сумма: {confirmExpenseAmountModal.plannedAmount.toFixed(2)} ₽
              </label>
              <label style={{ marginBottom: "1rem" }}>
                Фактическая сумма:
                <input
                  type="text"
                  inputMode="decimal"
                  value={confirmExpenseAmountModal.actualAmount || "0"}
                  onFocus={(e) => {
                    const v = confirmExpenseAmountModal.actualAmount;
                    if (!v || v === "0") e.target.select();
                  }}
                  onChange={(e) => {
                    const filtered = filterAmountInput(e.target.value);
                    setConfirmExpenseAmountModal((prev) => ({ ...prev, actualAmount: filtered }));
                    if (confirmExpenseModalError) setConfirmExpenseModalError(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#fff",
                    fontSize: "1rem",
                    marginTop: "0.5rem",
                  }}
                  autoFocus
                />
              </label>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    if (!isConfirmingExpense) {
                      setConfirmExpenseModalError(null);
                      setConfirmExpenseAmountModal((prev) => ({ ...prev, isOpen: false }));
                    }
                  }}
                  disabled={isConfirmingExpense}
                  style={{
                    padding: "0.75rem 1.5rem",
                    borderRadius: "12px",
                    border: "none",
                    background: "#64748b",
                    color: "#fff",
                    cursor: isConfirmingExpense ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    const amount = parseAmountStr(confirmExpenseAmountModal.actualAmount);
                    if (amount < 0) {
                      setConfirmExpenseModalError("Введите корректную сумму (0 или больше)");
                      return;
                    }
                    setIsConfirmingExpense(true);
                    setConfirmExpenseModalError(null);
                    try {
                      await confirmExpenseAmountModal.onConfirm(amount);
                    } catch (_) {
                      // Ошибка уже обработана в onConfirm (setConfirmExpenseModalError)
                    } finally {
                      setIsConfirmingExpense(false);
                    }
                  }}
                  disabled={isConfirmingExpense}
                  style={{
                    padding: "0.75rem 1.5rem",
                    borderRadius: "12px",
                    border: "none",
                    background: "#3b82f6",
                    color: "#fff",
                    cursor: isConfirmingExpense ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                  }}
                >
                  {isConfirmingExpense ? "Подтверждение..." : "Подтвердить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

export default App;
