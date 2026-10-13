"use client";

import {
  useState, useEffect, useRef, useCallback,
} from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EmojiPickerReact = dynamic(() => import("emoji-picker-react"), { ssr: false }) as React.ComponentType<any>;
import {
  X, Maximize2, Minimize2, Send, Smile,
  ChevronLeft, MoreHorizontal, Copy, Flag, CornerUpLeft,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useDMStore } from "@/store/use-dm-store";
import styles from "./dm-window.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OtherUser { name: string; color: string; alias?: string }

interface Convo {
  id: string;
  creator_id: string;
  viewer_id:  string;
  updated_at: string;
  other: OtherUser;
  lastMsg?: string;
}

interface Msg {
  id:              string;
  conversation_id: string;
  sender_id:       string;
  content:         string;
  reply_to_id:     string | null;
  reply_to?:       { id: string; content: string; sender_name: string } | null;
  reactions:       Record<string, string[]>;
  is_deleted:      boolean;
  created_at:      string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const C = {
  bg:      "#0A0D12",
  card:    "#0F1318",
  border:  "#1E2530",
  border2: "#262E3A",
  green:   "#22B16B",
  greenBg: "#0B2E1A",
  text:    "#FFFFFF",
  sec:     "#8A9BB0",
  muted:   "#4A5568",
  red:     "#FF5252",
} as const;

const REACTIONS = ["❤️","😂","👍","🔥","😮","😢","👏","🎉"];

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_ID = "__demo__";

const DEMO_CONVO: Convo = {
  id:         DEMO_ID,
  creator_id: "creator",
  viewer_id:  "viewer",
  updated_at: new Date().toISOString(),
  other: { name: "Laura Vidal", color: "#8B5CF6", alias: "@lauravidal" },
  lastMsg: "¡Me ha encantado tu corto! 🎬",
};

const DEMO_MSGS: Msg[] = [
  {
    id: "d1", conversation_id: DEMO_ID, sender_id: "viewer",
    content: "Hola, acabo de ver tu corto «Marea Alta» y me ha dejado sin palabras. ¿Cuánto tiempo tardaste en rodarlo?",
    reply_to_id: null, reactions: {}, is_deleted: false,
    created_at: new Date(Date.now() - 18 * 60000).toISOString(),
  },
  {
    id: "d2", conversation_id: DEMO_ID, sender_id: "creator",
    content: "¡Hola Laura! Me alegra mucho que te haya gustado 🙏 Fueron tres fines de semana de rodaje, aunque la preproducción nos llevó casi dos meses.",
    reply_to_id: null, reactions: { "❤️": ["viewer"] }, is_deleted: false,
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: "d3", conversation_id: DEMO_ID, sender_id: "viewer",
    content: "Se nota el cuidado en cada plano. La escena del faro al atardecer es preciosa. ¿Fue difícil conseguir el permiso para rodar ahí?",
    reply_to_id: null, reactions: {}, is_deleted: false,
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: "d4", conversation_id: DEMO_ID, sender_id: "creator",
    content: "Bastante, sí 😅 Tuvimos que esperar tres semanas para la autorización. Pero valió la pena. También te quería decir que tu donación me ayudó a cubrir el alquiler del equipo de sonido, ¡gracias de verdad!",
    reply_to_id: "d3",
    reply_to: { id: "d3", content: "¿Fue difícil conseguir el permiso para rodar ahí?", sender_name: "Laura Vidal" },
    reactions: { "🔥": ["viewer"], "👏": ["viewer"] }, is_deleted: false,
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: "d5", conversation_id: DEMO_ID, sender_id: "viewer",
    content: "¡Me ha encantado tu corto! 🎬 Ya estoy esperando el siguiente.",
    reply_to_id: null, reactions: {}, is_deleted: false,
    created_at: new Date(Date.now() - 2 * 60000).toISOString(),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(ts: string) {
  const d   = new Date(ts);
  const now = new Date();
  const ms  = now.getTime() - d.getTime();
  if (ms < 86400_000)  return "Hoy";
  if (ms < 172800_000) return "Ayer";
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function Av({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: color, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.38,
      fontWeight: 800, color: "#031A0F",
    }}>
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// ─── Portal popups (escape overflow/clip contexts) ────────────────────────────

function useVisibleViewport() {
  const [viewport, setViewport] = useState({ width: 0, height: 0, top: 0, left: 0 });
  useEffect(() => {
    const update = () => setViewport({
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
      top: window.visualViewport?.offsetTop ?? 0,
      left: window.visualViewport?.offsetLeft ?? 0,
    });
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return viewport;
}

function popupPosition(anchor: DOMRect, width: number, height: number, viewport: ReturnType<typeof useVisibleViewport>) {
  const left = Math.max(viewport.left + 8, Math.min(anchor.left, viewport.left + viewport.width - width - 8));
  const above = anchor.top - height - 8;
  const preferredTop = above >= viewport.top + 8 ? above : anchor.bottom + 8;
  const top = Math.max(viewport.top + 8, Math.min(preferredTop, viewport.top + viewport.height - height - 8));
  return { top, left };
}

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    }
    // Let the trigger click finish before listening; otherwise it can close a
    // freshly opened popup or reopen one dismissed on pointerdown.
    const timer = window.setTimeout(() => document.addEventListener("click", h), 0);
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
    };
    document.addEventListener("keydown", handleKeys);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", h);
      document.removeEventListener("keydown", handleKeys);
      const active = document.activeElement;
      if (previousFocus?.isConnected && (active === document.body || ref.current?.contains(active))) previousFocus.focus();
    };
  }, [ref]);
}

