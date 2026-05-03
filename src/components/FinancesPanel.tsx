import type { ReactNode } from "react";

/**
 * Единый компонент отображения: доходы, расходы и инвестиции в одной панели.
 */
interface FinancesPanelProps {
  /** Секция «Доходы» */
  incomeSection: ReactNode;
  /** Секция «Расходы за месяц» */
  expenseSection: ReactNode;
  /** Секция «Инвестиции» */
  investmentSection: ReactNode;
}

export function FinancesPanel({
  incomeSection,
  expenseSection,
  investmentSection,
}: FinancesPanelProps) {
  return (
    <div className="finances-panel" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {incomeSection}
      {expenseSection}
      {investmentSection}
    </div>
  );
}
