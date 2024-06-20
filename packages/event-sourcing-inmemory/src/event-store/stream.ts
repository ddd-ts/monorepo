import { type IFact, type IEsEvent } from "@ddd-ts/core";

export class Stream {
  facts: IFact[] = [];

  subscribers = new Set<(fact: IFact) => void>();

  append(change: IEsEvent) {
    const revision = this.facts.length;
    const occurredAt = new Date();
    const fact = {
      ...change,
      revision,
      occurredAt,
    };

    this.facts.push(fact);
    for (const subscriber of this.subscribers) {
      subscriber(fact);
    }
  }

  subscribe(subscriber: (fact: IFact) => void) {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  *read(from = 0) {
    for (let i = from; i < this.facts.length; i++) {
      yield this.facts[i];
    }
  }
}
