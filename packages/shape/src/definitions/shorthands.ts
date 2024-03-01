import { IsShapeConstructor } from "../mixins/objectShape";
import { ChildDefinition, ChildShorthand } from "./child";
import { Definition } from "./definition";
import { DictShorthand, DictDefinition } from "./dict";
import {
  SerializableClassConfiguration,
  SerializableClassDefinition,
  SerializableClassShorthand,
} from "./serializableClass";
import {
  LiteralShorthand,
  LiteralDefinition,
} from "./literal";
import { MultipleDefinition, MultipleShorthand } from "./multiple";
import { StringEnumDefinition, StringEnumShorthand } from "./stringEnum";
import { EitherDefinition } from "./either";
import { OptionalDefinition } from "./optional";
import { TupleDefinition } from "./tuple";
import { NothingDefinition, NothingShorthand } from "./nothing";

export type AnyShorthand =
  | LiteralShorthand
  | DictShorthand
  | MultipleShorthand
  | ChildShorthand
  | SerializableClassShorthand
  | StringEnumShorthand
  | NothingShorthand;

export type AnyDefinition =
  | ChildDefinition
  | SerializableClassDefinition
  | DictDefinition
  | EitherDefinition
  | LiteralDefinition
  | MultipleDefinition
  | OptionalDefinition
  | StringEnumDefinition
  | TupleDefinition
  | NothingDefinition;

export type ShorthandToLonghand<T> = T extends undefined
  ? NothingDefinition
  : T extends IsShapeConstructor<Definition>
    ? ChildDefinition<T>
    : T extends SerializableClassConfiguration
      ? SerializableClassDefinition<T>
      : T extends Definition
        ? T
        : T extends typeof String
          ? LiteralDefinition<T>
          : T extends typeof Number
            ? LiteralDefinition<T>
            : T extends typeof Boolean
              ? LiteralDefinition<T>
              : T extends typeof Date
                ? LiteralDefinition<T>
                : T extends [...infer C extends string[]]
                  ? StringEnumDefinition<C>
                  : T extends [infer C]
                    ? MultipleDefinition<ShorthandToLonghand<C>>
                    : T extends Record<string, any>
                      ? DictDefinition<{
                          [k in keyof T]: ShorthandToLonghand<T[k]>;
                        }>
                      : never;
