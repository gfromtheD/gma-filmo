import { User as UserRound } from "@/components/ui/icons";
import { ProfileAvatar } from "@/components/ui/profile-avatar";

interface UserAvatarProps {
  readonly name: string;
  readonly color: string;
  readonly imageUrl?: string;
  readonly iconId?: string;
}

export function UserAvatar({ name, color, imageUrl, iconId }: UserAvatarProps) {
  return <ProfileAvatar name={name} color={color} url={imageUrl || null} iconId={iconId || null} size={36} />;
}

export function GuestAvatarIcon() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3A4A5A] bg-gma-border">
      <UserRound size={19} className="text-[#C4C4C4]" />
    </div>
  );
}
