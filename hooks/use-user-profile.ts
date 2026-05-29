// Single source of truth — all profile state lives in UserProfileProvider.
export {
  useUserProfile,
  deriveAvatarColor,
  type UserProfile,
} from "@/components/providers/user-profile-provider";
