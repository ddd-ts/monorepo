import { EsAggregateStoreSuite } from "@ddd-ts/tests";
import { InMemoryEventStore } from "./in-memory.event-store";

describe("InMemoryEventStore", () => {
  EsAggregateStoreSuite(new InMemoryEventStore());
});
