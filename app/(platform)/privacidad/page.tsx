import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidad · GMA Filmo" };

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-16 text-white">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6D7D94]">
        GMA Filmo
      </p>
      <h1 className="mb-2 text-[36px] font-extrabold tracking-[-0.02em]">Política de privacidad</h1>
      <p className="mb-10 text-[13px] text-[#5A6A7E]">Versión provisional · sujeta a revisión legal</p>

      <div className="flex flex-col gap-8 text-[15px] leading-[1.7] text-[#C0CCDA]">
        <Section title="1. Responsable del tratamiento">
          Generación Maldita, a través de la plataforma GMA Filmo, es la responsable del tratamiento de
          los datos personales recogidos durante el uso del servicio.
        </Section>

        <Section title="2. Datos que recogemos">
          Recogemos los datos que el usuario proporciona al registrarse (nombre, correo electrónico,
          foto o avatar de perfil) y los datos de uso de la plataforma (historial de visualización,
          valoraciones, listas de favoritos). Los creadores facilitan adicionalmente información sobre
          su estudio, disciplina artística y redes sociales.
        </Section>

        <Section title="3. Finalidad del tratamiento">
          Los datos se usan exclusivamente para operar y mejorar la plataforma: personalizar la
          experiencia, mostrar el perfil público del creador y gestionar la cuenta del usuario.
          No vendemos ni cedemos datos a terceros con fines comerciales.
        </Section>

        <Section title="4. Base legal">
          El tratamiento se basa en el consentimiento del usuario, manifestado al aceptar esta política
          durante el proceso de registro. El usuario puede retirar su consentimiento en cualquier momento
          eliminando su cuenta desde la sección de configuración.
        </Section>

        <Section title="5. Conservación">
          Los datos se conservan mientras la cuenta permanezca activa. Una vez eliminada la cuenta,
          los datos se borran de forma permanente en un plazo máximo de 30 días, salvo obligación
          legal de conservación.
        </Section>

        <Section title="6. Derechos del usuario">
          El usuario tiene derecho a acceder, rectificar, suprimir y portar sus datos, así como a
          oponerse a determinados tratamientos. Para ejercer estos derechos, puede eliminar su cuenta
          desde configuración o contactar con nosotros a través de{" "}
          <a
            href="https://generacionmaldita.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#22B16B] underline-offset-2 hover:underline"
          >
            generacionmaldita.com
          </a>.
        </Section>

        <Section title="7. Seguridad">
          Utilizamos Supabase como proveedor de infraestructura, que cumple con los estándares de
          seguridad SOC 2. Las contraseñas se almacenan con hash bcrypt y nunca en texto plano.
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
