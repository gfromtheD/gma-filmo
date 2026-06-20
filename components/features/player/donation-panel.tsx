"use client";

import { QRCodeSVG } from "qrcode.react";
import { X } from "lucide-react";
import { motion } from "motion/react";
import type { CreatorProfile } from "@/types/creator";

const PLATFORM_BUTTONS = [
  {
    key: "paypal" as const,
    label: "Donar por PayPal",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z" />
      </svg>
    ),
  },
  {
    key: "patreon" as const,
    label: "Apoyar en Patreon",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" />
      </svg>
    ),
  },
  {
    key: "bitcoin" as const,
    label: "Dirección Bitcoin",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.165c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.925l.007-.013zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" />
      </svg>
    ),
  },
] as const;

interface DonationPanelProps {
  readonly creator: CreatorProfile | null;
  readonly appUrl: string;
  readonly onClose: () => void;
}

export function DonationPanel({ creator, appUrl, onClose }: DonationPanelProps) {
  // TODO: revert to `/creadores/${creator.slug}` after QR flow is verified
  const profileUrl = `${appUrl}/donatest`;

  const hasAnyDonation = creator && (
    creator.donacion_paypal || creator.donacion_patreon || creator.donacion_bitcoin
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 30, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/10"
        style={{ background: "rgba(10,13,20,0.98)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="text-[15px] font-bold text-white">
            {creator ? `Apoya a ${creator.nombre}` : "Apoya al creador"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de donación"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-white/40 transition-colors duration-150 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex gap-5 p-5">
          {/* QR */}
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="rounded-[10px] border border-white/10 p-2.5" style={{ background: "#0D0D0D" }}>
              <QRCodeSVG
                value={profileUrl}
                size={100}
                bgColor="#0D0D0D"
                fgColor="#22B16B"
                level="M"
              />
            </div>
            <p className="max-w-[120px] text-center text-[10px] leading-tight text-[#6D7D94]">
              Escanea para ver el perfil completo
            </p>
          </div>

          {/* Donation buttons */}
          <div className="flex flex-1 flex-col justify-center gap-2">
            {hasAnyDonation ? (
              PLATFORM_BUTTONS.map(({ key, label, icon }) => {
                const val = creator![`donacion_${key}`];
                if (!val) return null;
                const href = key === "bitcoin" ? `bitcoin:${val}` : val;
                return (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-full border border-[#1E2D42] px-4 py-2.5 text-[13px] font-semibold text-[#B8C5D4] transition-colors duration-150 hover:border-[#22B16B]/50 hover:bg-[#22B16B]/10 hover:text-[#22B16B]"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    {icon}
                    {label}
                  </a>
                );
              })
            ) : (
              <p className="text-[13px] leading-relaxed text-[#6D7D94]">
                Escanea el QR para visitar el perfil del creador y apoyar su trabajo.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
