import { useCallback, useState } from "react"
import type { Direction } from "@/domain/direction"

export interface DirectionApi {
  direction: Direction
  setDirection: (d: Direction) => void
  toggle: () => void
}

export function useDirection(initial: Direction = "forward"): DirectionApi {
  const [direction, setDirection] = useState<Direction>(initial)
  const set = useCallback((d: Direction) => setDirection(d), [])
  const toggle = useCallback(
    () => setDirection((d) => (d === "forward" ? "reverse" : "forward")),
    []
  )
  return { direction, setDirection: set, toggle }
}
