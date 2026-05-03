import { useState, useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import type {
  RecurringExpenseDto,
  ExpenseDto,
  IncomeRecordDto,
  IncomeCycleDto,
  LoanPaymentForMonthDto,
  PendingCreditPaymentDto,
} from "../types";

// API может вернуть frequency как число (enum)
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

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  amount: number;
  type: "recurring" | "expense" | "planned" | "income";
  categoryName?: string;
}

export type PeriodType = "full" | "first" | "second";

interface CalendarProps {
  recurringExpenses: RecurringExpenseDto[];
  expenses: ExpenseDto[];
  creditPayments?: PendingCreditPaymentDto[];
  loanPayments?: LoanPaymentForMonthDto[];
  incomeRecords?: IncomeRecordDto[];
  incomeCycles?: IncomeCycleDto[];
  selectedYear: number;
  selectedMonth: number;
  useHalfMonth?: boolean;
  onUseHalfMonthChange?: (v: boolean) => void;
  selectedPeriod?: PeriodType;
  onPeriodChange?: (period: PeriodType) => void;
  onDateSelect?: (date: string) => void;
  onAddExpense?: (date: string) => void;
  onYearChange?: (year: number) => void;
  onMonthChange?: (month: number) => void;
  /** Скрыть чекбокс «По полумесяцам» и кнопки 8–23 / 24–7 (например, когда открыт раздел План/Факт) */
  hideHalfMonthOptions?: boolean;
}

