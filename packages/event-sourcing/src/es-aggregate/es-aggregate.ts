import { Constructor } from "@ddd-ts/types";
import { Change, Event, Fact } from "../event/event";

export type EsAggregateId = { toString(): string };

export abstract class EsAggregate<Id extends EsAggregateId, E extends Event[]> {
  a: E = [] as any;
  acknowledgedRevision = -1n;

  changes: Change<E[number]>[] = [];

  constructor(public id: Id) {}

  load(fact: Fact<E[number]>) {
    if (typeof fact.revision !== "bigint") {
      throw new Error("not a fact");
    }
    if (fact.revision <= this.acknowledgedRevision) {
      throw new Error("already acknowledged");
    }
    if (fact.revision > this.acknowledgedRevision + 1n) {
      throw new Error("not in sequence");
    }
    if (this.changes.length > 0) {
      throw new Error("cannot load facts after changes have been made");
    }

    this.play(fact);

    this.acknowledgedRevision = fact.revision;
  }

  apply(change: Change<E[number]>) {
    this.play(change);
    this.changes.push(change);
  }

  private play(event: E[number]) {
    const handler = this.getEventHandler(event);
    if (!handler) {
      throw new Error(`cannot play event ${event.type}, no handler registered`);
    }

    handler.apply(this, [event]);
  }

  clearChanges() {
    this.changes = [];
  }

  acknowledgeChanges() {
    const changes = BigInt(this.changes.length);
    this.acknowledgedRevision = this.acknowledgedRevision + changes;
    this.changes = [];
  }

  static instanciate<T extends Constructor<EsAggregate<any, any>>>(
    this: T,
    id: T extends Constructor<EsAggregate<infer U, any>> ? U : never
  ) {
    return new this(id) as InstanceType<T>;
  }

  static eventHandlers = new Map<string, (event: Event) => any>();

  static registerHandler(eventType: string, handler: (event: Event) => any) {
    this.eventHandlers.set(eventType, handler);
  }
  private getEventHandler(event: E[number]) {
    const ctor = this.constructor as typeof EsAggregate;
    const eventType = event.type;
    const handler = ctor.eventHandlers.get(eventType);
    return handler;
  }

  static on<E extends Event>(event: new (...args: any[]) => E) {
    return <A extends EsAggregate<any, any>>(
      target: A,
      key: string,
      descriptor: TypedPropertyDescriptor<(event: E) => any>
    ) => {
      const ctor = target.constructor as typeof EsAggregate;
      ctor.registerHandler(event.name, descriptor.value as any);
      return descriptor;
    };
  }
}
