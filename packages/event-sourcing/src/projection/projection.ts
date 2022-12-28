import { Constructor } from "../es-aggregate-store/event-store/event-store";
import { EsAggregate } from "../es-aggregate/es-aggregate";
import { Event, Fact } from "../event/event";
import { Transaction } from "./transaction/transaction.old";

export abstract class Projection<A extends EsAggregate = EsAggregate> {
  abstract AGGREGATE: Constructor<A>;

  get configuration() {
    return {
      AGGREGATE: this.AGGREGATE,
      name: this.constructor.name,
    };
  }

  async project(event: Fact, trx?: Transaction) {
    const handler = this.getEventHandler(event);
    if (!handler) {
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

  static on<E extends Event>(event: new (...args: any[]) => E) {
    return <P extends Projection<any>>(
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
