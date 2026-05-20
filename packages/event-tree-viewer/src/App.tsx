import { useGraph } from "@/application/use-graph";
import { useFilters } from "@/application/use-filters";
import { useSelection } from "@/application/use-selection";
import { useViewMode } from "@/application/use-view-mode";
import { useDirection } from "@/application/use-direction";
import { useDomains } from "@/application/use-domains";
import { useSettings } from "@/application/use-settings";
import { useExpansion } from "@/application/use-expansion";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { FilterBar } from "@/components/filter-bar";
import { ViewSwitcher } from "@/components/view-switcher";
import { DirectionToggle } from "@/components/direction-toggle";
import { Inspector } from "@/components/inspector";
import { ListView } from "@/components/views/list-view";
import { TreeView } from "@/components/views/tree-view";

export function App() {
  const { index, status, error, refetch } = useGraph();
  const domains = useDomains(index);
  const filters = useFilters(index);
  const selection = useSelection();
  const viewMode = useViewMode();
  const direction = useDirection();
  const settings = useSettings();
  const expansion = useExpansion();

  return (
    <div className="bg-background flex h-svh flex-col">
      <Header index={index} settings={settings} />
      <FilterBar filters={filters} />
      <div className="flex items-center justify-between gap-3 border-b px-6 py-2">
        <ViewSwitcher view={viewMode} />
        {viewMode.view === "tree" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-px">
              <Button
                variant="outline"
                size="sm"
                onClick={expansion.expandAll}
              >
                Expand
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={expansion.collapseAll}
              >
                Collapse
              </Button>
            </div>
            <DirectionToggle direction={direction} />
          </div>
        )}
      </div>

      <main className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {status === "loading" && (
            <p className="text-muted-foreground px-6 py-4 text-sm">Scanning project…</p>
          )}
          {status === "error" && (
            <div className="px-6 py-4 text-sm">
              <p className="text-destructive">Failed to load graph: {error}</p>
              <button
                type="button"
                onClick={refetch}
                className="text-muted-foreground mt-2 underline"
              >
                Retry
              </button>
            </div>
          )}
          {status === "ready" && viewMode.view === "list" && (
            <ListView
              nodes={filters.visibleNodes}
              selectedId={selection.selectedId}
              onSelect={selection.select}
            />
          )}
          {status === "ready" && viewMode.view === "tree" && (
            <TreeView
              index={index}
              visibleNodes={filters.visibleNodes}
              domains={domains}
              direction={direction.direction}
              settings={settings.settings}
              expansion={expansion}
              selectedId={selection.selectedId}
              onSelect={selection.select}
            />
          )}
        </div>
        {selection.selectedId && (
          <Inspector
            index={index}
            selectedId={selection.selectedId}
            onSelect={selection.select}
            onClose={selection.clear}
          />
        )}
      </main>
    </div>
  );
}

export default App;
