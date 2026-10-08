import { CaretDownIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { NodeBadge } from "@/components/node-badge"
import { NODE_KINDS, type NodeKind } from "@/domain/node"
import type { FiltersApi } from "@/application/use-filters"

export function KindFilter({ filters }: { filters: FiltersApi }) {
  const selected = filters.filter.kinds
  const label = buildLabel(selected)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <span>{label}</span>
            <CaretDownIcon data-icon="inline-end" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-56 p-1">
        <ul className="flex flex-col">
          {NODE_KINDS.map((kind) => (
            <li key={kind}>
              <KindOption
                kind={kind}
                checked={selected.has(kind)}
                onToggle={() => filters.toggleKind(kind)}
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function KindOption({
  kind,
  checked,
  onToggle,
}: {
  kind: NodeKind
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm transition-colors hover:bg-muted hover:text-foreground">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <NodeBadge kind={kind} />
      <span className="capitalize">{kind}</span>
    </label>
  )
}

function buildLabel(selected: ReadonlySet<NodeKind>): string {
  if (selected.size === NODE_KINDS.length) return "All kinds"
  if (selected.size === 0) return "No kinds"
  if (selected.size === 1) {
    const only = [...selected][0]
    return only[0].toUpperCase() + only.slice(1)
  }
  return `${selected.size} kinds`
}
