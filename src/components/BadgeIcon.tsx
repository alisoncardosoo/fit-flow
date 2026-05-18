import {
  Sparkles, Award, Medal, Trophy, Crown, Flame,
  CalendarCheck, Dumbbell, TrendingUp, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, Award, Medal, Trophy, Crown, Flame, CalendarCheck, Dumbbell, TrendingUp,
};

export type BadgeTier = "bronze" | "silver" | "gold";
export type BadgeShape = "disc" | "banner" | "hex" | "bolt";

// Vibrant Apple Watch–style face palettes (per-badge accent color)
type Palette = { face: string; faceLight: string; faceDark: string };

const ACCENT_BY_ICON: Record<string, Palette> = {
  Sparkles:      { face: "#FF3B6B", faceLight: "#FF8AA8", faceDark: "#9E1A3D" }, // pink
  Award:         { face: "#C8FF3D", faceLight: "#E5FF8A", faceDark: "#5D7A12" }, // lime
  Medal:         { face: "#FF7A3D", faceLight: "#FFB58A", faceDark: "#8A3A14" }, // orange
  Trophy:        { face: "#FFD23D", faceLight: "#FFE88A", faceDark: "#8A6A14" }, // gold yellow
  Crown:         { face: "#A455FF", faceLight: "#CFA3FF", faceDark: "#4A1F8A" }, // violet
  Flame:         { face: "#FF4D2E", faceLight: "#FF9B82", faceDark: "#8A1F0F" }, // hot red
  CalendarCheck: { face: "#3DDCFF", faceLight: "#9CECFF", faceDark: "#0F6480" }, // cyan
  Dumbbell:      { face: "#C8FF3D", faceLight: "#E5FF8A", faceDark: "#5D7A12" }, // lime
  TrendingUp:    { face: "#3DFF9B", faceLight: "#9AFFCD", faceDark: "#0F7A47" }, // green
};

// Metallic rim gradient stops per tier (silver / champagne / gold)
const RIM_BY_TIER: Record<BadgeTier, { hi: string; mid: string; lo: string; spec: string }> = {
  bronze: { hi: "#F5D3A8", mid: "#B8865A", lo: "#5A3A1E", spec: "#FFE8C8" },
  silver: { hi: "#F4F6FA", mid: "#A8B2C0", lo: "#3E4754", spec: "#FFFFFF" },
  gold:   { hi: "#FFF1B8", mid: "#D4A84A", lo: "#5A3F0F", spec: "#FFF8D8" },
};

type Props = {
  name: string;
  tier: BadgeTier;
  shape?: BadgeShape;
  earned: boolean;
  size?: number;
  className?: string;
};

/**
 * Apple Watch–style achievement medallion with distinct shapes and vibrant
 * faces. Locked = monochrome; earned = full color with metallic rim.
 */
