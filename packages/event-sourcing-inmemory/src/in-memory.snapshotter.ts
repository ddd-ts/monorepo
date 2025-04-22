import {
  type IEsAggregateStore,
  type IEventSourced,
  type IIdentifiable,
  type ISerializer,
} from "@ddd-ts/core";

import { InMemoryDatabase, InMemoryStore } from "@ddd-ts/store-inmemory";

class SnapshotSerializer<A extends IEventSourced & IIdentifiable> {
  constructor(private readonly serializer: ISerializer<A>) {}

  async serialize(instance: A) {
    const serialized = await this.serializer.serialize(instance);
    return {
      ...serialized,
      revision: instance.acknowledgedRevision,
    };
  }

  async deserialize(serialized: any) {
    const { revision, ...content } = serialized;
    const instance = await this.serializer.deserialize(content);
    instance.acknowledgedRevision = Number(revision);
    return instance;
  }
}

export class InMemorySnapshotter<A extends IEventSourced & IIdentifiable>
  extends InMemoryStore<A>
  implements IEsAggregateStore<A>
{
  constructor(
    aggregate: string,
    db: InMemoryDatabase,
    serializer: ISerializer<A>,
  ) {
    super(`snapshots-${aggregate}`, db, new SnapshotSerializer(serializer));
  }
}
