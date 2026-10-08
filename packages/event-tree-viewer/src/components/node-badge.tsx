import { Badge } from "@/components/ui/badge"
import type { NodeKind } from "@/domain/node"

const STYLES: Record<NodeKind, string> = {
  event: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  command: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  saga: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  aggregate:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  projection: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
}

export function NodeBadge({ kind }: { kind: NodeKind }) {
  return (
    <Badge variant="secondary" className={STYLES[kind]}>
      {kind}
    </Badge>
  )
}
