import { ISerializedEvent, ISerializedFact, EventId, StreamId, EventReference, LakeId } from "@ddd-ts/core";

export class Stream {

  constructor(public readonly id: StreamId | LakeId) {}
  facts: ISerializedFact[] = [];

  subscribers = new Set<(fact: ISerializedFact) => void>();

  append(change: ISerializedEvent) {
    const ref = `${this.id.serialize()}:${change.id}`
    const revision = this.facts.length;
    const occurredAt = new Date();
    const fact = {
      ...change,
      revision,
      occurredAt,
      ref,
    };

    this.facts.push(fact);
    for (const subscriber of this.subscribers) {
      subscriber(fact);
    }

    return ref
  }

  subscribe(subscriber: (fact: ISerializedFact) => void) {
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

  *readLake(startAfter?: EventId, endAt?: EventId){
    let started = !startAfter;
    for(const fact of this.facts){
      if(!started && startAfter && fact.id === startAfter.serialize()){
        started = true;
        continue;
      }

      if(started && endAt && fact.id === endAt.serialize()){
        yield fact;
        break;
      }

      if (started) {
        yield fact;
      }
    }
  }
}
