import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Condiciones de uso · GMA Filmo" };

export default function TerminosPage() {
  return (
    <article style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px 96px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <Link href="/" style={{ display: "inline-block", marginBottom: 24, opacity: 0.9 }}>
          <Image src="/images/logo-gma.png" alt="GMA Filmo" width={140} height={44} style={{ height: 44, width: "auto" }} />
        </Link>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
          Condiciones de uso
        </h1>
        <p style={{ marginTop: 16, fontSize: 13, color: "#4A5A6E" }}>
          Última actualización: junio de 2026
        </p>
      </div>

      {/* Intro */}
      <p style={{ fontSize: 15, lineHeight: 1.75, color: "#B0BDCC", marginBottom: 48, marginTop: 0 }}>
        GMA Filmo es una plataforma gratuita y sin publicidad creada por Generación Maldita para que
        directores, guionistas y creadores audiovisuales independientes puedan distribuir su obra y
        llegar a nuevos públicos. Estas condiciones explican cómo funciona, qué se espera de quienes
        la usan y qué responsabilidades asume cada parte. Intentamos ser lo más claros posible.
      </p>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 40, fontSize: 15, lineHeight: 1.75, color: "#B0BDCC" }}>

        <Section title="1. Qué es GMA Filmo">
          GMA Filmo es un servicio de distribución y descubrimiento de cine independiente. No producimos
          contenido, no vendemos licencias y no obtenemos ningún beneficio económico de la plataforma.
          Somos un espacio: facilitamos que los creadores suban su obra y que el público la encuentre y
          disfrute de forma completamente gratuita.
        </Section>

        <Section title="2. Quién puede usar la plataforma">
          Cualquier persona puede registrarse como espectador y acceder a todo el contenido sin coste.
          Los creadores que deseen publicar su obra deben completar el proceso de registro como creador,
          que incluye facilitar información básica sobre su estudio o proyecto y aceptar expresamente estas
          condiciones. El registro implica que el creador confirma que tiene los derechos necesarios sobre
          lo que va a publicar.
        </Section>

        <Section title="3. Responsabilidad del creador sobre el contenido">
          Cada creador es el único responsable del contenido que sube. Al publicar una obra en GMA Filmo,
          el creador garantiza que es titular de todos los derechos necesarios —o dispone de las
          autorizaciones pertinentes— para distribuirla en esta plataforma. GMA Filmo no verifica la
          titularidad de los derechos de cada pieza antes de su publicación, por lo que cualquier
          reclamación derivada de infracciones de propiedad intelectual o de derechos de terceros es
          responsabilidad exclusiva del creador que subió el contenido.
        </Section>

        <Section title="4. Licencia que nos concedes al publicar">
          Cuando subes contenido a GMA Filmo, nos concedes una licencia no exclusiva, gratuita y
          revocable para alojarlo, reproducirlo y distribuirlo dentro de la plataforma durante el tiempo
          que tu cuenta permanezca activa. Conservas todos tus derechos sobre tu obra. Nosotros no
          podemos venderla, cederla a terceros ni explotarla fuera de GMA Filmo sin tu permiso expreso.
        </Section>

        <Section title="5. Uso promocional opcional">
          Si quieres que tu obra llegue a más gente, puedes autorizar que GMA Filmo use fragmentos o
          clips de tu contenido en nuestras redes sociales oficiales con fines promocionales —siempre
          mencionando tu autoría. Esta autorización es completamente voluntaria, no forma parte de las
          condiciones de uso generales y puedes revocarla en cualquier momento desde la configuración de
          tu perfil de creador o escribiéndonos directamente.
        </Section>

        <Section title="6. Contenido prohibido y moderación">
          GMA Filmo está pensada exclusivamente para obra audiovisual independiente: cortometrajes,
          largometrajes, series, documentales y proyectos similares cuyos derechos pertenecen al
          creador. Está terminantemente prohibido subir contenido pornográfico, violento sin contexto
          artístico, que incite al odio, ilegal o que infrinja derechos de autor de terceros —incluyendo
          contenido de plataformas comerciales como Netflix, Prime o similares.
          <br /><br />
          Contamos con un equipo de moderación humana que revisa el contenido publicado. GMA Filmo se
          reserva el derecho de retirar cualquier pieza sin previo aviso si considera que vulnera estas
          normas, así como de suspender o eliminar la cuenta del creador responsable.
        </Section>

        <Section title="7. Modelo de donaciones">
          GMA Filmo no cobra al espectador, no cobra al creador ni se queda con un porcentaje de las
          donaciones. El sistema de donaciones es directo: los espectadores que quieran apoyar
          económicamente a un creador lo hacen a través de los enlaces que el propio creador facilita
          (PayPal, Patreon, Bitcoin u otros). Nosotros no gestionamos ni procesamos ningún pago. Todo
          el dinero va íntegramente al creador.
        </Section>

        <Section title="8. Cooperación con autoridades">
          GMA Filmo no comparte datos de usuarios con terceros salvo cuando así lo exija una obligación
          legal o una orden judicial firme. Si una autoridad competente nos requiere información
          vinculada a un contenido potencialmente ilegal o a una infracción denunciada formalmente,
          cooperaremos dentro de lo que establezca la ley. El usuario que haga un uso indebido de la
          plataforma será el único responsable de las consecuencias legales que se deriven de ese uso.
        </Section>

        <Section title="9. Modificaciones de estas condiciones">
          Podemos actualizar estas condiciones cuando sea necesario. Si los cambios son significativos,
          lo comunicaremos dentro de la plataforma con suficiente antelación. El uso continuado de GMA
          Filmo tras la notificación implica la aceptación de los nuevos términos. Si no estás de
          acuerdo con los cambios, puedes eliminar tu cuenta desde la configuración.
        </Section>

      </div>

      {/* Footer */}
      <div style={{ marginTop: 72, paddingTop: 32, borderTop: "1px solid #1A2536", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#4A5A6E" }}>
          También puedes consultar nuestra{" "}
          <Link href="/privacidad" style={{ color: "#22B16B", textDecoration: "none", fontWeight: 600 }}>
            Política de privacidad →
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
