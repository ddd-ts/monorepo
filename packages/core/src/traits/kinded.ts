import { AbstractConstructor, Trait } from "@ddd-ts/traits";
import { IKinded } from "../interfaces/kinded";

export const Kinded = <const Kind extends string>(kind: Kind) =>
  Trait((base) => ExtendsKinded(kind, base));

export const ExtendsKinded = <const Kind extends string>(
  kind: Kind,
  base: AbstractConstructor<{}, {}>,
) => {
  abstract class $Kinded extends base implements IKinded<Kind> {
    static $kind = kind;
    $kind = kind;

    /**
     * @deprecated use $kind instead
     */
    name = kind;
  }

  return $Kinded;
};
