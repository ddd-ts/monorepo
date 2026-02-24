import { Class, type IClass, type ClassShorthand } from "./class";
import { Dict, type IDict, type DictShorthand } from "./dict";
import { Primitive, type PrimitiveShorthand } from "./primitive";
import { Multiple, type IMultiple, type MultipleShorthand } from "./multiple";
import { Nothing, type NothingShorthand } from "./nothing";
import { Literal, type ILiteral, type LiteralShorthand } from "./literal";

export abstract class Empty {}

export interface Constructor<T = any, P extends any[] = any[]> {
  new (...args: P): T;
}
export type AbstractConstructor<
  T = any,
  P extends any[] = any[],
> = abstract new (...args: P) => T;

export interface Definition {
  $shape: string;
  $inline: any;
  $serialize(value: any): any;
  $deserialize(value: any): any;
}

export type MakeAbstract<T> = T extends new (
  ...params: infer P
) => infer R
  ? Omit<T, ""> & (abstract new (...params: P) => R)
  : never;

export type Concrete<T extends AbstractConstructor<any>> =
  T extends abstract new (
    ...params: infer P
  ) => infer R
    ? Omit<T, ""> & {
        new (...params: P): R;
      }
    : never;

export type Shorthand =
  | Definition
  | DictShorthand
  | PrimitiveShorthand
  | MultipleShorthand
  | NothingShorthand
  | ClassShorthand
  | LiteralShorthand;

export type DefinitionOf<
  T extends Shorthand | Definition,
  B extends AbstractConstructor<{}> = typeof Empty,
> = T extends LiteralShorthand
  ? ILiteral<T, B>
  : T extends undefined
    ? ReturnType<typeof Nothing<B>>
    : T extends PrimitiveShorthand
      ? ReturnType<typeof Primitive<T, B>>
      : T extends MultipleShorthand
        ? IMultiple<T[0], B>
        : T extends ClassShorthand
          ? IClass<T, B>
          : T extends Definition
            ? T
            : T extends DictShorthand
              ? IDict<T, B>
              : never;

export function Shape<
  const S extends Definition | Shorthand,
  B extends AbstractConstructor<{}> = typeof Empty,
>(shorthand: S, base: B = Empty as any): DefinitionOf<S, B> {
  if (typeof shorthand === "string" || typeof shorthand === "number") {
    return Literal(shorthand, base) as any;
  }

  if (
    shorthand &&
    "$shape" in shorthand &&
    "name" in shorthand &&
    typeof shorthand.name === "string"
  ) {
    if ((shorthand as any).name.startsWith("$")) {
      return shorthand as any;
    }
    return Class(shorthand as any, base) as any;
  }
  if (shorthand === undefined) {
    return Nothing(undefined, base) as any;
  }
  if ([String, Number, Date, Boolean].includes(shorthand as any)) {
    return Primitive(shorthand as any, base) as any;
  }
  if (shorthand && "prototype" in shorthand) {
    return Class(shorthand as any, base) as any;
  }

  if (Array.isArray(shorthand)) {
    return (Multiple as any)(shorthand[0] as any, base);
  }

  if (typeof shorthand === "object") {
    return Dict(shorthand as any, base) as any;
  }

  throw new Error(
    `Could not determine longhand from shorthand ${JSON.stringify(shorthand)}`,
  );
}

export type Expand<T> = T extends { serialize(): any }
  ? T
  : T extends Date
    ? T
    : T extends Record<string, any>
      ? { [key in keyof T]: Expand<T[key]> }
      : T;

export function forward<
  T extends AbstractConstructor<{ value: any }>,
  const Forward extends T extends AbstractConstructor<{ value: infer U }>
    ? (keyof U)[]
    : never,
>(
  base: T,
  forward: Forward,
): MakeAbstract<
  T &
    (new (
      ...args: ConstructorParameters<T>
    ) => InstanceType<T> & {
      [K in Forward[number]]: InstanceType<T>["value"][K];
    })
> {
  for (const key of forward) {
    Object.defineProperty(base.prototype, key, {
      get() {
        return (this.value as any)[key].bind(this.value);
      },
    });
  }
  return base as any;
}

export type MergeClasses<
  B extends AbstractConstructor,
  Current extends AbstractConstructor,
> = abstract new (
  ...args: ConstructorParameters<Current>
) => InstanceType<B> & InstanceType<Current>;
