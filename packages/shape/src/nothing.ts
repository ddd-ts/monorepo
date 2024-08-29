import { AbstractConstructor, Constructor, Definition, Empty } from "./_";

export type NothingShorthand = undefined;

export const Nothing = <B extends AbstractConstructor<{}> = typeof Empty>(
  config: void,
  base: B = Empty as any,
) => {
  abstract class $Nothing extends (base as any as Constructor<{}>) {
    static $shape = "nothing" as const;

    serialize() {}
    static deserialize<T extends Constructor>(
      this: T,
      value: void,
    ): InstanceType<T> {
      return new (this as any)();
    }
    static $deserialize() {}
    static $serialize() {}
    static $inline: void;
  }

  type NothingConstructor = abstract new (
    value: void,
  ) => InstanceType<B> & $Nothing;

  type Nothing = Omit<B, "prototype"> &
    Omit<typeof $Nothing, ""> &
    NothingConstructor;

  return $Nothing as Nothing;
};
