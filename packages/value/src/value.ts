type ValueConstructor<S> = (new (
  value: RuntimeShape<S>
) => ValueInstance<S>) & {
  deserialize<T extends ValueConstructor<S>>(
    this: T,
    serialized: SerializedShape<S>
  ): InstanceType<T>;
  shape: S;
};

type ValueInstance<S> = {
  value: RuntimeShape<S>;
  serialize(): SerializedShape<S>;
};

export type SerializedShape<S> = S extends NumberConstructor
  ? number
  : S extends StringConstructor
  ? string
  : S extends BooleanConstructor
  ? boolean
  : S extends ValueConstructor<infer U>
  ? SerializedShape<U>
  : S extends Array<infer U>
  ? Array<SerializedShape<U>>
  : S extends readonly [...any[]]
  ? { [K in keyof S]: SerializedShape<S[K]> }
  : S extends Record<string, any>
  ? { [K in keyof S]: SerializedShape<S[K]> }
  : never;

type RuntimeShape<S> = S extends NumberConstructor
  ? number
  : S extends StringConstructor
  ? string
  : S extends BooleanConstructor
  ? boolean
  : S extends ValueConstructor<infer U> // this is not used but needed because typescript is broken
  ? InstanceType<S>
  : S extends Array<infer U>
  ? Array<RuntimeShape<U>>
  : S extends readonly [...any[]]
  ? { [K in keyof S]: RuntimeShape<S[K]> }
  : S extends Record<string, any>
  ? { [K in keyof S]: RuntimeShape<S[K]> }
  : never;

function serialize<S extends any>(
  shape: S,
  runtime: RuntimeShape<S>
): SerializedShape<S> {
  if (shape === Number) {
    return runtime as any;
  }

  if (shape === Boolean) {
    return runtime as any;
  }

  if (shape === String) {
    return runtime as any;
  }

  if ("serialize" in (runtime as any)) {
    return (runtime as any).serialize();
  }

  if (Array.isArray(shape)) {
    if (shape.length === 1) {
      return (runtime as any).map((element: any) =>
        serialize(shape[0] as any, element as any)
      ) as any;
    }

    throw new Error("handle tuples");
  }

  const serialized: any = {};
  for (const key in shape) {
    const subshape = shape[key];
    serialized[key] = serialize(subshape, (runtime as any)[key]);
  }
  return serialized;
}

function deserialize<S extends any>(
  shape: S,
  serialized: SerializedShape<S>
): RuntimeShape<S> {
  if (shape === Number) {
    return serialized as any;
  }

  if (shape === Boolean) {
    return serialized as any;
  }

  if (shape === String) {
    return serialized as any;
  }

  if ("deserialize" in (shape as any)) {
    return (shape as any).deserialize(serialized);
  }

  if (Array.isArray(shape)) {
    if (shape.length === 1) {
      return (serialized as any[]).map((element) =>
        deserialize(shape[0], element)
      ) as any;
    }

    throw new Error("handle tuples");
  }

  const deserialized: any = {};
  for (const key in shape) {
    const subshape: any = shape[key];
    deserialized[key] = deserialize(subshape, (serialized as any)[key]);
  }
  return deserialized;
}

export function Value<S>(shape: S): ValueConstructor<S> {
  class Intermediate implements ValueInstance<S> {
    static shape = shape;
    constructor(public readonly value: RuntimeShape<S>) {}

    serialize(): SerializedShape<S> {
      return serialize(shape, this.value);
    }

    static deserialize<T extends ValueConstructor<S>>(
      this: T,
      serialized: SerializedShape<S>
    ) {
      return new this(deserialize(shape, serialized)) as InstanceType<T>;
    }

    ensureValidity() {}
  }

  return Intermediate;
}
