"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const FAQ_ITEMS: readonly { readonly q: string; readonly a: string }[] = [
  {
    q: "¿Qué es GMA Filmo?",
    a: "La plataforma de streaming del colectivo Generación Maldita: cortos, animación y películas independientes de creadores reales, pensada para que se descubran y se vean, no para hacer dinero con publicidad.",
  },
  {
    q: "¿Es gratis?",
    a: "Sí, del todo. Puedes ver el catálogo entero sin pagar nada, con cuenta o como invitado.",
  },
  {
    q: "¿Puedo subir mis propios cortos o películas?",
    a: "Sí. Regístrate como creador y sube tu obra desde Mi Estudio: ficha, cartel, tráiler y la película, todo gestionado por ti.",
  },
  {
    q: "¿Qué datos pedís al registrarme?",
    a: "Lo mínimo: un correo (o tu cuenta de Google) y una contraseña. Puedes entrar como invitado sin dar ningún dato.",
  },
  {
    q: "¿Cómo contacto con el equipo?",
    a: "Desde el pie de esta página tienes nuestras redes y los enlaces al colectivo Generación Maldita.",
  },
];

interface FaqItemProps {
  readonly q: string;
  readonly a: string;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
}

/** Una pregunta: el signo gira al abrir y la respuesta se despliega con un muelle, no con un corte seco. */
function FaqItem({ q, a, isOpen, onToggle }: FaqItemProps) {
  return (
    <div className="py-6">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center justify-between gap-4 text-left text-[18px] font-semibold text-white outline-none transition-colors focus-visible:text-[#58D99B] sm:text-[20px]"
      >
        {q}
        <motion.span
          aria-hidden="true"
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="shrink-0 text-2xl text-[#C4C4C4]"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { type: "spring", stiffness: 280, damping: 30 }, opacity: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-[#C4C4C4] sm:text-[17px]">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Preguntas frecuentes de la bienvenida: un acordeón con despliegue animado (un solo abierto a la vez). El fondo
 *  verde-morado (aurora) lo pone la página entera, no esta sección. */
export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section aria-label="Preguntas frecuentes" className="px-6 py-16 text-center sm:px-10 sm:py-20 lg:px-16">
      <h2 className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-extrabold tracking-[-.02em] text-white">Preguntas frecuentes</h2>
      <div className="mx-auto mt-8 max-w-2xl divide-y divide-white/10 border-y border-white/10 text-left">
        {FAQ_ITEMS.map(({ q, a }, i) => (
          <FaqItem key={q} q={q} a={a} isOpen={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? null : i)} />
        ))}
      </div>
    </section>
  );
}
