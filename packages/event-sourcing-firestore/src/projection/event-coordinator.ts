import type { IEsEvent, ISavedChange } from "@ddd-ts/core";
import { promiseWithResolvers, type PromiseResolvers } from "../utils/promise-with-resolvers";

export class EventCoordinator {
  private eventProcessing: Map<string, PromiseResolvers<void>> = new Map();
  private currentEventId: string | null = null;
  private lastEvent: ISavedChange<IEsEvent> | null = null;
  private isRunning = false;

  addEvent(event: ISavedChange<IEsEvent>) {
    const eventId = event.id.serialize();
    this.eventProcessing.set(eventId, promiseWithResolvers());

    if (
      this.lastEvent === null ||
      this.lastEvent.revision < event.revision
    ) {
      this.lastEvent = event;
    }
  }

  start(event: ISavedChange<IEsEvent>) {
    if (this.isRunning) {
      throw new Error("Event processing already in progress");
    }

    this.currentEventId = event.id.serialize();
    this.isRunning = true;
    return () => this.cleanEvent(event);
  }

  async waitCurrentEvent() {
    if (!this.currentEventId) return;
    const resolvers = this.eventProcessing.get(this.currentEventId);
    await resolvers?.promise;
  }

  cleanEvent(event: ISavedChange<IEsEvent>) {
    const eventId = event.id.serialize();

    this.eventProcessing.get(eventId)?.resolve();
    this.eventProcessing.delete(eventId);

    this.isRunning = false;
    this.currentEventId = null;
  }

  canProceed(event: ISavedChange<IEsEvent>) {
    if (this.isRunning) return false;
    const eventId = event.id.serialize();
    return this.lastEvent?.id.serialize() === eventId;
  }
}