function EmojiPicker({ anchorRect, onPick, onClose }: {
  anchorRect: DOMRect; onPick: (e: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, onClose);
  const viewport = useVisibleViewport();

  if (typeof document === "undefined") return null;
  const W = Math.min(320, Math.max(0, viewport.width - 16));
  const H = Math.min(420, Math.max(0, viewport.height - 16));
  const { top, left } = popupPosition(anchorRect, W, H, viewport);
  if (!W || !H) return null;
  return createPortal(
    <div ref={ref} data-dm-popup style={{ position: "fixed", top, left, zIndex: 10000, width: W, maxHeight: H, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.8)" }}>
      <EmojiPickerReact
        onEmojiClick={(emojiData: { emoji: string }) => onPick(emojiData.emoji)}
        theme="dark"
        emojiStyle="native"
        searchPlaceholder="Buscar emoji…"
        width={W}
        height={H}
        lazyLoadEmojis
        previewConfig={{ showPreview: false }}
        style={{
          ["--epr-bg-color" as string]:                  "#0F1318",
          ["--epr-category-label-bg-color" as string]:   "#0A0D12",
          ["--epr-hover-bg-color" as string]:            "#1E2530",
          ["--epr-search-input-bg-color" as string]:     "#1E2530",
          ["--epr-search-border-color" as string]:       "#262E3A",
          ["--epr-text-color" as string]:                "#FFFFFF",
          ["--epr-search-input-placeholder-color" as string]: "#8A9BB0",
          ["--epr-emoji-highlighted-color" as string]:   "#22B16B",
          ["--epr-category-icon-active-color" as string]:"#22B16B",
        }}
      />
    </div>,
    document.body,
  );
}

function ReactionPicker({ anchorRect, onPick, onClose }: {
  anchorRect: DOMRect; onPick: (e: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, onClose);
  const viewport = useVisibleViewport();
  if (typeof document === "undefined" || !viewport.width || !viewport.height) return null;
  const columns = Math.max(1, Math.min(8, Math.floor((viewport.width - 32) / 44)));
  const popupW = columns * 44 + 16;
  const popupH = Math.ceil(REACTIONS.length / columns) * 44 + 12;
  const { top, left } = popupPosition(anchorRect, popupW, popupH, viewport);
  return createPortal(
    <div ref={ref} data-dm-popup style={{
      position: "fixed", top, left, zIndex: 10000,
      display: "grid", gridTemplateColumns: `repeat(${columns}, 44px)`, padding: "6px 8px", borderRadius: 16,
      maxHeight: Math.max(0, viewport.height - 16), overflowY: "auto",
      background: C.card, border: `1px solid ${C.border2}`,
      boxShadow: "0 6px 24px rgba(0,0,0,0.8)",
    }}>
      {REACTIONS.map(e => (
        <button key={e} type="button" onClick={() => onPick(e)}
          aria-label={`Reaccionar con ${e}`}
          style={{ width: 44, height: 44, background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: 2, borderRadius: 6 }}
          onMouseEnter={ev => (ev.currentTarget.style.background = C.border)}
          onMouseLeave={ev => (ev.currentTarget.style.background = "none")}
        >{e}</button>
      ))}
    </div>,
    document.body,
  );
}

function DotMenu({ anchorRect, onCopy, onReport, onClose }: {
  anchorRect: DOMRect;
  onCopy: () => void; onReport: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, onClose);
  const viewport = useVisibleViewport();
  if (typeof document === "undefined" || !viewport.width || !viewport.height) return null;
  const menuW = Math.min(160, viewport.width - 16);
  const menuH = Math.min(90, viewport.height - 16);
  const { top, left } = popupPosition(anchorRect, menuW, menuH, viewport);
  return createPortal(
    <div ref={ref} data-dm-popup style={{
      position: "fixed", top, left, width: menuW, zIndex: 10000,
      borderRadius: 10, maxHeight: menuH, overflowY: "auto", overscrollBehavior: "contain",
      background: C.card, border: `1px solid ${C.border2}`,
      boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
    }}>
      {([
        { label: "Copiar",    icon: <Copy size={13} />, action: onCopy,   red: false },
        { label: "Denunciar", icon: <Flag size={13} />, action: onReport, red: true  },
      ] as const).map(({ label, icon, action, red }) => (
        <button key={label} type="button"
          onClick={() => { action(); onClose(); }}
          style={{
            display: "flex", alignItems: "center", gap: 9, width: "100%", minHeight: 44,
            padding: "9px 14px", background: "none", border: "none", cursor: "pointer",
            fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
            color: red ? C.red : C.sec, textAlign: "left",
            transition: "background 0.12s, color 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.border; e.currentTarget.style.color = red ? C.red : C.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none";   e.currentTarget.style.color = red ? C.red : C.sec; }}
        >
          {icon}{label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

function MsgActions({ isMine, onReact, onReply, onCopy, onReport }: {
  isMine: boolean;
  onReact: (rect: DOMRect) => void;
  onReply: () => void;
  onCopy: () => void;
  onReport: () => void;
}) {
  const [dotRect, setDotRect] = useState<DOMRect | null>(null);

  const btn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", padding: 4,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: C.sec, borderRadius: 6, transition: "color 0.15s, background 0.15s",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1, flexDirection: isMine ? "row-reverse" : "row" }}>
      <button type="button"
        onClick={e => onReact(e.currentTarget.getBoundingClientRect())}
        className={styles.actionButton}
        style={btn}
        onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.border; }}
        onMouseLeave={e => { e.currentTarget.style.color = C.sec;  e.currentTarget.style.background = "none"; }}
        aria-label="Reaccionar" title="Reaccionar">
        <Smile size={14} />
      </button>
      <button type="button" onClick={onReply} className={styles.actionButton}
        style={btn}
        onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.border; }}
        onMouseLeave={e => { e.currentTarget.style.color = C.sec;  e.currentTarget.style.background = "none"; }}
        aria-label="Responder" title="Responder">
        <CornerUpLeft size={14} />
      </button>
      <button type="button"
        onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setDotRect(r => r ? null : rect); }}
        className={styles.actionButton}
        style={btn}
        onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.border; }}
        onMouseLeave={e => { e.currentTarget.style.color = C.sec;  e.currentTarget.style.background = "none"; }}
        aria-label="Más opciones" title="Más opciones">
        <MoreHorizontal size={14} />
      </button>
      {dotRect && (
        <DotMenu
          anchorRect={dotRect}
          onCopy={onCopy}
          onReport={onReport}
          onClose={() => setDotRect(null)}
        />
      )}
    </div>
  );
}

