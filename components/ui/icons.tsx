import type { ComponentType, SVGProps } from "react";
import {
  Airplay as IconoirAirplay,
  ArrowLeft as IconoirArrowLeft,
  ArrowRight as IconoirArrowRight,
  ArrowUpRight as IconoirArrowUpRight,
  Calendar as IconoirCalendar,
  ChatBubble as IconoirChatBubble,
  Check as IconoirCheck,
  CheckCircle as IconoirCheckCircle,
  Clock as IconoirClock,
  ClosedCaptionsTag as IconoirClosedCaptionsTag,
  CloudUpload as IconoirCloudUpload,
  Collapse as IconoirCollapse,
  ControlSlider as IconoirControlSlider,
  Copy as IconoirCopy,
  Dashboard as IconoirDashboard,
  Drag as IconoirDrag,
  EditPencil as IconoirEditPencil,
  EmojiSatisfied as IconoirEmojiSatisfied,
  Expand as IconoirExpand,
  Eye as IconoirEye,
  EyeClosed as IconoirEyeClosed,
  Folder as IconoirFolder,
  Home as IconoirHome,
  LogIn as IconoirLogIn,
  Globe as IconoirGlobe,
  HelpCircle as IconoirHelpCircle,
  InfoCircle as IconoirInfoCircle,
  List as IconoirList,
  MapPin as IconoirMapPin,
  Maximize as IconoirMaximize,
  MediaImage as IconoirMediaImage,
  MediaVideo as IconoirMediaVideo,
  Menu as IconoirMenu,
  MoreHoriz as IconoirMoreHoriz,
  Movie as IconoirMovie,
  NavArrowDown as IconoirNavArrowDown,
  NavArrowLeft as IconoirNavArrowLeft,
  NavArrowRight as IconoirNavArrowRight,
  NavArrowUp as IconoirNavArrowUp,
  OpenNewWindow as IconoirOpenNewWindow,
  Pause as IconoirPause,
  Play as IconoirPlay,
  Plus as IconoirPlus,
  Redo as IconoirRedo,
  RefreshDouble as IconoirRefreshDouble,
  Search as IconoirSearch,
  Send as IconoirSend,
  Settings as IconoirSettings,
  ShareAndroid as IconoirShareAndroid,
  Shuffle as IconoirShuffle,
  ShieldCheck as IconoirShieldCheck,
  SkipNext as IconoirSkipNext,
  SkipPrev as IconoirSkipPrev,
  SoundHigh as IconoirSoundHigh,
  SoundOff as IconoirSoundOff,
  Sparks as IconoirSparks,
  Star as IconoirStar,
  StatsReport as IconoirStatsReport,
  Trash as IconoirTrash,
  TriangleFlag as IconoirTriangleFlag,
  Undo as IconoirUndo,
  UndoAction as IconoirUndoAction,
  Upload as IconoirUpload,
  User as IconoirUser,
  ViewGrid as IconoirViewGrid,
  WarningCircle as IconoirWarningCircle,
  WarningTriangle as IconoirWarningTriangle,
  Xmark as IconoirXmark,
} from "iconoir-react";

type IconoirProps = SVGProps<SVGSVGElement>;

export interface IconProps extends Omit<IconoirProps, "ref"> {
  /** Lado en px (ancho y alto). Por defecto 24, como Iconoir. */
  readonly size?: number | string;
}

/**
 * Adapta un icono de Iconoir a la API `size` que usa el resto del proyecto.
 * Decorativo por defecto (aria-hidden) salvo que se pase `aria-label`.
 */
function createIcon(Icon: ComponentType<IconoirProps>) {
  return function AppIcon({ size = 24, ...rest }: IconProps) {
    const labelled = rest["aria-label"] !== undefined;
    return <Icon width={size} height={size} aria-hidden={labelled ? undefined : true} {...rest} />;
  };
}

