import { Shape } from "@ddd-ts/shape";
import { AccountId } from "../account/account";

export class Cashflow extends Shape({
  id: AccountId,
  name: String,
  all_names: [String],
  flow: Number,
}) {}
