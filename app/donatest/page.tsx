"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// ── Brand logo imitations ──────────────────────────────────────────────────

const P_PATH =
  "M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.72A.641.641 0 0 1 5.577 2h7.022c2.33 0 3.984.65 4.96 1.948.93 1.234 1.096 2.795.501 4.715-.847 2.766-2.951 4.213-6.254 4.29l-1.286.02-.613 3.875a.641.641 0 0 1-.633.54H7.076zm4.99-13.073c1.93 0 3.145.677 3.641 2.016.366.993.257 2.207-.322 3.61-.793 1.942-2.213 2.913-4.219 2.913h-.37l.494-3.116a.641.641 0 0 0-.633-.74H9.4l.948-5.988c.527.194 1.067.305 1.718.305z";

function PayPalLogo() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden="true">
      {/* Back P — light blue, offset right */}
      <path d={P_PATH} fill="#009cde" transform="translate(3,0)" />
      {/* Front P — dark navy */}
      <path d={P_PATH} fill="#003087" />
    </svg>
  );
}

function PatreonLogo() {
  return (
    // Circle (head) + vertical bar (stem) — Patreon's iconic mark
    <svg width={26} height={26} viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="17" cy="11.5" r="7.5" fill="#FF424D" />
      <rect x="2.5" y="2.5" width="4.5" height="23" rx="1.5" fill="#FF424D" />
    </svg>
  );
}

function BitcoinLogo() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="#f7931a" aria-hidden="true">
      <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.165c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.925l.007-.013zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ── Donation options ───────────────────────────────────────────────────────

interface DonationOption {
  key: string;
  name: string;
  detail: string;
  href: string;
  logo: React.ReactNode;
  labelColor: string;
  bg: string;
  border: string;
  hoverBorder: string;
}

const DONATIONS: DonationOption[] = [
  {
    key: "paypal",
    name: "PayPal",
    detail: "paypal.me/carlos-mendoza",
    href: "https://paypal.me/test",
    logo: <PayPalLogo />,
    labelColor: "#009cde",
    bg: "rgba(0,56,135,0.10)",
    border: "rgba(0,156,222,0.18)",
    hoverBorder: "rgba(0,156,222,0.45)",
  },
  {
    key: "patreon",
    name: "Patreon",
    detail: "patreon.com/carlosdocs",
    href: "https://patreon.com/test",
    logo: <PatreonLogo />,
    labelColor: "#FF424D",
    bg: "rgba(255,66,77,0.08)",
    border: "rgba(255,66,77,0.18)",
    hoverBorder: "rgba(255,66,77,0.45)",
  },
  {
    key: "bitcoin",
    name: "Bitcoin",
    detail: "bc1qxy2kg…x0wlh",
    href: "bitcoin:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    logo: <BitcoinLogo />,
    labelColor: "#f7931a",
    bg: "rgba(247,147,26,0.08)",
    border: "rgba(247,147,26,0.18)",
    hoverBorder: "rgba(247,147,26,0.45)",
  },
];

// ── Login gate (bottom sheet) ──────────────────────────────────────────────

