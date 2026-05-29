import type { Metadata } from "next";
import { SettingsScreen } from "@/components/features/settings/settings-screen";
import { GuestGate } from "@/components/ui/guest-gate";

export const metadata: Metadata = { title: "Configuración" };

export default function SettingsPage() {
  return (
    <GuestGate message="La configuración de cuenta, control parental y preferencias requieren una cuenta.">
      <SettingsScreen />
    </GuestGate>
  );
}
