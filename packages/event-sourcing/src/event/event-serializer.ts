import { Serialized } from "@ddd-ts/model";
import { Constructor } from "@ddd-ts/types";
import { Event, Fact } from "./event";

export interface EventSerializer<E extends Event = Event> {
  type: E["type"];
  serialize(event: E): any | Promise<any>;
  deserialize(serialized: Serialized<this>): E | Promise<E>;
}
export function MakeEventSerializer<
  EVENT extends Constructor<Event> & {
    asFact: (payload: any, revision: bigint) => Fact;
  }
>(event: EVENT) {
  abstract class EventSerializer {
    type = event.name as InstanceType<EVENT>["type"];
    abstract serializePayload(
      payload: InstanceType<EVENT>["payload"]
    ): any | Promise<any>;
    abstract deserializePayload(
      serialized: any
    ): InstanceType<EVENT>["payload"] | Promise<InstanceType<EVENT>["payload"]>;

    async serialize(event: InstanceType<EVENT>) {
      return {
        id: event.id,
        type: event.type,
        payload: await this.serializePayload(event.payload),
        revision: Number(event.revision),
      };
    }
    async deserialize(
      serialized: Serialized<this>
    ): Promise<InstanceType<EVENT>> {
      return event.asFact(
        await this.deserializePayload(serialized.payload),
        BigInt(serialized.revision)
      ) as any;
    }
  }

  return EventSerializer;
}
