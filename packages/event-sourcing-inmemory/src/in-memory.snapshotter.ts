import { Serializer } from "@ddd-ts/model";
import {
  Snapshotter,
  EsAggregate,
  EsAggregateId,
} from "@ddd-ts/event-sourcing";
import { InMemoryDatabase } from "@ddd-ts/store-inmemory";

export class InMemorySnapshotter<A extends EsAggregate> extends Snapshotter<A> {
  constructor(
    private readonly db: InMemoryDatabase,
    public readonly serializer: Serializer<A>
  ) {
    super();
  }

  async load(id: A["id"]): Promise<any> {
    const snapshot = await this.db.loadLatestSnapshot(id.toString());

    if (!snapshot) {
      return undefined;
    }

    return this.serializer.deserialize(snapshot.serialized);
  }

  async save(aggregate: A): Promise<void> {
    const id = aggregate.id.toString();
    this.db.save("snapshots", id, {
      id,
      revision: Number(aggregate.acknowledgedRevision),
      serialized: await this.serializer.serialize(aggregate),
    });
  }
}
