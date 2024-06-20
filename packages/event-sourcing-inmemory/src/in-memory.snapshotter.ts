import {
  type IEsAggregateStore,
  type IEventSourced,
  type IIdentifiable,
  type ISerializer,
} from "@ddd-ts/core";

import { InMemoryDatabase } from "@ddd-ts/store-inmemory";

export class InMemorySnapshotter<A extends IEventSourced & IIdentifiable>
  implements IEsAggregateStore<A>
{
  constructor(
    private readonly db: InMemoryDatabase,
    public readonly serializer: ISerializer<A>,
  ) {}

  async load(id: A["id"]): Promise<any> {
    const snapshot = await this.db.loadLatestSnapshot(id.toString());

    if (!snapshot) {
      return undefined;
    }

    const aggregate = await this.serializer.deserialize(snapshot.serialized);
    aggregate.acknowledgedRevision = snapshot.revision;
    return aggregate;
  }

  async save(aggregate: A): Promise<void> {
    this.db.save("snapshots", aggregate.id.toString(), {
      id: aggregate.id.toString(),
      revision: Number(aggregate.acknowledgedRevision),
      serialized: await this.serializer.serialize(aggregate),
    });
  }
}
