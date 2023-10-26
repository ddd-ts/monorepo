import { Snapshotter, EsAggregate } from "@ddd-ts/event-sourcing";
import { Model } from "@ddd-ts/model";
import { ISerializer } from "@ddd-ts/serialization";
import { InMemoryDatabase } from "@ddd-ts/store-inmemory";

export class InMemorySnapshotter<
  S extends ISerializer<EsAggregate<any, any>>
> extends Snapshotter<S extends ISerializer<infer A> ? A : never> {
  constructor(
    private readonly db: InMemoryDatabase,
    public readonly serializer: S
  ) {
    super();
  }

  private getIdFromModel(model: S extends ISerializer<infer A extends Model> ? A : never) {
    if (Object.getOwnPropertyNames(model.id).includes('serialize')) {
      if ('serialize' in model.id) {
        return model.id.serialize()
      }
    }
    return model.id.toString()
  }

  async load(id: S extends ISerializer<infer T extends Model> ? T['id'] : never): Promise<any> {
    const snapshot = await this.db.loadLatestSnapshot(id.toString());

    if (!snapshot) {
      return undefined;
    }

    return this.serializer.deserialize(snapshot.serialized);
  }

  async save(
    aggregate: S extends ISerializer<infer A extends Model> ? A : never
  ): Promise<void> {
    const id = this.getIdFromModel(aggregate);
    this.db.save("snapshots", id.toString(), {
      id: id.toString(),
      revision: Number(aggregate.acknowledgedRevision),
      serialized: await this.serializer.serialize(aggregate),
    });
  }
}
