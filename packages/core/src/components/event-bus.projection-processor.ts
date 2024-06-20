import type { IEvent } from "../interfaces/event";
import type { IEventBus } from "../interfaces/event-bus";
import type { IProjection } from "../interfaces/projection";

export class EventBusProjectionProcessor<P extends IProjection> {
  constructor(
    public readonly projection: P,
    public readonly eventBus: IEventBus,
  ) {}

  private handle = (event: IEvent) => this.projection.handle(event);

  start() {
    for (const EVENT of this.projection.on) {
      this.eventBus.on(EVENT, this.handle);
    }
  }

  stop() {
    for (const EVENT of this.projection.on) {
      this.eventBus.off(EVENT, this.handle);
    }
  }
}
