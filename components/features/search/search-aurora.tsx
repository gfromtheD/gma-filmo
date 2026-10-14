/**
 * Fondo "líquido" de la búsqueda: manchas de color muy desenfocadas que derivan despacio detrás de
 * la página. Solo CSS (transform/opacity); con movimiento reducido queda quieto.
 */
export function SearchAurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#060613]" style={{ contain: "strict" }}>
      <div className="aurora-blob aurora-a absolute -left-[10%] top-[-15%] h-[70vh] w-[60vw] rounded-full bg-[#22B16B]/40 blur-[110px]" />
      <div className="aurora-blob aurora-b absolute -right-[12%] top-[5%] h-[75vh] w-[55vw] rounded-full bg-[#5B3FD1]/35 blur-[120px]" />
      <div className="aurora-blob aurora-c absolute bottom-[-25%] left-[20%] h-[65vh] w-[65vw] rounded-full bg-[#138C96]/30 blur-[120px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,6,19,0)_0%,rgba(6,6,19,0.55)_70%,#060613_100%)]" />
    </div>
  );
}
