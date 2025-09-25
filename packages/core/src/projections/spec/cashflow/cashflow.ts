import { Shape } from "@ddd-ts/shape";
import { AccountId } from "../account/account";
import { EventId } from "../../../components/event-id";

export class Cashflow extends Shape({
  id: AccountId,
  name: String,
  all_names: [String],
  flow: Number,
  ops_trace: [EventId],
}) {}
