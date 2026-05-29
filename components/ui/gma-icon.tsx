import type { CSSProperties } from "react";

export type GmaIconName =
  | "play" | "pause" | "search" | "home" | "film" | "series"
  | "bookmark" | "user" | "settings" | "plus" | "check"
  | "chevronRight" | "chevronLeft" | "chevronDown" | "arrowLeft" | "close"
  | "bell" | "info" | "star" | "heart" | "download" | "volume" | "mute"
  | "cc" | "backward" | "forward" | "fullscreen" | "trash"
  | "filter" | "stats" | "card" | "languages" | "shield"
  | "mail" | "doc" | "logout" | "sparkle" | "delete"
  | "capslock" | "space" | "enter"
  | "audio" | "sliders";

interface GmaIconProps {
  readonly name: GmaIconName;
  readonly size?: number;
  readonly className?: string;
  readonly strokeWidth?: number;
  readonly style?: CSSProperties;
}

const PATHS: Record<GmaIconName, React.ReactNode> = {
  play:         <path d="M6 4l14 8-14 8V4z" fill="currentColor" stroke="none"/>,
  pause:        <g fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></g>,
  search:       <g><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></g>,
  home:         <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-8.5Z"/>,
  film:         <g><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M17 8h4M3 16h4M17 16h4M3 12h18"/></g>,
  series:       <g><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M8 3l4 3 4-3"/></g>,
  bookmark:     <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/>,
  user:         <g><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></g>,
  settings:     <g><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></g>,
  plus:         <path d="M12 5v14M5 12h14"/>,
  check:        <path d="M5 12l5 5 9-11"/>,
  chevronRight: <path d="m9 6 6 6-6 6"/>,
  chevronLeft:  <path d="m15 6-6 6 6 6"/>,
  chevronDown:  <path d="m6 9 6 6 6-6"/>,
  arrowLeft:    <g><path d="m12 6-6 6 6 6"/><path d="M6 12h14"/></g>,
  close:        <g><path d="m6 6 12 12M18 6 6 18"/></g>,
  bell:         <g><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8Z"/><path d="M10 21a2 2 0 0 0 4 0"/></g>,
  info:         <g><circle cx="12" cy="12" r="9"/><path d="M12 8v0M12 12v4"/></g>,
  star:         <path d="m12 3 2.8 6 6.2.8-4.6 4.4 1.2 6.4L12 17.4l-5.6 3.2 1.2-6.4L3 9.8l6.2-.8L12 3z"/>,
  heart:        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>,
  download:     <g><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></g>,
  volume:       <g><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/></g>,
  mute:         <g><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6M21 9l-5 6"/></g>,
  cc:           <g><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M9 10a2 2 0 0 0-4 0v4a2 2 0 0 0 4 0M16 10a2 2 0 0 0-4 0v4a2 2 0 0 0 4 0"/></g>,
  backward:     <g><path d="M11 6 3 12l8 6V6z" fill="currentColor" stroke="none"/><path d="M21 6 13 12l8 6V6z" fill="currentColor" stroke="none"/></g>,
  forward:      <g><path d="M3 6 11 12l-8 6V6z" fill="currentColor" stroke="none"/><path d="M13 6 21 12l-8 6V6z" fill="currentColor" stroke="none"/></g>,
  fullscreen:   <g><path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"/></g>,
  trash:        <g><path d="M4 7h16M9 7V4h6v3M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/></g>,
  filter:       <path d="M3 5h18M6 12h12M10 19h4"/>,
  stats:        <g><path d="M3 21h18"/><rect x="5" y="11" width="3" height="8"/><rect x="11" y="6" width="3" height="13"/><rect x="17" y="13" width="3" height="6"/></g>,
  card:         <g><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20"/></g>,
  languages:    <g><path d="M5 8h7M8 5v3M5 8c0 4 2 6 4 6M11 14c-1.5 2-3.5 3-6 3"/><path d="m12 21 5-11 5 11M14.5 16h5"/></g>,
  shield:       <path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6l-8-3Z"/>,
  mail:         <g><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></g>,
  doc:          <g><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></g>,
  logout:       <g><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8 6 12l4 4M6 12h11"/></g>,
  sparkle:      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M5.6 18.4l4.2-4.2M14.2 9.8l4.2-4.2"/>,
  delete:       <g><path d="M21 4H8l-5 8 5 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"/><path d="m18 9-6 6M12 9l6 6"/></g>,
  capslock:     <g><path d="m12 5 7 7h-4v4H9v-4H5l7-7Z"/><path d="M9 19h6"/></g>,
  space:        <g><path d="M5 11v3h14v-3"/></g>,
  enter:        <g><path d="M9 10V6h12v12H9v-4"/><path d="m12 14-3-3 3-3M9 11h10"/></g>,
  audio:        <g><path d="M11 5 7 9H3v6h4l4 4V5z" fill="currentColor" stroke="none"/><path d="M15 9h5M15 12h7M15 15h5"/></g>,
  // 3 equal-length lines, each with a circular knob (slider handle) at different positions
  sliders:      <g><path d="M3 7h8.5M16.5 7h4.5M3 12h3.5M11.5 12h9.5M3 17h10.5M18.5 17h2.5"/><circle cx="14" cy="7" r="2.5"/><circle cx="9" cy="12" r="2.5"/><circle cx="16" cy="17" r="2.5"/></g>,
};

export function GmaIcon({ name, size = 20, className = "", strokeWidth = 1.8, style }: GmaIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
