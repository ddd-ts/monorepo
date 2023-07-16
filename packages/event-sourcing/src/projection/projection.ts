import { Transaction } from "@ddd-ts/model";
import {
  EsEvent,
  ProjectedStreamConfiguration,
} from "../es-aggregate-store/event-store";
import { EsAggregate } from "../es-aggregate/es-aggregate";
import { Event, Fact } from "../event/event";

export abstract class Projection {
  abstract on: ProjectedStreamConfiguration;

  get configuration() {
    return {
      streams: this.on,
      name: this.constructor.name,
    };
  }

  async project(event: Fact<any>, trx?: Transaction) {
    const handler = this.getEventHandler(event);
    if (!handler) {
      return;
      throw new Error(
        `cannot project event ${event.type}, no handler registered`
      );
    }

    await handler.apply(this, [event, trx]);
  }

  static eventHandlers = new Map<
    string,
    (event: Event, trx?: Transaction) => any
  >();

  static registerHandler(eventType: string, handler: (event: Event) => any) {
    this.eventHandlers.set(eventType, handler);
  }

  private getEventHandler(event: any) {
    const constructor = this.constructor as typeof Projection;
    const eventType = event.type;
    const handler = constructor.eventHandlers.get(eventType);
    return handler;
  }

  static on<E extends EsEvent>(event: new (...args: any[]) => E) {
    return <P extends Projection>(
      target: P,
      key: string,
      descriptor: TypedPropertyDescriptor<(event: Fact<E>) => any>
    ) => {
      const constructor = target.constructor as typeof Projection;
      constructor.registerHandler(event.name, descriptor.value as any);
      return descriptor;
    };
  }
}