export function BadgeIcon({
  name,
  tier,
  shape = "disc",
  earned,
  size = 96,
  className,
}: Props) {
  const Icon = ICON_MAP[name] ?? Award;
  const accent = ACCENT_BY_ICON[name] ?? ACCENT_BY_ICON.Award;
  const rim = RIM_BY_TIER[tier];

  // Monochrome palette for locked state
  const lockedAccent: Palette = { face: "#3A3D44", faceLight: "#5A6068", faceDark: "#16181C" };
  const lockedRim = { hi: "#6E7480", mid: "#3A3F47", lo: "#15171B", spec: "#9099A6" };

  const A = earned ? accent : lockedAccent;
  const R = earned ? rim : lockedRim;
  const id = `${tier}-${shape}-${name}`.replace(/[^a-z0-9-]/gi, "");

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {earned && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: A.face, opacity: 0.25 }}
        />
      )}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="relative drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
      >
        <defs>
          {/* Metallic rim — top→bottom highlight to shadow */}
          <linearGradient id={`rim-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={R.hi} />
            <stop offset="45%" stopColor={R.mid} />
            <stop offset="100%" stopColor={R.lo} />
          </linearGradient>
          {/* Inner rim shadow (groove between rim and face) */}
          <radialGradient id={`groove-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
          {/* Face vibrant fill */}
          <radialGradient id={`face-${id}`} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor={A.faceLight} />
            <stop offset="55%" stopColor={A.face} />
            <stop offset="100%" stopColor={A.faceDark} />
          </radialGradient>
          {/* Specular top gloss */}
          <linearGradient id={`gloss-${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={earned ? 0.55 : 0.18} />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          {/* Bottom inner shadow */}
          <linearGradient id={`shade-${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
          </linearGradient>
          {/* Concentric clip for disc detail */}
          <clipPath id={`clip-${id}`}>
            {shapeOuterPath(shape)}
          </clipPath>
        </defs>

        {/* OUTER RIM */}
        {shapeOuter(shape, `url(#rim-${id})`)}

        {/* INNER FACE (clipped) */}
        <g clipPath={`url(#clip-${id})`}>
          {shapeInnerFace(shape, `url(#face-${id})`)}

          {/* Shape-specific decorations */}
          {shape === "disc" && <DiscDetails id={id} accent={A} earned={earned} />}
          {shape === "banner" && <BannerDetails id={id} accent={A} earned={earned} />}
          {shape === "hex" && <HexDetails id={id} accent={A} earned={earned} />}
          {shape === "bolt" && <BoltDetails id={id} accent={A} earned={earned} />}

          {/* Center icon */}
          <foreignObject x="28" y="28" width="44" height="44">
            <div
              style={{
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: earned ? "#ffffff" : "#7E848E",
                filter: earned
                  ? "drop-shadow(0 1px 2px rgba(0,0,0,0.55))"
                  : "none",
              }}
            >
              <Icon size={26} strokeWidth={2.6} />
            </div>
          </foreignObject>

          {/* Top gloss */}
          {shapeGloss(shape, `url(#gloss-${id})`)}
          {/* Bottom shade */}
          {shapeGloss(shape, `url(#shade-${id})`, true)}
        </g>

        {/* Inner groove ring (rim seam) */}
        {shapeInnerStroke(shape, R.spec, earned ? 0.5 : 0.25)}
        {/* Subtle radial groove darkening */}
        <rect x="0" y="0" width="100" height="100" fill={`url(#groove-${id})`} clipPath={`url(#clip-${id})`} />
      </svg>
    </div>
  );
}

/* ---------------- shape primitives ---------------- */

function shapeOuter(shape: BadgeShape, fill: string) {
  switch (shape) {
    case "disc":
      return <circle cx="50" cy="50" r="48" fill={fill} />;
    case "banner":
      // Shield / banner with notched bottom (like the "200% Movimento")
      return <path d={BANNER_OUTER} fill={fill} />;
    case "hex":
      return <path d={HEX_OUTER} fill={fill} />;
    case "bolt":
      // Hexagon with subtle bevel cuts (used as bolt-medal base)
      return <path d={HEX_OUTER} fill={fill} />;
  }
}

function shapeOuterPath(shape: BadgeShape) {
  switch (shape) {
    case "disc":
      return <circle cx="50" cy="50" r="42" />;
    case "banner":
      return <path d={BANNER_INNER} />;
    case "hex":
    case "bolt":
      return <path d={HEX_INNER} />;
  }
}

function shapeInnerFace(shape: BadgeShape, fill: string) {
  switch (shape) {
    case "disc":
      return <circle cx="50" cy="50" r="42" fill={fill} />;
    case "banner":
      return <path d={BANNER_INNER} fill={fill} />;
    case "hex":
    case "bolt":
      return <path d={HEX_INNER} fill={fill} />;
  }
}

function shapeInnerStroke(shape: BadgeShape, stroke: string, opacity: number) {
  const props = { fill: "none", stroke, strokeOpacity: opacity, strokeWidth: 0.8 };
  switch (shape) {
    case "disc":
      return <circle cx="50" cy="50" r="42" {...props} />;
    case "banner":
      return <path d={BANNER_INNER} {...props} />;
    case "hex":
    case "bolt":
      return <path d={HEX_INNER} {...props} />;
  }
}

function shapeGloss(shape: BadgeShape, fill: string, bottom = false) {
  if (shape === "disc") {
    return bottom ? (
      <ellipse cx="50" cy="68" rx="34" ry="14" fill={fill} />
    ) : (
      <ellipse cx="50" cy="32" rx="32" ry="16" fill={fill} />
    );
  }
  if (shape === "banner") {
    return bottom ? (
      <rect x="14" y="55" width="72" height="35" fill={fill} />
    ) : (
      <rect x="14" y="8" width="72" height="30" fill={fill} />
    );
  }
  return bottom ? (
    <rect x="10" y="55" width="80" height="35" fill={fill} />
  ) : (
    <rect x="10" y="8" width="80" height="30" fill={fill} />
  );
}

/* ---------------- shape paths ---------------- */

// Shield / banner: rounded rect with twin notches at the bottom
const BANNER_OUTER =
  "M14 12 Q14 6 20 6 H80 Q86 6 86 12 V70 L74 60 L66 80 L50 68 L34 80 L26 60 L14 70 Z";
const BANNER_INNER =
  "M19 16 Q19 11 24 11 H76 Q81 11 81 16 V66 L72 58 L66 74 L50 64 L34 74 L28 58 L19 66 Z";

// Hexagon (point up/down)
const HEX_OUTER = "M50 4 L92 28 V72 L50 96 L8 72 V28 Z";
const HEX_INNER = "M50 10 L86 30 V70 L50 90 L14 70 V30 Z";

/* ---------------- decorative details per shape ---------------- */

function DiscDetails({ id, accent, earned }: { id: string; accent: Palette; earned: boolean }) {
  return (
    <g>
      {/* Concentric rings (like Move/Exercise rings) */}
      {[36, 30, 24, 18].map((r, i) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={earned ? 0.18 - i * 0.025 : 0.08}
          strokeWidth={i === 0 ? 1.2 : 0.6}
        />
      ))}
      {/* Center disc highlight */}
      <circle cx="50" cy="50" r="12" fill={accent.faceDark} opacity={earned ? 0.55 : 0.4} />
      <circle cx="50" cy="50" r="12" fill="none" stroke="#ffffff" strokeOpacity={earned ? 0.35 : 0.15} strokeWidth="0.6" />
    </g>
  );
}

