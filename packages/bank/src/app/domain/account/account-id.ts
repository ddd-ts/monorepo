export class AccountId {
  constructor(public value: string) {}

  serialize() {
    return this.value;
  }

  static deserialize(value: string) {
    return new AccountId(value);
  }

  toString() {
    return this.value;
  }

  static generate() {
    return new AccountId(Math.random().toString());
  }
}
