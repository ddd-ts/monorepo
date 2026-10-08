import type { ReactNode } from "react"
import { CaretRightIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface DomainHeaderProps {
  label: string
  expanded: boolean
  onToggle: () => void
  meta?: ReactNode
  className?: string
}

export function DomainHeader({
  label,
  expanded,
  onToggle,
  meta,
  className,
}: DomainHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex h-full min-h-9 w-full items-center gap-2 px-1 py-2 text-left transition-colors hover:bg-muted/30",
        className
      )}
    >
      <CaretRightIcon
        className={`size-3 shrink-0 text-muted-foreground transition-transform ${
          expanded ? "rotate-90" : ""
        }`}
      />
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {meta && (
        <span className="font-mono text-xs font-normal text-muted-foreground">
          {meta}
        </span>
      )}
    </button>
  )
}
