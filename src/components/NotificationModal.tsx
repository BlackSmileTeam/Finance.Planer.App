import { useEffect } from "react";
import "../App.css";

interface NotificationModalProps {
  isOpen: boolean;
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export function NotificationModal({
  isOpen,
  message,
  type = "success",
  onClose,
  autoClose = true,
  autoCloseDelay = 3000,
}: NotificationModalProps) {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          icon: "✅",
          background: "#10b981",
          borderColor: "#059669",
        };
      case "error":
        return {
          icon: "❌",
          background: "#ef4444",
          borderColor: "#dc2626",
        };
      case "info":
        return {
          icon: "ℹ️",
          background: "#3b82f6",
          borderColor: "#2563eb",
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 4000,
        pointerEvents: "none",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: styles.background,
          border: `1px solid ${styles.borderColor}`,
          borderRadius: "8px",
          padding: "0.75rem 1rem",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          minWidth: "200px",
          maxWidth: "400px",
          pointerEvents: "auto",
          animation: "slideIn 0.3s ease-out",
        }}
      >
        <span style={{ fontSize: "1rem", flexShrink: 0 }}>{styles.icon}</span>
        <p
          style={{
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: "400",
            margin: 0,
            flex: 1,
          }}
        >
          {message}
        </p>
      </div>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

