import type { Metadata } from "next";

export const metadata: Metadata = { title: "Condiciones de uso · GMA Filmo" };

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-16 text-white">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6D7D94]">
        GMA Filmo
      </p>
      <h1 className="mb-2 text-[36px] font-extrabold tracking-[-0.02em]">Condiciones de uso</h1>
      <p className="mb-10 text-[13px] text-[#5A6A7E]">Versión provisional · sujeta a revisión legal</p>

      <div className="flex flex-col gap-8 text-[15px] leading-[1.7] text-[#C0CCDA]">
        <Section title="1. Objeto">
          GMA Filmo es una plataforma de distribución y descubrimiento de cine independiente gestionada
          por Generación Maldita. El acceso y uso de la plataforma implica la aceptación de estas condiciones.
        </Section>

        <Section title="2. Acceso">
          El acceso es gratuito y libre para cualquier persona. Los creadores que deseen publicar contenido
          deben completar el proceso de registro como creador y aceptar expresamente estos términos.
        </Section>

        <Section title="3. Contenido publicado por creadores">
          Los creadores son los únicos responsables del contenido que suban a la plataforma. Al publicar,
          garantizan que son titulares de los derechos necesarios o disponen de las autorizaciones pertinentes.
          GMA Filmo no se responsabiliza de posibles infracciones de derechos de autor cometidas por los creadores.
        </Section>

        <Section title="4. Conducta">
          Queda prohibido publicar contenido que incite al odio, sea ilegal, vulnere derechos de terceros
          o contravenga la legislación vigente. GMA Filmo se reserva el derecho de retirar cualquier
          contenido sin previo aviso y de suspender cuentas que incumplan estas normas.
        </Section>

        <Section title="5. Propiedad intelectual">
          Cada creador conserva todos los derechos sobre su obra. GMA Filmo obtiene únicamente una licencia
          no exclusiva para mostrar y distribuir el contenido dentro de la plataforma durante el tiempo que
          el creador mantenga su cuenta activa.
        </Section>

        <Section title="6. Modificaciones">
          Estas condiciones pueden actualizarse. Los cambios significativos se comunicarán a través de la
          plataforma. El uso continuado tras la notificación implica la aceptación de los nuevos términos.
        </Section>

        <Section title="7. Contacto">
          Para cualquier consulta relacionada con estas condiciones, escríbenos a través de{" "}
          <a
            href="https://generacionmaldita.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#22B16B] underline-offset-2 hover:underline"
          >
            generacionmaldita.com
          </a>.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-[17px] font-bold text-white">{title}</h2>
      <p>{children}</p>
    </div>
  );
}
