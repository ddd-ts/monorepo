import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Direction } from "@/domain/direction"
import type { DirectionApi } from "@/application/use-direction"

const OPTIONS: { value: Direction; label: string }[] = [
  { value: "forward", label: "Forward" },
  { value: "reverse", label: "Reverse" },
]

export function DirectionToggle({ direction }: { direction: DirectionApi }) {
  return (
    <ToggleGroup
      value={[direction.direction]}
      onValueChange={(next) => {
        const picked = next[0] as Direction | undefined
        if (picked) direction.setDirection(picked)
      }}
      variant="outline"
      size="sm"
    >
      {OPTIONS.map((opt) => (
        <ToggleGroupItem key={opt.value} value={opt.value}>
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
