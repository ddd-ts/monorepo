export interface Event {
  readonly type: string;
}

export interface EventHandler<E extends Event = Event> {
  readonly on: readonly E["type"][];
  handle(event: E): any;
}

export interface EventBusMiddleware {
  (event: Event, handler: EventHandler, next: () => any): any;
}
