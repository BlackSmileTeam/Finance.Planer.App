/// <summary>
/// <para>Represents a budgeting category DTO consumed by the UI.</para>
/// </summary>
export interface CategoryDto {
  /// <summary>Gets the unique identifier.</summary>
  id: string;
  /// <summary>Gets the visible name.</summary>
  name: string;
  /// <summary>Gets the hex color code.</summary>
  hexColor: string;
  /// <summary>Gets the icon identifier.</summary>
  icon?: string;
  /// <summary>Gets the parent category identifier (for subcategories).</summary>
  parentId?: string;
  /// <summary>Gets the subcategories.</summary>
  subcategories?: CategoryDto[];
  /// <summary>Indicates whether the category is active.</summary>
  isActive: boolean;
}

/// <summary>
/// <para>Represents an expense DTO consumed by the UI.</para>
/// </summary>
export interface ExpenseDto {
  /// <summary>Gets the unique identifier.</summary>
  id: string;
  /// <summary>Gets the category identifier.</summary>
  categoryId: string;
  /// <summary>Gets the category name.</summary>
  categoryName: string;
  /// <summary>Gets the subcategory identifier.</summary>
  subcategoryId?: string;
  /// <summary>Gets the subcategory name.</summary>
  subcategoryName?: string;
  /// <summary>Gets the date.</summary>
  expenseDate: string;
  /// <summary>Gets the amount.</summary>
  amount: number;
  /// <summary>Gets the description.</summary>
  description?: string;
  /// <summary>Gets the optional planned budget identifier.</summary>
  plannedBudgetId?: string;
  /// <summary>Gets the currency code (e.g., RUB, USD, EUR).</summary>
  currency?: string;
  /// <summary>Gets the account identifier from which this expense is made.</summary>
  accountId?: string;
  /// <summary>Gets a value indicating whether this expense is planned (not yet actual).</summary>
  isPlanned?: boolean;
  /// <summary>Gets the optional credit payment schedule identifier when this expense was created by confirming a credit payment.</summary>
  creditPaymentScheduleId?: string;
  /// <summary>Gets the optional credit account identifier when this expense is a confirmed credit payment.</summary>
  creditAccountId?: string;
}

/// <summary>
/// <para>Represents a planned budget DTO consumed by the UI.</para>
/// </summary>
export interface PlannedBudgetDto {
  /// <summary>Gets the identifier.</summary>
  id: string;
  /// <summary>Gets the category identifier.</summary>
  categoryId: string;
  /// <summary>Gets the optional subcategory identifier.</summary>
  subcategoryId?: string;
  /// <summary>Gets the category name.</summary>
  categoryName: string;
  /// <summary>Gets the optional subcategory name.</summary>
  subcategoryName?: string;
  /// <summary>Gets the planned amount.</summary>
  plannedAmount: number;
}

/// <summary>
/// <para>Represents a monthly plan DTO consumed by the UI.</para>
/// </summary>
export interface MonthlyPlanDto {
  /// <summary>Gets the identifier.</summary>
  id: string;
  /// <summary>Gets the year.</summary>
  planYear: number;
  /// <summary>Gets the month.</summary>
  planMonth: number;
  /// <summary>Gets the planned income.</summary>
  plannedIncome: number;
  /// <summary>Gets the planned expense.</summary>
  plannedExpense: number;
  /// <summary>Gets the carry over.</summary>
  carryOver: number;
  /// <summary>Gets the expected pay cycles.</summary>
  expectedPayCycles: number;
  /// <summary>Gets optional notes.</summary>
  notes?: string;
  /// <summary>Gets the planned budgets.</summary>
  plannedBudgets: PlannedBudgetDto[];
}

/// <summary>
/// <para>Represents a monthly summary DTO consumed by the UI.</para>
/// </summary>
export interface MonthlySummaryDto {
  /// <summary>Gets the year.</summary>
  year: number;
  /// <summary>Gets the month.</summary>
  month: number;
  /// <summary>Gets the planned income.</summary>
  plannedIncome: number;
  /// <summary>Gets the planned expense.</summary>
  plannedExpense: number;
  /// <summary>Gets the full planned expense (total plan for the month).</summary>
  fullPlannedExpense: number;
  /// <summary>Gets the actual income.</summary>
  actualIncome: number;
  /// <summary>Gets the actual expense.</summary>
  actualExpense: number;
  /// <summary>Gets the carry over.</summary>
  carryOver: number;
  /// <summary>Gets the closing balance.</summary>
  closingBalance: number;
  /// <summary>Gets the balance based on actual income and expense only.</summary>
  actualBalance: number;
  /// <summary>Gets the balance based on planned income and expense only.</summary>
  plannedBalance: number;
  /// <summary>Gets the alert color.</summary>
  alertColor: string;
}

