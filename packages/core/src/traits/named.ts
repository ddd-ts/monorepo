import { AbstractConstructor, Trait } from "@ddd-ts/traits";
import { INamed } from "../interfaces/named";

export const Named = <const Name extends string>(name: Name) =>
  Trait((base) => ExtendsNamed(name, base));

export const ExtendsNamed = <const Name extends string>(
  name: Name,
  base: AbstractConstructor<{}, {}>,
) => {
  abstract class $Named extends base implements INamed<Name> {
    static $name = name;
    $name = name;
  }

  return $Named;
};
