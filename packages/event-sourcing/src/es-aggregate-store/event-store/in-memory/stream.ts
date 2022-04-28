import { Event, Fact } from "../../../event/event";
import { Deposited } from "../../../test";

type DatedFact<T extends Event> = Fact<T> & { occuredAt: Date };

export class Stream {
  facts: DatedFact<Deposited>[] = [];

  subscribers = new Set<(fact: DatedFact<Deposited>) => void>();

  append(change: Deposited) {
    const revision = BigInt(this.facts.length);
    const occuredAt = new Date();
    const datedFact = { ...change, revision, occuredAt };

    this.facts.push(datedFact);
    for (const subscriber of this.subscribers) {
      subscriber(datedFact);
    }
  }

  subscribe(subscriber: (fact: DatedFact<Deposited>) => void) {
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
