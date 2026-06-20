"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ErrorButton {
  label: string;
  onClick: () => void;
  variant: "outline" | "solid";
  icon: "back" | "home" | "retry";
}

interface Props {
  code?: string;
  title: string;
  description: string;
  buttons: ErrorButton[];
}

interface Circle { x: number; y: number; size: number; }

// ── Icons ──────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function RetryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  );
}

// ── Message Display ────────────────────────────────────────────────────────

function MessageDisplay({ code, title, description, buttons }: Props & { code: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: "absolute", zIndex: 100,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      width: "90%", height: "90%", textAlign: "center",
    }}>
      <div style={{
        opacity: visible ? 1 : 0, transition: "opacity 0.5s ease",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{ fontSize: 32, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 90, fontWeight: 800, color: "#fff", lineHeight: 1,
          marginBottom: 16, letterSpacing: "-0.04em" }}>
          {code}
        </div>
        <div style={{ fontSize: 15, maxWidth: 380, color: "rgba(255,255,255,0.7)",
          lineHeight: 1.6, marginBottom: 36 }}>
          {description}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {buttons.map((btn) => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "11px 26px", fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                border: "2px solid",
                transition: "all 0.22s ease",
                borderColor: btn.variant === "solid" ? "#fff" : "rgba(255,255,255,0.45)",
                background:  btn.variant === "solid" ? "#fff" : "transparent",
                color:       btn.variant === "solid" ? "#000" : "#fff",
                borderRadius: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.color = "#000";
                e.currentTarget.style.borderColor = "#fff";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = btn.variant === "solid" ? "#fff" : "transparent";
                e.currentTarget.style.color = btn.variant === "solid" ? "#000" : "#fff";
                e.currentTarget.style.borderColor = btn.variant === "solid" ? "#fff" : "rgba(255,255,255,0.45)";
              }}
            >
              {btn.icon === "back"  && <BackIcon />}
              {btn.icon === "home"  && <HomeIcon />}
              {btn.icon === "retry" && <RetryIcon />}
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Circle Animation ───────────────────────────────────────────────────────

function CircleAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>();
  const stateRef  = useRef({ timer: 0, circles: [] as Circle[] });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setup = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      stateRef.current.timer   = 0;
      stateRef.current.circles = Array.from({ length: 300 }, () => ({
        x:    Math.random() * canvas.width * 1.8 + canvas.width * 1.2,
        y:    Math.random() * canvas.height * 1.2 - canvas.height * 0.1,
        size: canvas.width / 1000,
      }));
    };

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      stateRef.current.timer++;
      const { timer, circles } = stateRef.current;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";

      const distX  = canvas.width / 80;
      const growth = canvas.width / 1000;

      circles.forEach(c => {
        ctx.beginPath();
        if (timer < 65) {
          c.x    -= distX;
          c.size += growth;
        } else if (timer < 500) {
          c.x    -= distX * 0.02;
          c.size += growth * 0.2;
        }
        ctx.arc(c.x, c.y, Math.max(c.size, 0), 0, Math.PI * 2);
        ctx.fill();
      });

      if (stateRef.current.timer < 500) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    setup();
    draw();

    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setup();
      draw();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

// ── Main export ────────────────────────────────────────────────────────────

export function ErrorScreen({ code = "404", title, description, buttons }: Props) {
  return (
    <div style={{
      width: "100%", height: "100vh",
      background: "#22B16B", overflow: "hidden",
      position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* UPSS! sobre el verde, queda tapado por los círculos al animarse */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none", userSelect: "none",
      }}>
        <span style={{
          fontSize: "clamp(80px, 18vw, 200px)",
          fontWeight: 900,
          color: "#000",
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}>
          UPSS!
        </span>
      </div>

      <CircleAnimation />
      <MessageDisplay code={code} title={title} description={description} buttons={buttons} />
    </div>
  );
}
