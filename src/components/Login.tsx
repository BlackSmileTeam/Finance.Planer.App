import { useState } from "react";
import { financialApi } from "../api/financialApi";
import type { LoginRequest, RegisterRequest } from "../types";

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState<LoginRequest>({
    usernameOrEmail: "",
    password: "",
  });
  const [registerForm, setRegisterForm] = useState<RegisterRequest>({
    username: "",
    email: "",
    password: "",
    fullName: "",
  });

  const handleLogin = async () => {
    if (!loginForm.usernameOrEmail || !loginForm.password) {
      setError("Заполните все поля");
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      await financialApi.login(loginForm);
      onLogin();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Ошибка входа");
    } finally {
      setIsBusy(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.username || !registerForm.email || !registerForm.password) {
      setError("Заполните все обязательные поля");
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      await financialApi.register(registerForm);
      onLogin();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Ошибка регистрации");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    }}>
      <div className="panel" style={{ maxWidth: "400px", width: "90%" }}>
        <div className="panel__header">
          <h2>{isLogin ? "Вход" : "Регистрация"}</h2>
        </div>
        {error && <div className="app__error">⚠️ {error}</div>}
        <div className="panel__content">
          {isLogin ? (
            <div className="form">
              <label>
                Имя пользователя или email
                <input
                  type="text"
                  value={loginForm.usernameOrEmail}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, usernameOrEmail: e.target.value })
                  }
                  placeholder="Введите имя пользователя или email"
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  placeholder="Введите пароль"
                />
              </label>
              <div style={{ display: "flex", justifyContent: "center", marginTop: "0.5rem" }}>
                <button type="button" onClick={handleLogin} disabled={isBusy}>
                  {isBusy ? "Вход..." : "Войти"}
                </button>
              </div>
              <p style={{ textAlign: "center", marginTop: "1rem" }}>
                Нет аккаунта?{" "}
                <button
                  onClick={() => setIsLogin(false)}
                  style={{ background: "transparent", border: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}
                >
                  Зарегистрироваться
                </button>
              </p>
            </div>
          ) : (
            <div className="form">
              <label>
                Имя пользователя
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, username: e.target.value })
                  }
                  placeholder="Введите имя пользователя"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  placeholder="Введите email"
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, password: e.target.value })
                  }
                  placeholder="Введите пароль"
                />
              </label>
              <label>
                Полное имя (необязательно)
                <input
                  type="text"
                  value={registerForm.fullName || ""}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, fullName: e.target.value })
                  }
                  placeholder="Введите полное имя"
                />
              </label>
              <div style={{ display: "flex", justifyContent: "center", marginTop: "0.5rem" }}>
                <button type="button" onClick={handleRegister} disabled={isBusy}>
                  {isBusy ? "Регистрация..." : "Зарегистрироваться"}
                </button>
              </div>
              <p style={{ textAlign: "center", marginTop: "1rem" }}>
                Уже есть аккаунт?{" "}
                <button
                  onClick={() => setIsLogin(true)}
                  style={{ background: "transparent", border: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}
                >
                  Войти
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

