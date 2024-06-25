export { AggregateStreamId } from "./components/aggregate-stream-id";
export { AutoSerializable, AutoSerializer } from "./components/auto-serializer";
export { EventBusProjectionProcessor } from "./components/event-bus.projection-processor";
export { EventId } from "./components/event-id";
export { SerializerRegistry } from "./components/serializer-registry";
export { DetachedEventBus } from "./components/detached.event-bus";
export { ConcurrencyError } from "./components/concurrency-error";
export {
  Transaction,
  CommitListener,
  TransactionEffect,
  TransactionPerformer,
} from "./components/transaction";

export { On, getHandler } from "./decorators/handlers";

export type { IEsAggregateStore } from "./interfaces/es-aggregate-store";
export type { IEsEvent, IChange, IFact } from "./interfaces/es-event";
export type { IEventBus } from "./interfaces/event-bus";
export type { IEventSourced } from "./interfaces/event-sourced";
export type { IEventStore } from "./interfaces/event-store";
export type { IEvent } from "./interfaces/event";
export type {
  IIdentifiable,
  Identifier,
} from "./interfaces/identifiable";
export type { INamed } from "./interfaces/named";
export type { IProjection } from "./interfaces/projection";
export type {
  ISerializer,
  Serialized,
  PromiseOr,
} from "./interfaces/serializer";
export type { Store } from "./interfaces/store";

export {
  EsAggregate,
  BasicEsAggregate,
  SnapshottableEsAggregate,
} from "./makers/es-aggregate";
export { EsEvent } from "./makers/es-event";
export { Named } from "./makers/named";
export { Projection } from "./makers/projection";

export * from "./tools/iterator";
export * from "./tools/queue";

export { EventSourced } from "./traits/event-sourced";
export { Identifiable } from "./traits/identifiable";

import "./metadata.polyfill";
