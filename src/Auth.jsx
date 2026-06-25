import { useState } from "react";
import { supabase } from "./supabaseClient";

const C = {
  bg: "#131319",
  surface: "#1C1C24",
  line: "#2E2E3A",
  text: "#EDEDF2",
  muted: "#8C8C9C",
  faint: "#3A3A48",
  gold: "#F5B544",
  danger: "#E0656B",
};

export default function Auth() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async () => {
    if (!email || !password) return;
    setBusy(true);
    setMsg("");
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    // на успехе App перехватит сессию через onAuthStateChange
    setBusy(false);
  };

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
          Трекер привычек
        </div>
        <div style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>
          {mode === "signin" ? "Вход" : "Регистрация"}
        </div>

        <input
          type="email"
          autoComplete="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={field(C)}
        />
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ ...field(C), marginTop: 10 }}
        />

        {msg && (
          <div style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>
            {msg}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "11px 0",
            borderRadius: 12,
            border: "none",
            background: C.gold,
            color: "#1A1208",
            fontWeight: 600,
            fontSize: 15,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {mode === "signin" ? "Войти" : "Создать аккаунт"}
        </button>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMsg("");
          }}
          style={{
            marginTop: 14,
            width: "100%",
            background: "transparent",
            border: "none",
            color: C.muted,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {mode === "signin"
            ? "Нет аккаунта — зарегистрироваться"
            : "Уже есть аккаунт — войти"}
        </button>
      </div>
    </div>
  );
}

function field(C) {
  return {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 14px",
    borderRadius: 12,
    background: C.surface,
    border: `1px solid ${C.line}`,
    color: C.text,
    fontSize: 15,
    outline: "none",
  };
}
