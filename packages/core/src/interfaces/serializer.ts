export type PromiseOr<T> = T | Promise<T>;

export abstract class ISerializer<T, S = {}> {
  abstract serialize(value: T): PromiseOr<{ version: number } & S>;
  abstract deserialize(value: unknown): PromiseOr<T>;
}

export type Serialized<T extends { serialize(...args: any[]): any }> = Awaited<
  ReturnType<T["serialize"]>
>;
