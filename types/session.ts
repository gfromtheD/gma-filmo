export type SessionStatus = "anonymous" | "authenticated" | "loading";

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

export interface SessionState {
  readonly status: SessionStatus;
  readonly user: SessionUser | null;
}
