import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/ru";
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
import { financialApi } from "../api/financialApi";
import type { MonthlySummaryDto, AvailableFundsDto } from "../types";

export function PlanVsActual() {
  const [summaries, setSummaries] = useState<MonthlySummaryDto[]>([]);
  const [summaries8_23, setSummaries8_23] = useState<MonthlySummaryDto[]>([]);
  const [summaries24_7, setSummaries24_7] = useState<MonthlySummaryDto[]>([]);
  const [forecast, setForecast] = useState<AvailableFundsDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().add(3, "months").format("YYYY-MM-DD"));
  const [viewMode, setViewMode] = useState<"chart" | "table">("table");
  const [useHalfMonth, setUseHalfMonth] = useState(false);

  // Generate months for the period
  const monthsList = useMemo(() => {
    const list: Array<{ year: number; month: number }> = [];
    const start = dayjs(startDate).startOf("month");
    const end = dayjs(endDate);
    let current = start;
    while (current.isBefore(end) || current.isSame(end, "month")) {
      list.push({ year: current.year(), month: current.month() + 1 });
      current = current.add(1, "month");
    }
    return list;
  }, [startDate, endDate]);

  // При useHalfMonth: две колонки на месяц (8–23 и 24–7). Иначе: одна колонка на месяц.
  const allColumns = useMemo(() => {
    if (!useHalfMonth) {
      return monthsList.map((m) => ({
        year: m.year,
        month: m.month,
        period: null as string | null,
        summary: summaries.find((s) => s.year === m.year && s.month === m.month),
      }));
    }
    return monthsList.flatMap((m) => [
      {
        year: m.year,
        month: m.month,
        period: "8–23" as const,
        summary: summaries8_23.find((s) => s.year === m.year && s.month === m.month),
      },
      {
        year: m.year,
        month: m.month,
        period: "24–7" as const,
        summary: summaries24_7.find((s) => s.year === m.year && s.month === m.month),
      },
    ]);
  }, [useHalfMonth, monthsList, summaries, summaries8_23, summaries24_7]);

  useEffect(() => {
    loadSummaries();
    loadForecast();
  }, [startDate, endDate, useHalfMonth]);

  const loadSummaries = async () => {
    try {
      const start = dayjs(startDate);
      const end = dayjs(endDate);
      const years = new Set<number>();
      let current = start.startOf("month");
      while (current.isBefore(end) || current.isSame(end, "month")) {
        years.add(current.year());
        current = current.add(1, "month");
      }
      if (!useHalfMonth) {
        const allSummaries: MonthlySummaryDto[] = [];
        for (const year of years) {
          try {
            const response = await financialApi.getSummaries(year);
            allSummaries.push(...response.data);
          } catch (err: any) {
            console.error(`Error loading summaries for year ${year}:`, err);
          }
        }
        setSummaries(allSummaries);
        setSummaries8_23([]);
        setSummaries24_7([]);
      } else {
        const list8_23: MonthlySummaryDto[] = [];
        const list24_7: MonthlySummaryDto[] = [];
        for (const year of years) {
          try {
            const [res8_23, tailRes, headRes] = await Promise.all([
              financialApi.getSummaries(year, 8, 23),
              financialApi.getSummaries(year, 24, 31),
              financialApi.getSummaries(year, 1, 7),
            ]);
            list8_23.push(...res8_23.data);
            const tail = tailRes.data;
            const head = headRes.data;
            const nextYear = year + 1;
            const nextYearHead = await financialApi.getSummaries(nextYear, 1, 7).then((r) => r.data).catch(() => []);
            for (let m = 1; m <= 12; m++) {
              const tailS = tail.find((s) => s.month === m);
              const nextM = m === 12 ? 1 : m + 1;
              const nextY = m === 12 ? nextYear : year;
              const headS = (m === 12 ? nextYearHead : head).find((s) => s.year === nextY && s.month === nextM);
              const pi = (tailS?.plannedIncome ?? 0) + (headS?.plannedIncome ?? 0);
              const pe = (tailS?.plannedExpense ?? 0) + (headS?.plannedExpense ?? 0);
              const ai = (tailS?.actualIncome ?? 0) + (headS?.actualIncome ?? 0);
              const ae = (tailS?.actualExpense ?? 0) + (headS?.actualExpense ?? 0);
              const carryOver = tailS?.carryOver ?? 0;
              const closing = carryOver + (ai > 0 ? ai : pi) - (ae > 0 ? ae : pe);
              const color = closing < 0 ? "#DC2626" : closing < 2500 ? "#DC2626" : closing < 5000 ? "#F97316" : "#16A34A";
              list24_7.push({
                year,
                month: m,
                plannedIncome: pi,
                plannedExpense: pe,
                fullPlannedExpense: pe,
                actualIncome: ai,
                actualExpense: ae,
                carryOver,
                closingBalance: closing,
                actualBalance: 0,
                plannedBalance: 0,
                alertColor: color,
              });
            }
          } catch (err: any) {
            console.error(`Error loading summaries for year ${year}:`, err);
          }
        }
        setSummaries([]);
        setSummaries8_23(list8_23);
        setSummaries24_7(list24_7);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadForecast = async () => {
    try {
      const response = await financialApi.getAvailableFundsForecast(startDate, endDate);
      setForecast(response.data);
    } catch (err: any) {
      // Silently handle forecast errors
    }
  };

  const balanceByColumn = useMemo(() => {
    const map = new Map<number, { closingBalance: number; actualBalance: number; plannedBalance: number }>();
    let prevActual = 0;
    let prevCarryForPlanned = 0;
    allColumns.forEach((col, idx) => {
      const s = col.summary;
      const actual = s ? prevActual + s.actualIncome - s.actualExpense : prevActual;
      const isFirstHalf = col.period === "8–23";
      const planned = isFirstHalf
        ? (s?.closingBalance ?? 0)
        : (s ? prevCarryForPlanned + s.plannedIncome - s.plannedExpense : prevCarryForPlanned);
      map.set(idx, {
        closingBalance: s?.closingBalance ?? 0,
        actualBalance: actual,
        plannedBalance: planned,
      });
      prevActual = actual;
      prevCarryForPlanned = s && s.actualExpense > 0 ? actual : planned;
    });
    return map;
  }, [allColumns]);

  const getPlannedBalance = (colIdx: number, summary?: MonthlySummaryDto) => {
    if (useHalfMonth) {
      return balanceByColumn.get(colIdx)?.plannedBalance ?? summary?.closingBalance ?? 0;
    }
    return (summary?.plannedBalance ?? summary?.closingBalance) ?? balanceByColumn.get(colIdx)?.closingBalance ?? 0;
  };

  const getActualBalance = (colIdx: number, summary?: MonthlySummaryDto) =>
    balanceByColumn.get(colIdx)?.actualBalance ?? summary?.actualBalance ?? 0;

  const chartData = useMemo(() => {
    return monthsList.map((m) => {
      const monthName = dayjs(`${m.year}-${m.month}-01`).locale("ru").format("MMM");
      if (useHalfMonth) {
        const s8 = summaries8_23.find((s) => s.year === m.year && s.month === m.month);
        const s24 = summaries24_7.find((s) => s.year === m.year && s.month === m.month);
        const plannedIncome = (s8?.plannedIncome ?? 0) + (s24?.plannedIncome ?? 0);
        const actualIncome = (s8?.actualIncome ?? 0) + (s24?.actualIncome ?? 0);
        const plannedExpense = (s8?.plannedExpense ?? 0) + (s24?.plannedExpense ?? 0);
        const actualExpense = (s8?.actualExpense ?? 0) + (s24?.actualExpense ?? 0);
        const closing = s24?.closingBalance ?? s8?.closingBalance ?? 0;
        const colIdx = allColumns.findIndex(
          (c) => c.year === m.year && c.month === m.month && c.period === "24–7"
        );
        const plannedBalance = colIdx >= 0 ? balanceByColumn.get(colIdx)?.plannedBalance ?? closing : closing;
        const actualBalance = colIdx >= 0 ? balanceByColumn.get(colIdx)?.actualBalance ?? 0 : 0;
        const color = (s24 ?? s8)?.alertColor ?? "#64748b";
        return {
          name: monthName,
          plannedIncome,
          actualIncome,
          plannedExpense,
          actualExpense,
          balance: closing,
          plannedBalance,
          actualBalance,
          color,
        };
      }
      const summary = summaries.find((s) => s.year === m.year && s.month === m.month);
      return {
        name: monthName,
        plannedIncome: summary?.plannedIncome ?? 0,
        actualIncome: summary?.actualIncome ?? 0,
        plannedExpense: summary?.plannedExpense ?? 0,
        actualExpense: summary?.actualExpense ?? 0,
        balance: summary?.closingBalance ?? 0,
        plannedBalance: summary?.plannedBalance ?? summary?.closingBalance ?? 0,
        actualBalance: summary?.actualBalance ?? 0,
        color: summary?.alertColor ?? "#64748b",
      };
    });
  }, [useHalfMonth, monthsList, summaries, summaries8_23, summaries24_7, allColumns, balanceByColumn]);

  const hasData = (useHalfMonth ? [...summaries8_23, ...summaries24_7] : summaries).some(
    (s) => s.plannedIncome > 0 || s.actualIncome > 0 || s.plannedExpense > 0 || s.actualExpense > 0
  );

  const hasForecastData = forecast.some(
    (item) =>
      item.plannedIncome > 0 ||
      item.plannedExpenses > 0 ||
      item.recurringExpenses > 0 ||
      item.creditPayments > 0 ||
      item.availableAmount !== 0
  );

  const forecastChartData = forecast.map((item) => ({
    date: dayjs(item.date).format("DD.MM"),
    available: item.availableAmount,
  }));

  const minAvailable = forecast.length > 0
    ? Math.min(...forecast.map((f) => f.availableAmount))
    : 0;
  const maxAvailable = forecast.length > 0
    ? Math.max(...forecast.map((f) => f.availableAmount))
    : 0;
  const currentAvailable = forecast[forecast.length - 1]?.availableAmount || 0;

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>План vs Факт</h2>
        <div className="app__filters">
          <label>
            Дата начала
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            Дата окончания
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
      </div>
      {error && <div className="app__error">⚠️ {error}</div>}
      <div className="panel__content">
        {/* Свободные средства */}
        <div style={{ marginBottom: "2rem" }}>
          <h3>Динамика свободных средств</h3>
          <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ padding: "1rem", background: "rgba(30, 41, 59, 0.5)", border: "1px solid #334155", borderRadius: "8px", color: "#cbd5e1" }}>
              <strong style={{ color: "#fff" }}>Свободные средства за период:</strong> {currentAvailable.toFixed(2)} ₽
            </div>
            <div style={{ padding: "1rem", background: "rgba(30, 41, 59, 0.5)", border: "1px solid #334155", borderRadius: "8px", color: "#cbd5e1" }}>
              <strong style={{ color: "#fff" }}>Минимум в периоде:</strong> {minAvailable.toFixed(2)} ₽
            </div>
            <div style={{ padding: "1rem", background: "rgba(30, 41, 59, 0.5)", border: "1px solid #334155", borderRadius: "8px", color: "#cbd5e1" }}>
              <strong style={{ color: "#fff" }}>Максимум в периоде:</strong> {maxAvailable.toFixed(2)} ₽
            </div>
          </div>
          {hasForecastData ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={forecastChartData}>
                  <defs>
                    <linearGradient id="colorAvailable" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="available"
                    stroke="#10B981"
                    fillOpacity={1}
                    fill="url(#colorAvailable)"
                    name="Свободные средства"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
              Данные отсутствуют
            </div>
          )}
        </div>

        {/* План vs Факт график */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h3>План vs Факт</h3>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", color: "#94a3b8", fontSize: "0.9rem" }}>
                <input type="checkbox" checked={useHalfMonth} onChange={(e) => setUseHalfMonth(e.target.checked)} />
                Разбить на полумесяцы
              </label>
              <span style={{ width: "0.5rem" }} />
              <button
                onClick={() => setViewMode("chart")}
                style={{
                  padding: "0.5rem 1rem",
                  background: viewMode === "chart" ? "#3b82f6" : "rgba(30, 41, 59, 0.5)",
                  color: "#fff",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                График
              </button>
              <button
                onClick={() => setViewMode("table")}
                style={{
                  padding: "0.5rem 1rem",
                  background: viewMode === "table" ? "#3b82f6" : "rgba(30, 41, 59, 0.5)",
                  color: "#fff",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Таблица по категориям
              </button>
            </div>
          </div>
          {viewMode === "chart" ? (
            <div className="chart">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="plannedIncome" fill="#F59E0B" name="Плановый доход" />
                <Bar dataKey="actualIncome" fill="#10B981" name="Фактический доход" />
                <Bar dataKey="plannedExpense" fill="#EF4444" name="Плановый расход" />
                <Bar dataKey="actualExpense" fill="#DC2626" name="Фактический расход" />
                <Bar dataKey="plannedBalance" fill="#8B5CF6" name="Баланс план" />
                <Bar dataKey="actualBalance" fill="#06B6D4" name="Баланс факт" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          ) : (
            <div style={{ maxHeight: "600px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(30, 41, 59, 0.8)", borderBottom: "1px solid #334155", position: "sticky", top: 0 }}>
                    <th style={{ padding: "0.75rem", textAlign: "left", color: "#fff" }}>Месяц</th>
                    {allColumns.map((col) => (
                      <th key={`${col.year}-${col.month}-${col.period ?? "full"}`} style={{ padding: "0.75rem", textAlign: "right", color: "#fff" }}>
                        {col.period
                          ? `${dayjs(`${col.year}-${col.month}-01`).locale("ru").format("MMM")} ${col.period}`
                          : dayjs(`${col.year}-${col.month}-01`).locale("ru").format("MMMM YYYY")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "0.75rem", color: "#cbd5e1", fontWeight: "bold" }}>Плановый доход</td>
                    {allColumns.map((col, idx) => {
                      const s = col.summary;
                      return (
                        <td key={`planned-income-${idx}`} style={{ padding: "0.75rem", textAlign: "right", color: "#cbd5e1" }}>
                          {s ? `${s.plannedIncome.toFixed(2)} ₽` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "0.75rem", color: "#cbd5e1", fontWeight: "bold" }}>Фактический доход</td>
                    {allColumns.map((col, idx) => {
                      const s = col.summary;
                      return (
                        <td key={`actual-income-${idx}`} style={{ padding: "0.75rem", textAlign: "right", color: "#cbd5e1" }}>
                          {s ? `${s.actualIncome.toFixed(2)} ₽` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "0.75rem", color: "#cbd5e1", fontWeight: "bold" }}>Плановый расход</td>
                    {allColumns.map((col, idx) => {
                      const s = col.summary;
                      return (
                        <td key={`planned-expense-${idx}`} style={{ padding: "0.75rem", textAlign: "right", color: "#cbd5e1" }}>
                          {s ? `${s.plannedExpense.toFixed(2)} ₽` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "0.75rem", color: "#94a3b8", fontWeight: "bold" }}>Плановый расход (всего)</td>
                    {allColumns.map((col, idx) => {
                      const s = col.summary;
                      const val = s ? (s.fullPlannedExpense ?? s.plannedExpense) : null;
                      return (
                        <td key={`planned-expense-full-${idx}`} style={{ padding: "0.75rem", textAlign: "right", color: "#94a3b8" }}>
                          {val != null ? `${val.toFixed(2)} ₽` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "0.75rem", color: "#cbd5e1", fontWeight: "bold" }}>Фактический расход</td>
                    {allColumns.map((col, idx) => {
                      const s = col.summary;
                      return (
                        <td key={`actual-expense-${idx}`} style={{ padding: "0.75rem", textAlign: "right", color: "#cbd5e1" }}>
                          {s ? `${s.actualExpense.toFixed(2)} ₽` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "0.75rem", color: "#cbd5e1", fontWeight: "bold" }}>Отклонение расхода</td>
                    {allColumns.map((col, idx) => {
                      const planned = col.summary ? (col.summary.fullPlannedExpense ?? col.summary.plannedExpense) : 0;
                      const diff = col.summary ? col.summary.actualExpense - planned : 0;
                      return (
                        <td
                          key={`expense-diff-${idx}`}
                          style={{
                            padding: "0.75rem",
                            textAlign: "right",
                            color: diff > 0 ? "#ef4444" : diff < 0 ? "#10b981" : "#94a3b8",
                          }}
                        >
                          {diff > 0 ? "+" : ""}{diff.toFixed(2)} ₽
                        </td>
                      );
                    })}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "0.75rem", color: "#cbd5e1", fontWeight: "bold" }}>Баланс план</td>
                    {allColumns.map((col, idx) => {
                      const val = getPlannedBalance(idx, col.summary);
                      return (
                        <td
                          key={`planned-balance-${idx}`}
                          style={{
                            padding: "0.75rem",
                            textAlign: "right",
                            fontWeight: "bold",
                            color: val >= 0 ? "#10b981" : "#ef4444",
                          }}
                        >
                          {val.toFixed(2)} ₽
                        </td>
                      );
                    })}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "0.75rem", color: "#cbd5e1", fontWeight: "bold" }}>Баланс факт</td>
                    {allColumns.map((col, idx) => {
                      const val = getActualBalance(idx, col.summary);
                      return (
                        <td
                          key={`actual-balance-${idx}`}
                          style={{
                            padding: "0.75rem",
                            textAlign: "right",
                            fontWeight: "bold",
                            color: val >= 0 ? "#10b981" : "#ef4444",
                          }}
                        >
                          {val.toFixed(2)} ₽
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Детализация по месяцам - таблица */}
        <div style={{ marginTop: "2rem" }}>
          <h3>Детализация по месяцам</h3>
          {allColumns.length === 0 || !hasData ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
              Данные отсутствуют
            </div>
          ) : (
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(30, 41, 59, 0.8)", borderBottom: "1px solid #334155" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left", color: "#fff" }}>Месяц</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Плановый доход</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Фактический доход</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Плановый расход</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Фактический расход</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Отклонение расхода</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Перенос</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Баланс план</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Баланс факт</th>
                  </tr>
                </thead>
                <tbody>
                  {allColumns.map((col, idx) => {
                    const monthName = col.period
                      ? `${dayjs(`${col.year}-${col.month}-01`).locale("ru").format("MMMM YYYY")} (${col.period})`
                      : dayjs(`${col.year}-${col.month}-01`).locale("ru").format("MMMM YYYY");
                    const summary = col.summary;
                    if (!summary) {
                      return (
                        <tr key={`${col.year}-${col.month}-${col.period ?? "full"}`} style={{ borderBottom: "1px solid #334155" }}>
                          <td style={{ padding: "0.5rem", color: "#cbd5e1" }}>{monthName}</td>
                          <td style={{ padding: "0.5rem", textAlign: "right", color: "#6b7280" }}>0.00 ₽</td>
                          <td style={{ padding: "0.5rem", textAlign: "right", color: "#6b7280" }}>0.00 ₽</td>
                          <td style={{ padding: "0.5rem", textAlign: "right", color: "#6b7280" }}>0.00 ₽</td>
                          <td style={{ padding: "0.5rem", textAlign: "right", color: "#6b7280" }}>0.00 ₽</td>
                          <td style={{ padding: "0.5rem", textAlign: "right", color: "#6b7280" }}>0.00 ₽</td>
                          <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "bold", color: "#6b7280" }}>0.00 ₽</td>
                          <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "bold", color: "#6b7280" }}>0.00 ₽</td>
                        </tr>
                      );
                    }
                    const incomeDiff = summary.actualIncome - summary.plannedIncome;
                    const plannedForDiff = summary.fullPlannedExpense ?? summary.plannedExpense;
                    const expenseDiff = summary.actualExpense - plannedForDiff;

                    return (
                      <tr
                        key={`${col.year}-${col.month}-${col.period ?? "full"}`}
                        style={{
                          background: summary.closingBalance < 0 ? "rgba(239, 68, 68, 0.1)" : "transparent",
                          borderBottom: "1px solid #334155",
                        }}
                      >
                        <td style={{ padding: "0.5rem", color: "#cbd5e1" }}>{monthName}</td>
                        <td style={{ padding: "0.5rem", textAlign: "right", color: "#cbd5e1" }}>
                          {summary.plannedIncome.toFixed(2)} ₽
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right", color: "#cbd5e1" }}>
                          {summary.actualIncome.toFixed(2)} ₽
                          {incomeDiff !== 0 && (
                            <span
                              style={{
                                color: incomeDiff >= 0 ? "#10b981" : "#ef4444",
                                marginLeft: "0.5rem",
                                fontSize: "0.875rem",
                              }}
                            >
                              ({incomeDiff >= 0 ? "+" : ""}
                              {incomeDiff.toFixed(2)} ₽)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right", color: "#cbd5e1" }}>
                          {summary.plannedExpense.toFixed(2)} ₽
                          {summary.fullPlannedExpense !== summary.plannedExpense && (
                            <span style={{ display: "block", fontSize: "0.75rem", opacity: 0.75, marginTop: "0.15rem" }}>
                              всего: {(summary.fullPlannedExpense ?? summary.plannedExpense).toFixed(2)} ₽
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right", color: "#cbd5e1" }}>
                          {summary.actualExpense.toFixed(2)} ₽
                          {expenseDiff !== 0 && (
                            <span
                              style={{
                                color: expenseDiff <= 0 ? "#10b981" : "#ef4444",
                                marginLeft: "0.5rem",
                                fontSize: "0.875rem",
                              }}
                            >
                              ({expenseDiff >= 0 ? "+" : ""}
                              {expenseDiff.toFixed(2)} ₽)
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            textAlign: "right",
                            color: expenseDiff > 0 ? "#ef4444" : expenseDiff < 0 ? "#10b981" : "#94a3b8",
                          }}
                        >
                          {expenseDiff > 0 ? "+" : ""}{expenseDiff.toFixed(2)} ₽
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right", color: "#cbd5e1" }}>
                          {summary.carryOver.toFixed(2)} ₽
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            textAlign: "right",
                            fontWeight: "bold",
                            color: getPlannedBalance(idx, summary) >= 0 ? "#10b981" : "#ef4444",
                          }}
                        >
                          {getPlannedBalance(idx, summary).toFixed(2)} ₽
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            textAlign: "right",
                            fontWeight: "bold",
                            color: getActualBalance(idx, summary) >= 0 ? "#10b981" : "#ef4444",
                          }}
                        >
                          {getActualBalance(idx, summary).toFixed(2)} ₽
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

