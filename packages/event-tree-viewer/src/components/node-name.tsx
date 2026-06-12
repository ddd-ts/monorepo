import { DotsThreeIcon } from "@phosphor-icons/react"
import { isJustKind, stripDomainAffix } from "@/domain/domain-grouping"

interface NodeNameProps {
  name: string
  kind: string
  domainPrefix: string
  hide: boolean
  allowEmpty?: boolean
  metaClass?: string
}

export function NodeName({
  name,
  kind,
  domainPrefix,
  hide,
  allowEmpty = false,
  metaClass = "text-xs",
}: NodeNameProps) {
  const dotIdx = name.indexOf(".")
  const head = dotIdx >= 0 ? name.slice(0, dotIdx) : name
  const tail = dotIdx >= 0 ? name.slice(dotIdx) : ""
  const methodTag = tail ? (
    <span className={`font-mono ${metaClass} text-muted-foreground`}>
      {tail}
    </span>
  ) : null

  if (!hide) {
    return (
      <span className="font-medium">
        {head}
        {methodTag}
      </span>
    )
  }
  const { stripped, position } = stripDomainAffix(
    head,
    domainPrefix,
    allowEmpty || tail !== ""
  )
  if (position === null) {
    return (
      <span className="font-medium">
        {head}
        {methodTag}
      </span>
    )
  }
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
      {methodTag}
    </span>
  )
}
