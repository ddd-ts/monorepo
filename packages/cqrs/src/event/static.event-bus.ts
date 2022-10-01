import { EventBusMiddleware, EventHandler } from ".";
import { EventBus } from "./event-bus";

export class StaticEventBus<Hs extends EventHandler[] = []> extends EventBus {
  register<H extends EventHandler>(handler: H): StaticEventBus<[...Hs, H]> {
    super.register(handler);
    return this;
  }

  use(middleware: EventBusMiddleware) {
    super.use(middleware);
    return this as StaticEventBus<Hs>;
  }

  publish<E extends Parameters<Hs[number]["handle"]>[0]>(
    event: E
  ): Promise<any> {
    return super.publish(event);
  }
}
