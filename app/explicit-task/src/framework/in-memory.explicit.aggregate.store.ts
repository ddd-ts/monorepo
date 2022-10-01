import { Serializer } from "./serialization.registry";

type Stringifiable = { toString(): string };
type Identity = Stringifiable | Record<string, Stringifiable>;

export abstract class InMemoryExplicitAggregateStore<
  A extends any = any,
  S extends Serializer<A> = Serializer<A>
> {
  constructor(private readonly serializer: S) {}

  abstract identify(aggregate: A): Identity;

  storage = new Map<string, ReturnType<S["serialize"]>>();

  async load(id: ReturnType<this["identify"]>) {
    const serialized = this.storage.get(id.toString());
    if (!serialized) {
      return undefined;
    }
    return this.serializer.deserialize(serialized);
  }

  async save(aggregate: A) {
    const serialized = this.serializer.serialize(aggregate);
    this.storage.set(this.identify(aggregate).toString(), serialized);
  }

  loadAll() {
    return Array.from(this.storage.values()).map((serialized) =>
      this.serializer.deserialize(serialized)
    );
  }
}
