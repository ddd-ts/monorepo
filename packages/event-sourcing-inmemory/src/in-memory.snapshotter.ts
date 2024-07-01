import {
  type IEsAggregateStore,
  type IEventSourced,
  type IIdentifiable,
  type ISerializer,
} from "@ddd-ts/core";

import { InMemoryDatabase, InMemoryStore } from "@ddd-ts/store-inmemory";

export class InMemorySnapshotter<A extends IEventSourced & IIdentifiable>
  extends InMemoryStore<A>
  implements IEsAggregateStore<A>
{
  constructor(
    aggregate: string,
    db: InMemoryDatabase,
    serializer: ISerializer<A>,
  ) {
    // super(db, 'snapshots')
    super(`snapshots-${aggregate}`, db, {
      deserialize: async (serialized: any) => {
        const { revision, ...content } = serialized;
        const instance = await serializer.deserialize(content);
        instance.acknowledgedRevision = Number(revision);
        return instance;
      },
      serialize: async (instance: A) => {
        return {
          revision: instance.acknowledgedRevision,
          ...(await serializer.serialize(instance)),
        };
      },
    });
  }
}
