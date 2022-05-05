import { EsAggregate } from "../es-aggregate/es-aggregate";
import { Constructor, EventStore } from "./event-store/event-store";

export class EsProjectedStreamReader {
  constructor(private eventStore: EventStore) {}

  async *read(AGGREGATE: Constructor<EsAggregate>, from = 0n) {
    yield* this.eventStore.readProjectedStream(AGGREGATE, from);
  }

  async follow(AGGREGATE: Constructor<EsAggregate>, from = 0n) {
    return this.eventStore.followProjectedStream(AGGREGATE, from);
  }

  async compete(AGGREGATE: Constructor<EsAggregate>, competition: string) {
    return this.eventStore.competeForProjectedStream(AGGREGATE, competition);
  }
}
