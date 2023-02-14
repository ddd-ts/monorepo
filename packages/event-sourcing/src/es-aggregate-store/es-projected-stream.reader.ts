import { Constructor } from "@ddd-ts/types";
import { EventSerializer } from "../event/event-serializer";
import { closeable, EsAggregate, Event, map } from "../index";
import { AllEventSerializers } from "./es-aggregate.persistor";
import {
  EsFact,
  EventStore,
  ProjectedStreamConfiguration,
} from "./event-store";

export class EsProjectedStreamReader<P extends ProjectedStreamConfiguration> {
  constructor(
    private eventStore: EventStore,
    public serializers: {
      [T in keyof P]: P[T] extends Constructor<EsAggregate<any, any>>
        ? AllEventSerializers<InstanceType<P[T]>>
        : never;
    } // find a way to make this typesafe
  ) {}

  private getSerializer(type: string) {
    const flatSerializers: EventSerializer[] = this.serializers.flat() as any;
    const serializer = flatSerializers.find((s) => s.type === type);
    if (!serializer) {
      throw new Error(`no serializer for event type ${type}`);
    }
    return serializer;
  }

  async *read(config: P, from = 0n) {
    for await (const event of this.eventStore.readProjectedStream(
      config,
      from
    )) {
      const serializer = this.getSerializer(event.type);

      yield serializer.deserialize(event);
    }
  }

  async follow(config: P, from = 0n) {
    const follower = await this.eventStore.followProjectedStream(config, from);
    const that = this;

    const mapped = map(follower, (event) => {
      const serializer: any = that.getSerializer(event.type);
      return serializer.deserialize(event);
    });

    return closeable(mapped, async () => follower.close());
  }

  async compete(config: P, competition: string) {
    return this.eventStore.competeForProjectedStream(config, competition);
  }
}
