import { EsAggregateStoreSuite } from "@ddd-ts/test-bank";
import { InMemoryEventStore } from "./in-memory.event-store";

describe("InMemoryEventStore", () => {
  EsAggregateStoreSuite(new InMemoryEventStore());
});
