import {
  EsAggregate,
  Event,
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
let id = 0;
export class FirestoreEventStore extends EventStore {
  constructor(public readonly firestore: fb.firestore.Firestore) {
    super();
  }

  private serialize(object: object) {
    return JSON.parse(JSON.stringify(object));
  }

  runningSubscriptions = new Set<any>();

  async close() {
    for (const unsubscribe of this.runningSubscriptions) {
      unsubscribe();
      this.runningSubscriptions.delete(unsubscribe);
    }

    await this.firestore.terminate();
  }

  async clear() {
    console.log("clearing event store");
    console.log("loading bulk writer");
    const bw = this.firestore.bulkWriter();

    console.log("deleting events");
    await this.firestore.recursiveDelete(
      this.firestore.collection("events"),
      bw
    );

    console.log("flushing bulk writer");
    await bw.flush();

    console.log("closing bulk writer");
    await bw.close();

    console.log("clearing event store done");
  }

  async appendToAggregateStream(
    AGGREGATE: Constructor<EsAggregate>,
    id: { toString(): string },
    changes: EsChange[],
    expectedRevision: bigint
  ): Promise<void> {
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
        trx.create(aggregateCollection.doc(change.id), {
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
    config: ProjectedStreamConfiguration,
    from?: bigint
  ): AsyncIterable<EsFact> {
    const aggregateCollection = this.firestore.collection("events");

    let query = aggregateCollection
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
    console.log("following", config, from);
    const i = id++;
    const aggregateCollection = this.firestore.collection("events");

    let query = aggregateCollection
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
        console.log("pushing", data.type, data.revision, data.id);
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
      console.log("closing follower");
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