export function Calendar({
  recurringExpenses,
  expenses,
  creditPayments = [],
  loanPayments = [],
  incomeRecords = [],
  incomeCycles = [],
  selectedYear,
  selectedMonth,
  useHalfMonth = false,
  onUseHalfMonthChange,
  selectedPeriod = "first",
  onPeriodChange,
  onDateSelect,
  onAddExpense,
  onYearChange,
  onMonthChange,
  hideHalfMonthOptions = false,
}: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calculate events for the month
  const events = useMemo(() => {
    const monthEvents: CalendarEvent[] = [];
    const startDate = dayjs(`${selectedYear}-${selectedMonth}-01`);
    const endDate = startDate.endOf("month");

    // Add recurring expenses
    recurringExpenses
      .filter((re) => re.isActive)
      .forEach((re) => {
        const start = dayjs(re.startDate);
        const end = re.endDate ? dayjs(re.endDate) : endDate;
        let current = start;

        while (current.isBefore(endDate) || current.isSame(endDate, "day")) {
          if (end && current.isAfter(end)) break;
          if (current.month() + 1 === selectedMonth && current.year() === selectedYear) {
            const title = (re.title || "").trim() || re.subcategoryName || re.categoryName || "Повторяющийся расход";
            monthEvents.push({
              id: `${re.id}-${current.format("YYYY-MM-DD")}`,
              date: current.format("YYYY-MM-DD"),
              title,
              amount: re.amount,
              type: "recurring",
              categoryName: re.categoryName,
            });
          }

          switch (re.frequency) {
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
          }
        }
      });

    // Add expenses (actual and planned) — плановые показываем типом "planned"
    expenses.forEach((exp) => {
      const title = (exp.description || exp.categoryName || "").trim() || exp.subcategoryName || "Расход";
      monthEvents.push({
        id: exp.id,
        date: exp.expenseDate,
        title,
        amount: exp.amount,
        type: exp.isPlanned ? "planned" : "expense",
        categoryName: exp.categoryName,
      });
    });

    // Add credit payments (planned)
    creditPayments.forEach((p) => {
      const day = p.scheduledDay ?? 1;
      const date = `${p.scheduledYear}-${String(p.scheduledMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (p.scheduledYear === selectedYear && p.scheduledMonth === selectedMonth) {
        monthEvents.push({
          id: `credit-${p.paymentScheduleId}`,
          date,
          title: `${p.categoryName} (${p.creditAccountName})`,
          amount: p.paymentAmount,
          type: "planned",
          categoryName: p.categoryName,
        });
      }
    });

    // Add loan payments (planned)
    loanPayments.forEach((p) => {
      const day = p.scheduledDay ?? 1;
      const date = `${p.scheduledYear}-${String(p.scheduledMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (p.scheduledYear === selectedYear && p.scheduledMonth === selectedMonth) {
        monthEvents.push({
          id: `loan-${p.creditAccountId}`,
          date,
          title: `Платеж по кредиту ${p.creditAccountName}`,
          amount: p.paymentAmount,
          type: "planned",
          categoryName: "Кредиты",
        });
      }
    });

    // Add income records (actual and planned)
    incomeRecords
      .filter((r) => {
        const d = dayjs(r.receivedDate);
        return d.year() === selectedYear && d.month() + 1 === selectedMonth;
      })
      .forEach((r) => {
        monthEvents.push({
          id: r.id,
          date: r.receivedDate,
          title: r.title,
          amount: r.amount,
          type: "income",
          categoryName: undefined,
        });
      });

    // Add planned income from cycles (expand by date)
    incomeCycles
      .filter((c) => c.isPlanned)
      .forEach((cycle) => {
        const start = dayjs(cycle.startDate);
        const end = cycle.endDate ? dayjs(cycle.endDate) : null;
        const freq = normalizeFrequency(cycle.frequency);
        const getPeriodUnit = () => {
          switch (freq) {
            case "Weekly":
            case "BiWeekly": return "week";
            case "Monthly":
            case "Quarterly": return "month";
            case "Yearly": return "year";
            default: return "month";
          }
        };
        let iterationLimit = end && end.isBefore(endDate) ? end : endDate.add(1, getPeriodUnit());
        let current = start;
        let iterations = 0;
        const maxIterations = 1000;

        while ((current.isBefore(iterationLimit) || current.isSame(iterationLimit, "day")) && iterations < maxIterations) {
          iterations++;
          if (end && current.isAfter(end)) break;
          if (current.month() + 1 === selectedMonth && current.year() === selectedYear) {
            const cycleTitle = (cycle.title || "").trim() || "Повторяющийся доход";
            monthEvents.push({
              id: `${cycle.id}-${current.format("YYYY-MM-DD")}`,
              date: current.format("YYYY-MM-DD"),
              title: cycleTitle,
              amount: cycle.amount,
              type: "income",
              categoryName: undefined,
            });
          }
          switch (freq) {
            case "Weekly": current = current.add(1, "week"); break;
            case "BiWeekly": current = current.add(2, "weeks"); break;
            case "Monthly": current = current.add(1, "month"); break;
            case "Quarterly": current = current.add(3, "months"); break;
            case "Yearly": current = current.add(1, "year"); break;
            default: current = current.add(1, "month"); break;
          }
        }
      });

    return monthEvents;
  }, [recurringExpenses, expenses, creditPayments, loanPayments, incomeRecords, incomeCycles, selectedYear, selectedMonth]);

  // При «По полумесяцам» — границы периода: 8–23 или 24 текущего по 7 следующего
  const { periodStartDate, periodEndDate } = useMemo(() => {
    const start = dayjs(`${selectedYear}-${selectedMonth}-01`);
    if (!useHalfMonth) {
      return { periodStartDate: start.format("YYYY-MM-DD"), periodEndDate: start.endOf("month").format("YYYY-MM-DD") };
    }
    if (selectedPeriod === "first") {
      return { periodStartDate: start.date(8).format("YYYY-MM-DD"), periodEndDate: start.date(23).format("YYYY-MM-DD") };
    }
    const nextMonth = start.add(1, "month");
    return { periodStartDate: start.date(24).format("YYYY-MM-DD"), periodEndDate: nextMonth.date(7).format("YYYY-MM-DD") };
  }, [selectedYear, selectedMonth, useHalfMonth, selectedPeriod]);

  // В режиме полумесяцев показываем только события выбранного периода
  const eventsInPeriod = useMemo(() => {
    if (!useHalfMonth) return events;
    const start = dayjs(periodStartDate).startOf("day");
    const end = dayjs(periodEndDate).endOf("day");
    return events.filter((e) => {
      const d = dayjs(e.date);
      return !d.isBefore(start) && !d.isAfter(end);
    });
  }, [events, useHalfMonth, periodStartDate, periodEndDate]);

  const daysInMonth = dayjs(`${selectedYear}-${selectedMonth}-01`).daysInMonth();
  const firstDayOfMonth = dayjs(`${selectedYear}-${selectedMonth}-01`).day();
  const monthName = dayjs(`${selectedYear}-${selectedMonth}-01`).locale("ru").format("MMMM YYYY");

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const getEventsForDate = (date: string) => {
    return eventsInPeriod.filter((e) => e.date === date);
  };

  const days = [];
  // Empty cells for days before month starts
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = dayjs(`${selectedYear}-${selectedMonth}-${day}`).format("YYYY-MM-DD");
    days.push(date);
  }

  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const getEventTypeLabel = (type: CalendarEvent["type"]): string => {
    switch (type) {
      case "income": return "Доход";
      case "expense": return "Фактический расход";
      case "recurring": return "Повторяющийся расход";
      case "planned": return "Плановый (расход или платёж по кредиту/карте)";
      default: return "Событие";
    }
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      if (onYearChange) onYearChange(selectedYear - 1);
      if (onMonthChange) onMonthChange(12);
    } else {
      if (onMonthChange) onMonthChange(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      if (onYearChange) onYearChange(selectedYear + 1);
      if (onMonthChange) onMonthChange(1);
    } else {
      if (onMonthChange) onMonthChange(selectedMonth + 1);
    }
  };

  const periodBtn = (period: "first" | "second", label: string) => (
    <button
      key={period}
      onClick={() => onPeriodChange?.(period)}
      style={{
        background: selectedPeriod === period ? "#3b82f6" : "rgba(30, 41, 59, 0.5)",
        border: "1px solid #334155",
        color: "#fff",
        padding: "0.35rem 0.6rem",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "0.8rem",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="calendar">
      <div className="calendar__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={handlePrevMonth}
          style={{
            background: "rgba(30, 41, 59, 0.5)",
            border: "1px solid #334155",
            color: "#fff",
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          ←
        </button>
        <h3 style={{ margin: 0 }}>{monthName}</h3>
        <button
          onClick={handleNextMonth}
          style={{
            background: "rgba(30, 41, 59, 0.5)",
            border: "1px solid #334155",
            color: "#fff",
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          →
        </button>
      </div>
      {onUseHalfMonthChange && !hideHalfMonthOptions && (
        <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", color: "#cbd5e1", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={useHalfMonth}
              onChange={(e) => onUseHalfMonthChange(e.target.checked)}
            />
            По полумесяцам
          </label>
          {useHalfMonth && onPeriodChange && (
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {periodBtn("first", "8–23")}
              {periodBtn("second", "24–7")}
            </div>
          )}
        </div>
      )}
      <div className="calendar__grid">
        {dayNames.map((name) => (
          <div key={name} className="calendar__day-name">
            {name}
          </div>
        ))}
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="calendar__day calendar__day--empty" />;
          }

          const dateEvents = getEventsForDate(date);
          const isToday = date === dayjs().format("YYYY-MM-DD");
          const isSelected = date === selectedDate;

          return (
            <div
              key={date}
              className={`calendar__day ${isToday ? "calendar__day--today" : ""} ${isSelected ? "calendar__day--selected" : ""}`}
              onClick={() => handleDateClick(date)}
            >
              <div className="calendar__day-number">{dayjs(date).date()}</div>
              {dateEvents.length > 0 && (
                <div className="calendar__day-events">
                  {dateEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={`calendar__event calendar__event--${event.type}`}
                      title={`${getEventTypeLabel(event.type)}: ${event.title} — ${event.amount.toFixed(2)} ₽`}
                    />
                  ))}
                  {dateEvents.length > 3 && (
                    <div className="calendar__event-more">+{dateEvents.length - 3}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="calendar__legend" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1rem", justifyContent: "center", marginTop: "0.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }} title="Доход">
          <span className="calendar__event-dot calendar__event-dot--income" style={{ flexShrink: 0 }} /> Доход
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }} title="Фактический расход">
          <span className="calendar__event-dot calendar__event-dot--expense" style={{ flexShrink: 0 }} /> Факт. расход
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }} title="Повторяющийся расход">
          <span className="calendar__event-dot calendar__event-dot--recurring" style={{ flexShrink: 0 }} /> Повторяющийся
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }} title="Плановый расход или платёж по кредиту/карте">
          <span className="calendar__event-dot calendar__event-dot--planned" style={{ flexShrink: 0 }} /> Плановые
        </span>
      </div>
      {selectedDate && (
        <div className="calendar__details">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h4>События на {dayjs(selectedDate).format("DD.MM.YYYY")}</h4>
            <button
              className="app__right-sidebar__add-button"
              style={{ padding: "0.25rem 0.75rem", fontSize: "0.85rem" }}
              onClick={() => {
                onAddExpense?.(selectedDate);
              }}
            >
              +
            </button>
          </div>
          {getEventsForDate(selectedDate).length === 0 ? (
            <p style={{ color: "#94a3b8" }}>Нет событий</p>
          ) : (
            <ul className="calendar__events-list">
              {getEventsForDate(selectedDate).map((event) => (
                <li key={event.id}>
                  <span
                    className={`calendar__event-dot calendar__event-dot--${event.type}`}
                    title={getEventTypeLabel(event.type)}
                  />
                  <span>{event.title}</span>
                  <span style={{ marginLeft: "auto", fontWeight: 600 }}>
                    {event.type === "income" ? "+" : "-"}
                    {event.amount.toFixed(2)} ₽
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

