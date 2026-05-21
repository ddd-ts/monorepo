import { useMemo } from "react"
import { ArrowSquareOutIcon } from "@phosphor-icons/react"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { NodeBadge } from "@/components/node-badge"
import { nodeId, type GraphIndex, type NodeId } from "@/domain/graph"
import type { Node } from "@/domain/node"
import { edgeKind, type Edge } from "@/domain/edge"
import { trpc } from "@/application/trpc-client"

async function openInEditor(source: { file: string; start: number }) {
  try {
    await trpc.editor.open.mutate({ file: source.file, offset: source.start })
  } catch (error) {
    console.warn(`[open-in-editor] ${(error as Error).message}`)
  }
}

interface InspectorProps {
  index: GraphIndex
  selectedId: NodeId
  onSelect: (id: NodeId) => void
  onClose: () => void
}

export function Inspector({
  index,
  selectedId,
  onSelect,
  onClose,
}: InspectorProps) {
  const node = index.nodesById.get(selectedId)
  const outgoing = useMemo(
    () => index.outgoing.get(selectedId) ?? [],
    [index, selectedId]
  )
  const incoming = useMemo(
    () => index.incoming.get(selectedId) ?? [],
    [index, selectedId]
  )

  if (!node) return null

  return (
    <aside className="surface-elevated flex h-full w-96 shrink-0 flex-col border-l bg-card">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <NodeBadge kind={node.type} />
          <span className="truncate text-sm font-semibold">{node.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="shrink-0"
        >
          Close
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-5 py-4">
          <Meta node={node} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => openInEditor(node.source)}
            className="w-full justify-start gap-2"
          >
            <ArrowSquareOutIcon />
            Open in editor
          </Button>
          <Separator />
          <Section
            title={`Incoming (${incoming.length})`}
            edges={incoming}
            direction="in"
            onSelect={onSelect}
          />
          <Separator />
          <Section
            title={`Outgoing (${outgoing.length})`}
            edges={outgoing}
            direction="out"
            onSelect={onSelect}
          />
        </div>
      </ScrollArea>
    </aside>
  )
}

function Meta({ node }: { node: Node }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">Name</dt>
      <dd className="font-mono break-all">{node.name}</dd>
      {"meta" in node && "alias" in node.meta && (
        <>
          <dt className="text-muted-foreground">Alias</dt>
          <dd className="font-mono break-all">{node.meta.alias}</dd>
        </>
      )}
      {"meta" in node && "base" in node.meta && (
        <>
          <dt className="text-muted-foreground">Base</dt>
          <dd className="font-mono break-all">{node.meta.base}</dd>
        </>
      )}
      <dt className="text-muted-foreground">File</dt>
      <dd className="font-mono text-xs break-all">{node.source.file}</dd>
      <dt className="text-muted-foreground">Offset</dt>
      <dd className="font-mono text-xs">{node.source.start}</dd>
    </dl>
  )
}

function Section({
  title,
  edges,
  direction,
  onSelect,
}: {
  title: string
  edges: Edge[]
  direction: "in" | "out"
  onSelect: (id: NodeId) => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {edges.length === 0 && (
        <p className="text-sm text-muted-foreground">None</p>
      )}
      <ul className="flex flex-col gap-1">
        {edges.map((edge, idx) => (
          <li key={idx}>
            <EdgeRow edge={edge} direction={direction} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function EdgeRow({
  edge,
  direction,
  onSelect,
}: {
  edge: Edge
  direction: "in" | "out"
  onSelect: (id: NodeId) => void
}) {
  const peer = direction === "in" ? edge.from : edge.to
  const peerId = nodeId(peer.type, peer.name)
  const dotIdx = peer.name.indexOf(".")
  const head = dotIdx >= 0 ? peer.name.slice(0, dotIdx) : peer.name
  const tail = dotIdx >= 0 ? peer.name.slice(dotIdx) : ""

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSelect(peerId)}
      className="h-auto w-full justify-start gap-2 overflow-hidden px-2 py-1.5 text-sm font-normal"
    >
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {edgeKind(edge)}
      </span>
      <NodeBadge kind={peer.type} />
      <span className="min-w-0 truncate">
        <span className="font-medium">{head}</span>
        {tail && (
          <span className="font-mono text-xs text-muted-foreground">
            {tail}
          </span>
        )}
      </span>
    </Button>
  )
}
