import { DotsThreeIcon } from "@phosphor-icons/react"
import { isJustKind, stripDomainAffix } from "@/domain/domain-grouping"

interface NodeNameProps {
  name: string
  kind: string
  domainPrefix: string
  hide: boolean
  allowEmpty?: boolean
}

export function NodeName({
  name,
  kind,
  domainPrefix,
  hide,
  allowEmpty = false,
}: NodeNameProps) {
  if (!hide) return <span className="font-medium">{name}</span>
  const { stripped, position } = stripDomainAffix(name, domainPrefix, allowEmpty)
  if (position === null) return <span className="font-medium">{name}</span>
  const visible = isJustKind(stripped, kind) ? "" : stripped
  const ellipsis = (
    <DotsThreeIcon
      className="inline size-3 align-middle text-muted-foreground"
      aria-label={name}
    />
  )
  return (
    <span className="font-medium" title={name}>
      {position === "prefix" && ellipsis}
      {visible}
      {position === "suffix" && ellipsis}
    </span>
  )
}