export const Airplay = createIcon(IconoirAirplay);
export const ArrowLeft = createIcon(IconoirArrowLeft);
export const ArrowRight = createIcon(IconoirArrowRight);
export const ArrowUpRight = createIcon(IconoirArrowUpRight);
export const Calendar = createIcon(IconoirCalendar);
export const ChatBubble = createIcon(IconoirChatBubble);
export const Check = createIcon(IconoirCheck);
export const CheckCircle = createIcon(IconoirCheckCircle);
export const Clock = createIcon(IconoirClock);
export const ClosedCaptionsTag = createIcon(IconoirClosedCaptionsTag);
export const CloudUpload = createIcon(IconoirCloudUpload);
export const Collapse = createIcon(IconoirCollapse);
export const ControlSlider = createIcon(IconoirControlSlider);
export const Copy = createIcon(IconoirCopy);
export const Dashboard = createIcon(IconoirDashboard);
export const Drag = createIcon(IconoirDrag);
export const EditPencil = createIcon(IconoirEditPencil);
export const EmojiSatisfied = createIcon(IconoirEmojiSatisfied);
export const Expand = createIcon(IconoirExpand);
export const Eye = createIcon(IconoirEye);
export const EyeClosed = createIcon(IconoirEyeClosed);
export const Folder = createIcon(IconoirFolder);
export const Home = createIcon(IconoirHome);
export const LogIn = createIcon(IconoirLogIn);
export const Globe = createIcon(IconoirGlobe);
export const HelpCircle = createIcon(IconoirHelpCircle);
export const InfoCircle = createIcon(IconoirInfoCircle);
export const List = createIcon(IconoirList);
export const MapPin = createIcon(IconoirMapPin);
export const Maximize = createIcon(IconoirMaximize);
export const MediaImage = createIcon(IconoirMediaImage);
export const MediaVideo = createIcon(IconoirMediaVideo);
export const Menu = createIcon(IconoirMenu);
export const MoreHoriz = createIcon(IconoirMoreHoriz);
export const Movie = createIcon(IconoirMovie);
export const NavArrowDown = createIcon(IconoirNavArrowDown);
export const NavArrowLeft = createIcon(IconoirNavArrowLeft);
export const NavArrowRight = createIcon(IconoirNavArrowRight);
export const NavArrowUp = createIcon(IconoirNavArrowUp);
export const OpenNewWindow = createIcon(IconoirOpenNewWindow);
export const Pause = createIcon(IconoirPause);
export const Play = createIcon(IconoirPlay);
export const Plus = createIcon(IconoirPlus);
export const Redo = createIcon(IconoirRedo);
export const RefreshDouble = createIcon(IconoirRefreshDouble);
export const Search = createIcon(IconoirSearch);
export const Send = createIcon(IconoirSend);
export const Settings = createIcon(IconoirSettings);
export const ShareAndroid = createIcon(IconoirShareAndroid);
export const ShieldCheck = createIcon(IconoirShieldCheck);
export const SkipNext = createIcon(IconoirSkipNext);
export const SkipPrev = createIcon(IconoirSkipPrev);
export const SoundHigh = createIcon(IconoirSoundHigh);
export const SoundOff = createIcon(IconoirSoundOff);
export const Shuffle = createIcon(IconoirShuffle);
export const Sparks = createIcon(IconoirSparks);
export const Star = createIcon(IconoirStar);
export const StatsReport = createIcon(IconoirStatsReport);
export const Trash = createIcon(IconoirTrash);
export const TriangleFlag = createIcon(IconoirTriangleFlag);
export const Undo = createIcon(IconoirUndo);
export const UndoAction = createIcon(IconoirUndoAction);
export const Upload = createIcon(IconoirUpload);
export const User = createIcon(IconoirUser);
export const ViewGrid = createIcon(IconoirViewGrid);
export const WarningCircle = createIcon(IconoirWarningCircle);
export const WarningTriangle = createIcon(IconoirWarningTriangle);
export const Xmark = createIcon(IconoirXmark);
