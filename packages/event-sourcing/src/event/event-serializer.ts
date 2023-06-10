import { Serialized, Serializer } from "@ddd-ts/model";
import { Constructor } from "@ddd-ts/types";
import { Event } from "./event";
import { EsEvent } from "..";

export interface EventSerializer<E extends EsEvent = EsEvent> {
  type: E["type"];
  serialize(event: E): any | Promise<any>;
  deserialize(serialized: Serialized<this>): E | Promise<E>;
}

export function MakeEventSerializer<
  EVENT extends Constructor<EsEvent> & {
    deserialize: ReturnType<typeof Event>["deserialize"];
  }
>(event: EVENT) {
  abstract class EventSerializer extends Serializer<InstanceType<EVENT>> {
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
        revision:
          typeof event.revision === "undefined"
            ? undefined
            : Number(event.revision),
        version: this.version,
      };
    }
    async deserialize(
      serialized: Serialized<this>
    ): Promise<InstanceType<EVENT>> {
      return event.deserialize({
        id: serialized.id,
        revision:
          typeof serialized.revision === "undefined"
            ? undefined
            : BigInt(serialized.revision),
        payload: await this.deserializePayload(serialized.payload),
      }) as any;
    }
  }

  return EventSerializer;
}
