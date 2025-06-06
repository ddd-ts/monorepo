import { AutoSerializable, Serialized } from "@ddd-ts/core";
import { Constructor } from "@ddd-ts/types";

abstract class SerializableMap<
  K extends InstanceType<AutoSerializable>,
  V extends InstanceType<AutoSerializable>,
> {
  abstract KEY: Constructor<K>;
  abstract VALUE: Constructor<V>;

  map = new Map<string, V>();

  constructor(entries?: Array<[K, V]> | Array<readonly [K, V]>) {
    this.map = new Map(entries?.map(([k, v]) => [k.serialize(), v]) ?? []);
  }

  new<TH extends SerializableMap<K, V>>() {
    return new (this.constructor as Constructor<TH>)();
  }

  get size() {
    return this.map.size;
  }

  isEmpty() {
    return this.size === 0;
  }

  has(key: K) {
    return this.map.has(key.serialize());
  }

  get(key: K) {
    return this.map.get(key.serialize());
  }

  list(keys: K[]) {
    return keys.map((k) => this.map.get(k.serialize())).filter((k) => !!k);
  }

  set(key: K, value: V) {
    this.map.set(key.serialize(), value);
    return this;
  }

  delete(key: K) {
    this.map.delete(key.serialize());
    return this;
  }

  clear() {
    this.map.clear();
  }

  keys() {
    return Array.from(this.map.keys()).map((k) => new this.KEY(k));
  }

  values() {
    return Array.from(this.map.values());
  }

  entries() {
    return Array.from(this.map.entries()).map(
      ([k, v]) => [new this.KEY(k), v] as const,
    );
  }

  mapValues<U>(fn: (value: V, key: K) => U) {
    return Array.from(this.map.entries()).reduce<Record<string, U>>(
      (acc, [k, v]) => {
        acc[k] = fn(v, new this.KEY(k));
        return acc;
      },
      {},
    );
  }

  toPlainObject() {
    return Object.fromEntries(this.map.entries());
  }

  serialize() {
    return this.entries().reduce<Record<string, Serialized<V>>>(
      (acc, [k, v]) => {
        acc[k.serialize()] = v.serialize();
        return acc;
      },
      {},
    );
  }

  *[Symbol.iterator]() {
    yield* this.map.entries();
  }
}

function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn: (...args: any[]) => string,
): T {
  const cache = new Map<string, ReturnType<T>>();
  //@ts-ignore
  return (...args: Parameters<T>) => {
    const key = keyFn(...args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const value = fn(...args);
    cache.set(key, value);
    return value;
  };
}

/**
 * For multiple instances of IdMap.for(SomeIdA, SomeIdB, [])
 * to work with jest expect().toEqual() matcher,
 * we need to memoize the IdSpecificMap class
 * so the constructor strict equality is preserved.
 */
const makeIdMap = memoize(
  <
    const KClass extends AutoSerializable,
    const VClass extends AutoSerializable,
  >(
    kClass: KClass,
    vClass: VClass,
  ) => {
    type K = InstanceType<KClass>;
    type V = InstanceType<VClass>;

    return class IdSpecificMap extends SerializableMap<K, V> {
      KEY = kClass as any as Constructor<K>;
      VALUE = vClass as any as Constructor<V>;

      static deserialize<TH extends typeof IdSpecificMap>(
        this: TH,
        value?: Record<Serialized<K>, Serialized<V>>,
      ) {
        return new this(
          value
            ? Object.entries(value).map(([k, v]) => [
                kClass.deserialize(k),
                vClass.deserialize(v),
              ])
            : undefined,
        ) as InstanceType<TH>;
      }
    };
  },
  (kClass: AutoSerializable, vClass: AutoSerializable) =>
    `${kClass.name}-${vClass.name}`,
);

function IdMap<
  const KClass extends AutoSerializable,
  const VClass extends AutoSerializable,
>(kClass: KClass, vClass: VClass) {
  return makeIdMap(kClass, vClass);
}

IdMap.for = <
  const KClass extends AutoSerializable,
  const VClass extends AutoSerializable,
>(
  kClass: KClass,
  vClass: VClass,
  entries?:
    | Array<
        readonly [InstanceType<NoInfer<KClass>>, InstanceType<NoInfer<VClass>>]
      >
    | Array<[InstanceType<NoInfer<KClass>>, InstanceType<NoInfer<VClass>>]>,
) => new (IdMap(kClass, vClass))(entries);

export { IdMap };

export type IdMap<
  K extends { serialize(): string },
  V extends { serialize(): string },
> = SerializableMap<K, V>;
