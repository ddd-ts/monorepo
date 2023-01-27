import { EventStore, ProjectedStreamConfiguration } from "./event-store";

export class EsProjectedStreamReader {
  constructor(private eventStore: EventStore) {}

  async *read(config: ProjectedStreamConfiguration, from = 0n) {
    yield* this.eventStore.readProjectedStream(config, from);
  }

  async follow(config: ProjectedStreamConfiguration, from = 0n) {
    return this.eventStore.followProjectedStream(config, from);
  }

  async compete(config: ProjectedStreamConfiguration, competition: string) {
    return this.eventStore.competeForProjectedStream(config, competition);
  }
}
