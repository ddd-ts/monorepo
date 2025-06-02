import { IEsEvent, IFact } from "../interfaces/es-event";
import { EventReference } from "./event-id";

export class EventCommitResult {
  result = new Map<string, { ref: EventReference; revision: number }>();

  set(id: string, ref: EventReference, revision: number) {
    this.result.set(id, { ref, revision });
  }

  factualize(change: IEsEvent) {
    const key = change.id.serialize();
    const result = this.result.get(key);
    if (!result) {
      throw new Error(`Event not found: ${change.id}`);
    }

    const fact = change as any as IFact;

    fact.revision = result.revision;
    fact.ref = result.ref;
    return fact;
  }
}
