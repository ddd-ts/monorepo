export type Constructor<in Props = any, Result extends {} = {}> = new (
  props: Props,
) => Result;
export type AbstractConstructor<
  Props = any,
  Result extends {} = {},
> = abstract new (props: Props) => Result;

export type Trait<
  Factory extends <Base extends AbstractConstructor>(
    base: Base,
  ) => AbstractConstructor = any,
> = {
  factory: Factory;
  superTraits: readonly Trait<any>[];
};

type Explode<T> = { [P in keyof T]: T[P] };

export type UnionToIntersection<U> = (
  U extends any
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;

type MergeStaticSide<T extends readonly Trait[]> = UnionToIntersection<
  Explode<ReturnType<[...T][number]["factory"]>>
>;

export type MergeInstanceSide<T extends readonly Trait[]> = T extends []
  ? {}
  : T extends never[]
    ? {}
    : UnionToIntersection<InstanceType<ReturnType<[...T][number]["factory"]>>>;

export type MergeParameter<T extends readonly Trait[]> = T extends []
  ? {}
  : T extends never[]
    ? {}
    : ConstructorParameters<ReturnType<[...T][number]["factory"]>>[0] extends {}
      ? UnionToIntersection<
          ConstructorParameters<ReturnType<[...T][number]["factory"]>>[0]
        >
      : ConstructorParameters<ReturnType<[...T][number]["factory"]>>[0];

export type ApplyTraits<T extends readonly Trait[]> = {
  new (param: MergeParameter<T>): MergeInstanceSide<T>;
} & MergeStaticSide<T>;

export type CheckTraitRequirements<Traits extends readonly Trait[]> =
  CheckTraitRequirementsInternal<[], Traits>;

type CheckTraitRequirementsInternal<
  AppliedTraits extends readonly Trait[],
  RemainingTraits extends readonly Trait[],
> = RemainingTraits extends readonly [
  infer ApplyingTrait extends Trait,
  ...infer Rest extends Trait[],
]
  ? MergeParameter<AppliedTraits> extends MergeParameter<
      ApplyingTrait["superTraits"]
    >
    ? MergeInstanceSide<AppliedTraits> extends MergeInstanceSide<
        ApplyingTrait["superTraits"]
      >
      ? CheckTraitRequirementsInternal<[...AppliedTraits, ApplyingTrait], Rest>
      : {
          error: "Instance mismatch";
          check: "MergeInstanceSide<AppliedTraits> extends MergeInstanceSide<ApplyingTrait['superTraits']>";
          left: MergeInstanceSide<AppliedTraits>;
          right: MergeInstanceSide<ApplyingTrait["superTraits"]>;
          result: MergeInstanceSide<AppliedTraits> extends MergeInstanceSide<
            ApplyingTrait["superTraits"]
          >
            ? true
            : false;
        }
    : {
        error: "Parameter mismatch";
        check: "MergeParameter<AppliedTraits> extends MergeParameter<[ApplyingTrait]>";
        left: MergeParameter<AppliedTraits>;
        right: MergeParameter<[ApplyingTrait]>;
        result: MergeParameter<AppliedTraits> extends MergeParameter<
          [ApplyingTrait]
        >
          ? true
          : false;
      }
  : "success";

export function Subtrait<
  const SuperTraits extends readonly Trait[],
  Applied extends ApplyTraits<SuperTraits>,
  const Factory extends (
    base: Applied,
    props: ConstructorParameters<Applied>[0],
  ) => AbstractConstructor,
>(superTraits: SuperTraits, factory: Factory) {
  const symbol = Symbol();
  return {
    factory,
    superTraits,
    symbol,
  };
}

export type Props<T extends { __traits_props__: any } | Trait | Trait[]> =
  T extends {
    __traits_props__: any;
  }
    ? T["__traits_props__"]
    : T extends Trait
      ? MergeParameter<[T]>
      : T extends Trait[]
        ? MergeParameter<T>
        : never;

export function Derive<R extends Trait[], C extends CheckTraitRequirements<R>>(
  ...traits: R
): C extends "success"
  ? ApplyTraits<R> & { __traits__: R; __traits_props__: MergeParameter<R> }
  : C {
  let current: Constructor = class {};
  for (const trait of traits) {
    current = trait.factory(current);
  }

  for (const trait of traits) {
    (current as any)[(trait as any).symbol] = true;
  }

  return current as any;
}

export function WithDerivations<
  B extends AbstractConstructor<any>,
  R extends Trait[],
>(base: B, ...traits: R) {
  return Derive(
    Trait(() => base),
    ...traits,
  );
}

export const Trait = <
  T extends (
    base: AbstractConstructor<{}, {}>,
  ) => AbstractConstructor<any, any>,
>(
  factory: T,
) => {
  const symbol = Symbol();
  return { factory, superTraits: [] as Trait[], symbol };
};

export function implementsTrait<I extends InstanceType<any>, T extends Trait>(
  instance: I,
  trait: T,
): instance is ImplementsTrait<T> {
  return (instance as any).constructor[(trait as any).symbol] === true;
}

export type ConstructorWithTrait<T extends Trait> = Omit<
  ReturnType<T["factory"]>,
  ""
> &
  (new (
    ...args: any[]
  ) => ImplementsTrait<T>);

export type HasTrait<T extends Trait | ((...args: any[]) => Trait)> =
  T extends (...args: any[]) => Trait
    ? HasTrait<ReturnType<T>>
    : T extends Trait
      ? ConstructorWithTrait<T>
      : never;

export type ImplementsTrait<T extends Trait> = InstanceType<
  ReturnType<T["factory"]>
>;

export const WithProps = <P extends Record<string, any>>() =>
  Trait((base) => {
    class Intermediate extends base {}
    type I = typeof Intermediate extends new (
      ...args: infer A
    ) => infer T
      ? new (
          ...args: A
        ) => T & P
      : never;
    return Intermediate as typeof Intermediate & I;
  });