/// <summary>
/// <para>Represents the payload required to create a category.</para>
/// </summary>
export interface CreateCategoryRequest {
  /// <summary>Gets the name.</summary>
  name: string;
  /// <summary>Gets the color.</summary>
  hexColor: string;
  /// <summary>Gets the icon identifier.</summary>
  icon?: string;
  /// <summary>Gets the parent category identifier (for subcategories).</summary>
  parentId?: string;
}

/// <summary>
/// <para>Represents the payload to update an existing category.</para>
/// </summary>
export interface UpdateCategoryRequest {
  name: string;
  hexColor: string;
  icon?: string;
  /// <summary>Parent category id, or null for top-level category.</summary>
  parentId?: string | null;
}

/// <summary>
/// <para>Represents the payload required to create an expense.</para>
/// </summary>
export interface CreateExpenseRequest {
  /// <summary>Gets the category identifier.</summary>
  categoryId: string;
  /// <summary>Gets the subcategory identifier.</summary>
  subcategoryId?: string;
  /// <summary>Gets the date of the expense.</summary>
  expenseDate: string;
  /// <summary>Gets the amount.</summary>
  amount: number;
  /// <summary>Gets the description.</summary>
  description?: string;
  /// <summary>Gets the optional planned budget identifier.</summary>
  plannedBudgetId?: string;
  /// <summary>Gets the currency code (e.g., RUB, USD, EUR).</summary>
  currency?: string;
  /// <summary>Gets the account identifier from which this expense is made.</summary>
  accountId?: string;
  /// <summary>Gets a value indicating whether this expense is planned (not yet actual).</summary>
  isPlanned?: boolean;
  /// <summary>Gets the optional credit account (e.g. credit card) identifier. When set, a credit transaction is created and this expense is not counted as actual cash expense.</summary>
  creditAccountId?: string;
  /// <summary>When creditAccountId is set, number of months to spread the payment (default 6).</summary>
  paymentMonths?: number;
}

/// <summary>
/// <para>Represents the payload to update an expense.</para>
/// </summary>
export interface UpdateExpenseRequest {
  /// <summary>Gets the category identifier.</summary>
  categoryId: string;
  /// <summary>Gets the subcategory identifier.</summary>
  subcategoryId?: string;
  /// <summary>Gets the date of the expense.</summary>
  expenseDate: string;
  /// <summary>Gets the amount.</summary>
  amount: number;
  /// <summary>Gets the description.</summary>
  description?: string;
  /// <summary>Gets the optional planned budget identifier.</summary>
  plannedBudgetId?: string;
  /// <summary>Gets the currency code (e.g., RUB, USD, EUR).</summary>
  currency?: string;
  /// <summary>Gets the account identifier from which this expense is made. Use null to clear.</summary>
  accountId?: string | null;
  /// <summary>Gets the optional credit account (e.g. credit card) identifier. When set, expense is paid by card.</summary>
  creditAccountId?: string | null;
  /// <summary>Gets a value indicating whether this expense is planned (not yet actual).</summary>
  isPlanned?: boolean;
}

/// <summary>
/// <para>Represents a planned budget payload used when editing plans.</para>
/// </summary>
export interface UpsertPlannedBudgetRequest {
  /// <summary>Gets the category identifier.</summary>
  categoryId: string;
  /// <summary>Gets the optional subcategory identifier.</summary>
  subcategoryId?: string;
  /// <summary>Gets the amount.</summary>
  plannedAmount: number;
}

/// <summary>
/// <para>Represents the payload required to create a monthly plan.</para>
/// </summary>
export interface CreateMonthlyPlanRequest {
  /// <summary>Gets the year.</summary>
  planYear: number;
  /// <summary>Gets the month.</summary>
  planMonth: number;
  /// <summary>Gets the planned income.</summary>
  plannedIncome: number;
  /// <summary>Gets the planned expense.</summary>
  plannedExpense: number;
  /// <summary>Gets the carry over.</summary>
  carryOver: number;
  /// <summary>Gets the expected pay cycles.</summary>
  expectedPayCycles: number;
  /// <summary>Gets optional notes.</summary>
  notes?: string;
  /// <summary>Gets the planned budgets.</summary>
  budgets: UpsertPlannedBudgetRequest[];
}