function MsgBubble({
  msg, isMine, currentUserId, otherColor, otherName,
  onReact, onReply, onCopy, onReport,
}: {
  msg: Msg; isMine: boolean; currentUserId: string;
  otherColor: string; otherName: string;
  onReact: (msgId: string, emoji: string) => void;
  onReply: (msg: Msg) => void;
  onCopy: (content: string) => void;
  onReport: (msgId: string) => void;
}) {
  const [reactAnchorRect, setReactAnchorRect] = useState<DOMRect | null>(null);

  const reactionEntries = Object.entries(msg.reactions).filter(([, ids]) => ids.length > 0);

  return (
    <div
      className={styles.message}
      style={{
        display: "flex", flexDirection: isMine ? "row-reverse" : "row",
        alignItems: "flex-end", gap: 8, marginBottom: 12,
      }}
    >
      {/* avatar (only for other person) */}
      {!isMine && <Av name={otherName} color={otherColor} size={26} />}

      <div className={styles.messageBody} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
        {/* reply preview */}
        {msg.reply_to && (
          <div style={{
            fontSize: 11, color: C.muted, padding: "4px 8px",
            borderLeft: `2px solid ${C.border2}`, marginBottom: 3,
            maxWidth: "100%", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
            borderRadius: "0 4px 4px 0",
          }}>
            <span style={{ fontWeight: 700, color: C.sec }}>{msg.reply_to.sender_name} · </span>
            {msg.reply_to.content.slice(0, 60)}{msg.reply_to.content.length > 60 ? "…" : ""}
          </div>
        )}

        {/* bubble */}
        <div style={{
          padding: "9px 13px", borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isMine ? C.greenBg : C.card,
          border: `1px solid ${isMine ? C.green + "33" : C.border}`,
          fontSize: 13.5, color: C.text, lineHeight: 1.5,
          whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere",
        }}>
          {msg.is_deleted
            ? <span style={{ color: C.muted, fontStyle: "italic" }}>Mensaje eliminado</span>
            : msg.content}
        </div>

        {/* reactions */}
        {reactionEntries.length > 0 && (
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            {reactionEntries.map(([emoji, ids]) => (
              <button key={emoji} type="button" className={styles.reactionPill}
                onClick={() => onReact(msg.id, emoji)}
                style={{
                  display: "flex", alignItems: "center", gap: 3,
                  padding: "2px 7px", borderRadius: 999, fontSize: 13, cursor: "pointer",
                  background: ids.includes(currentUserId) ? `${C.green}22` : C.card,
                  border: `1px solid ${ids.includes(currentUserId) ? C.green + "66" : C.border}`,
                  color: C.text,
                }}
              >
                {emoji}
                {ids.length > 1 && <span style={{ fontSize: 11, color: C.sec }}>{ids.length}</span>}
              </button>
            ))}
          </div>
        )}

        {/* time */}
        <span style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{fmtTime(msg.created_at)}</span>
      </div>

      {/* Actions are also visible on touch devices and keyboard focus. */}
      <div className={styles.messageActions}>
        {reactAnchorRect && (
          <ReactionPicker
            anchorRect={reactAnchorRect}
            onPick={(e) => { onReact(msg.id, e); setReactAnchorRect(null); }}
            onClose={() => setReactAnchorRect(null)}
          />
        )}
        <MsgActions
          isMine={isMine}
          onReact={(rect) => setReactAnchorRect(r => r ? null : rect)}
          onReply={() => onReply(msg)}
          onCopy={() => onCopy(msg.content)}
          onReport={() => onReport(msg.id)}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DMWindow() {
  const { isOpen, activeConvoId, close, setConvo } = useDMStore();
  const { userId } = useUserProfile();
  const viewport = useVisibleViewport();
  const hasViewport = viewport.width > 0;
  const windowRef = useRef<HTMLDivElement>(null);

  const [maximized, setMaximized] = useState(false);
  const [convos, setConvos]       = useState<Convo[]>([]);
  const [messages, setMessages]   = useState<Msg[]>([]);
  const [loading, setLoading]     = useState(false);
  const [input, setInput]         = useState("");
  const [replyTo, setReplyTo]           = useState<Msg | null>(null);
  const [emojiAnchorRect, setEmojiAnchorRect] = useState<DOMRect | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const supabase  = getSupabaseBrowserClient();

  const isDemo      = activeConvoId === DEMO_ID;
  const allConvos   = [DEMO_CONVO, ...convos];
  const activeConvo = allConvos.find(c => c.id === activeConvoId) ?? null;

  // ── Fetch conversations ────────────────────────────────────────────────────
  const loadConvos = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("dm_conversations")
      .select("id, creator_id, viewer_id, updated_at, other_display_name, other_color, last_message")
      .order("updated_at", { ascending: false });
    if (!data) return;
    setConvos(data.map((r: Record<string, unknown>) => ({
      id:         r.id as string,
      creator_id: r.creator_id as string,
      viewer_id:  r.viewer_id as string,
      updated_at: r.updated_at as string,
      other: {
        name:  (r.other_display_name as string | null) ?? "Usuario",
        color: (r.other_color as string | null) ?? "#22B16B",
      },
      lastMsg: r.last_message as string | undefined,
    })));
  }, [userId, supabase]);

  useEffect(() => {
    if (isOpen) void loadConvos();
  }, [isOpen, loadConvos]);

  // ── Fetch messages for active conversation ────────────────────────────────
  const loadMessages = useCallback(async (convoId: string) => {
    if (convoId === DEMO_ID) { setMessages(DEMO_MSGS); return; }
    setLoading(true);
    const { data } = await supabase
      .from("dm_messages")
      .select("*")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Msg[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!activeConvoId) { setMessages([]); return; }
    void loadMessages(activeConvoId);
  }, [activeConvoId, loadMessages]);

  // ── Realtime subscription (skip for demo) ────────────────────────────────
  useEffect(() => {
    if (!activeConvoId || isDemo) return;
    const channel = supabase.channel(`dm_${activeConvoId}`)
      .on("postgres_changes", {
        event:  "*",
        schema: "public",
        table:  "dm_messages",
        filter: `conversation_id=eq.${activeConvoId}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          setMessages(m => [...m, payload.new as Msg]);
        } else if (payload.eventType === "UPDATE") {
          setMessages(m => m.map(msg => msg.id === payload.new.id ? payload.new as Msg : msg));
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeConvoId, isDemo, supabase]);

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim();
    if (!text || !activeConvoId || !userId) return;
    setInput("");
    setReplyTo(null);
    if (isDemo) {
      // In demo mode, show the sent message locally without hitting DB
      const fake: Msg = {
        id: `demo_${Date.now()}`, conversation_id: DEMO_ID,
        sender_id: "creator", content: text,
        reply_to_id: replyTo?.id ?? null,
        reply_to: replyTo ? { id: replyTo.id, content: replyTo.content, sender_name: DEMO_CONVO.other.name } : null,
        reactions: {}, is_deleted: false,
        created_at: new Date().toISOString(),
      };
      setMessages(m => [...m, fake]);
      return;
    }
    await supabase.from("dm_messages").insert({
      conversation_id: activeConvoId,
      sender_id:       userId,
      content:         text,
      reply_to_id:     replyTo?.id ?? null,
      reactions:       {},
    });
    await supabase.from("dm_conversations")
      .update({ updated_at: new Date().toISOString(), last_message: text })
      .eq("id", activeConvoId);
  }

  // ── Toggle reaction ───────────────────────────────────────────────────────
  async function handleReact(msgId: string, emoji: string) {
    if (!userId) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const reactions = { ...msg.reactions };
    const current = reactions[emoji] ?? [];
    reactions[emoji] = current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId];
    await supabase.from("dm_messages").update({ reactions }).eq("id", msgId);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  async function handleReport() {
    // TODO: insert into reports table (needs the message id from the caller)
    alert("Mensaje denunciado. Lo revisaremos pronto.");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  useEffect(() => {
    if (!isOpen || !hasViewport) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    windowRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("[data-dm-popup]")) close();
    };
    document.addEventListener("keydown", handleEscape);
    return () => { document.removeEventListener("keydown", handleEscape); previousFocus?.focus(); };
  }, [isOpen, close, hasViewport]);

  if (!isOpen || !viewport.width) return null;

  const margin = viewport.width < 640 ? 8 : 24;
  const W = Math.min(viewport.width < 640 ? viewport.width - 16 : maximized ? 480 : 360, viewport.width - margin * 2);
  const H = Math.max(1, Math.min(maximized ? 660 : 520, viewport.height - 8));

  // ── Window layout ─────────────────────────────────────────────────────────
  return (
    <div ref={windowRef} className={styles.window} role="dialog" aria-label="Mensajes directos" tabIndex={-1} style={{
      position: "fixed", top: viewport.top + viewport.height - H, left: viewport.left + viewport.width - W - margin, zIndex: 9000,
      width: W, height: H,
      borderRadius: "16px 16px 0 0",
      background: C.bg, border: `1px solid ${C.border2}`,
      borderBottom: "none",
      boxShadow: "0 -8px 48px rgba(0,0,0,0.7)",
      display: "flex", flexDirection: "column",
      fontFamily: "inherit",
      transition: "width 0.25s ease, height 0.25s ease",
      overflow: "hidden",
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={styles.header} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px", borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        {activeConvoId && (
          <button type="button" onClick={() => setConvo(null)} aria-label="Volver a conversaciones"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.sec, padding: 4, display: "flex", alignItems: "center" }}>
            <ChevronLeft size={18} />
          </button>
        )}

        {activeConvo ? (
          <>
            <Av name={activeConvo.other.name} color={activeConvo.other.color} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.identity} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ minWidth: 0, fontSize: 13.5, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeConvo.other.name}
                </span>
                {isDemo && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, flexShrink: 0,
                    background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)",
                    color: "#A78BFA", letterSpacing: "0.04em", textTransform: "uppercase",
                  }}>Vista previa</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>Mensaje directo</div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Mensajes</div>
            <div style={{ fontSize: 11, color: C.muted }}>{convos.length} conversacion{convos.length !== 1 ? "es" : ""}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" onClick={() => setMaximized(m => !m)} aria-label={maximized ? "Reducir mensajes" : "Ampliar mensajes"}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.sec, padding: 4, display: "flex", alignItems: "center", borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.color = C.text}
            onMouseLeave={e => e.currentTarget.style.color = C.sec}>
            {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button type="button" onClick={close} aria-label="Cerrar mensajes"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.sec, padding: 4, display: "flex", alignItems: "center", borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.color = C.text}
            onMouseLeave={e => e.currentTarget.style.color = C.sec}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!activeConvoId ? (
          /* Conversations list */
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0", overscrollBehavior: "contain" }}>
            {allConvos.map(c => (
              <button key={c.id} type="button" onClick={() => setConvo(c.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  padding: "10px 14px", background: "none", border: "none",
                  cursor: "pointer", textAlign: "left", transition: "background 0.12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.card}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <Av name={c.other.name} color={c.other.color} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ minWidth: 0, overflowWrap: "anywhere", fontSize: 13.5, fontWeight: 700, color: C.text }}>{c.other.name}</span>
                    {c.id === DEMO_ID && (
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                        background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)",
                        color: "#A78BFA", letterSpacing: "0.04em", textTransform: "uppercase",
                      }}>Vista previa</span>
                    )}
                  </div>
                  {c.lastMsg && (
                    <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.lastMsg.slice(0, 50)}{c.lastMsg.length > 50 ? "…" : ""}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: C.muted, flexShrink: 0 }}>{fmtDate(c.updated_at)}</div>
              </button>
            ))}
          </div>
        ) : (
          /* Chat view */
          <>
            {/* Messages */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 14px 0", overscrollBehavior: "contain" }}>
              {/* Profile intro — always at top of the message thread */}
              {activeConvo && (
                <div style={{ padding: "28px 0 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Av name={activeConvo.other.name} color={activeConvo.other.color} size={72} />
                  <div style={{ maxWidth: "100%", overflowWrap: "anywhere", textAlign: "center", fontSize: 16, fontWeight: 800, color: C.text, marginTop: 12 }}>
                    {activeConvo.other.name}
                  </div>
                  {activeConvo.other.alias && (
                    <div style={{ maxWidth: "100%", overflowWrap: "anywhere", textAlign: "center", fontSize: 13, color: C.sec, marginTop: 3 }}>
                      {activeConvo.other.alias}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, textAlign: "center", overflowWrap: "anywhere" }}>
                    Este es el principio de tu conversación privada
                  </div>
                  <div style={{ width: 40, height: 1, background: C.border, margin: "16px auto 0" }} />
                </div>
              )}

              {loading && (
                <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: 20 }}>Cargando…</div>
              )}
              {messages.map((msg) => {
                const isMine = isDemo ? msg.sender_id === "creator" : msg.sender_id === userId;
                return (
                  <MsgBubble
                    key={msg.id}
                    msg={msg}
                    isMine={isMine}
                    currentUserId={userId ?? ""}
                    otherColor={activeConvo?.other.color ?? C.green}
                    otherName={activeConvo?.other.name ?? "?"}
                    onReact={handleReact}
                    onReply={setReplyTo}
                    onCopy={(c) => void navigator.clipboard.writeText(c)}
                    onReport={handleReport}
                  />
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* ── Input area ──────────────────────────────────────────── */}
            <div className={styles.composer} style={{ borderTop: `1px solid ${C.border}`, padding: "10px 12px", flexShrink: 0 }}>
              {/* Reply preview */}
              {replyTo && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "5px 10px", borderRadius: 8, marginBottom: 6,
                  background: C.card, border: `1px solid ${C.border2}`,
                }}>
                  <div style={{ fontSize: 11.5, color: C.sec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>↩ Respondiendo a: </span>
                    {replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? "…" : ""}
                  </div>
                  <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancelar respuesta"
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 2, marginLeft: 6 }}>
                    <X size={12} />
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                {/* Emoji button */}
                <div style={{ flexShrink: 0 }}>
                  {emojiAnchorRect && (
                    <EmojiPicker
                      anchorRect={emojiAnchorRect}
                      onPick={(e) => { setInput(t => t + e); setEmojiAnchorRect(null); inputRef.current?.focus(); }}
                      onClose={() => setEmojiAnchorRect(null)}
                    />
                  )}
                  <button type="button"
                    aria-label="Elegir emoji"
                    onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setEmojiAnchorRect(r => r ? null : rect); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: 6,
                      color: emojiAnchorRect ? C.green : C.sec, display: "flex", alignItems: "center",
                      transition: "color 0.15s", borderRadius: 8,
                    }}
                    onMouseEnter={e => { if (!emojiAnchorRect) e.currentTarget.style.color = C.text; }}
                    onMouseLeave={e => { if (!emojiAnchorRect) e.currentTarget.style.color = C.sec; }}>
                    <Smile size={18} />
                  </button>
                </div>

                {/* Text input */}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje…"
                  rows={1}
                  style={{
                    flex: 1, minWidth: 0, resize: "none", background: C.card,
                    border: `1px solid ${C.border2}`, borderRadius: 12,
                    padding: "8px 12px", fontSize: 13.5, color: C.text,
                    fontFamily: "inherit", outline: "none", lineHeight: 1.5,
                    maxHeight: 120, overflowY: "auto",
                  }}
                  onFocus={e => e.target.style.borderColor = C.green + "66"}
                  onBlur={e => e.target.style.borderColor = C.border2}
                />

                {/* Send */}
                <button type="button" aria-label="Enviar mensaje" onClick={() => void handleSend()}
                  disabled={!input.trim()}
                  style={{
                    flexShrink: 0, width: 34, height: 34,
                    borderRadius: "50%", border: "none", cursor: "pointer",
                    background: input.trim() ? C.green : C.border2,
                    color: input.trim() ? "#031A0F" : C.muted,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.2s, color 0.2s",
                  }}>
                  <Send size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
