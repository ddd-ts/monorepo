import { Constructor } from "@ddd-ts/types";

import { AutoSerializable, Serialized } from "@ddd-ts/core";

abstract class SerializableSet<Of extends InstanceType<AutoSerializable>> {
  abstract OF: Constructor<Of>;

  set = new Set<string>();

  constructor(value?: Array<Of | undefined>) {
    this.set = new Set(
      value?.filter((k) => !!k).map((k) => k.serialize()) ?? [],
    );
  }

  get size() {
    return this.set.size;
  }

  new<TH extends SerializableSet<Of>>() {
    return new (this.constructor as Constructor<TH>)();
  }

  isEmpty() {
    return this.size === 0;
  }

  has(id: Of) {
    return this.set.has(id.serialize());
  }

  add(id: Of) {
    this.set.add(id.serialize());
    return this;
  }

  delete(id: Of) {
    this.set.delete(id.serialize());
    return this;
  }

  clone() {
    return new (this.constructor as Constructor<this>)(
      this.toArray().map((k) => new this.OF(k.serialize())),
    );
  }

  clear() {
    this.set.clear();
  }

  equals(other: this) {
    if (this.size !== other.size) {
      return false;
    }

    for (const v of this.set.values()) {
      if (!other.set.has(v)) {
        return false;
      }
    }

    return true;
  }

  difference(withSet: SerializableSet<Of>) {
    const deleted = this.new();
    const added = this.new();

    for (const v of this.set.values()) {
      if (withSet.set.has(v)) {
        continue;
      }
      deleted.set.add(v);
    }
    for (const v of withSet.set.values()) {
      if (this.set.has(v)) {
        continue;
      }
      added.set.add(v);
    }
    return { deleted, added };
  }

  toArray() {
    return Array.from(this.set.values()).map((id) => new this.OF(id));
  }

  toStringArray() {
    return Array.from(this.set.values());
  }

  serialize() {
    return this.toStringArray();
  }

  *[Symbol.iterator]() {
    yield* this.toArray();
  }
}

function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn: (...args: any[]) => string,
): T {
  const cache = new Map<string, ReturnType<T>>();
  const memo = (...args: Parameters<T>) => {
    const key = keyFn(...args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const value = fn(...args);
    cache.set(key, value);
    return value;
  };

  return memo as any;
}

/**
 * For multiple instances of IdSet.for(SomeId, [])
 * to work with jest expect().toEqual() matcher,
 * we need to memoize the IdSpecificSet class
 * so the constructor strict equality is preserved.
 */
const makeIdSet = memoize(
  <const OF extends AutoSerializable>(OF: OF) => {
    type Of = InstanceType<OF>;

    return class IdSpecificSet extends SerializableSet<Of> {
      OF = OF as any as Constructor<Of>;

      static deserialize<TH extends typeof IdSpecificSet>(
        this: TH,
        value?: Serialized<Of>[],
      ) {
        return new this(
          value?.map((v) => OF.deserialize(v)),
        ) as InstanceType<TH>;
      }
    };
  },
  (OF: AutoSerializable) => `${OF.name}`,
);

function IdSet<const OF extends AutoSerializable>(kClass: OF) {
  return makeIdSet(kClass);
}

IdSet.for = <const OF extends AutoSerializable>(
  kClass: OF,
  value?: Array<undefined | InstanceType<NoInfer<OF>>>,
) => new (IdSet(kClass))(value);

export { IdSet };

export type IdSet<K extends { serialize(): string }> = SerializableSet<K>;
