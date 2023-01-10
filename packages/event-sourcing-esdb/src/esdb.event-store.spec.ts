import { EsAggregateStoreSuite } from "@ddd-ts/test-bank";
import { ESDBEventStore } from "./esdb.event-store";

describe("ESDBEventStore", () => {
  EsAggregateStoreSuite(new ESDBEventStore());
});