/// <summary>
/// <para>Represents the payload required to update a monthly plan.</para>
/// </summary>
export interface UpdateMonthlyPlanRequest {
  /// <summary>Gets the planned income.</summary>
  plannedIncome: number;
  /// <summary>Gets the planned expense.</summary>
  plannedExpense: number;
  /// <summary>Gets the carry over.</summary>
  carryOver: number;
  /// <summary>Gets the expected pay cycles.</summary>
  expectedPayCycles: number;
  /// <summary>Gets optional notes.</summary>
  notes?: string;
  /// <summary>Gets the planned budgets.</summary>
  budgets: UpsertPlannedBudgetRequest[];
}

/// <summary>
/// <para>Represents a recurring expense DTO.</para>
/// </summary>
export interface RecurringExpenseDto {
  id: string;
  categoryId: string;
  categoryName: string;
  subcategoryId?: string;
  subcategoryName?: string;
  title: string;
  amount: number;
  startDate: string;
  endDate?: string;
  frequency: "Weekly" | "BiWeekly" | "Monthly" | "Quarterly" | "Yearly";
  isActive: boolean;
  /// <summary>Gets a value indicating whether this recurring expense is planned (not yet actual).</summary>
  isPlanned?: boolean;
  notes?: string;
}

/// <summary>
/// <para>Represents the payload to create a recurring expense.</para>
/// </summary>
export interface CreateRecurringExpenseRequest {
  categoryId: string;
  subcategoryId?: string;
  title: string;
  amount: number;
  startDate: string;
  endDate?: string;
  frequency: "Weekly" | "BiWeekly" | "Monthly" | "Quarterly" | "Yearly";
  /// <summary>Gets a value indicating whether this recurring expense is planned (not yet actual).</summary>
  isPlanned?: boolean;
  notes?: string;
}

/// <summary>
/// <para>Represents a credit account DTO.</para>
/// </summary>
export interface CreditAccountDto {
  id: string;
  name: string;
  accountType: "CreditCard" | "Loan";
  creditLimit?: number;
  monthlyPayment?: number;
  totalAmount?: number;
  termMonths?: number;
  paymentStartDate?: string;
  currentBalance: number;
  interestRate?: number;
  isActive: boolean;
  notes?: string;
}

/// <summary>
/// <para>Represents a credit transaction DTO.</para>
/// </summary>
export interface CreditTransactionDto {
  id: string;
  creditAccountId: string;
  creditAccountName: string;
  categoryId: string;
  categoryName: string;
  subcategoryId?: string;
  subcategoryName?: string;
  transactionDate: string;
  amount: number;
  description?: string;
  isIncomeRecorded: boolean;
  paymentSchedule: CreditPaymentScheduleDto[];
}

/// <summary>
/// <para>Represents a credit payment schedule DTO.</para>
/// </summary>
export interface CreditPaymentScheduleDto {
  id: string;
  scheduledYear: number;
  scheduledMonth: number;
  paymentAmount: number;
  isPaid: boolean;
  paidDate?: string;
}

/// <summary>
/// <para>Represents a pending credit payment that needs to be confirmed.</para>
/// </summary>
/// <summary>
/// <para>Плановый платёж по кредиту (Loan) за месяц.</para>
/// </summary>
export interface LoanPaymentForMonthDto {
  creditAccountId: string;
  creditAccountName: string;
  scheduledYear: number;
  scheduledMonth: number;
  /** Day of month when the payment is due (from PaymentStartDate). */
  scheduledDay: number;
  paymentAmount: number;
}

export interface PendingCreditPaymentDto {
  paymentScheduleId: string;
  creditTransactionId: string;
  creditAccountName: string;
  /** "CreditCard" | "Loan" — для различения «Платеж по кредитной карте» и «Платеж по кредиту» */
  creditAccountType?: "CreditCard" | "Loan";
  scheduledYear: number;
  scheduledMonth: number;
  /** Day of month when the payment is due. */
  scheduledDay: number;
  paymentAmount: number;
  categoryName: string;
  categoryId: string;
  subcategoryId?: string;
  subcategoryName?: string;
}

