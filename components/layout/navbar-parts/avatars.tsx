import { UserRound } from "lucide-react";
import { renderAvatar } from "@/lib/data/profile-avatars";

interface UserAvatarProps {
  readonly name: string;
  readonly color: string;
  readonly imageUrl?: string;
  readonly iconId?: string;
}

export function UserAvatar({ name, color, imageUrl, iconId }: UserAvatarProps) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
    );
  }
  if (iconId) {
    return (
      <div className="h-7 w-7 overflow-hidden rounded-full">
        {renderAvatar(iconId, color, 28) as React.ReactNode}
      </div>
    );
  }
  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-extrabold text-[#031A0E]"
      style={{ background: color }}
    >
      {name[0]?.toUpperCase() ?? "U"}
    </div>
  );
}

export function GuestAvatarIcon() {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#3A4A5A] bg-[#1A2535]">
      <UserRound size={15} className="text-[#B8C5D4]" />
    </div>
  );
}
