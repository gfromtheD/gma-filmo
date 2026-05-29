"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ background: "#0A0F17", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#B8C5D4" }}>
          <p style={{ marginBottom: 16, fontSize: 14 }}>Algo fue mal. Por favor intenta de nuevo.</p>
          <button
            onClick={reset}
            style={{ background: "#22B16B", color: "#031A0E", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