/// <summary>
/// <para>Represents a pending planned expense or income that needs to be confirmed.</para>
/// </summary>
export interface PendingPlannedTransactionDto {
  id: string;
  type: string; // "Expense" or "Income" or "IncomeRecord"
  title: string;
  amount: number;
  date: string;
  categoryName: string;
  categoryId: string;
  subcategoryId?: string;
  subcategoryName?: string;
  description?: string;
  accountId?: string;
}

/// <summary>
/// <para>Represents an investment DTO.</para>
/// </summary>
export interface InvestmentDto {
  id: string;
  title: string;
  investmentType: "Stock" | "Bond" | "ETF" | "Crypto" | "RealEstate" | "Other";
  amount: number;
  purchaseDate: string;
  currentValue?: number;
  notes?: string;
}

/// <summary>
/// <para>Represents an income record DTO.</para>
/// </summary>
export interface IncomeRecordDto {
  id: string;
  incomeCycleId?: string;
  title: string;
  amount: number;
  receivedDate: string;
  isFromCredit: boolean;
  notes?: string;
  /// <summary>Gets the currency code (e.g., RUB, USD, EUR).</summary>
  currency?: string;
  isPlanned?: boolean;
}

/// <summary>
/// <para>Represents available funds forecast DTO.</para>
/// </summary>
/// <summary>
/// <para>Represents a login request.</para>
/// </summary>
export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

/// <summary>
/// <para>Represents a register request.</para>
/// </summary>
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName?: string;
}

/// <summary>
/// <para>Represents a user DTO.</para>
/// </summary>
export interface UserDto {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  /** When true, user may create/update/delete categories (server enforces the same). */
  isAdministrator?: boolean;
}

