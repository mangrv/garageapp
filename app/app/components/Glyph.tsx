import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlarmClock, Waves, ArrowDown, ArrowRight, Ban, Banknote, Bell, Bike, Bookmark, Bot, Calendar, CalendarDays, Camera, Car, CarFront, Check, CircleCheck, CircleX, ClipboardList, Construction, Disc3, Droplet, Droplets, Eye, FileText, Flag, Folder, FolderOpen, Globe, Hammer, Handshake, Hash, Hourglass, House, Image, Inbox, KeyRound, Landmark, Lightbulb, Link, Loader, Lock, LockKeyhole, Mail, MapPin, Maximize, Menu, MessageCircle, Mic, Moon, Motorbike, NotebookPen, Nut, OctagonX, Package, Palette, Paperclip, Pencil, Plus, Printer, Receipt, RefreshCw, Repeat, Ruler, Satellite, Save, Scale, ScrollText, Search, Settings, ShieldCheck, ShoppingCart, Smile, Sparkle, Sparkles, Star, Store, Sun, Timer, Toolbox, Tractor, Trash2, TriangleAlert, Truck, Upload, User, Users, Wallet, Wrench, X, Zap,
} from "lucide-react";

/** Maps the emoji used across the UI to line icons, so markup can keep a single symbol per concept. */
const ICONS: Record<string, LucideIcon> = {
  "🔧": Wrench,
  "✅": CircleCheck,
  "✕": X,
  "🚗": Car,
  "📋": ClipboardList,
  "📄": FileText,
  "📷": Camera,
  "⚠": TriangleAlert,
  "✓": Check,
  "📅": Calendar,
  "🧰": Toolbox,
  "⚙": Settings,
  "✏": Pencil,
  "🗑": Trash2,
  "🔩": Nut,
  "📍": MapPin,
  "🛠": Hammer,
  "🧾": Receipt,
  "🔍": Search,
  "🛡": ShieldCheck,
  "🔒": Lock,
  "🤖": Bot,
  "⭐": Star,
  "🚚": Truck,
  "🗂": FolderOpen,
  "🚜": Tractor,
  "💾": Save,
  "💰": Wallet,
  "📎": Paperclip,
  "🚲": Bike,
  "🎨": Palette,
  "⏳": Hourglass,
  "📝": NotebookPen,
  "⬇": ArrowDown,
  "🔜": ArrowRight,
  "📦": Package,
  "🤝": Handshake,
  "🏁": Flag,
  "🛢": Droplet,
  "💡": Lightbulb,
  "📸": Camera,
  "🌐": Globe,
  "🏎": CarFront,
  "🚫": Ban,
  "👁": Eye,
  "🔄": RefreshCw,
  "🐎": CarFront,
  "🚙": CarFront,
  "🔗": Link,
  "📁": Folder,
  "🖼": Image,
  "✨": Sparkles,
  "📥": Inbox,
  "👉": ArrowRight,
  "🎙": Mic,
  "🔑": KeyRound,
  "🏠": House,
  "☰": Menu,
  "🐏": Truck,
  "💵": Banknote,
  "📐": Ruler,
  "🔁": Repeat,
  "🔔": Bell,
  "🛑": OctagonX,
  "🛒": ShoppingCart,
  "💬": MessageCircle,
  "🗓": CalendarDays,
  "🔐": LockKeyhole,
  "🔖": Bookmark,
  "❌": CircleX,
  "🛞": Disc3,
  "🚿": Droplets,
  "🏪": Store,
  "📡": Satellite,
  "✦": Sparkle,
  "🖨": Printer,
  "⚡": Zap,
  "🏍": Motorbike,
  "👤": User,
  "✉": Mail,
  "📤": Upload,
  "➕": Plus,
  "🌙": Moon,
  "☀": Sun,
  "👥": Users,
  "🙂": Smile,
  "⚖": Scale,
  "🏗": Construction,
  "⛶": Maximize,
  "🌀": Loader,
  "📜": ScrollText,
  "🏦": Landmark,
  "🚴": Bike,
  "✔": Check,
  "⏱": Timer,
  "👀": Eye,
  "🧴": Droplet,
  "🔟": Hash,
  "⏰": AlarmClock,
  "⬛": Disc3,
  "〰": Waves,
};

/** Status dots keep their meaning as solid colors. */
const DOTS: Record<string, string> = {
  "🔴": "#dc2626",
  "🟡": "#d97706",
  "🟢": "#059669",
  "🔵": "#2446f0",
  "🟦": "#2446f0",
};

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2B07}\u{23F0}-\u{23FA}\u{231A}\u{231B}\u{2B1B}\u{3030}]/u;

export function isGlyph(value: unknown): boolean {
  return typeof value === "string" && EMOJI.test(value);
}

interface GlyphProps {
  /** An emoji (mapped to an icon), plain text, or any React node (rendered as-is). */
  e?: ReactNode;
  size?: number | string;
  className?: string;
  strokeWidth?: number;
}

export default function Glyph({ e, size = "1em", className = "", strokeWidth = 2 }: GlyphProps) {
  if (e === null || e === undefined || e === false || e === "") return null;
  if (typeof e !== "string") return <>{e}</>;
  const key = e.replace(/\uFE0F/g, "").trim();
  const dot = DOTS[key];
  if (dot) {
    return (
      <span aria-hidden="true" className={`inline-block rounded-full align-middle ${className}`}
        style={{ width: "0.6em", height: "0.6em", background: dot }} />
    );
  }
  const Icon = ICONS[key];
  if (Icon) {
    return <Icon aria-hidden="true" size={size} strokeWidth={strokeWidth} className={`inline-block shrink-0 align-[-0.125em] ${className}`} />;
  }
  // Plain text (e.g. initials or a label) passes through; unknown emoji are dropped.
  return EMOJI.test(key) ? null : <>{e}</>;
}
