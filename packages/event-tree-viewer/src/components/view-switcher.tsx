import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ViewMode, ViewModeApi } from "@/application/use-view-mode"

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "tree", label: "Tree" },
  { value: "list", label: "List" },
  { value: "graph", label: "Graph" },
]

export function ViewSwitcher({ view }: { view: ViewModeApi }) {
  return (
    <ToggleGroup
      value={[view.view]}
      onValueChange={(next) => {
        const picked = next[0] as ViewMode | undefined
        if (picked) view.setView(picked)
      }}
      variant="outline"
      size="sm"
    >
      {VIEWS.map((v) => (
        <ToggleGroupItem key={v.value} value={v.value}>
          {v.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
