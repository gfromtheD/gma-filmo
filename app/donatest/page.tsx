export default function DonaTestPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-start"
      style={{ background: "#080B11" }}
    >
      <div className="w-full max-w-[390px] px-4 py-10">
        {/* Creator card */}
        <div
          className="overflow-hidden rounded-2xl border border-white/10"
          style={{ background: "rgba(10,13,20,0.98)" }}
        >
          {/* Banner */}
          <div
            className="h-28 w-full"
            style={{
              background:
                "linear-gradient(135deg, #0e2218 0%, #112d20 50%, #0a1a14 100%)",
            }}
          />

          {/* Avatar + name */}
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
              <p className="mt-0.5 text-[13px] font-medium" style={{ color: "#22B16B" }}>
                @carlos.mendoza
              </p>
              <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "#8A9AB0" }}>
                Documentalista independiente. Cuento historias que otros prefieren
                no ver. Si mi trabajo te llega, considera apoyarme — cada
                contribución hace posible el próximo proyecto.
              </p>
            </div>
          </div>
        </div>

        {/* Donation section */}
        <div className="mt-5">
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#4A5A6A" }}
          >
            Apoya el trabajo de Carlos
          </p>

          <div className="flex flex-col gap-2.5">
            {/* PayPal */}
            <a
              href="https://paypal.me/test"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3.5 transition-colors duration-150 hover:border-[#22B16B]/40 hover:bg-[#22B16B]/8"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(0,112,186,0.15)" }}
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#009cde" aria-hidden="true">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.72A.641.641 0 0 1 5.577 2h7.022c2.33 0 3.984.65 4.96 1.948.93 1.234 1.096 2.795.501 4.715-.847 2.766-2.951 4.213-6.254 4.29l-1.286.02-.613 3.875a.641.641 0 0 1-.633.54H7.076zm4.99-13.073c1.93 0 3.145.677 3.641 2.016.366.993.257 2.207-.322 3.61-.793 1.942-2.213 2.913-4.219 2.913h-.37l.494-3.116a.641.641 0 0 0-.633-.74H9.4l.948-5.988c.527.194 1.067.305 1.718.305z" />
                </svg>
              </span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-white">PayPal</p>
                <p className="text-[12px]" style={{ color: "#5A6A7A" }}>paypal.me/test</p>
              </div>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#4A5A6A" strokeWidth={2} aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>

            {/* Patreon */}
            <a
              href="https://patreon.com/test"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3.5 transition-colors duration-150 hover:border-[#22B16B]/40 hover:bg-[#22B16B]/8"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(255,66,77,0.12)" }}
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#f96854" aria-hidden="true">
                  <path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21 0 3.96-3.22 7.18-7.18 7.18-3.97 0-7.21-3.22-7.18-7.18 0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2V21.6z" />
                </svg>
              </span>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-white">Patreon</p>
                <p className="text-[12px]" style={{ color: "#5A6A7A" }}>patreon.com/test</p>
              </div>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#4A5A6A" strokeWidth={2} aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>

            {/* Bitcoin */}
            <a
              href="bitcoin:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
              className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3.5 transition-colors duration-150 hover:border-[#22B16B]/40 hover:bg-[#22B16B]/8"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(247,147,26,0.12)" }}
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#f7931a" aria-hidden="true">
                  <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.165c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.925l.007-.013zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-white">Bitcoin</p>
                <p className="truncate text-[11px]" style={{ color: "#5A6A7A" }}>
                  bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
                </p>
              </div>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#4A5A6A" strokeWidth={2} aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-[11px]" style={{ color: "#2A3A4A" }}>
          Página de prueba — GMA Filmo
        </p>
      </div>
    </main>
  );
}
