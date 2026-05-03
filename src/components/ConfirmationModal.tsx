import "../App.css";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  onConfirm,
  onCancel,
  variant = "danger",
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: "⚠️",
          confirmButton: {
            background: "#ef4444",
            hoverBackground: "#dc2626",
          },
        };
      case "warning":
        return {
          icon: "⚠️",
          confirmButton: {
            background: "#f59e0b",
            hoverBackground: "#d97706",
          },
        };
      case "info":
        return {
          icon: "ℹ️",
          confirmButton: {
            background: "#3b82f6",
            hoverBackground: "#2563eb",
          },
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
        <div className="modal__header">
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.75rem" }}>{styles.icon}</span>
            {title}
          </h2>
        </div>
        <div className="modal__content">
          <p style={{ color: "#cbd5e1", fontSize: "1rem", lineHeight: "1.6", margin: "0.5rem 0" }}>
            {message}
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "flex-end",
              marginTop: "1.5rem",
            }}
          >
            <button
              onClick={onCancel}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "10px",
                border: "1px solid #334155",
                background: "transparent",
                color: "#cbd5e1",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: "500",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#334155";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#cbd5e1";
              }}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "10px",
                border: "none",
                background: styles.confirmButton.background,
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: "600",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = styles.confirmButton.hoverBackground;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = styles.confirmButton.background;
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

