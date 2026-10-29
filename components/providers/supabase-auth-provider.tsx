"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, isLoading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export function useSupabaseUserId(): string | null {
  return useContext(AuthContext).user?.id ?? null;
}

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Marca este navegador como «ya ha tenido cuenta aquí» (cookie propia, sin datos ni huella digital, un año de
  // validez) en cuanto hay una sesión real, sea cual sea la forma en que entró. No distingue entre cuentas ni
  // dispositivos: solo sirve para no ofrecerle «Registrarse» a quien ya se registró en este mismo navegador.
  useEffect(() => {
    if (!user) return;
    document.cookie = "gma_known_device=1; path=/; max-age=31536000; SameSite=Lax";
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
