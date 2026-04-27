import type { NodeKind } from "../../shared/types.js";
import { COL } from "../lib/tokens.js";

interface Props {
  kind: NodeKind;
  size?: number;
  color?: string;
}

export function KindGlyph({ kind, size = 14, color }: Props) {
  const c = color ?? COL.textMuted;
  const sw = 1.4;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      style={{ flexShrink: 0 }}
    >
      {kind === "command" && (
        <g
          fill="none"
          stroke={c}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 9 L13 9" />
          <path d="M9 5 L13 9 L9 13" />
          <line x1={15.5} y1={4} x2={15.5} y2={14} />
        </g>
      )}
      {kind === "event" && (
        <g>
          <rect x={2} y={4} width={14} height={3} fill={c} rx={0.5} />
          <rect x={2} y={9} width={10} height={3} fill={c} rx={0.5} opacity={0.55} />
          <rect x={2} y={14} width={6} height={1.2} fill={c} rx={0.5} opacity={0.35} />
        </g>
      )}
      {kind === "effect" && (
        <g fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round">
          <line x1={9} y1={2} x2={9} y2={16} />
          <line x1={2} y1={9} x2={16} y2={9} />
          <line x1={3.8} y1={3.8} x2={14.2} y2={14.2} />
          <line x1={14.2} y1={3.8} x2={3.8} y2={14.2} />
        </g>
      )}
      {kind === "saga" && (
        <g fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round">
          <rect x={2} y={5} width={6.5} height={8} rx={2.5} />
          <rect x={9.5} y={5} width={6.5} height={8} rx={2.5} />
          <line x1={6.5} y1={9} x2={11.5} y2={9} />
        </g>
      )}
      {kind === "projection" && (
        <g fill="none" stroke={c} strokeWidth={sw} strokeLinejoin="round">
          <path d="M9 2.5 L15.5 5.5 L9 8.5 L2.5 5.5 Z" />
          <path d="M2.5 9 L9 12 L15.5 9" />
          <path d="M2.5 12.5 L9 15.5 L15.5 12.5" opacity={0.55} />
        </g>
      )}
      {kind === "policy" && (
        <g
          fill="none"
          stroke={c}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 2 L15 4.5 V9 C15 12.5 12.5 14.8 9 16 C5.5 14.8 3 12.5 3 9 V4.5 Z" />
          <path d="M6.2 9 L8.2 11 L11.8 7" />
        </g>
      )}
    </svg>
  );
}
