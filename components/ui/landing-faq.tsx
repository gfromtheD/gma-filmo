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

/** Preguntas frecuentes de la bienvenida: un acordeón nativo (<details>), sin JavaScript. */
export function LandingFaq() {
  return (
    <section aria-label="Preguntas frecuentes" className="px-6 py-16 sm:px-10 sm:py-20 lg:px-16">
      <h2 className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-extrabold tracking-[-.02em] text-white">Preguntas frecuentes</h2>
      <div className="mt-8 max-w-2xl divide-y divide-white/10 border-y border-white/10">
        {FAQ_ITEMS.map(({ q, a }) => (
          <details key={q} className="group py-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-white outline-none focus-visible:text-[#58D99B] sm:text-[17px]">
              {q}
              <span aria-hidden="true" className="shrink-0 text-xl text-[#C4C4C4] transition-transform duration-200 group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-[#C4C4C4]">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
