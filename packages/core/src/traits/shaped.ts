import { Dict, Shape, type DictShorthand } from "@ddd-ts/shape";
import { Trait } from "@ddd-ts/traits";
import { ExtendsKinded } from "./kinded";

export const Shaped = <S extends DictShorthand>(shape: S) =>
  Trait((base) => Shape(shape, base));

export const KindedShaped = <
  const Kind extends string,
  S extends DictShorthand,
>(
  kind: Kind,
  shape: S,
) => Trait((base) => Dict(shape, ExtendsKinded(kind, base)));
