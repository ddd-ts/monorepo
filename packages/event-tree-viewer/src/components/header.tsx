import type { GraphIndex } from "@/domain/graph";

export function Header({ index }: { index: GraphIndex }) {
  const { graph } = index;
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold">Event Tree Viewer</h1>
      </div>
      <div className="text-muted-foreground font-mono text-xs">
        {graph.nodes.length} nodes · {graph.edges.length} edges
      </div>
    </header>
  );
}
