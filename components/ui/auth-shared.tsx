/** Piezas comunes de las tarjetas de acceso (iniciar sesión, registrarse, registrarse como creador). */

export function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 7L2 7" />
    </svg>
  );
}

export function GuestIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const AUTH_BUTTON =
  "flex h-14 w-full items-center justify-center gap-3 rounded-[4px] px-6 text-[16px] font-semibold leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#58D99B] disabled:opacity-60";

/** Camino principal: Google, en blanco y bien visible. */
export const AUTH_GOOGLE = `${AUTH_BUTTON} bg-white text-[#0E0E11] hover:bg-[#E9ECEA]`;
/** Alternativas: correo, invitado… con contorno claro sobre fondo oscuro. */
export const AUTH_SECONDARY = `${AUTH_BUTTON} border border-white/35 bg-black/35 text-white hover:bg-white/10`;
/** Enviar el formulario. */
export const AUTH_SUBMIT = `${AUTH_BUTTON} bg-[#22B16B] font-bold text-[#031A0E] hover:bg-[#2AC57A]`;
export const AUTH_INPUT =
  "h-14 w-full rounded-[4px] border border-white/25 bg-black/60 px-4 text-[16px] text-white placeholder-white/55 outline-none transition-colors focus:border-[#22B16B] focus:bg-black/55";
export const AUTH_NOTICE_ERROR = "w-full rounded-[4px] bg-[#ff5252]/12 px-4 py-3 text-center text-[14px] text-[#ff8a8a]";
export const AUTH_NOTICE_OK = "w-full rounded-[4px] bg-[#22B16B]/12 px-4 py-3 text-center text-[14px] text-[#58D99B]";
