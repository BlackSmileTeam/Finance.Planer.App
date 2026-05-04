import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import { financialApi } from "../api/financialApi";
import type {
  CreateIncomeRecordRequest,
  IncomeRecordDto,
  AccountDto,
  IncomeCycleDto,
} from "../types";
import { ConfirmationModal } from "./ConfirmationModal";

// API может вернуть frequency как число (enum: 0=Weekly, 1=BiWeekly, 2=Monthly, 3=Quarterly, 4=Yearly)
function normalizeFrequency(f: string | number): "Weekly" | "BiWeekly" | "Monthly" | "Quarterly" | "Yearly" {
  if (typeof f === "number") {
    const map: Record<number, "Weekly" | "BiWeekly" | "Monthly" | "Quarterly" | "Yearly"> = {
      0: "Weekly", 1: "BiWeekly", 2: "Monthly", 3: "Quarterly", 4: "Yearly",
    };
    return map[f] ?? "Monthly";
  }
  if (f === "Weekly" || f === "BiWeekly" || f === "Monthly" || f === "Quarterly" || f === "Yearly") return f;
  return "Monthly";
}

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

function HintTooltip({ text }: { text: string }) {
  return (
    <span className="hint-tooltip" tabIndex={0} aria-label={text}>
      ?
      <span className="hint-tooltip__content" role="tooltip">
        {text}
      </span>
    </span>
  );
}

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

interface IncomeRecordsProps {
  selectedYear?: number; // Used by parent for filtering
  selectedMonth?: number; // Used by parent for filtering
  periodStartDate?: string; // Filter by date range (1–15 or 16–end)
  periodEndDate?: string;
  onNewClick: () => void;
  onEdit?: (record: IncomeRecordDto) => void; // Reserved for future use
  onDelete: (id: string) => void;
  records: IncomeRecordDto[];
  incomeCycles?: IncomeCycleDto[]; // Optional income cycles to display
  accounts: AccountDto[];
  onSuccess?: (message: string) => void; // Callback for success notifications
  onConfirmPlanned?: () => void; // Callback to refresh pending planned transactions
}

