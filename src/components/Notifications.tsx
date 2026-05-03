import { useState, useMemo } from "react";
import dayjs from "dayjs";
import type { RecurringExpenseDto } from "../types";

interface Notification {
  id: string;
  title: string;
  amount: number;
  date: string;
  type: "upcoming" | "today" | "overdue";
  categoryName?: string;
}

interface NotificationsProps {
  recurringExpenses: RecurringExpenseDto[];
  onDismiss?: (id: string) => void;
}

export function Notifications({ recurringExpenses, onDismiss }: NotificationsProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const notifications = useMemo(() => {
    const today = dayjs();
    const next7Days = today.add(7, "days");
    const notifs: Notification[] = [];

    recurringExpenses
      .filter((re) => re.isActive)
      .forEach((re) => {
        const start = dayjs(re.startDate);
        const end = re.endDate ? dayjs(re.endDate) : null;
        let current = start;

        // Find next occurrence
        while (current.isBefore(next7Days) || current.isSame(next7Days, "day")) {
          if (end && current.isAfter(end)) break;

          if (current.isSame(today, "day")) {
            notifs.push({
              id: `${re.id}-${current.format("YYYY-MM-DD")}`,
              title: re.title,
              amount: re.amount,
              date: current.format("YYYY-MM-DD"),
              type: "today",
              categoryName: re.categoryName,
            });
            break;
          } else if (current.isAfter(today) && current.isBefore(next7Days) || current.isSame(next7Days, "day")) {
            notifs.push({
              id: `${re.id}-${current.format("YYYY-MM-DD")}`,
              title: re.title,
              amount: re.amount,
              date: current.format("YYYY-MM-DD"),
              type: "upcoming",
              categoryName: re.categoryName,
            });
            break;
          }

          // Move to next occurrence
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

    // Sort by date
    return notifs
      .filter((n) => !dismissedIds.includes(n.id))
      .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
  }, [recurringExpenses, dismissedIds]);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => [...prev, id]);
    onDismiss?.(id);
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notifications">
      {notifications.map((notif) => {
        const daysUntil = dayjs(notif.date).diff(dayjs(), "days");
        const isToday = daysUntil === 0;

        return (
          <div
            key={notif.id}
            className={`notification notification--${notif.type}`}
          >
            <div className="notification__icon">
              {isToday ? "🔔" : "📅"}
            </div>
            <div className="notification__content">
              <div className="notification__title">{notif.title}</div>
              <div className="notification__details">
                {isToday
                  ? "Сегодня"
                  : daysUntil === 1
                  ? "Завтра"
                  : `Через ${daysUntil} ${daysUntil === 1 ? "день" : daysUntil < 5 ? "дня" : "дней"}`}
                {" • "}
                {notif.amount.toFixed(2)} ₽
              </div>
            </div>
            <button
              className="notification__dismiss"
              onClick={() => handleDismiss(notif.id)}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

