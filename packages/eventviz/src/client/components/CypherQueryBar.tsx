import { useEffect, useRef, useState } from "react";
import { COL, FONT_MONO } from "../lib/tokens.js";
import { useCypherLLM } from "../lib/useCypherLLM.js";

interface Props {
  value: string;
  onChange: (q: string) => void;
  error: string | null;
  matchCount: number | null;
  rowCount: number | null;
}

export function CypherQueryBar({
  value,
  onChange,
  error,
  matchCount,
  rowCount,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [nlOpen, setNlOpen] = useState(false);
  const [nlText, setNlText] = useState("");
  const [nlError, setNlError] = useState<string | null>(null);
  const llm = useCypherLLM();

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  async function runGenerate() {
    if (!nlText.trim()) return;
    setNlError(null);
    try {
      const cypher = await llm.generate(nlText);
      if (cypher) onChange(cypher);
      else setNlError("model returned empty output");
    } catch (e) {
      setNlError((e as Error).message);
    }
  }

  return (
    <div
      style={{
        padding: "10px 16px 12px",
        borderBottom: `0.5px solid ${COL.border}`,
        background: "oklch(0.985 0.003 80)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: COL.textFaint,
            fontWeight: 600,
          }}
        >
          Cypher
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: COL.textFaint,
            fontStyle: "italic",
          }}
        >
          query the graph — labels: Event, Command, Saga, Projection, Effect,
          Policy · types: emits, reacts, sends
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setNlOpen((v) => !v)}
          title="Translate plain English to Cypher with a local LLM"
          style={{
            border: `0.5px solid ${nlOpen ? COL.accent : COL.border}`,
            background: nlOpen ? COL.accentSoft : "#fff",
            color: nlOpen ? COL.accentText : COL.textMuted,
            padding: "6px 10px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
            fontFamily: "inherit",
            fontWeight: nlOpen ? 600 : 400,
          }}
        >
          Ask in plain English
        </button>
      </div>

      {nlOpen && (
        <NLPanel
          text={nlText}
          setText={setNlText}
          onGenerate={runGenerate}
          status={llm.status}
          progress={llm.progress}
          fromCache={llm.fromCache}
          loadError={llm.error}
          generateError={nlError}
          onPreload={llm.load}
        />
      )}

      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="MATCH (e:Event)-[:reacts]->(s:Saga) RETURN e, s"
        rows={Math.max(2, value.split("\n").length)}
        style={{
          width: "100%",
          padding: "8px 10px",
          border: `0.5px solid ${error ? "oklch(0.6 0.18 25)" : COL.border}`,
          borderRadius: 4,
          background: "#fff",
          fontFamily: FONT_MONO,
          fontSize: 12,
          color: COL.text,
          outline: "none",
          resize: "vertical",
          lineHeight: 1.5,
          boxSizing: "border-box",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          letterSpacing: 0.3,
          minHeight: 14,
        }}
      >
        {error && (
          <span style={{ color: "oklch(0.5 0.18 25)" }}>
            ✗ {error}
          </span>
        )}
        {!error && value.trim() && matchCount !== null && (
          <span style={{ color: COL.textMuted }}>
            <span style={{ color: COL.text, fontWeight: 600 }}>
              {matchCount}
            </span>{" "}
            node{matchCount === 1 ? "" : "s"} match ·{" "}
            <span style={{ color: COL.text }}>{rowCount ?? 0}</span> row
            {rowCount === 1 ? "" : "s"}
          </span>
        )}
        {!error && !value.trim() && (
          <span style={{ color: COL.textFaint, fontStyle: "italic" }}>
            empty query — clear all filters and show full graph
          </span>
        )}
      </div>
    </div>
  );
}

interface NLPanelProps {
  text: string;
  setText: (v: string) => void;
  onGenerate: () => void;
  status: ReturnType<typeof useCypherLLM>["status"];
  progress: ReturnType<typeof useCypherLLM>["progress"];
  fromCache: boolean;
  loadError: string | null;
  generateError: string | null;
  onPreload: () => void;
}

function NLPanel({
  text,
  setText,
  onGenerate,
  status,
  progress,
  fromCache,
  loadError,
  generateError,
  onPreload,
}: NLPanelProps) {
  useEffect(() => {
    if (status === "idle") onPreload();
  }, [status, onPreload]);

  const busy = status === "loading" || status === "generating";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 10px",
        border: `0.5px dashed ${COL.border}`,
        borderRadius: 4,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!busy) onGenerate();
            }
          }}
          placeholder="e.g. events that any saga reacts to"
          style={{
            flex: 1,
            padding: "6px 9px",
            border: `0.5px solid ${COL.border}`,
            borderRadius: 4,
            background: COL.bg,
            fontFamily: "inherit",
            fontSize: 12,
            color: COL.text,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy || !text.trim()}
          style={{
            border: `0.5px solid ${COL.accent}`,
            background: busy || !text.trim() ? "#fff" : COL.accentSoft,
            color: busy || !text.trim() ? COL.textFaint : COL.accentText,
            padding: "5px 12px",
            borderRadius: 4,
            cursor: busy || !text.trim() ? "default" : "pointer",
            fontSize: 11,
            fontFamily: "inherit",
            fontWeight: 600,
            letterSpacing: 0.2,
            whiteSpace: "nowrap",
          }}
        >
          {status === "generating" ? "Generating…" : "Generate"}
        </button>
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: 0.3,
          color: COL.textFaint,
          minHeight: 12,
        }}
      >
        {status === "loading" && (
          progress?.percent != null && progress.percent >= 99.5 ? (
            <span>
              {fromCache ? "files restored from local cache" : "files downloaded"}{" "}
              · compiling model on{" "}
              {hasWebGPU() ? "WebGPU" : "WASM"}… (one-time per page load,
              ~10–30s)
            </span>
          ) : (
            <span>
              {fromCache ? "loading from local cache" : "downloading model"}
              {progress?.percent != null
                ? ` · ${Math.round(progress.percent)}%`
                : "…"}
              {progress?.file ? ` · ${shortFile(progress.file)}` : ""}
            </span>
          )
        )}
        {status === "ready" && !generateError && !loadError && (
          <span>
            model ready · runs locally in a Web Worker
            {fromCache ? " · cached" : ""}
          </span>
        )}
        {status === "generating" && <span>generating cypher…</span>}
        {(generateError || (status === "error" && loadError)) && (
          <span style={{ color: "oklch(0.5 0.18 25)" }}>
            ✗ {generateError || loadError}
          </span>
        )}
        {status === "idle" && (
          <span>warming up local LLM…</span>
        )}
      </div>
    </div>
  );
}

function shortFile(f: string): string {
  const parts = f.split("/");
  return parts[parts.length - 1] ?? f;
}

function hasWebGPU(): boolean {
  return typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined";
}
