import { COL, FONT_MONO } from "../lib/tokens.js";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  layout: "sequence" | "hierarchical" | "force" | "radial";
  setLayout: (
    l: "sequence" | "hierarchical" | "force" | "radial",
  ) => void;
  selected: boolean;
  onClear: () => void;
}

export function Toolbar({
  search,
  setSearch,
  layout,
  setLayout,
  selected,
  onClear,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderBottom: `0.5px solid ${COL.border}`,
        background: "#fff",
        fontSize: 13,
        color: COL.text,
      }}
    >
      <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
        <svg
          width={12}
          height={12}
          viewBox="0 0 12 12"
          style={{
            position: "absolute",
            left: 9,
            top: "50%",
            transform: "translateY(-50%)",
            color: COL.textFaint,
          }}
        >
          <circle
            cx={5}
            cy={5}
            r={3.5}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
          />
          <line
            x1={7.5}
            y1={7.5}
            x2={10.5}
            y2={10.5}
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes…"
          style={{
            width: "100%",
            padding: "5px 10px 5px 26px",
            border: `0.5px solid ${COL.border}`,
            borderRadius: 4,
            font: "inherit",
            fontSize: 12.5,
            color: COL.text,
            background: COL.bg,
            outline: "none",
          }}
        />
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          color: COL.textMuted,
          fontFamily: FONT_MONO,
        }}
      >
        {(["sequence", "hierarchical", "force", "radial"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLayout(l)}
            style={{
              border: "none",
              background: layout === l ? COL.accentSoft : "transparent",
              color: layout === l ? COL.accentText : COL.textMuted,
              padding: "4px 9px",
              borderRadius: 3,
              cursor: "pointer",
              font: "inherit",
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            {l.slice(0, 4)}
          </button>
        ))}
      </div>
      {selected && (
        <button
          type="button"
          onClick={onClear}
          style={{
            border: `0.5px solid ${COL.border}`,
            background: "#fff",
            color: COL.textMuted,
            padding: "4px 10px",
            borderRadius: 3,
            cursor: "pointer",
            fontSize: 11.5,
            font: "inherit",
            letterSpacing: 0.2,
          }}
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
