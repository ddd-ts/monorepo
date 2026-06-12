import { Activity } from "react"
import { useGraph } from "@/application/use-graph"
import { useFilters } from "@/application/use-filters"
import { useSelection } from "@/application/use-selection"
import { useViewMode } from "@/application/use-view-mode"
import { useDirection } from "@/application/use-direction"
import { useDomains } from "@/application/use-domains"
import { useSettings } from "@/application/use-settings"
import { useExpansion } from "@/application/use-expansion"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { FilterBar } from "@/components/filter-bar"
import { ViewSwitcher } from "@/components/view-switcher"
import { DirectionToggle } from "@/components/direction-toggle"
import { Inspector } from "@/components/inspector"
import { ListView } from "@/components/views/list-view"
import { TreeView } from "@/components/views/tree-view"
import { GraphView } from "@/components/views/graph-view"

export function App() {
  const { index, status, error, refetch } = useGraph()
  const domains = useDomains(index)
  const direction = useDirection()
  const filters = useFilters(index)
  const selection = useSelection()
  const viewMode = useViewMode()
  const settings = useSettings()
  const expansion = useExpansion()

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header
        index={index}
        visibleNodes={filters.visibleNodes}
        settings={settings}
      />
      <FilterBar filters={filters} />
      <div className="flex items-center justify-between gap-3 border-b px-6 py-2">
        <ViewSwitcher view={viewMode} />
        {viewMode.view === "tree" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-px">
              <Button variant="outline" size="sm" onClick={expansion.expandAll}>
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
        {viewMode.view === "graph" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-px">
              <Button variant="outline" size="sm" onClick={expansion.expandAll}>
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
            <p className="px-6 py-4 text-sm text-muted-foreground">
              Scanning project…
            </p>
          )}
          {status === "error" && (
            <div className="px-6 py-4 text-sm">
              <p className="text-destructive">Failed to load graph: {error}</p>
              <button
                type="button"
                onClick={refetch}
                className="mt-2 text-muted-foreground underline"
              >
                Retry
              </button>
            </div>
          )}
          {status === "ready" && (
            <>
              <Activity
                mode={viewMode.view === "list" ? "visible" : "hidden"}
                name="list-view"
              >
                <ListView
                  nodes={filters.visibleNodes}
                  selectedId={selection.selectedId}
                  onSelect={selection.select}
                />
              </Activity>
              <Activity
                mode={viewMode.view === "tree" ? "visible" : "hidden"}
                name="tree-view"
              >
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
              </Activity>
              <Activity
                mode={viewMode.view === "graph" ? "visible" : "hidden"}
                name="graph-view"
              >
                <GraphView
                  index={index}
                  visibleNodes={filters.visibleNodes}
                  domains={domains}
                  direction={direction.direction}
                  settings={settings.settings}
                  expansion={expansion}
                  selectedId={selection.selectedId}
                  onSelect={selection.select}
                />
              </Activity>
            </>
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
  )
}

export default App
