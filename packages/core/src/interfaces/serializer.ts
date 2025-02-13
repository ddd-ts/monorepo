export type PromiseOr<T> = T | Promise<T>;

export interface ISerializer<T, S = {}> {
  serialize(value: T): PromiseOr<{ version: number } & S>;
  deserialize(value: unknown): PromiseOr<T>;
}

export type Serialized<T extends { serialize(...args: any[]): any }> = Awaited<
  ReturnType<T["serialize"]>
>;
