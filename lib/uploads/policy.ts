import type { AssetRole } from "./types";

export const GIB = 1024 ** 3;
export const MIB = 1024 ** 2;
export const UPLOAD_LIMITS: Record<AssetRole, number> = {
  main: 4 * GIB, trailer: GIB, extras: GIB, intro: 500 * MIB,
  poster: 10 * MIB, poster_h: 10 * MIB, poster_v: 10 * MIB,
  subtitles: 5 * MIB, avatar: 5 * MIB,
};
export const DRAFT_BYTE_LIMIT = 6 * GIB;
export const USER_BYTE_LIMIT = 10 * GIB;
export const TUS_CHUNK_SIZE = 5 * MIB;
export const VIDEO_ROLES: readonly AssetRole[] = ["main", "trailer", "extras", "intro"];
export const UPLOAD_ENGINE_CLIENT_ENABLED = process.env.NEXT_PUBLIC_UPLOAD_ENGINE_V2 === "true";
export const isVideoRole = (role: AssetRole) => VIDEO_ROLES.includes(role);
export const durationLimit = (role: AssetRole) => role === "main" ? 4 * 3600 : role === "extras" ? 3600 : role === "trailer" ? 600 : role === "intro" ? 300 : 0;
export function assertUploadInput(role: AssetRole, bytes: number, sha256: string) {
  if (!Object.hasOwn(UPLOAD_LIMITS, role) || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > UPLOAD_LIMITS[role]) throw new Error("INVALID_UPLOAD_SIZE");
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("INVALID_FILE_IDENTITY");
}
