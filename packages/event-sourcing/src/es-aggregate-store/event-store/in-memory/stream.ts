import { EsEvent, EsFact } from "../event-store";

type DatedFact = EsFact & { occuredAt: Date };

export class Stream {
  facts: DatedFact[] = [];

  subscribers = new Set<(fact: DatedFact) => void>();

  append(change: EsEvent) {
    const revision = BigInt(this.facts.length);
    const occuredAt = new Date();
    const datedFact = {
      ...change,
      revision,
      occuredAt,
    };

    this.facts.push(datedFact);
    for (const subscriber of this.subscribers) {
      subscriber(datedFact);
    }
  }

  subscribe(subscriber: (fact: DatedFact) => void) {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  *readRaw(from = 0n) {
    const revision = Number(from);
    for (let i = revision; i < this.facts.length; i++) {
      yield this.facts[i];
    }
  }
}
