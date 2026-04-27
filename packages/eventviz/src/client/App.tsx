import { useState } from "react";
import { useGraph } from "./lib/useGraph.js";
import { COL, FONT_MONO } from "./lib/tokens.js";
import { LinearChainsView } from "./components/LinearChainsView.js";
import { SequenceView } from "./components/SequenceView.js";
import { CompactView } from "./components/CompactView.js";
import { Toolbar } from "./components/Toolbar.js";
import { Legend } from "./components/Legend.js";
import { DetailPanel } from "./components/DetailPanel.js";

type Tab = "tree" | "sequence" | "compact";

export function App() {
  const { index, info } = useGraph();
  const [tab, setTab] = useState<Tab>("tree");

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
      }}
    >
      <Header tab={tab} setTab={setTab} info={info} />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {!index && <LoadingState />}
        {index && tab === "tree" && <LinearChainsView index={index} />}
        {index && tab === "sequence" && <SequenceTab index={index} />}
        {index && tab === "compact" && <CompactView index={index} />}
      </div>
    </div>
  );
}

function Header({
  tab,
  setTab,
  info,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  info: { fileCount: number; root: string } | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderBottom: `0.5px solid ${COL.border}`,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: COL.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={8} height={8} viewBox="0 0 8 8">
            <path
              d="M1 4 L3 6 L7 2"
              stroke="#fff"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span
          style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: -0.1 }}
        >
          Effects
        </span>
        <span style={{ color: COL.textFaint, fontSize: 12 }}>· DDD-TS</span>
      </div>
      <div
        style={{ width: 1, height: 16, background: COL.border, margin: "0 4px" }}
      />
      <div style={{ display: "flex", gap: 4 }}>
        {(
          [
            ["tree", "Tree"],
            ["sequence", "Sequence"],
            ["compact", "Compact"],
          ] as const
        ).map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              border: "none",
              background: tab === k ? COL.accentSoft : "transparent",
              color: tab === k ? COL.accentText : COL.textMuted,
              padding: "4px 10px",
              borderRadius: 3,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: tab === k ? 500 : 400,
              letterSpacing: 0.1,
            }}
          >
            {lbl}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      {info && (
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            color: COL.textFaint,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 480,
          }}
          title={info.root}
        >
          {info.fileCount} files · {trimRoot(info.root)}
        </div>
      )}
    </div>
  );
}

function trimRoot(root: string): string {
  const parts = root.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 3) return root;
  return ".../" + parts.slice(-3).join("/");
}

function SequenceTab({ index }: { index: ReturnType<typeof useGraph>["index"] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<
    "sequence" | "hierarchical" | "force" | "radial"
  >("sequence");
  if (!index) return null;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Toolbar
        search={search}
        setSearch={setSearch}
        layout={layout}
        setLayout={setLayout}
        selected={!!selected}
        onClear={() => setSelected(null)}
      />
      <div
        style={{
          position: "relative",
          flex: 1,
          overflow: "hidden",
        }}
      >
        <SequenceView
          index={index}
          selectedId={selected}
          onSelect={setSelected}
          search={search}
          layout={layout}
        />
        <DetailPanel
          index={index}
          nodeId={selected}
          onClose={() => setSelected(null)}
          onSelect={setSelected}
        />
        {!selected && <Legend />}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: COL.textFaint,
        fontSize: 12,
        fontFamily: FONT_MONO,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      connecting to parser…
    </div>
  );
}
