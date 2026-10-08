import { useMemo, useState } from "react"
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExportIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  exportGraphToCypher,
  subgraphFromVisible,
} from "@/domain/cypher-export"
import type { GraphIndex } from "@/domain/graph"
import type { Node } from "@/domain/node"

type Format = "cypher"

const FORMATS: { value: Format; label: string; ext: string }[] = [
  { value: "cypher", label: "Cypher", ext: "cypher" },
]

interface ExportDialogProps {
  index: GraphIndex
  visibleNodes: Node[]
}

export function ExportDialog({ index, visibleNodes }: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<Format>("cypher")
  const [followFilters, setFollowFilters] = useState(true)
  const [copied, setCopied] = useState(false)

  const output = useMemo(() => {
    if (!open) return ""
    const graph = followFilters
      ? subgraphFromVisible(index.graph, visibleNodes)
      : index.graph
    return exportGraphToCypher(graph)
  }, [open, followFilters, index, visibleNodes])

  const counts = useMemo(() => {
    if (!open) return { nodes: 0, edges: 0 }
    const graph = followFilters
      ? subgraphFromVisible(index.graph, visibleNodes)
      : index.graph
    return { nodes: graph.nodes.length, edges: graph.edges.length }
  }, [open, followFilters, index, visibleNodes])

  const formatMeta = FORMATS.find((f) => f.value === format) ?? FORMATS[0]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const download = () => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `event-graph.${formatMeta.ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Export graph">
            <ExportIcon />
          </Button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export graph</DialogTitle>
          <DialogDescription>
            Export the graph in a format designed for graph databases.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">Format</span>
            <Select<Format>
              value={format}
              onValueChange={(value) => {
                if (value) setFormat(value)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue>
                  {(value) =>
                    FORMATS.find((f) => f.value === value)?.label ?? ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={followFilters}
              onCheckedChange={(checked) => setFollowFilters(checked === true)}
            />
            <span>Follow current filters</span>
          </label>

          <div className="flex flex-col gap-1">
            <span className="self-end font-mono text-xs text-muted-foreground">
              {counts.nodes} nodes · {counts.edges} edges
            </span>
            <pre className="max-h-72 overflow-auto bg-muted p-3 font-mono text-xs whitespace-pre-wrap text-foreground">
              {output}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="default" size="sm" onClick={download}>
            <DownloadIcon />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
