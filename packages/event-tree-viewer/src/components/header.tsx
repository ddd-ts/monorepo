import { SettingsMenu } from "@/components/settings-menu";
import type { GraphIndex } from "@/domain/graph";
import type { SettingsApi } from "@/application/use-settings";

export function Header({
  index,
  settings,
}: {
  index: GraphIndex;
  settings: SettingsApi;
}) {
  const { graph } = index;
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-foreground text-base font-bold tracking-tight">
          DDD-TS
        </span>
        <span className="text-muted-foreground/70">·</span>
        <h1 className="text-muted-foreground text-sm font-medium tracking-tight">
          Event Tree Viewer
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground font-mono text-xs tracking-wide">
          {graph.nodes.length} nodes · {graph.edges.length} edges
        </span>
        <SettingsMenu settings={settings} />
      </div>
    </header>
  );
}
