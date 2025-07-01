import {
  ProjectedStream,
  StreamSource,
} from "../../../components/projected-stream";
import {
  Account,
  AccountOpened,
  AccountRenamed,
  Deposited,
  Withdrawn,
} from "../account/account";

export class CashflowStream extends ProjectedStream {
  constructor() {
    super({
      sources: [
        new StreamSource({
          aggregateType: Account.name,
          shardKey: "accountId",
          events: [
            AccountOpened.name,
            Deposited.name,
            Withdrawn.name,
            AccountRenamed.name,
          ],
        }),
      ],
    });
  }
}
