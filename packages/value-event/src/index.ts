import { Change, Fact, Event as IEvent } from "@ddd-ts/event";

import { RuntimeShape, SerializedShape, Value } from "@ddd-ts/value";
import { v4 } from "uuid";

type Constructor<T> = new (...args: any[]) => T;

export function Event<S extends {}>(shape: S) {
  const Payload = Value(shape);
  return class Intermediate implements IEvent {
    content: InstanceType<typeof Payload>;
    constructor(
      public id: string,
      public type: string,
      content: RuntimeShape<S>,
      public revision?: bigint
    ) {
      this.content = new Payload(content);
    }

    get payload() {
      return this.content.serialize();
    }

    static newChange<T extends Constructor<Intermediate>>(
      this: T,
      payload: RuntimeShape<S>
    ) {
      const id = v4();
      return new this(id, this.name, payload) as Change<InstanceType<T>>;
    }

    static deserializeChange<T extends Constructor<Intermediate>>(
      this: T,
      id: string,
      payload: SerializedShape<S>
    ) {
      return new this(id, this.name, Payload.deserialize(payload)) as Change<
        InstanceType<T>
      >;
    }

    static deserializeFact<T extends Constructor<Intermediate>>(
      this: T,
      id: string,
      payload: SerializedShape<S>,
      revision: bigint
    ) {
      return new this(
        id,
        this.name,
        Payload.deserialize(payload),
        revision
      ) as Fact<InstanceType<T>>;
    }
  };
}
