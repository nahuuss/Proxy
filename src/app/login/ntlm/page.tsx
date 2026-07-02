"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ntlmSignIn } from "./actions";

function NtlmLoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/";
  const connectorId = searchParams?.get("connectorId") || "";
  const defaultDomain = searchParams?.get("domain") || "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const domain = (form.elements.namedItem("domain") as HTMLInputElement).value;

    const result = await ntlmSignIn(username, password, domain, connectorId);

    if (result.ok) {
      window.location.href = callbackUrl;
    } else {
      setError("Credenciales incorrectas. Verifica usuario y contraseña.");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "sans-serif", backgroundColor: "#0072c6", position: "fixed", inset: 0, zIndex: 9999 }}>
      <div style={{ background: "#fff", padding: "40px", borderRadius: "12px", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", minWidth: "340px", maxWidth: "400px", width: "100%" }}>
        <div style={{ marginBottom: "28px", textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", background: "#EFF6FF", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#111" }}>Acceso a CRM</h2>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#374151" }}>Ingresa tus credenciales de red</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#1E3A5F", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Legajo</label>
            <input name="username" type="text" autoComplete="username" autoFocus required
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #93C5FD", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box", color: "#111827", backgroundColor: "#F0F7FF" }}
              placeholder="XXXXXX" />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#1E3A5F", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Contraseña</label>
            <input name="password" type="password" autoComplete="current-password" required
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #93C5FD", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box", color: "#111827", backgroundColor: "#F0F7FF" }}
              placeholder="••••••••" />
          </div>

          {/* Campo dominio oculto para mantener lógica de autenticación sin mostrarlo en UI */}
          <input name="domain" type="hidden" value={defaultDomain} readOnly />
          <input name="connectorId" type="hidden" value={connectorId} readOnly />

          {error && <p style={{ margin: 0, color: "#DC2626", fontSize: "13px", textAlign: "center" }}>{error}</p>}

          <button type="submit" disabled={loading || !connectorId}
            style={{ background: loading || !connectorId ? "#93C5FD" : "#2563EB", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: loading || !connectorId ? "not-allowed" : "pointer", marginTop: "4px" }}>
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NtlmLoginPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Cargando...</div>}>
      <NtlmLoginForm />
    </Suspense>
  );
}
