export class Cashflow {
  constructor(public flow = 0) {}

  register(amount: number) {
    this.flow += amount;
  }
}
