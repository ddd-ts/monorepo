import { Serializer } from "@ddd-ts/model";
import { Snapshotter, EsAggregate } from "@ddd-ts/event-sourcing";
import { InMemoryDatabase } from "./index";

export class InMemorySnapshotter<
  S extends Serializer<EsAggregate>
> extends Snapshotter<S extends Serializer<infer A> ? A : never> {
  constructor(
    private readonly db: InMemoryDatabase,
    public readonly serializer: S
  ) {
    super();
  }

  async load(id: ReturnType<S["getIdFromModel"]>): Promise<any> {
    const snapshot = await this.db.loadLatestSnapshot(id.toString());

    if (!snapshot) {
      return undefined;
    }

    return this.serializer.deserialize(snapshot.serialized);
  }

  async save(
    aggregate: S extends Serializer<infer A> ? A : never
  ): Promise<void> {
    const id = this.serializer.getIdFromModel(aggregate);
    this.db.save("snapshots", id.toString(), {
      id: id.toString(),
      revision: Number(aggregate.acknowledgedRevision),
      serialized: this.serializer.serialize(aggregate),
    });
  }
}