function LoginGate({
  platform,
  onClose,
  onGoogleLogin,
  loading,
}: {
  platform: string;
  onClose: () => void;
  onGoogleLogin: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 flex items-end justify-center px-4 pb-6"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", zIndex: 50 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[390px] overflow-hidden rounded-2xl border border-white/10 p-6"
        style={{
          background: "rgba(8,11,17,0.99)",
          boxShadow: "0 -24px 80px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#22B16B" }}>
              GMA Filmo
            </p>
            <h2 className="mt-1 text-[18px] font-bold leading-snug text-white">
              Para donar en {platform}
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: "#6D7D94" }}>
              Inicia sesión con tu cuenta GMA primero.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/40 transition-colors hover:text-white"
          >
            <X size={13} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => void onGoogleLogin()}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-white/12 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.07] disabled:opacity-50"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <GoogleIcon />
          {loading ? "Redirigiendo…" : "Continuar con Google"}
        </button>

        <p className="mt-4 text-center text-[12px]" style={{ color: "#3A4A5E" }}>
          Tu cuenta GMA verifica que eres parte de la comunidad
        </p>
      </motion.div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DonaTestPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [gate, setGate] = useState<{ name: string; href: string } | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      // After OAuth redirect: auto-open the donation the user was clicking
      const pending = localStorage.getItem("gma_donate_pending");
      if (data.session && pending) {
        localStorage.removeItem("gma_donate_pending");
        window.open(pending, "_blank");
      }
    });
  }, []);

  function handleDonate(opt: DonationOption) {
    if (session) {
      window.open(opt.href, "_blank");
    } else {
      setGate({ name: opt.name, href: opt.href });
    }
  }

  async function handleGoogleLogin() {
    if (!gate) return;
    localStorage.setItem("gma_donate_pending", gate.href);
    setGoogleLoading(true);
    await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "openid email profile",
        redirectTo: `${window.location.origin}/auth/callback?next=/donatest`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  }

  return (
    <>
      <main
        className="flex min-h-screen flex-col items-center justify-start"
        style={{ background: "#080B11" }}
      >
        <div className="w-full max-w-[390px] px-4 py-10">

          {/* ── Creator card ───────────────────────────────────────────── */}
          <div
            className="overflow-hidden rounded-2xl border border-white/10"
            style={{ background: "rgba(10,13,20,0.98)" }}
          >
            <div
              className="h-28 w-full"
              style={{
                background:
                  "linear-gradient(135deg, #0e2218 0%, #112d20 50%, #0a1a14 100%)",
              }}
            />
            <div className="relative px-5 pb-5">
              <div
                className="absolute -top-10 left-5 h-20 w-20 overflow-hidden rounded-full border-4"
                style={{ borderColor: "#080B11" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://i.pravatar.cc/160?img=12"
                  alt="Foto de Carlos Mendoza"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="pt-12">
                <h1 className="text-[20px] font-bold text-white">
                  Carlos Mendoza
                </h1>
                <p
                  className="mt-0.5 text-[13px] font-medium"
                  style={{ color: "#22B16B" }}
                >
                  @carlos.mendoza
                </p>
                <p
                  className="mt-3 text-[13px] leading-relaxed"
                  style={{ color: "#8A9AB0" }}
                >
                  Documentalista independiente. Cuento historias que otros
                  prefieren no ver. Si mi trabajo te llega, considera apoyarme
                  — cada contribución hace posible el próximo proyecto.
                </p>
              </div>
            </div>
          </div>

          {/* ── Donation buttons ──────────────────────────────────────── */}
          <div className="mt-5">
            <p
              className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "#4A5A6A" }}
            >
              Apoya el trabajo de Carlos
            </p>
            <div className="flex flex-col gap-2.5">
              {DONATIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleDonate(opt)}
                  className="group flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-150"
                  style={{
                    background: opt.bg,
                    borderColor: opt.border,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = opt.hoverBorder;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = opt.border;
                  }}
                >
                  {opt.logo}
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[14px] font-bold"
                      style={{ color: opt.labelColor }}
                    >
                      {opt.name}
                    </p>
                    <p
                      className="truncate text-[12px]"
                      style={{ color: "#5A6A7A" }}
                    >
                      {opt.detail}
                    </p>
                  </div>
                  <svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4A5A6A"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <p
            className="mt-8 text-center text-[11px]"
            style={{ color: "#2A3A4A" }}
          >
            Página de prueba — GMA Filmo
          </p>
        </div>
      </main>

      <AnimatePresence>
        {gate && (
          <LoginGate
            platform={gate.name}
            onClose={() => { setGate(null); setGoogleLoading(false); }}
            onGoogleLogin={handleGoogleLogin}
            loading={googleLoading}
          />
        )}
      </AnimatePresence>
    </>
  );
}
