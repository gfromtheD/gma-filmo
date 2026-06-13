"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { LayoutGroup, motion, AnimatePresence } from "motion/react";

import { TextRotate } from "@/components/ui/text-rotate";
import AnimatedGradientBackground from "@/components/ui/animated-gradient-background";
import { ThreeDMarquee } from "@/components/ui/three-d-marquee";
import { LoginCard } from "@/components/ui/login-card";
import { RegisterCard } from "@/components/ui/register-card";
import { CreatorRegisterCard } from "@/components/ui/creator-register-card";

// ─── Component ────────────────────────────────────────────────────────────────

export function LandingHero() {
  const [view, setView] = useState<"hero" | "login" | "register" | "creator-register">("hero");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has("register")) setView("register");
    else if (p.has("login") || p.has("error")) setView("login");
  }, []);

  return (
    <section className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0A0F17] md:overflow-visible">








      {/* Franja — borde difuminado, semitransparente para dejar ver el patrón */}
      <div
        className="absolute right-0 top-0 h-full w-[55%] pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent 0%, rgba(8,12,16,0.4) 25%)", zIndex: 20 }}
      />

      {/* Gradiente animado — encima de todo, z-60 */}
      <AnimatedGradientBackground
        Breathing
        startingGap={130}
        breathingRange={5}
        animationSpeed={0.015}
        topOffset={0}
        gradientColors={[
          "transparent",
          "transparent",
          "#051F10",
          "#0D4A28",
          "#1B8E56",
          "#29D480",
          "#22B16B",
          "#0F6B3A",
          "#073D20",
          "rgba(4,18,10,0.95)",
        ]}
        gradientStops={[35, 48, 55, 61, 67, 72, 78, 85, 92, 100]}
        containerClassName="z-[60] pointer-events-none"
      />

      {/* 3a — Marquee 3D esquina superior izquierda */}
      <motion.div
        className="absolute top-0 left-0 w-[60%] h-[90%] z-10 pointer-events-none overflow-hidden"
        style={{ maskImage: "linear-gradient(to right, black 70%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black 70%, transparent 100%)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
      >
        <ThreeDMarquee className="h-full w-full" columns={4} />
      </motion.div>


      <div className="absolute right-0 top-[38%] -translate-y-1/2 z-50 flex w-[44%] flex-col items-center justify-center px-8 md:px-12 lg:px-16">
        <AnimatePresence mode="wait">
          {view === "hero" && (
            <motion.div
              key="hero-content"
              className="flex w-full flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div className="mb-10 self-center">
                <Image src="/images/logo-gma.png" alt="GMA Filmo" height={64} width={200} className="h-16 w-auto" />
              </div>

              <h1 className="flex w-full flex-col items-center justify-center gap-2 text-center text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl md:gap-3 md:text-5xl lg:text-6xl">
                <span>El lugar para</span>
                <LayoutGroup>
                  <motion.span layout>
                    <TextRotate
                      texts={["descubrir", "compartir", "sentir", "disfrutar"]}
                      mainClassName="overflow-hidden pb-1 pr-2 text-[#22B16B] md:pb-2"
                      staggerDuration={0.03}
                      staggerFrom="last"
                      rotationInterval={2800}
                      transition={{ type: "spring", damping: 30, stiffness: 400 }}
                    />
                  </motion.span>
                </LayoutGroup>
                <span>cine</span>
              </h1>

              <p className="pt-6 text-center text-sm font-medium text-[#B8C5D4] md:pt-8 md:text-base">
                Cine independiente, sin límites y completamente gratis.
                La plataforma del colectivo Generación Maldita donde el arte se ve, se comparte y crece.
              </p>

              <div className="mt-10 flex flex-row items-center justify-center gap-4 md:mt-14">
                <motion.button
                  type="button"
                  onClick={() => setView("login")}
                  whileHover={{ scale: 1.05, transition: { type: "spring", damping: 30, stiffness: 400 } }}
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-2xl sm:px-6 sm:py-3 sm:text-base md:px-8 md:text-lg"
                >
                  Iniciar sesión
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => setView("register")}
                  whileHover={{ scale: 1.05, transition: { type: "spring", damping: 30, stiffness: 400 } }}
                  className="rounded-full bg-[#22B16B] px-5 py-2.5 text-sm font-semibold text-black shadow-2xl sm:px-6 sm:py-3 sm:text-base md:px-8 md:text-lg"
                >
                  Registrarse
                </motion.button>
              </div>
            </motion.div>
          )}

          {view === "login" && (
            <motion.div
              key="login-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <LoginCard
                onBack={() => setView("hero")}
                onRegister={() => setView("register")}
                onCreatorRegister={() => setView("creator-register")}
              />
            </motion.div>
          )}

          {view === "register" && (
            <motion.div
              key="register-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <RegisterCard
                onBack={() => setView("hero")}
                onLogin={() => setView("login")}
                onCreatorRegister={() => setView("creator-register")}
              />
            </motion.div>
          )}

          {view === "creator-register" && (
            <motion.div
              key="creator-register-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full"
            >
              <CreatorRegisterCard
                onBack={() => setView("hero")}
                onLogin={() => setView("login")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
