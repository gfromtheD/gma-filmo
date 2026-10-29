"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";

import { TextRotate } from "@/components/ui/text-rotate";
import { ThreeDMarquee } from "@/components/ui/three-d-marquee";
import { LoginCard } from "@/components/ui/login-card";
import { RegisterCard } from "@/components/ui/register-card";
import { CreatorRegisterCard } from "@/components/ui/creator-register-card";
import { LandingPreviewRow } from "@/components/ui/landing-preview-row";
import { LandingMessageBand } from "@/components/ui/landing-message-band";
import { LandingFaq } from "@/components/ui/landing-faq";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteAurora } from "@/components/layout/site-aurora";
import { enterAsGuest } from "@/lib/auth/guest-access";
import type { MovieMedia } from "@/types/catalog";

type WelcomeView = "hero" | "login" | "register" | "creator-register";
const bandCtaClass = "inline-flex min-h-12 w-fit items-center justify-center gap-3 rounded-full bg-white px-6 text-[15px] font-semibold text-gma-surface-2 transition-colors hover:bg-[#DBF7E9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#58D99B] disabled:opacity-60";

interface LandingHeroProps {
  readonly peliculas: readonly MovieMedia[];
  readonly cortos: readonly MovieMedia[];
}

export function LandingHero({ peliculas, cortos }: LandingHeroProps) {
  const [view, setView] = useState<WelcomeView>("hero");
  const [guestLoading, setGuestLoading] = useState(false);
  const reducedMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const hasNavigated = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("register")) setView("register");
    else if (params.has("login") || params.has("error")) setView("login");
  }, []);

  function focusCurrentView() {
    if (!hasNavigated.current) return;
    if (view === "hero") enterRef.current?.focus({ preventScroll: true });
    else contentRef.current?.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true });
  }

  function changeView(next: WelcomeView) {
    hasNavigated.current = true;
    setView(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  const openLogin = () => changeView("login");

  // El único botón de invitado que queda (el «Entrar a GMA Filmo» del giro y su eco más abajo): entra directo,
  // sin pasar por ninguna pasarela intermedia.
  async function enterGuest() {
    setGuestLoading(true);
    try {
      await enterAsGuest("/inicio");
    } catch {
      setGuestLoading(false);
    }
  }

  // Cada franja con mensaje usa de fondo una imagen real del catálogo que ya se está enseñando en las filas.
  const filmBandImage = peliculas[0]?.imageUrl ?? cortos[0]?.imageUrl;
  const creatorsBandImage = cortos[0]?.imageUrl ?? peliculas[1]?.imageUrl ?? peliculas[0]?.imageUrl;

  return (
    <MotionConfig reducedMotion="user">
      <div className="text-white">
        <SiteAurora />
        <section className="relative isolate flex min-h-[88svh] w-full flex-col overflow-hidden">
          {/* El mosaico se disuelve de verdad en el último tramo (máscara de opacidad, no una capa de color
              encima): revela el mismo fondo aurora que ya corre por toda la web, así no hay dos colores que
              «empalmar» a ojo — es el mismo fondo a ambos lados del límite del giro, sin corte posible. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20"
            style={{
              maskImage: "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
            }}>
            {/* columns=4 es la base del móvil (el mínimo que admite el componente); el escritorio siempre
                enseña 6 porque .largePosters lo fuerza por CSS, así que esto no cambia cómo se ve ahí. */}
            <ThreeDMarquee className="h-full w-full" columns={4} largePostersOnDesktop itemsPerGroup={10} />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10"
            style={{ background: view === "hero"
              ? "linear-gradient(90deg, color-mix(in srgb, var(--gma-surface-2) 94%, transparent) 0%, color-mix(in srgb, var(--gma-surface-2) 84%, transparent) 28%, color-mix(in srgb, var(--gma-surface-2) 48%, transparent) 58%, color-mix(in srgb, var(--gma-surface-2) 8%, transparent) 100%)"
              : "color-mix(in srgb, var(--gma-surface-2) 74%, transparent)" }} />

          <header className="relative flex min-h-[68px] items-center justify-between gap-4 px-6 pt-6 sm:px-10 sm:pt-8 lg:px-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-gma.png" alt="GMA Filmo" width={200} height={64} fetchPriority="high" className="h-10 w-auto sm:h-12" />
            {view === "hero" && (
              <button type="button" onClick={openLogin}
                className="min-h-10 rounded-full bg-white px-5 text-[14px] font-semibold text-gma-surface-2 transition-colors hover:bg-[#DBF7E9] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#58D99B]">
                Iniciar sesión
              </button>
            )}
          </header>

          <div ref={contentRef} className="relative flex w-full flex-1 items-center justify-center px-6 py-12 sm:px-10 sm:py-16 lg:px-16">
            <AnimatePresence mode="wait">
              <motion.div key={view} className={view === "hero" ? "w-full max-w-4xl" : "w-full max-w-lg text-center"}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }} transition={{ duration: reducedMotion ? 0 : 0.25 }}
                onAnimationComplete={focusCurrentView}>
                {view === "hero" && <div className="text-center">
                  <h1 aria-label="El lugar para descubrir, compartir, sentir y disfrutar cine." className="text-[clamp(3rem,8.5vw,8rem)] font-extrabold leading-[1.15] tracking-[-.045em]">
                    <span className="block">El lugar para</span>
                    <span aria-hidden="true" className="mx-auto block h-[1.35em] text-[#58D99B]">
                      <TextRotate texts={["descubrir", "compartir", "sentir", "disfrutar"]}
                        rotationInterval={3000} auto={!reducedMotion}
                        mainClassName="h-full w-full flex-nowrap items-center justify-center overflow-hidden whitespace-nowrap"
                        splitLevelClassName="whitespace-nowrap"
                        staggerDuration={0.025} staggerFrom="last"
                        transition={{ type: "spring", damping: 30, stiffness: 400 }} />
                    </span>
                    <span className="block">cine.</span>
                  </h1>
                  <p className="mx-auto mt-7 max-w-lg text-base leading-relaxed text-[#DEE3E0] sm:text-lg">
                    Descubre cortos, animación y nuevas voces del cine independiente. Un espacio de Generación Maldita para ver, compartir y apoyar a sus creadores.
                  </p>
                  <button ref={enterRef} type="button" onClick={() => void enterGuest()} disabled={guestLoading}
                    className="mt-9 inline-flex min-h-14 items-center justify-center gap-5 rounded-full bg-white px-7 text-base font-semibold text-gma-surface-2 transition-colors hover:bg-[#DBF7E9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#58D99B] disabled:opacity-60">
                    {guestLoading ? "Entrando…" : <>Entrar a GMA Filmo <ArrowRight size={20} aria-hidden="true" /></>}
                  </button>
                  <p className="mt-4 text-sm text-[#C4C4C4]">Acceso gratuito, sin necesidad de registrarte.</p>
                </div>}

                {(["login", "register", "creator-register"] as WelcomeView[]).includes(view) && <div>
                  <button type="button" onClick={() => changeView("hero")} className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-[#C4C4C4] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#58D99B]">
                    <ArrowLeft size={16} aria-hidden="true" /> Volver a la bienvenida
                  </button>
                  {view === "login" && <LoginCard onBack={() => changeView("hero")} onRegister={() => changeView("register")} onCreatorRegister={() => changeView("creator-register")} />}
                  {view === "register" && <RegisterCard onBack={() => changeView("hero")} onLogin={() => changeView("login")} onCreatorRegister={() => changeView("creator-register")} />}
                  {view === "creator-register" && <CreatorRegisterCard onBack={() => changeView("hero")} onLogin={() => changeView("login")} />}
                </div>}

              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* Avance real del catálogo, franjas con mensaje y preguntas frecuentes: todo sigue aquí debajo pase lo que
            pase arriba (también con el panel de acceso abierto), como en las plataformas de streaming de referencia. */}
        <LandingPreviewRow title="Cortos" items={cortos} onRequestLogin={openLogin} />

        <LandingMessageBand
          title="Largometrajes independientes, sin publicidad"
          description="Películas completas de cine independiente, de principio a fin, sin anuncios de por medio."
          imageUrl={filmBandImage}
          cta={<button type="button" onClick={() => void enterGuest()} disabled={guestLoading} className={bandCtaClass}>{guestLoading ? "Entrando…" : "Ver gratis"}</button>}
        />

        <LandingPreviewRow title="Películas" items={peliculas} onRequestLogin={openLogin} />

        <LandingMessageBand
          title="Apoya a quien lo hace"
          description="Cada título es de un creador real. Generación Maldita es un colectivo: si tienes cortos o películas propias, también puedes subirlos y que se vean."
          imageUrl={creatorsBandImage}
          cta={<button type="button" onClick={() => { changeView("creator-register"); }} className={bandCtaClass}>Regístrate como creador</button>}
        />

        <LandingFaq />

        <section className="px-6 py-16 text-center sm:px-10 sm:py-20 lg:px-16">
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold tracking-[-.03em] text-white">¿List@ para entrar?</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-[#C4C4C4]">Acceso gratuito, sin necesidad de registrarte.</p>
          <button type="button" onClick={() => void enterGuest()} disabled={guestLoading}
            className="mx-auto mt-7 inline-flex min-h-14 items-center justify-center gap-5 rounded-full bg-white px-7 text-base font-semibold text-gma-surface-2 transition-colors hover:bg-[#DBF7E9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#58D99B] disabled:opacity-60">
            {guestLoading ? "Entrando…" : <>Entrar a GMA Filmo <ArrowRight size={20} aria-hidden="true" /></>}
          </button>
        </section>

        <SiteFooter insetClassName="" />
      </div>
    </MotionConfig>
  );
}
