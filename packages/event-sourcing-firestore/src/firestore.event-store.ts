import {
  EsAggregate,
  Event,
  Serializable,
  closeable,
  map,
  Competitor,
  Constructor,
  EsChange,
  EsFact,
  EventStore,
  Follower,
  ProjectedStreamConfiguration,
  Queue,
} from "@ddd-ts/event-sourcing";
import * as fb from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

export class FirestoreEventStore extends EventStore {
  namespace = Math.random().toString().substring(2, 8);
  firestore: fb.firestore.Firestore;
  constructor() {
    super();
    const app = fb.initializeApp({
      projectId: "demo-es",
    });
    this.firestore = app.firestore();
  }

  async close() {}

  async clear() {
    this.namespace = Math.random().toString().substring(2, 8);
    await this.firestore.recursiveDelete(this.firestore.collection("events"));
  }

  async appendToAggregateStream(
    AGGREGATE: Constructor<EsAggregate>,
    id: { toString(): string },
    changes: EsChange[],
    expectedRevision: bigint
  ): Promise<void> {
    console.log(
      "appendToAggregateStream",
      AGGREGATE.name,
      id.toString(),
      changes.length,
      expectedRevision
    );
    await this.firestore.runTransaction(async (trx) => {
      const aggregateCollection = this.firestore.collection("events");

      const eventsOccuredAfter = await trx.get(
        aggregateCollection
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
        console.log("revision", revision, "change", change.id);
        trx.create(aggregateCollection.doc(change.id), {
          aggregateType: AGGREGATE.name,
          aggregateId: id.toString(),
          revision: revision,
          type: change.type,
          payload: change.payload,
          occurredAt: fb.firestore.FieldValue.serverTimestamp(),
        });
        revision++;
      }
    });
  }

  async *readAggregateStream(
    AGGREGATE: Constructor<EsAggregate<{ toString(): string }, Event>, any[]>,
    id: { toString(): string },
    from?: bigint
  ): AsyncIterable<EsFact> {
    const aggregateCollection = this.firestore.collection("events");

    let query = aggregateCollection
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
    AGGREGATE: ProjectedStreamConfiguration,
    from?: bigint
  ): AsyncIterable<EsFact> {
    const aggregateCollection = this.firestore.collection("events");

    let query = aggregateCollection
      .where("aggregateType", "==", AGGREGATE.name)
      .orderBy("revision", "asc")
      .orderBy("occurredAt", "asc");

    let revision = 0n;
    if (from) {
      query = query.startAt(from);
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
    AGGREGATE: ProjectedStreamConfiguration,
    from: bigint = 0n
  ): Promise<Follower> {
    const aggregateCollection = this.firestore.collection("events");

    let query = aggregateCollection
      .where("aggregateType", "==", AGGREGATE.name)
      .orderBy("revision", "asc")
      .orderBy("occurredAt", "asc");

    let revision = 0n;
    if (from) {
      query = query.startAt(from);
      revision = from;
    }

    const follower = new Queue<EsFact>();

    const unsubscribe = query.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const e =
            change.doc as any as fb.firestore.QueryDocumentSnapshot<any>;
          follower.push({
            id: e.id,
            revision: revision,
            type: e.data().type,
            payload: e.data().payload,
          });
          revision++;
        }
      });
    });

    follower.onClose(unsubscribe);

    return follower;
  }

  async competeForProjectedStream(
    AGGREGATE: ProjectedStreamConfiguration,
    competitionName: string
  ): Promise<Competitor> {
    throw new Error("not implemented");
  }
}
