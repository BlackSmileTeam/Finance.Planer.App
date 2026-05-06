import { apiClient, setAuthUserJson, setToken } from "./client";
import type {
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  CreateMonthlyPlanRequest,
  ExpenseDto,
  MonthlyPlanDto,
  MonthlySummaryDto,
  UpdateMonthlyPlanRequest,
  RecurringExpenseDto,
  CreateRecurringExpenseRequest,
  UpdateRecurringExpenseRequest,
  CreditAccountDto,
  CreateCreditAccountRequest,
  UpdateCreditAccountRequest,
  LoanPaymentForMonthDto,
  CreditTransactionDto,
  CreateCreditTransactionRequest,
  PendingCreditPaymentDto,
  PendingPlannedTransactionDto,
  InvestmentDto,
  CreateInvestmentRequest,
  UpdateInvestmentRequest,
  IncomeRecordDto,
  CreateIncomeRecordRequest,
  IncomeCycleDto,
  CreateIncomeRequest,
  UpdateIncomeRequest,
  AvailableFundsDto,
  LoginRequest,
  RegisterRequest,
  LoginResponseDto,
  AccountDto,
  CreateAccountRequest,
  UpdateAccountRequest,
  UpdatePasswordRequest,
} from "../types";

/// <summary>
/// <para>Provides strongly typed helpers around the REST API.</para>
/// </summary>
export const financialApi = {
  /// <summary>Logs in a user.</summary>
  login: async (payload: LoginRequest) => {
    const response = await apiClient.post<LoginResponseDto>("api/auth/login", payload);
    if (response.data.token) {
      setToken(response.data.token);
      setAuthUserJson(JSON.stringify(response.data.user));
    }
    return response;
  },
  /// <summary>Registers a new user.</summary>
  register: async (payload: RegisterRequest) => {
    const response = await apiClient.post<LoginResponseDto>("api/auth/register", payload);
    if (response.data.token) {
      setToken(response.data.token);
      setAuthUserJson(JSON.stringify(response.data.user));
    }
    return response;
  },
  /// <summary>Returns all categories.</summary>
  getCategories: () => apiClient.get<CategoryDto[]>("api/categories"),
  /// <summary>Creates a category.</summary>
  createCategory: (payload: CreateCategoryRequest) =>
    apiClient.post<CategoryDto>("api/categories", payload),
  /// <summary>Updates a category.</summary>
  updateCategory: (id: string, payload: UpdateCategoryRequest) =>
    apiClient.put<CategoryDto>(`api/categories/${id}`, payload),
  /// <summary>Deletes a category.</summary>
  deleteCategory: (id: string) => apiClient.delete(`api/categories/${id}`),
  /// <summary>Returns expenses for a month.</summary>
  getExpenses: (year: number, month: number) =>
    apiClient.get<ExpenseDto[]>(`api/expenses`, {
      params: { year, month },
    }),
  /// <summary>Returns a single expense by id.</summary>
  getExpense: (id: string) =>
    apiClient.get<ExpenseDto>(`api/expenses/${id}`),
  /// <summary>Creates an expense.</summary>
  createExpense: (payload: CreateExpenseRequest) =>
    apiClient.post("api/expenses", payload),
  /// <summary>Updates an expense.</summary>
  updateExpense: (id: string, payload: UpdateExpenseRequest) =>
    apiClient.put(`api/expenses/${id}`, payload),
  /// <summary>Deletes an expense.</summary>
  deleteExpense: (id: string) => apiClient.delete(`api/expenses/${id}`),
  /// <summary>Returns monthly summaries for a year. Optional startDay/endDay filter by day of month (e.g. 1–15 or 16–31).</summary>
  getSummaries: (year: number, startDay?: number, endDay?: number) =>
    apiClient.get<MonthlySummaryDto[]>(`api/summary`, {
      params: { year, ...(startDay != null && endDay != null ? { startDay, endDay } : {}) },
    }),
  /// <summary>Returns a plan for a month.</summary>
  getMonthlyPlan: (year: number, month: number) =>
    apiClient.get<MonthlyPlanDto>(`api/monthlyplans/${year}/${month}`),
  /// <summary>Creates a plan.</summary>
  createMonthlyPlan: (payload: CreateMonthlyPlanRequest) =>
    apiClient.post<MonthlyPlanDto>("api/monthlyplans", payload),
  /// <summary>Updates a plan.</summary>
  updateMonthlyPlan: (id: string, payload: UpdateMonthlyPlanRequest) =>
    apiClient.put<MonthlyPlanDto>(`api/monthlyplans/${id}`, payload),
  /// <summary>Returns recurring expenses.</summary>
  getRecurringExpenses: () => apiClient.get<RecurringExpenseDto[]>("api/recurringexpenses"),
  /// <summary>Creates a recurring expense.</summary>
  createRecurringExpense: (payload: CreateRecurringExpenseRequest) =>
    apiClient.post<RecurringExpenseDto>("api/recurringexpenses", payload),
  /// <summary>Updates a recurring expense.</summary>
  updateRecurringExpense: (id: string, payload: UpdateRecurringExpenseRequest) =>
    apiClient.put<RecurringExpenseDto>(`api/recurringexpenses/${id}`, payload),
  /// <summary>Deletes a recurring expense.</summary>
  deleteRecurringExpense: (id: string) => apiClient.delete(`api/recurringexpenses/${id}`),
  /// <summary>Returns recurring expenses forecast.</summary>
  getRecurringExpensesForecast: (startDate: string, endDate: string) =>
    apiClient.get<RecurringExpenseDto[]>("api/recurringexpenses/forecast", {
      params: { startDate, endDate },
    }),
  /// <summary>Returns credit accounts.</summary>
  getCreditAccounts: () => apiClient.get<CreditAccountDto[]>("api/creditaccounts"),
  /// <summary>Returns loan payments for a specific month.</summary>
  getLoanPaymentsForMonth: (year: number, month: number) =>
    apiClient.get<LoanPaymentForMonthDto[]>("api/creditaccounts/loan-payments-for-month", {
      params: { year, month },
    }),
  /// <summary>Confirms a loan payment and creates an expense.</summary>
  confirmLoanPayment: (creditAccountId: string, year: number, month: number, day?: number, amount?: number) =>
    apiClient.post(`api/creditaccounts/${creditAccountId}/confirm-loan-payment`, null, {
      params: { year, month, day: day ?? 1, amount },
    }),
  /// <summary>Creates a credit account.</summary>
  createCreditAccount: (payload: CreateCreditAccountRequest) =>
    apiClient.post<CreditAccountDto>("api/creditaccounts", payload),
  /// <summary>Updates a credit account.</summary>
  updateCreditAccount: (id: string, payload: UpdateCreditAccountRequest) =>
    apiClient.put<CreditAccountDto>(`api/creditaccounts/${id}`, payload),
  /// <summary>Deletes a credit account.</summary>
  deleteCreditAccount: (id: string) => apiClient.delete(`api/creditaccounts/${id}`),
  /// <summary>Returns credit transactions.</summary>
  getCreditTransactions: () => apiClient.get<CreditTransactionDto[]>("api/credittransactions"),
  /// <summary>Creates a credit transaction.</summary>
  createCreditTransaction: (payload: CreateCreditTransactionRequest) =>
    apiClient.post<CreditTransactionDto>("api/credittransactions", payload),
  /// <summary>Deletes a credit transaction.</summary>
  deleteCreditTransaction: (id: string) => apiClient.delete(`api/credittransactions/${id}`),
  /// <summary>Records credit transaction as income.</summary>
  recordCreditTransactionAsIncome: (id: string) =>
    apiClient.post(`api/credittransactions/${id}/record-income`),
  /// <summary>Gets pending credit payments.</summary>
  getPendingCreditPayments: () =>
    apiClient.get<PendingCreditPaymentDto[]>("api/credittransactions/pending-payments"),
  /// <summary>Returns credit payments for a specific month.</summary>
  getCreditPaymentsForMonth: (year: number, month: number) =>
    apiClient.get<PendingCreditPaymentDto[]>("api/credittransactions/payments-for-month", {
      params: { year, month },
    }),
  /// <summary>Confirms a credit payment.</summary>
  confirmCreditPayment: (paymentScheduleId: string) =>
    apiClient.post(`api/credittransactions/confirm-payment/${paymentScheduleId}`),
  /// <summary>Gets pending planned expenses.</summary>
  getPendingPlannedExpenses: () =>
    apiClient.get<PendingPlannedTransactionDto[]>("api/expenses/pending-planned"),
  /// <summary>Confirms a planned expense.</summary>
  confirmPlannedExpense: (expenseId: string, request?: { amount?: number } | null) =>
    apiClient.post(`api/expenses/confirm-planned/${expenseId}`, request || {}),
  /// <summary>Confirms a planned recurring expense.</summary>
  confirmPlannedRecurringExpense: (recurringExpenseId: string, expenseDate: string, request?: { amount?: number } | null) =>
    apiClient.post(`api/expenses/confirm-planned-recurring/${recurringExpenseId}?expenseDate=${expenseDate}`, request || {}),
  /// <summary>Gets pending planned income.</summary>
  getPendingPlannedIncome: () =>
    apiClient.get<PendingPlannedTransactionDto[]>("api/income/pending-planned"),
  /// <summary>Confirms a planned income.</summary>
  confirmPlannedIncome: (incomeId: string, request?: { amount?: number } | null) =>
    apiClient.post(`api/income/confirm-planned/${incomeId}`, request || {}),
  /// <summary>Returns investments.</summary>
  getInvestments: () => apiClient.get<InvestmentDto[]>("api/investments"),
  /// <summary>Creates an investment.</summary>
  createInvestment: (payload: CreateInvestmentRequest) =>
    apiClient.post<InvestmentDto>("api/investments", payload),
  /// <summary>Updates an investment.</summary>
  updateInvestment: (id: string, payload: UpdateInvestmentRequest) =>
    apiClient.put<InvestmentDto>(`api/investments/${id}`, payload),
  /// <summary>Deletes an investment.</summary>
  deleteInvestment: (id: string) => apiClient.delete(`api/investments/${id}`),
  /// <summary>Returns income records.</summary>
  getIncomeRecords: (year?: number) =>
    apiClient.get<IncomeRecordDto[]>("api/incomerecords", {
      params: year ? { year } : {},
    }),
  /// <summary>Creates an income record.</summary>
  createIncomeRecord: (payload: CreateIncomeRecordRequest) =>
    apiClient.post<IncomeRecordDto>("api/incomerecords", payload),
  /// <summary>Updates an income record.</summary>
  updateIncomeRecord: (id: string, payload: CreateIncomeRecordRequest) =>
    apiClient.put<IncomeRecordDto>(`api/incomerecords/${id}`, payload),
  /// <summary>Deletes an income record.</summary>
  deleteIncomeRecord: (id: string) => apiClient.delete(`api/incomerecords/${id}`),
  /// <summary>Returns income cycles.</summary>
  getIncomeCycles: (year?: number) =>
    apiClient.get<IncomeCycleDto[]>("api/income", {
      params: year ? { year } : {},
    }),
  /// <summary>Creates an income cycle.</summary>
  createIncomeCycle: (payload: CreateIncomeRequest) =>
    apiClient.post<IncomeCycleDto>("api/income", payload),
  /// <summary>Updates an income cycle.</summary>
  updateIncomeCycle: (id: string, payload: UpdateIncomeRequest) =>
    apiClient.put<IncomeCycleDto>(`api/income/${id}`, payload),
  /// <summary>Deletes an income cycle.</summary>
  deleteIncomeCycle: (id: string) => apiClient.delete(`api/income/${id}`),
  /// <summary>Returns available funds forecast.</summary>
  getAvailableFundsForecast: (startDate: string, endDate: string) =>
    apiClient.get<AvailableFundsDto[]>("api/summary/available-funds", {
      params: { startDate, endDate },
    }),
  /// <summary>Returns all accounts.</summary>
  getAccounts: () => apiClient.get<AccountDto[]>("api/accounts"),
  /// <summary>Creates an account.</summary>
  createAccount: (payload: CreateAccountRequest) =>
    apiClient.post<AccountDto>("api/accounts", payload),
  /// <summary>Updates an account.</summary>
  updateAccount: (id: string, payload: UpdateAccountRequest) =>
    apiClient.put<AccountDto>(`api/accounts/${id}`, payload),
  /// <summary>Deletes an account.</summary>
  deleteAccount: (id: string) => apiClient.delete(`api/accounts/${id}`),
  /// <summary>Updates user password.</summary>
  updatePassword: (payload: UpdatePasswordRequest) =>
    apiClient.post("api/auth/update-password", payload),
  /// <summary>
  /// Resets actual income/expense data for the current user while keeping planned and recurring items.
  /// </summary>
  resetActualData: () =>
    apiClient.post("api/maintenance/reset-actual-data"),
};

