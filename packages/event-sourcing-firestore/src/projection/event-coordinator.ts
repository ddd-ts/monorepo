import type { IEsEvent, ISavedChange } from "@ddd-ts/core";
import { promiseWithResolvers, type PromiseResolvers } from "../utils/promise-with-resolvers";

export class EventCoordinator {
  private eventProcessing: Map<string, PromiseResolvers<void>> = new Map();
  private currentEventId: string | null = null;
  private eventStack: ISavedChange<IEsEvent>[] = [];
  private isRunning = false;

  addEvent(event: ISavedChange<IEsEvent>) {
    const eventId = event.id.serialize();
    this.eventProcessing.set(eventId, promiseWithResolvers());
    this.eventStack.push(event);
  }

  start(event: ISavedChange<IEsEvent>) {
    if (this.isRunning) {
      throw new Error("Event processing already in progress");
    }

    this.currentEventId = event.id.serialize();
    this.eventStack = [];
    this.isRunning = true;
    return () => this.end(event);
  }

  async waitCurrentEvent() {
    if (!this.currentEventId) return;
    const resolvers = this.eventProcessing.get(this.currentEventId);
    await resolvers?.promise;
  }

  end(event: ISavedChange<IEsEvent>) {
    const eventId = event.id.serialize();
    this.eventProcessing.get(eventId)?.resolve();
    
    this.eventProcessing.delete(eventId);
    this.isRunning = false;
    this.currentEventId = null;
  }

  canProceed(event: ISavedChange<IEsEvent>) {
    const eventId = event.id.serialize();
    const lastStackEvent = this.eventStack.at(-1);
    if (lastStackEvent && lastStackEvent.id.serialize() !== eventId) {
      return false;
    }
    return true;
  }
}
