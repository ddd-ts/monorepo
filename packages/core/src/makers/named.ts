import { Trait } from "@ddd-ts/traits";

export const Named = <const Name extends string>(name: Name) =>
  Trait(
    (base) =>
      class $Named extends base {
        static $name = name;
        name = name;
      },
  );
