"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0F17",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#B8C5D4",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div>
        <p style={{ marginBottom: 16, fontSize: 14 }}>Algo fue mal. Por favor intenta de nuevo.</p>
        <button
          onClick={reset}
          style={{
            background: "#22B16B",
            color: "#031A0E",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
