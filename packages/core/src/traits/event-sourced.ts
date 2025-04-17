import { HasTrait, Trait } from "@ddd-ts/traits";
import type { Constructor } from "@ddd-ts/types";

import type { IChange, IEsEvent } from "../interfaces/es-event";
import type { IEventSourced } from "../interfaces/event-sourced";
import { getHandler } from "../decorators/handlers";
import { INamed } from "../interfaces/named";

type Config = (INamed & Constructor<IEsEvent & INamed>)[];

export const EventSourced = <C extends Config>(config: C) =>
  Trait((base) => {
    type Event = InstanceType<C[number]> & INamed;
    abstract class $EventSourced extends base implements IEventSourced<Event> {
      acknowledgedRevision = -1;
      changes: IChange<Event>[] = [];
      static events = config;

      load(fact: Event) {
        if (typeof fact.revision !== "number") {
          throw new Error("not a fact");
        }
        if (fact.revision <= this.acknowledgedRevision) {
          throw new Error("already acknowledged");
        }
        if (fact.revision > this.acknowledgedRevision + 1) {
          throw new Error("not in sequence");
        }
        if (this.changes.length > 0) {
          throw new Error("cannot load facts after changes have been made");
        }

        this.play(fact);

        this.acknowledgedRevision = fact.revision;
      }

      apply(change: IChange<Event>) {
        this.play(change);
        this.changes.push(change);
      }

      play(event: Event) {
        const handler = getHandler(this, event.name);

        if (!handler) {
          throw new Error(
            `cannot play event ${event.name}, no handler registered`,
          );
        }

        return handler.apply(this, [event]);
      }

      clearChanges() {
        this.changes = [];
      }

      acknowledgeChanges() {
        const changes = this.changes.length;
        this.acknowledgedRevision = this.acknowledgedRevision + changes;
        this.changes = [];
      }

      static instanciate<TH extends Constructor>(
        this: TH,
        event: Event,
      ): InstanceType<TH> {
        const handler = getHandler(this, event.name);

        if (!handler) {
          throw new Error(
            `cannot play event ${event.name}, no handler registered`,
          );
        }

        return handler.apply(this, [event]);
      }

      static loadFirst<TH extends Constructor>(
        this: TH,
        event: Event,
      ): InstanceType<TH> {
        if (typeof event.revision !== "number") {
          throw new Error("not a fact");
        }
        if (event.revision !== 0) {
          throw new Error("not the first event");
        }

        const instance = (this as any).instanciate(event);
        instance.acknowledgedRevision = 0;
        return instance;
      }

      static new<TH extends Constructor>(
        this: TH,
        event: Event,
      ): InstanceType<TH> {
        const instance = (this as any).instanciate(event);
        instance.changes.push(event);
        return instance;
      }
    }

    return $EventSourced;
  });

export type EventsOf<E> = E extends HasTrait<
  typeof EventSourced<infer C extends Config>
>
  ? {
      [K in keyof C]: InstanceType<C[K]>;
    }
  : never;

export type EventOf<E> = E extends HasTrait<
  typeof EventSourced<infer C extends Config>
>
  ? InstanceType<C[number]>
  : never;
