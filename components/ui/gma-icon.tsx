import type { CSSProperties, ComponentType, SVGProps } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Bookmark,
  Check,
  ClosedCaptionsTag,
  ControlSlider,
  CreditCard,
  Download,
  Erase,
  FilterList,
  Heart,
  Home,
  InfoCircle,
  Language,
  LogOut,
  Mail,
  Maximize,
  Minus,
  Movie,
  MusicDoubleNote,
  NavArrowDown,
  NavArrowLeft,
  NavArrowRight,
  Page,
  PauseSolid,
  PlaySolid,
  Plus,
  Search,
  Settings,
  Shield,
  SkipNextSolid,
  SkipPrevSolid,
  SoundHigh,
  SoundOff,
  Sparks,
  Star,
  StatsReport,
  Trash,
  Tv,
  User,
  Xmark,
} from "iconoir-react";

export type GmaIconName =
  | "play" | "pause" | "search" | "home" | "film" | "series" | "bookmark" | "user" | "settings" | "plus" | "check" | "chevronRight" | "chevronLeft" | "chevronDown" | "arrowLeft" | "close" | "bell" | "info" | "star" | "heart" | "download" | "volume" | "mute" | "cc" | "backward" | "forward" | "fullscreen" | "trash" | "filter" | "stats" | "card" | "languages" | "shield" | "mail" | "doc" | "logout" | "sparkle" | "delete" | "capslock" | "space" | "enter" | "audio" | "sliders";

interface GmaIconProps {
  readonly name: GmaIconName;
  readonly size?: number;
  readonly className?: string;
  readonly strokeWidth?: number;
  readonly style?: CSSProperties;
}

/** Nombres propios de GMA -> iconos de Iconoir (los rellenos usan la variante Solid). */
const ICONS: Record<GmaIconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  play: PlaySolid,
  pause: PauseSolid,
  search: Search,
  home: Home,
  film: Movie,
  series: Tv,
  bookmark: Bookmark,
  user: User,
  settings: Settings,
  plus: Plus,
  check: Check,
  chevronRight: NavArrowRight,
  chevronLeft: NavArrowLeft,
  chevronDown: NavArrowDown,
  arrowLeft: ArrowLeft,
  close: Xmark,
  bell: Bell,
  info: InfoCircle,
  star: Star,
  heart: Heart,
  download: Download,
  volume: SoundHigh,
  mute: SoundOff,
  cc: ClosedCaptionsTag,
  backward: SkipPrevSolid,
  forward: SkipNextSolid,
  fullscreen: Maximize,
  trash: Trash,
  filter: FilterList,
  stats: StatsReport,
  card: CreditCard,
  languages: Language,
  shield: Shield,
  mail: Mail,
  doc: Page,
  logout: LogOut,
  sparkle: Sparks,
  delete: Erase,
  capslock: ArrowUp,
  space: Minus,
  enter: ArrowRight,
  audio: MusicDoubleNote,
  sliders: ControlSlider,
};

export function GmaIcon({ name, size = 20, className = "", strokeWidth = 1.8, style }: GmaIconProps) {
  const Icon = ICONS[name];
  return <Icon width={size} height={size} strokeWidth={strokeWidth} className={className} style={style} aria-hidden="true" />;
}