export function IncomeRecords({ onNewClick, onDelete, records, incomeCycles = [], accounts, selectedYear, selectedMonth, periodStartDate, periodEndDate, onSuccess, onConfirmPlanned }: IncomeRecordsProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
  const [confirmAmountModal, setConfirmAmountModal] = useState<{
    isOpen: boolean;
    recordId: string;
    plannedAmount: number;
    actualAmount: string;
    incomeCycleId?: string;
    datePart?: string;
    onConfirm: (amount: number) => Promise<void>;
  }>({
    isOpen: false,
    recordId: "",
    plannedAmount: 0,
    actualAmount: "0",
    onConfirm: async () => {},
  });
  const [isRecurring, setIsRecurring] = useState(false);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<CreateIncomeRecordRequest>({
    incomeCycleId: undefined,
    title: "",
    amount: 0,
    receivedDate: dayjs().format("YYYY-MM-DD"),
    notes: "",
    currency: "RUB",
    isPlanned: false,
  });
  /** Строка для поля ввода суммы (пустая = показываем "0", запятая разрешена). */
  const [amountInput, setAmountInput] = useState("");
  const [recurringFields, setRecurringFields] = useState({
    frequency: "Monthly" as "Weekly" | "BiWeekly" | "Monthly" | "Quarterly" | "Yearly",
    startDate: dayjs().format("YYYY-MM-DD"),
    endDate: undefined as string | undefined,
    notes: "",
  });

  const handleNewClick = () => {
    setError(null);
    setEditingId(null);
    setIsRecurring(false);
    setAccountId(undefined);
      setForm({
        incomeCycleId: undefined,
        title: "",
        amount: 0,
        receivedDate: dayjs().format("YYYY-MM-DD"),
        notes: "",
        currency: "RUB",
        isPlanned: false,
      });
    setAmountInput("");
    setRecurringFields({
      frequency: "Monthly",
      startDate: dayjs().format("YYYY-MM-DD"),
      endDate: undefined,
      notes: "",
    });
    setShowModal(true);
  };

  useEffect(() => {
    const handleNew = () => {
      handleNewClick();
    };
    window.addEventListener('income:new', handleNew);
    return () => window.removeEventListener('income:new', handleNew);
  }, []);

  const handleSubmit = async () => {
    if (!form.title || form.amount <= 0) {
      setError("Заполните все обязательные поля");
      return;
    }

    setIsBusy(true);
    try {
      if (editingId) {
        const isEditingCycle = incomeCycles.some((c) => c.id === editingId);
        if (isEditingCycle) {
          await financialApi.updateIncomeCycle(editingId, {
            title: form.title,
            amount: form.amount,
            receivedDate: form.receivedDate,
            startDate: recurringFields.startDate,
            endDate: recurringFields.endDate || undefined,
            frequency: recurringFields.frequency,
            notes: recurringFields.notes || form.notes || undefined,
            accountId: accountId || undefined,
            isPlanned: form.isPlanned || false,
          });
        } else if (isCycleGeneratedId(editingId)) {
          const cycleId = getCycleIdFromSyntheticId(editingId);
          await financialApi.updateIncomeCycle(cycleId, {
            title: form.title,
            amount: form.amount,
            receivedDate: form.receivedDate,
            startDate: recurringFields.startDate,
            endDate: recurringFields.endDate || undefined,
            frequency: recurringFields.frequency,
            notes: recurringFields.notes || form.notes || undefined,
            accountId: accountId || undefined,
            isPlanned: form.isPlanned || false,
          });
        } else {
          await financialApi.updateIncomeRecord(editingId, form);
        }
      } else {
        if (isRecurring) {
          // Создаем повторяющийся доход (IncomeCycle)
          await financialApi.createIncomeCycle({
            title: form.title,
            amount: form.amount,
            receivedDate: form.receivedDate,
            startDate: recurringFields.startDate,
            endDate: recurringFields.endDate || undefined,
            frequency: recurringFields.frequency,
            notes: recurringFields.notes || form.notes || undefined,
            accountId: accountId || undefined,
            isPlanned: form.isPlanned || false,
          });
        } else {
          // Создаем обычный доход (IncomeRecord)
          await financialApi.createIncomeRecord(form);
        }
      }
      setForm({
        incomeCycleId: undefined,
        title: "",
        amount: 0,
        receivedDate: dayjs().format("YYYY-MM-DD"),
        notes: "",
        currency: "RUB",
        isPlanned: false,
      });
      setAmountInput("");
      setIsRecurring(false);
      setRecurringFields({
        frequency: "Monthly",
        startDate: dayjs().format("YYYY-MM-DD"),
        endDate: undefined,
        notes: "",
      });
      setEditingId(null);
      setShowModal(false);
      setError(null);
      if (onSuccess) {
        onSuccess(editingId ? "Доход успешно обновлен" : "Доход успешно добавлен");
      }
      onNewClick(); // Reload records
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleEdit = (record: IncomeRecordDto) => {
    setError(null);
    const cycle = record.incomeCycleId ? incomeCycles.find((c) => c.id === record.incomeCycleId) : undefined;
    const isEditingCycle = record.id === record.incomeCycleId;
    const isEditingCycleEntry = isCycleGeneratedId(record.id) && record.incomeCycleId;
    const isRecurringEdit = isEditingCycle || isEditingCycleEntry;
    // Для повторяющегося дохода берём «Планируемый» из цикла, иначе галочка снимается у подтверждённых записей
    const effectiveIsPlanned = cycle && isRecurringEdit ? (cycle.isPlanned ?? false) : (record.isPlanned ?? false);
    setForm({
      incomeCycleId: record.incomeCycleId,
      title: record.title,
      amount: record.amount,
      receivedDate: record.receivedDate,
      notes: record.notes || "",
      currency: record.currency || "RUB",
      isPlanned: effectiveIsPlanned,
    });
    setAmountInput(record.amount === 0 ? "" : record.amount.toString().replace(".", ","));
    setAccountId(cycle?.accountId ?? undefined);
    if (isRecurringEdit && cycle) {
      setIsRecurring(true);
      setRecurringFields({
        frequency: normalizeFrequency(cycle.frequency),
        startDate: cycle.startDate,
        endDate: cycle.endDate ?? undefined,
        notes: cycle.notes ?? "",
      });
    } else {
      setIsRecurring(false);
    }
    setEditingId(record.id);
    setShowModal(true);
  };

  /** Id вида {guid}-{YYYY-MM-DD} — виртуальная запись из цикла доходов, в БД нет отдельной строки. */
  const isCycleGeneratedId = (id: string) => {
    const parts = id.split("-");
    return parts.length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(parts.slice(-3).join("-"));
  };
  /** Извлекает id цикла из синтетического id. */
  const getCycleIdFromSyntheticId = (id: string) =>
    id.split("-").slice(0, 5).join("-");

  const handleDelete = (id: string, record?: IncomeRecordDto) => {
    if (isCycleGeneratedId(id) && record?.incomeCycleId) {
      const cycleId = record.incomeCycleId;
      setConfirmationModal({
        isOpen: true,
        title: "Удаление цикла доходов",
        message: `Удалить цикл «${record.title}»? Все записи из этого цикла исчезнут из списка.`,
        onConfirm: async () => {
          setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
          setIsBusy(true);
          setError(null);
          try {
            await financialApi.deleteIncomeCycle(cycleId);
            await onNewClick();
            onSuccess?.("Цикл доходов удалён");
          } catch (err: any) {
            setError(err.message);
          } finally {
            setIsBusy(false);
          }
        },
      });
      return;
    }
    setConfirmationModal({
      isOpen: true,
      title: "Удаление записи о доходе",
      message: "Удалить запись о доходе?",
      onConfirm: async () => {
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
        setIsBusy(true);
        try {
          await financialApi.deleteIncomeRecord(id);
          onDelete(id);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsBusy(false);
        }
      },
    });
  };

  // Convert income cycles to displayable format and merge with records
  const allIncomeItems = useMemo(() => {
    if (selectedMonth === undefined || selectedYear === undefined) {
      // If no month selected, just show cycles as single items
      const cycleItems: IncomeRecordDto[] = incomeCycles.map((cycle) => ({
        id: cycle.id,
        incomeCycleId: cycle.id,
        title: cycle.title,
        amount: cycle.amount,
        receivedDate: cycle.startDate,
        isFromCredit: false,
        notes: cycle.notes,
        currency: "RUB",
        isPlanned: cycle.isPlanned || false,
      }));
      return [...records, ...cycleItems];
    }

    // Generate entries for each period in the selected month for planned cycles
    const startDate = dayjs(`${selectedYear}-${selectedMonth}-01`);
    const endDate = startDate.endOf("month");
    const cycleItemsForMonth: IncomeRecordDto[] = [];

    incomeCycles.forEach((cycle) => {
      const start = dayjs(cycle.startDate);
      const end = cycle.endDate ? dayjs(cycle.endDate) : null;
      
      // Skip if start date is invalid
      if (!start.isValid()) return;
      
      // Skip if end date exists and is before start
      if (end && end.isBefore(start)) return;

      // For planned cycles, generate entries for each period in the selected month
      if (cycle.isPlanned) {
        const freq = normalizeFrequency(cycle.frequency);
        // Calculate iteration limit: go until endDate (if specified) or endDate + one period
        const getPeriodUnit = () => {
          switch (freq) {
            case "Weekly":
            case "BiWeekly":
              return "week";
            case "Monthly":
            case "Quarterly":
              return "month";
            case "Yearly":
              return "year";
            default:
              return "month";
          }
        };
        
        let iterationLimit: dayjs.Dayjs;
        if (end) {
          iterationLimit = end.isBefore(endDate) ? end : endDate.add(1, getPeriodUnit());
        } else {
          // No endDate - iterate until endDate + one period
          iterationLimit = endDate.add(1, getPeriodUnit());
        }
        
        // Safety: limit iterations to prevent infinite loops (max 1000 iterations)
        const maxIterations = 1000;
        let iterations = 0;
        let current = start;
        
        // Skip if current is already after iteration limit
        if (current.isAfter(iterationLimit)) return;
        
        while (current.isBefore(iterationLimit) || current.isSame(iterationLimit, "day")) {
          // Safety check: prevent infinite loops
          iterations++;
          if (iterations > maxIterations) {
            console.warn(`IncomeRecords: Max iterations reached for income cycle ${cycle.id}. Stopping iteration.`);
            break;
          }
          
          // Stop if we've passed the end date
          if (end && current.isAfter(end)) break;
          
          if (current.month() + 1 === selectedMonth && current.year() === selectedYear) {
            const dateStr = current.format("YYYY-MM-DD");
            // Не показывать плановый слот, если по этой дате и циклу уже есть фактическая запись (подтверждённый доход)
            const alreadyConfirmed = records.some(
              (r) => r.incomeCycleId === cycle.id && r.receivedDate === dateStr && !r.isPlanned
            );
            if (!alreadyConfirmed) {
              cycleItemsForMonth.push({
                id: `${cycle.id}-${dateStr}`,
                incomeCycleId: cycle.id,
                title: cycle.title,
                amount: cycle.amount,
                receivedDate: dateStr,
                isFromCredit: false,
                notes: cycle.notes,
                currency: "RUB",
                isPlanned: true,
              });
            }
          }

          // Move to next period based on frequency (freq уже нормализован — API может вернуть число)
          const previousCurrent = current;
          switch (freq) {
            case "Weekly":
              current = current.add(1, "week");
              break;
            case "BiWeekly":
              current = current.add(2, "weeks");
              break;
            case "Monthly":
              current = current.add(1, "month");
              break;
            case "Quarterly":
              current = current.add(3, "months");
              break;
            case "Yearly":
              current = current.add(1, "year");
              break;
            default:
              current = current.add(1, "month");
              break;
          }
          
          // Safety check: ensure current is actually advancing
          if (current.isSame(previousCurrent) || current.isBefore(previousCurrent)) {
            console.warn(`IncomeRecords: Date not advancing for income cycle ${cycle.id}. Stopping iteration.`);
            break;
          }
          
          // Break if we've passed the iteration limit
          if (current.isAfter(iterationLimit)) break;
        }
      } else {
        // For actual cycles, show only if startDate is in selected month
        if (start.month() + 1 === selectedMonth && start.year() === selectedYear) {
          cycleItemsForMonth.push({
            id: cycle.id,
            incomeCycleId: cycle.id,
            title: cycle.title,
            amount: cycle.amount,
            receivedDate: cycle.startDate,
            isFromCredit: false,
            notes: cycle.notes,
            currency: "RUB",
            isPlanned: false,
          });
        }
      }
    });

    // Merge records and cycle items
    return [...records, ...cycleItemsForMonth];
  }, [records, incomeCycles, selectedYear, selectedMonth]);

  // Filter records by selected month (and period: 1–15 or 16–end) if provided
  const filteredRecords = useMemo(() => {
    let items = allIncomeItems;
    if (selectedMonth !== undefined && selectedYear !== undefined) {
      items = items.filter((record) => {
        const recordDate = dayjs(record.receivedDate);
        if (periodStartDate && periodEndDate) {
          return (recordDate.isAfter(dayjs(periodStartDate)) || recordDate.isSame(dayjs(periodStartDate), "day")) &&
            (recordDate.isBefore(dayjs(periodEndDate)) || recordDate.isSame(dayjs(periodEndDate), "day"));
        }
        return recordDate.year() === selectedYear && recordDate.month() + 1 === selectedMonth;
      });
    }

    return [...items].sort((a, b) => {
      const da = dayjs(a.receivedDate).valueOf();
      const db = dayjs(b.receivedDate).valueOf();
      if (da !== db) return da - db;
      const ap = a.isPlanned ? 1 : 0;
      const bp = b.isPlanned ? 1 : 0;
      if (ap !== bp) return bp - ap; // плановые выше фактических
      return 0;
    });
  }, [allIncomeItems, selectedYear, selectedMonth, periodStartDate, periodEndDate]);

  const plannedRecords = useMemo(() => filteredRecords.filter((r) => r.isPlanned), [filteredRecords]);
  const actualRecords = useMemo(() => filteredRecords.filter((r) => !r.isPlanned), [filteredRecords]);
  const [expandedSections, setExpandedSections] = useState<{ planned: boolean; actual: boolean }>({ planned: false, actual: false });
  const toggleSection = (section: "planned" | "actual") => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
  const plannedTotal = plannedRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
  const actualTotal = actualRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

  const renderRecord = (record: IncomeRecordDto) => {
    const showCurrency = record.amount > 0 && record.currency && record.currency !== "RUB";
    const amountStr = showCurrency
      ? formatAmount(record.amount, record.currency)
      : record.amount.toFixed(2) + (record.amount > 0 && !showCurrency ? " ₽" : "");
    return (
      <li key={record.id}>
                <div>
                  <div>
                    <strong>
                      {record.incomeCycleId && <span style={{ marginRight: "0.5rem" }}>🔄</span>}
                      {record.title}
                    </strong>
                    <span>{dayjs(record.receivedDate).format("DD.MM")}</span>
                  </div>
                  {record.notes && (
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                      {record.notes}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "end", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                  {record.isPlanned && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.15rem 0.4rem",
                          backgroundColor: "#fbbf24",
                          color: "#1e293b",
                          borderRadius: "4px",
                          fontWeight: "normal",
                        }}
                      >
                        Плановый
                      </span>
                      <button
                        onClick={() => {
                          const parts = record.id.split("-");
                          if (parts.length >= 5 && record.incomeCycleId) {
                            const datePart = parts.slice(-3).join("-");
                            setConfirmAmountModal({
                              isOpen: true,
                              recordId: record.id,
                              plannedAmount: record.amount,
                              actualAmount: record.amount === 0 ? "" : record.amount.toFixed(2).replace(".", ","),
                              incomeCycleId: record.incomeCycleId,
                              datePart: datePart,
                              onConfirm: async (amount: number) => {
                                try {
                                  await financialApi.createIncomeRecord({
                                    incomeCycleId: record.incomeCycleId,
                                    title: record.title,
                                    amount: amount,
                                    receivedDate: datePart,
                                    notes: record.notes || undefined,
                                    currency: record.currency || "RUB",
                                    isPlanned: false,
                                  });
                                  setConfirmAmountModal((prev) => ({ ...prev, isOpen: false }));
                                  onNewClick();
                                  if (onConfirmPlanned) {
                                    onConfirmPlanned();
                                  }
                                  if (onSuccess) {
                                    onSuccess("Доход подтвержден");
                                  }
                                } catch (err: any) {
                                  setError(err.message);
                                }
                              },
                            });
                          } else {
                            setConfirmAmountModal({
                              isOpen: true,
                              recordId: record.id,
                              plannedAmount: record.amount,
                              actualAmount: record.amount === 0 ? "" : record.amount.toFixed(2).replace(".", ","),
                              onConfirm: async (amount: number) => {
                                try {
                                  const requestBody = amount !== record.amount ? { amount } : null;
                                  await financialApi.confirmPlannedIncome(record.id, requestBody);
                                  setConfirmAmountModal((prev) => ({ ...prev, isOpen: false }));
                                  onNewClick();
                                  if (onConfirmPlanned) {
                                    onConfirmPlanned();
                                  }
                                  if (onSuccess) {
                                    onSuccess("Доход подтвержден");
                                  }
                                } catch (err: any) {
                                  setError(err.message);
                                }
                              },
                            });
                          }
                        }}
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.15rem 0.4rem",
                          background: "#10b981",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                        title="Подтвердить доход"
                      >
                        ✓
                      </button>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "end", flexDirection: "row", alignItems: "center" }}>
                    <strong style={{ color: "#10b981" }}>+{amountStr}</strong>
                    <button
                      onClick={() => handleEdit(record)}
                      style={{ marginLeft: "0.5rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
                    >
                      ✏️
                    </button>
                    {isCycleGeneratedId(record.id) ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(record.id, record)}
                        title="Удалить цикл доходов"
                        style={{ marginLeft: "0.25rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem", background: "none", border: "none", cursor: "pointer" }}
                      >
                        🗑️
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDelete(record.id)}
                        style={{ marginLeft: "0.25rem", fontSize: "0.85rem", padding: "0.25rem 0.5rem" }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </li>
    );
  };

  const renderSection = (
    section: "planned" | "actual",
    title: string,
    total: number,
    count: number,
    records: IncomeRecordDto[]
  ) => {
    const isExpanded = expandedSections[section];
    return (
      <div
        key={section}
        style={{
          marginBottom: "1rem",
          border: "1px solid #334155",
          borderRadius: "8px",
          overflow: "hidden",
          background: "rgba(15, 23, 42, 0.5)",
        }}
      >
        <button
          type="button"
          onClick={() => toggleSection(section)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.6rem 0.75rem",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#e2e8f0",
            textAlign: "left",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>{isExpanded ? "▼" : "▶"}</span>
            <strong>{title}</strong>
          </span>
          <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
            +{total.toFixed(2)} ₽ · {count}
          </span>
        </button>
        {isExpanded && (
          <ul className="list list--table" style={{ width: "100%", borderTop: "1px solid #334155" }}>
            {records.map(renderRecord)}
          </ul>
        )}
      </div>
    );
  };

  return (
    <>
      {error && <div className="app__error">⚠️ {error}</div>}
      {filteredRecords.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
          Данные отсутствуют
        </div>
      ) : (
        <>
          {plannedRecords.length > 0 &&
            renderSection("planned", "Планируемые доходы", plannedTotal, plannedRecords.length, plannedRecords)}
          {actualRecords.length > 0 &&
            renderSection("actual", "Фактические доходы", actualTotal, actualRecords.length, actualRecords)}
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setError(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2>{editingId ? "Редактировать" : "Добавить"} доход</h2>
              <button onClick={() => { setShowModal(false); setError(null); }}>✕</button>
            </div>
            <div className="modal__content">
              {error && <div className="app__error" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}
              <div className="form">
                <label>
                  Название
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Например: Зарплата"
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "row", gap: "0.5rem", alignItems: "flex-end" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <span style={{ marginBottom: "0.25rem", fontSize: "0.85rem", color: "#cbd5e1" }}>Сумма</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountInput || "0"}
                      onFocus={(e) => {
                        if (amountInput === "" || amountInput === "0") e.target.select();
                      }}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const filtered = filterAmountInput(raw);
                        setAmountInput(filtered);
                        setForm({ ...form, amount: parseAmountStr(filtered) });
                      }}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ marginBottom: "0.25rem", fontSize: "0.85rem", color: "#cbd5e1" }}>Валюта</span>
                    <select
                      value={form.currency || "RUB"}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      style={{ width: "80px" }}
                    >
                      <option value="RUB">₽</option>
                      <option value="USD">$</option>
                      <option value="EUR">€</option>
                      <option value="GBP">£</option>
                    </select>
                  </div>
                </label>
                <label>
                  Дата получения
                  <input
                    type="date"
                    value={form.receivedDate}
                    onChange={(e) => {
                      const date = e.target.value;
                      setForm({ ...form, receivedDate: date });
                      if (form.isPlanned && isRecurring) {
                        setRecurringFields((prev) => ({ ...prev, startDate: date }));
                      }
                    }}
                  />
                </label>
                <label>
                  Счет
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <select
                      value={accountId || ""}
                      onChange={(e) => {
                        const id = e.target.value || undefined;
                        setAccountId(id);
                        const acc = accounts.find((a) => a.id === id);
                        if (acc) setForm((prev) => ({ ...prev, currency: acc.currency || "RUB" }));
                      }}
                      style={{ flex: "1", minWidth: "0" }}
                    >
                      <option value="">Не указывать</option>
                      {accounts.filter(acc => acc.isActive && acc.accountType !== "Savings").map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({formatAmount(account.balance, account.currency)})
                        </option>
                      ))}
                    </select>
                    {accountId ? (
                      <span style={{ color: "#cbd5e1", whiteSpace: "nowrap" }}>
                        {getCurrencySymbol(accounts.find((a) => a.id === accountId)?.currency)}
                        {accounts.find((a) => a.id === accountId)?.currency || "RUB"}
                      </span>
                    ) : (
                      <select
                        value={form.currency || "RUB"}
                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                        style={{ width: "80px" }}
                      >
                        <option value="RUB">₽</option>
                        <option value="USD">$</option>
                        <option value="EUR">€</option>
                        <option value="GBP">£</option>
                      </select>
                    )}
                  </div>
                </label>
                <label>
                  Заметки
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>
                {(!editingId || incomeCycles.some((c) => c.id === editingId) || (editingId && isCycleGeneratedId(editingId))) && (
                  <>
                    <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="checkbox"
                        checked={form.isPlanned || false}
                        onChange={(e) => {
                          const planned = e.target.checked;
                          setForm({ ...form, isPlanned: planned });
                          if (planned) {
                            setIsRecurring(true);
                            setRecurringFields((prev) => ({ ...prev, startDate: form.receivedDate }));
                          }
                        }}
                      />
                      <span>Планируемый</span>
                    </label>
                    <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        disabled={!!editingId && (incomeCycles.some((c) => c.id === editingId) || isCycleGeneratedId(editingId))}
                      />
                      <span>Повторяющийся доход</span>
                      {form.isPlanned && (
                        <HintTooltip text="При включённом «Повторяющийся доход» плановый доход будет отображаться в выбранном месяце и во всех последующих." />
                      )}
                    </label>
                  </>
                )}
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
                  <button onClick={handleSubmit} disabled={isBusy}>
                    {editingId ? "Обновить" : isRecurring ? "Создать повторяющийся доход" : "Создать доход"}
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
      {confirmAmountModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmAmountModal((prev) => ({ ...prev, isOpen: false }))}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
            <div className="modal__header">
              <h3>Подтверждение дохода</h3>
              <button onClick={() => setConfirmAmountModal((prev) => ({ ...prev, isOpen: false }))}>✕</button>
            </div>
            <div className="modal__content">
              <p style={{ marginBottom: "1rem" }}>
                Введите фактическую сумму дохода (может отличаться от планируемой):
              </p>
              <label style={{ marginBottom: "1rem" }}>
                Планируемая сумма: {confirmAmountModal.plannedAmount.toFixed(2)} ₽
              </label>
              <label style={{ marginBottom: "1rem" }}>
                Фактическая сумма:
                <input
                  type="text"
                  inputMode="decimal"
                  value={confirmAmountModal.actualAmount || "0"}
                  onFocus={(e) => {
                    const v = confirmAmountModal.actualAmount;
                    if (!v || v === "0") e.target.select();
                  }}
                  onChange={(e) => {
                    const filtered = filterAmountInput(e.target.value);
                    setConfirmAmountModal((prev) => ({ ...prev, actualAmount: filtered }));
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
                  onClick={() => setConfirmAmountModal((prev) => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: "0.75rem 1.5rem",
                    borderRadius: "12px",
                    border: "none",
                    background: "#64748b",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    const amount = parseAmountStr(confirmAmountModal.actualAmount);
                    if (amount <= 0) {
                      setError("Введите корректную сумму");
                      return;
                    }
                    await confirmAmountModal.onConfirm(amount);
                  }}
                  style={{
                    padding: "0.75rem 1.5rem",
                    borderRadius: "12px",
                    border: "none",
                    background: "#3b82f6",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                  }}
                >
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
