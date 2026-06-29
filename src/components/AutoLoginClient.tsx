"use client";

import { useEffect } from "react";

export function AutoLoginClient({ callbackUrl }: { callbackUrl: string }) {
  useEffect(() => {
    const form = document.getElementById("auto-login-form") as HTMLFormElement | null;
    form?.submit();
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "sans-serif", backgroundColor: "#f9fafb", zIndex: 9999 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "48px", height: "48px", border: "4px solid #e5e7eb", borderTopColor: "#0078D4", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 20px" }} />
        <h2 style={{ color: "#111827", margin: 0, fontWeight: 600, fontSize: "18px" }}>Conectando con Microsoft...</h2>
        <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "8px" }}>Redirigiendo de forma segura</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

        <form
          id="auto-login-form"
          method="POST"
          action="/api/auth/signin/microsoft-entra-id"
        >
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        </form>
      </div>
    </div>
  );
}
