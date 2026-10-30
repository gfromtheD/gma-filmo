/**
 * Texto de espera con tres puntos que ondulan (saltan y se iluminan en cascada, apoyados en la línea base del texto), en vez de una rueda giratoria o de
 * unos puntos suspensivos fijos. Los puntos heredan el color del texto y miden en `em`, así que se adaptan a cualquier
 * botón. Con «reducir movimiento» solo parpadean en opacidad (ver `.loading-dots` en globals.css).
 */
export function LoadingLabel({ children }: { readonly children: string }) {
  return (
    <span className="inline-flex items-baseline">
      {children}
      <span aria-hidden="true" className="loading-dots">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}
