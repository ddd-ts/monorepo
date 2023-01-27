export class Cashflow {
  constructor(public id: string, public flow = 0) {}

  register(amount: number) {
    this.flow += amount;
  }
}
