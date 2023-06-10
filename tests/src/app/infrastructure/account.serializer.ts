import { Serializer, Serialized } from "@ddd-ts/model";
import { Account } from "../domain/write/account/account";
import { AccountId } from "../domain/write/account/account-id";
import { EventSerializer, MakeEventSerializer } from "@ddd-ts/event-sourcing";
import { Deposited } from "../domain/write/account/deposited.event";

export class AccountSerializer extends Serializer<Account> {
  version = 1n;
  async serialize(model: Account) {
    return {
      id: model.id.toString(),
      balance: model.balance,
      revision: Number(model.acknowledgedRevision),
      version: this.version,
    };
  }

  async deserialize(serialized: Serialized<this>) {
    const account = Account.deserialize(
      AccountId.deserialize(serialized.id),
      serialized.balance,
      BigInt(serialized.revision)
    );

    return account;
  }
}

export class DepositedSerializer
  extends MakeEventSerializer(Deposited)
  implements EventSerializer<Deposited>
{
  version = 1n;

  async serializePayload(payload: Deposited["payload"]) {
    return {
      accountId: payload.accountId.toString(),
      amount: payload.amount,
    };
  }

  async deserializePayload(serialized: any) {
    return {
      accountId: AccountId.deserialize(serialized.accountId),
      amount: serialized.amount,
    };
  }
}

export class WithdrawnSerializer
  implements
    EventSerializer<{
      type: "Withdrawn";
      id: string;
      payload: { amount: number };
      revision?: bigint;
    }>
{
  type = "Withdrawn" as const;
  async serialize(event: {
    type: "Withdrawn";
    id: string;
    payload: { amount: number };
    revision?: bigint;
  }) {
    return {
      id: event.id,
      type: event.type,
      payload: {
        amount: event.payload.amount,
      },
      revision: Number(event.revision),
    };
  }

  async deserialize(serialized: Serialized<this>) {
    return {
      type: "Withdrawn" as const,
      id: serialized.id,
      payload: {
        amount: serialized.payload.amount,
      },
      revision: BigInt(serialized.revision),
    };
  }
}
