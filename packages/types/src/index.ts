export type AbstractConstructor<
  T = any,
  P extends any[] = any[],
> = abstract new (...args: P) => T;

export type Constructor<T = any, P extends any[] = any[]> = new (
  ...args: P
) => T;
