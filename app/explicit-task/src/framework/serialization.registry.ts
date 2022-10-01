type Constructor<T = any> = new (...args: any[]) => T;

type SerializationRegistration<T = any> = readonly [
  Constructor<T>,
  Serializer<T>
];

export interface Serializer<Instance = any, Serialized = any> {
  serialize(instance: Instance): Serialized;
  deserialize(serialized: ReturnType<this["serialize"]>): Instance;
}

export class SerializationRegistry<
  Rs extends SerializationRegistration[] = []
> {
  storage = new Map<Constructor, Serializer>();
  add<T, C extends Constructor<T>, S extends Serializer<T>>(
    Class: C,
    serializer: S
  ) {
    this.storage.set(Class, serializer);
    type R = [Class: C, serializer: S];
    return this as unknown as SerializationRegistry<[...Rs, R]>;
  }

  get<K extends Rs[number][0]>(key: K) {
    type result = {
      [I in keyof Rs]: Rs[I][0] extends K ? Rs[I][1] : never;
    }[number];

    return this.storage.get(key) as any as result;
  }
}