/// <summary>
/// <para>Represents a login response.</para>
/// </summary>
export interface LoginResponseDto {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface AvailableFundsDto {
  date: string;
  availableAmount: number;
  plannedIncome: number;
  plannedExpenses: number;
  creditPayments: number;
  recurringExpenses: number;
}

/// <summary>
/// <para>Standard category definitions with icons.</para>
/// </summary>
export const STANDARD_CATEGORIES = [
  { name: "Дети", icon: "👶", color: "#FF6B9D" },
  { name: "Жилье", icon: "🏠", color: "#4ECDC4" },
  { name: "Кредиты", icon: "💳", color: "#FF6B6B" },
  { name: "Налоги", icon: "📋", color: "#95A5A6" },
  { name: "Страховки", icon: "🛡️", color: "#3498DB" },
  { name: "Подарки", icon: "🎁", color: "#F39C12" },
  { name: "Машина", icon: "🚗", color: "#9B59B6" },
  { name: "Транспорт", icon: "🚇", color: "#1ABC9C" },
  { name: "Развлечения", icon: "🎬", color: "#E74C3C" },
  { name: "Продукты", icon: "🛒", color: "#27AE60" },
  { name: "Сбережения и инвестиции", icon: "💰", color: "#16A085" },
  { name: "Одежда", icon: "👕", color: "#E67E22" },
  { name: "Уход за собой", icon: "💅", color: "#E91E63" },
  { name: "Маркетплейсы", icon: "📦", color: "#FF9800" },
  { name: "Непредвиденные расходы", icon: "⚠️", color: "#607D8B" },
] as const;

/// <summary>
/// <para>Represents the payload to update a recurring expense.</para>
/// </summary>
export interface UpdateRecurringExpenseRequest {
  categoryId: string;
  subcategoryId?: string;
  title: string;
  amount: number;
  startDate: string;
  endDate?: string;
  frequency: "Weekly" | "BiWeekly" | "Monthly" | "Quarterly" | "Yearly";
  isActive: boolean;
  /// <summary>Gets a value indicating whether this recurring expense is planned (not yet actual).</summary>
  isPlanned?: boolean;
  notes?: string;
}

/// <summary>
/// <para>Represents the payload to create a credit account.</para>
/// </summary>
export interface CreateCreditAccountRequest {
  name: string;
  accountType: "CreditCard" | "Loan";
  creditLimit?: number;
  monthlyPayment?: number;
  totalAmount?: number;
  termMonths?: number;
  paymentStartDate?: string;
  /** Текущий баланс (задолженность) — задайте, чтобы вести расчёты с этого момента. */
  currentBalance?: number;
  interestRate?: number;
  notes?: string;
}

/// <summary>
/// <para>Represents the payload to update a credit account.</para>
/// </summary>
export interface UpdateCreditAccountRequest {
  name: string;
  creditLimit?: number;
  monthlyPayment?: number;
  totalAmount?: number;
  termMonths?: number;
  paymentStartDate?: string;
  currentBalance: number;
  interestRate?: number;
  isActive: boolean;
  notes?: string;
}

/// <summary>
/// <para>Represents the payload to create a credit transaction.</para>
/// </summary>
export interface CreateCreditTransactionRequest {
  creditAccountId: string;
  categoryId?: string;
  subcategoryId?: string;
  transactionDate: string;
  amount: number;
  description?: string;
  recordAsIncome?: boolean;
  paymentMonths?: number;
}

/// <summary>
/// <para>Represents the payload to create an investment.</para>
/// </summary>
export interface CreateInvestmentRequest {
  title: string;
  investmentType: "Stock" | "Bond" | "ETF" | "Crypto" | "RealEstate" | "Other";
  amount: number;
  purchaseDate: string;
  currentValue?: number;
  notes?: string;
}

/// <summary>
/// <para>Represents the payload to update an investment.</para>
/// </summary>
export interface UpdateInvestmentRequest {
  title: string;
  investmentType: "Stock" | "Bond" | "ETF" | "Crypto" | "RealEstate" | "Other";
  amount: number;
  purchaseDate: string;
  currentValue?: number;
  notes?: string;
}

/// <summary>
/// <para>Represents the payload to create an income record.</para>
/// </summary>
export interface CreateIncomeRecordRequest {
  incomeCycleId?: string;
  title: string;
  amount: number;
  receivedDate: string;
  notes?: string;
  /// <summary>Gets the currency code (e.g., RUB, USD, EUR).</summary>
  currency?: string;
  isPlanned?: boolean;
}

/// <summary>
/// <para>Represents an income cycle DTO.</para>
/// </summary>
export interface IncomeCycleDto {
  id: string;
  title: string;
  receivedDate: string;
  startDate: string;
  endDate?: string;
  amount: number;
  frequency: "Weekly" | "BiWeekly" | "Monthly" | "Quarterly" | "Yearly";
  notes?: string;
  accountId?: string;
  isPlanned?: boolean;
}

/// <summary>
/// <para>Represents the payload to create an income cycle.</para>
/// </summary>
export interface CreateIncomeRequest {
  title: string;
  amount: number;
  receivedDate: string;
  startDate: string;
  endDate?: string;
  frequency: "Weekly" | "BiWeekly" | "Monthly" | "Quarterly" | "Yearly";
  notes?: string;
  accountId?: string;
  isPlanned?: boolean;
}

/// <summary>
/// <para>Represents the payload to update an income cycle.</para>
/// </summary>
export interface UpdateIncomeRequest {
  title: string;
  amount: number;
  receivedDate: string;
  startDate: string;
  endDate?: string;
  frequency: "Weekly" | "BiWeekly" | "Monthly" | "Quarterly" | "Yearly";
  notes?: string;
  accountId?: string;
  isPlanned?: boolean;
}

/// <summary>
/// <para>Represents a regular account/card DTO.</para>
/// </summary>
export interface AccountDto {
  id: string;
  name: string;
  accountNumber: string;
  accountType: "Cash" | "Bank" | "Card" | "Savings";
  balance: number;
  expiryDate?: string;
  color?: string;
  currency?: string;
  isActive: boolean;
  createdAt: string;
}

/// <summary>
/// <para>Represents the payload to create an account.</para>
/// </summary>
export interface CreateAccountRequest {
  name: string;
  accountNumber?: string;
  accountType: "Cash" | "Bank" | "Card" | "Savings";
  balance: number;
  expiryDate?: string;
  color?: string;
  currency?: string;
}

/// <summary>
/// <para>Represents the payload to update an account.</para>
/// </summary>
export interface UpdateAccountRequest {
  name: string;
  accountNumber?: string;
  accountType: "Cash" | "Bank" | "Card" | "Savings";
  balance: number;
  expiryDate?: string;
  color?: string;
  currency?: string;
  isActive: boolean;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/// <summary>
/// <para>Represents a transaction DTO for accounts.</para>
/// </summary>
export interface AccountTransactionDto {
  id: string;
  accountId: string;
  accountName: string;
  type: "Income" | "Expense" | "Transfer";
  categoryId?: string;
  categoryName?: string;
  amount: number;
  description?: string;
  transactionDate: string;
  relatedAccountId?: string;
  relatedAccountName?: string;
}

