import { useEffect, useMemo, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { NodeBadge } from "@/components/node-badge"
import { NODE_KINDS, type Node, type NodeKind } from "@/domain/node"
import { nodeId, type NodeId } from "@/domain/graph"

interface ListViewProps {
  nodes: Node[]
  selectedId: NodeId | null
  onSelect: (id: NodeId) => void
}

export function ListView({ nodes, selectedId, onSelect }: ListViewProps) {
  const grouped = useMemo(() => groupByKind(nodes), [nodes])
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!selectedId) return
    const root = rootRef.current
    if (!root) return
    const el = root.querySelector<HTMLElement>(
      `[data-node-id="${cssEscape(selectedId)}"]`
    )
    el?.scrollIntoView({ block: "center", behavior: "auto" })
  }, [selectedId, nodes])

  return (
    <ScrollArea ref={rootRef} className="h-full">
      <div className="flex flex-col gap-4 px-6 py-4">
        {NODE_KINDS.map((kind) => {
          const items = grouped.get(kind) ?? []
          if (!items.length) return null
          return (
            <section key={kind} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {kind} ({items.length})
              </h2>
              <ul className="flex flex-col gap-1">
                {items.map((node) => (
                  <NodeRow
                    key={`${node.type}:${node.name}`}
                    node={node}
                    selected={selectedId === nodeId(node.type, node.name)}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </section>
          )
        })}
        {!nodes.length && (
          <p className="text-sm text-muted-foreground">No matching nodes.</p>
        )}
      </div>
    </ScrollArea>
  )
}

function NodeRow({
  node,
  selected,
  onSelect,
}: {
  node: Node
  selected: boolean
  onSelect: (id: NodeId) => void
}) {
  const id = nodeId(node.type, node.name)
  return (
    <li>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSelect(id)}
        aria-pressed={selected}
        data-node-id={id}
        className={`h-auto w-full justify-start gap-3 px-3 py-2 text-sm font-normal ${
          selected ? "bg-muted" : ""
        }`}
      >
        <NodeBadge kind={node.type} />
        <span className="font-medium">{node.name}</span>
        {"meta" in node &&
          "alias" in node.meta &&
          node.meta.alias !== node.name && (
            <span className="font-mono text-xs text-muted-foreground">
              {node.meta.alias}
            </span>
          )}
      </Button>
    </li>
  )
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(value)
    : value.replace(/(["\\])/g, "\\$1")
}

function groupByKind(nodes: Node[]): Map<NodeKind, Node[]> {
  const out = new Map<NodeKind, Node[]>()
  for (const node of nodes) {
    const list = out.get(node.type) ?? []
    list.push(node)
    out.set(node.type, list)
  }
  return out
}
