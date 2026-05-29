import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseDuration(runtime: string): number {
  const h = runtime.match(/(\d+)h/);
  const m = runtime.match(/(\d+)m/);
  const s = runtime.match(/(\d+)s/);
  return (
    (h ? parseInt(h[1] ?? "0") * 3600 : 0) +
    (m ? parseInt(m[1] ?? "0") * 60 : 0) +
    (s ? parseInt(s[1] ?? "0") : 0)
  );
}
