import {
  EsAggregate,
  Event,
  Competitor,
  EsChange,
  EsFact,
  EventStore,
  Follower,
  ProjectedStreamConfiguration,
  Queue,
  EsEvent,
} from "@ddd-ts/event-sourcing";
import { Constructor } from "@ddd-ts/types";
import * as fb from "firebase-admin";

export class FirestoreEventStore extends EventStore {
  constructor(public readonly firestore: fb.firestore.Firestore) {
    super();
  }

  async clear() {
    throw new Error("Not implemented");
  }

  private serialize(object: object) {
    return JSON.parse(
      JSON.stringify(object, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );
  }

  runningSubscriptions = new Set<any>();

  get aggregateCollection() {
    return this.firestore.collection("events");
  }

  async close() {
    for (const unsubscribe of this.runningSubscriptions) {
      unsubscribe();
      this.runningSubscriptions.delete(unsubscribe);
    }

    await this.firestore.terminate();
  }

  async appendToAggregateStream(
    AGGREGATE: Constructor<EsAggregate<any, any>>,
    id: { toString(): string },
    changes: EsChange[],
    expectedRevision: bigint
  ): Promise<void> {
    await this.firestore.runTransaction(async (trx) => {
      const eventsOccuredAfter = await trx.get(
        this.aggregateCollection
          .where("aggregateType", "==", AGGREGATE.name)
          .where("aggregateId", "==", id.toString())
          .where("revision", ">", expectedRevision)
      );
      const hasEventAfter = eventsOccuredAfter.docs.length > 0;

      if (hasEventAfter) {
        throw new Error("Concurrency error");
      }

      let revision = expectedRevision + 1n;

      for (const change of changes) {
        trx.create(this.aggregateCollection.doc(change.id), {
          aggregateType: AGGREGATE.name,
          id: change.id,
          aggregateId: id.toString(),
          revision: Number(revision),
          type: change.type,
          payload: this.serialize(change.payload),
          occurredAt: new Date(),
        });
        await new Promise((r) => setTimeout(r, 1)); // ensure occurredAt is unique
        revision++;
      }
    });
  }

  async *readAggregateStream(
    AGGREGATE: Constructor<
      EsAggregate<{ toString(): string }, EsEvent[]>,
      any[]
    >,
    id: { toString(): string },
    from?: bigint
  ): AsyncIterable<EsFact> {
    let query = this.aggregateCollection
      .where("aggregateType", "==", AGGREGATE.name)
      .where("aggregateId", "==", id.toString())
      .orderBy("revision", "asc");

    if (from) {
      query = query.where("revision", ">", from);
    }

    for await (const event of query.stream()) {
      const e = event as any as fb.firestore.QueryDocumentSnapshot<any>;
      yield {
        id: e.id,
        revision: BigInt(e.data().revision),
        type: e.data().type,
        payload: e.data().payload,
      };
    }
  }

  async *readProjectedStream(
    config: ProjectedStreamConfiguration,
    from?: bigint
  ): AsyncIterable<EsFact> {
    let query = this.aggregateCollection
      .where(
        "aggregateType",
        "in",
        config.map((c) => c.name)
      )
      .orderBy("occurredAt", "asc");

    let revision = 0n;
    if (from) {
      query = query.offset(Number(from));
      revision = from;
    }

    for await (const event of query.stream()) {
      const e = event as any as fb.firestore.QueryDocumentSnapshot<any>;
      yield {
        id: e.id,
        revision: revision,
        type: e.data().type,
        payload: e.data().payload,
      };
      revision++;
    }
  }

  async followProjectedStream(
    config: ProjectedStreamConfiguration,
    from: bigint = 0n
  ): Promise<Follower> {
    let query = this.aggregateCollection
      .where(
        "aggregateType",
        "in",
        config.map((c) => c.name)
      )
      .orderBy("occurredAt", "asc");

    let revision = from;
    query = query.offset(Number(revision));

    const follower = new Queue<EsFact>();

    const unsubscribe = query.onSnapshot((snap) => {
      for (const change of snap.docChanges()) {
        if (change.type !== "added") {
          continue;
        }
        const data = change.doc.data();
        follower.push({
          id: data.id,
          revision: revision,
          type: data.type,
          payload: data.payload,
        });
        revision++;
      }
    });

    const hook = () => follower.close();

    follower.onClose(() => {
      unsubscribe();
      this.runningSubscriptions.delete(hook);
    });

    this.runningSubscriptions.add(hook);

    return follower;
  }

  async competeForProjectedStream(
    AGGREGATE: ProjectedStreamConfiguration,
    competitionName: string
  ): Promise<Competitor> {
    throw new Error("not implemented");
  }
}

export class TestFirestoreEventStore extends FirestoreEventStore {
  namespace = Math.random().toString().substring(2, 8);

  changeNamespace() {
    this.namespace = Math.random().toString().substring(2, 8);
  }

  async clear() {
    for (const unsubscribe of this.runningSubscriptions) {
      unsubscribe();
      this.runningSubscriptions.delete(unsubscribe);
    }
    this.namespace = Math.random().toString().substring(2, 8);
  }

  get aggregateCollection() {
    return this.firestore.collection(this.namespace + "-events");
  }
}
