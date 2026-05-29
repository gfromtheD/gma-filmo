import { ProfileScreen } from "@/components/features/profile/profile-screen";
import { GuestGate } from "@/components/ui/guest-gate";

export default function ProfilePage() {
  return (
    <GuestGate message="Tu perfil, estadísticas y preferencias personales requieren una cuenta.">
      <ProfileScreen />
    </GuestGate>
  );
}
