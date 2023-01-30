import { EsAggregateStoreSuite } from "@ddd-ts/tests";
import { ESDBEventStore } from "./esdb.event-store";

describe("ESDBEventStore", () => {
  EsAggregateStoreSuite(new ESDBEventStore());
});
