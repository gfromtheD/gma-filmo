import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Política de privacidad · GMA Filmo" };

export default function PrivacidadPage() {
  return (
    <article style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px 96px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <Link href="/" style={{ display: "inline-block", marginBottom: 24, opacity: 0.9 }}>
          <Image src="/images/logo-gma.png" alt="GMA Filmo" width={140} height={44} style={{ height: 44, width: "auto" }} />
        </Link>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
          Política de privacidad
        </h1>
        <p style={{ marginTop: 16, fontSize: 13, color: "#4A5A6E" }}>
          Última actualización: junio de 2026
        </p>
      </div>

      {/* Intro */}
      <p style={{ fontSize: 15, lineHeight: 1.75, color: "#B0BDCC", marginBottom: 48, marginTop: 0 }}>
        En GMA Filmo gestionamos los datos personales de forma responsable y transparente. Esta política
        explica qué información recogemos, para qué la usamos y cuáles son tus derechos. No vendemos
        datos, no tenemos publicidad y no compartimos tu información con terceros salvo obligación legal.
      </p>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 40, fontSize: 15, lineHeight: 1.75, color: "#B0BDCC" }}>

        <Section title="1. Quién es responsable de tus datos">
          Generación Maldita, a través de GMA Filmo, es la responsable del tratamiento de los datos
          personales recogidos durante el uso del servicio. Puedes contactar con nosotros en cualquier
          momento a través de{" "}
          <a href="https://generacionmaldita.com" target="_blank" rel="noopener noreferrer"
            style={{ color: "#22B16B", textDecoration: "none" }}>
            generacionmaldita.com
          </a>.
        </Section>

        <Section title="2. Qué datos recogemos y por qué">
          Recogemos únicamente los datos que necesitamos para que la plataforma funcione:
          <br /><br />
          <strong style={{ color: "#fff" }}>Espectadores:</strong> nombre de usuario, correo electrónico,
          foto de perfil (opcional), historial de visualización, valoraciones y listas de favoritos.
          Usamos estos datos para personalizar tu experiencia y recordar tus preferencias entre sesiones.
          <br /><br />
          <strong style={{ color: "#fff" }}>Creadores:</strong> además de lo anterior, nombre del estudio
          o proyecto, disciplina artística, descripción del perfil y redes sociales o vías de donación
          que el propio creador decide hacer públicas. Estos datos se muestran en el perfil público del
          creador dentro de la plataforma.
          <br /><br />
          No recogemos datos de pago. Las donaciones se canalizan directamente a través de los servicios
          del creador (PayPal, Patreon, etc.) sin que GMA Filmo intervenga en la transacción.
        </Section>

        <Section title="3. Datos de uso y actividad">
          Registramos qué contenido visualizas, cuándo y durante cuánto tiempo, así como tus
          valoraciones y el contenido que añades a tus listas. Esta información se usa exclusivamente
          para mejorar tu experiencia dentro de la plataforma —por ejemplo, para mostrarte
          recomendaciones relevantes— y no se comparte con terceros ni se usa con fines publicitarios.
        </Section>

        <Section title="4. Base legal del tratamiento">
          El tratamiento de tus datos se basa en el consentimiento que otorgas al registrarte y aceptar
          esta política. Puedes retirar ese consentimiento en cualquier momento eliminando tu cuenta
          desde la configuración. La eliminación es permanente e irreversible.
        </Section>

        <Section title="5. Cuánto tiempo conservamos tus datos">
          Conservamos tus datos mientras tu cuenta permanezca activa. Si eliminas tu cuenta, borramos
          toda tu información personal en un plazo máximo de 30 días, salvo que una obligación legal
          nos exija conservar algún dato durante un período determinado —en cuyo caso lo haremos
          estrictamente en la medida que la ley requiera.
        </Section>

        <Section title="6. Compartir datos con terceros y autoridades">
          No vendemos ni cedemos tus datos a terceros con ningún fin comercial. Nunca.
          <br /><br />
          La única excepción es la obligación legal: si una autoridad competente nos requiere datos
          de un usuario mediante una orden judicial o requerimiento legal firme en el contexto de una
          investigación por uso indebido de la plataforma —como la publicación de contenido ilegal—,
          facilitaremos la información exigida dentro de lo que establezca la ley aplicable. Esta
          posibilidad existe precisamente para distinguir GMA Filmo de plataformas de contenido pirata:
          somos un espacio para la distribución legítima, y cooperamos con las autoridades cuando hay
          motivos fundados y procedimiento legal que lo sustente.
        </Section>

        <Section title="7. Tus derechos">
          Tienes derecho a acceder a los datos que tenemos sobre ti, rectificarlos, solicitar su
          eliminación, oponerte a determinados tratamientos o solicitar la portabilidad de tu
          información. Para ejercer cualquiera de estos derechos puedes:
          <br /><br />
          — Eliminar tu cuenta directamente desde la configuración de la plataforma.<br />
          — Escribirnos a través de{" "}
          <a href="https://generacionmaldita.com" target="_blank" rel="noopener noreferrer"
            style={{ color: "#22B16B", textDecoration: "none" }}>
            generacionmaldita.com
          </a> si necesitas ayuda adicional o tienes alguna reclamación.
        </Section>

        <Section title="8. Seguridad">
          Usamos Supabase como proveedor de infraestructura, que cumple con los estándares de seguridad
          SOC 2. Las contraseñas se almacenan con hash bcrypt y nunca en texto plano. El acceso a los
          datos está restringido mediante políticas de fila (RLS) que garantizan que cada usuario solo
          puede acceder a su propia información.
        </Section>

        <Section title="9. Menores de edad">
          GMA Filmo está dirigida a mayores de 16 años. No recogemos intencionadamente datos de menores.
          Si crees que un menor ha creado una cuenta, puedes comunicárnoslo y eliminaremos esa cuenta y
          sus datos de forma inmediata.
        </Section>

        <Section title="10. Cambios en esta política">
          Si actualizamos esta política de forma significativa, lo notificaremos dentro de la plataforma.
          La versión actualizada entrará en vigor en el momento de su publicación. El uso continuado
          de GMA Filmo tras la notificación implica la aceptación de los cambios.
        </Section>

      </div>

      {/* Footer */}
      <div style={{ marginTop: 72, paddingTop: 32, borderTop: "1px solid #1A2536", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#4A5A6E" }}>
          También puedes consultar nuestras{" "}
          <Link href="/terminos" style={{ color: "#22B16B", textDecoration: "none", fontWeight: 600 }}>
            Condiciones de uso →
          </Link>
        </p>
      </div>

    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 10, marginTop: 0 }}>
        {title}
      </h2>
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}
