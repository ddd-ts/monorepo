import { v4 } from "uuid";
import { Change, Event, Fact } from "../../../../event/event";

export class Deposited implements Event {
  type = "Deposited";

  public payload: { amount: number };

  constructor(
    public id: string,
    private amount: number,
    public revision?: bigint
  ) {
    this.payload = { amount: this.amount };
  }

  static newChange(amount: number) {
    return new Deposited(v4(), amount) as Change<Deposited>;
  }

  static newFact(amount: number, revision: bigint) {
    return new Deposited(v4(), amount, revision) as Fact<Deposited>;
  }

  static expectedFact(amount: number, revision: bigint) {
    return expect.objectContaining({
      id: expect.any(String),
      payload: { amount },
      revision,
    }) as Fact<Deposited>;
  }

  static expectedChange(amount: number) {
    return new Deposited(expect.any(String), amount) as Change<Deposited>;
  }
}