function BannerDetails({ id, accent, earned }: { id: string; accent: Palette; earned: boolean }) {
  return (
    <g>
      {/* Twin overlapping rings, like Apple Watch overlap awards */}
      <circle cx="42" cy="40" r="16" fill={accent.faceDark} opacity={earned ? 0.5 : 0.35} />
      <circle cx="58" cy="40" r="16" fill={accent.faceLight} opacity={earned ? 0.55 : 0.3} />
      <circle cx="42" cy="40" r="16" fill="none" stroke="#ffffff" strokeOpacity={earned ? 0.35 : 0.15} strokeWidth="0.7" />
      <circle cx="58" cy="40" r="16" fill="none" stroke="#ffffff" strokeOpacity={earned ? 0.35 : 0.15} strokeWidth="0.7" />
    </g>
  );
}

function HexDetails({ id, accent, earned }: { id: string; accent: Palette; earned: boolean }) {
  return (
    <g>
      {/* Diagonal split inspired by Perfect Week badges */}
      <path
        d="M50 10 L86 30 L50 50 Z"
        fill={accent.faceLight}
        opacity={earned ? 0.55 : 0.25}
      />
      <path
        d="M50 50 L86 30 V70 L50 90 Z"
        fill={accent.faceDark}
        opacity={earned ? 0.35 : 0.2}
      />
      {/* Inner hex outline */}
      <path
        d="M50 22 L74 36 V64 L50 78 L26 64 V36 Z"
        fill="none"
        stroke="#ffffff"
        strokeOpacity={earned ? 0.25 : 0.12}
        strokeWidth="0.7"
      />
    </g>
  );
}

function BoltDetails({ id, accent, earned }: { id: string; accent: Palette; earned: boolean }) {
  return (
    <g>
      {/* Lightning bolt accent across hexagon */}
      <path
        d="M58 18 L34 52 H50 L42 82 L70 44 H54 Z"
        fill={accent.faceLight}
        opacity={earned ? 0.65 : 0.3}
      />
      <path
        d="M58 18 L34 52 H50 L42 82 L70 44 H54 Z"
        fill="none"
        stroke="#ffffff"
        strokeOpacity={earned ? 0.35 : 0.15}
        strokeWidth="0.7"
      />
    </g>
  );
}
