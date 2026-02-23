import type { Divergence, Expand, IsNever } from "../divergence/divergence";

type FreezeParameters<T, NAME extends string> = {
  type: T;
  name: NAME;
  filename?: string;
  extension?: string;
}

export function freeze<
  T extends FreezeParameters<any, string>,
  FROZEN = never,
>(
  ..._args: Divergence<T['type'], NoInfer<FROZEN>> extends infer D
    ? IsNever<D> extends true
    ? [{}]
    : [Expand<D>]
    : [{}]
) { }
