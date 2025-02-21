import { Dict, Shape, type DictShorthand } from "@ddd-ts/shape";
import { Trait } from "@ddd-ts/traits";
import { ExtendsNamed } from "./named";

export const Shaped = <S extends DictShorthand>(shape: S) =>
  Trait((base) => Shape(shape, base));

export const NamedShape = <
  const Name extends string,
  S extends DictShorthand,
>(
  name: Name,
  shape: S,
) => Trait((base) => Dict(shape, ExtendsNamed(name, base)));
