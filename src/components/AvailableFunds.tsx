import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { financialApi } from "../api/financialApi";
import type { AvailableFundsDto } from "../types";

export function AvailableFunds() {
  const [forecast, setForecast] = useState<AvailableFundsDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(dayjs().add(3, "months").format("YYYY-MM-DD"));

  useEffect(() => {
    loadForecast();
  }, [startDate, endDate]);

  const loadForecast = async () => {
    try {
      const response = await financialApi.getAvailableFundsForecast(startDate, endDate);
      setForecast(response.data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const chartData = forecast.map((item) => ({
    date: dayjs(item.date).format("DD.MM"),
    available: item.availableAmount,
    income: item.plannedIncome,
    expenses: item.plannedExpenses,
    creditPayments: item.creditPayments,
    recurring: item.recurringExpenses,
  }));

  // Check if there's any meaningful data (not all zeros)
  const hasData = forecast.some(
    (item) =>
      item.plannedIncome > 0 ||
      item.plannedExpenses > 0 ||
      item.recurringExpenses > 0 ||
      item.creditPayments > 0 ||
      item.availableAmount !== 0
  );

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
        <h2>Динамика свободных средств</h2>
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
        <div className="chart">
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorAvailable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
        <div style={{ marginTop: "2rem" }}>
          <h3>Детализация по дням</h3>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {forecast.length === 0 || !hasData ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                Данные отсутствуют
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(30, 41, 59, 0.8)", borderBottom: "1px solid #334155" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left", color: "#fff" }}>Дата</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Доходы</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Расходы</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Повторяющиеся</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }} title="Планируемые платежи по кредитам и кредитным картам">Кредиты (план)</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", color: "#fff" }}>Доступно</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.map((item, index) => (
                    <tr
                      key={index}
                      style={{
                        background: item.availableAmount < 0 ? "rgba(239, 68, 68, 0.1)" : "transparent",
                        borderBottom: "1px solid #334155",
                      }}
                    >
                      <td style={{ padding: "0.5rem", color: "#cbd5e1" }}>
                        {dayjs(item.date).format("DD.MM.YYYY")}
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "right", color: "#cbd5e1" }}>
                        {item.plannedIncome.toFixed(2)} ₽
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "right", color: "#cbd5e1" }}>
                        {item.plannedExpenses.toFixed(2)} ₽
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "right", color: "#cbd5e1" }}>
                        {item.recurringExpenses.toFixed(2)} ₽
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "right", color: "#cbd5e1" }}>
                        {item.creditPayments.toFixed(2)} ₽
                      </td>
                      <td
                        style={{
                          padding: "0.5rem",
                          textAlign: "right",
                          fontWeight: "bold",
                          color: item.availableAmount < 0 ? "#ef4444" : "#10b981",
                        }}
                      >
                        {item.availableAmount.toFixed(2)} ₽
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

