import { EsAggregateId } from "../es-aggregate/es-aggregate";
import { EsAggregate } from "../index";

export abstract class Snapshotter<A extends EsAggregate<any, any>> {
  abstract load(id: EsAggregateId): Promise<A>;

  abstract save(aggregate: A): Promise<void>;
}
