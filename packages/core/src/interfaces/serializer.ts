export type PromiseOr<T> = T | Promise<T>;

export abstract class ISerializer<T> {
  abstract serialize(value: T): PromiseOr<{ version: number }>;
  abstract deserialize(value: { version: number }): PromiseOr<T>;
}

export type Serialized<T extends { serialize(...args: any[]): any }> = Awaited<
  ReturnType<T["serialize"]>
>;
