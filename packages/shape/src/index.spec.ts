import { Derive } from "@ddd-ts/traits";
import { Optional, Shape, Shaped } from ".";
const Value = Shape;

describe("Value", () => {
  describe("Primitive", () => {
    class Money extends Value(Number) {
      add(addend: Money) {
        return new Money(this.value + addend.value);
      }
    }

    it("number: deserializes and reserializes", () => {
      const money = Money.deserialize(2);
      expect(money).toBeInstanceOf(Money);
      expect(money.serialize()).toEqual(2);
    });

    it("can execute methods", () => {
      const before = new Money(2);
      const after = before.add(new Money(2));
      expect(after.value).toBe(4);
    });

    class Sentence extends Value(String) {
      get wordCount() {
        return this.value.split(" ").length;
      }
    }

    it("string: deserializes and reserializes", () => {
      const sentence = Sentence.deserialize("Hello World!");
      expect(sentence).toBeInstanceOf(Sentence);
      expect(sentence.serialize()).toEqual("Hello World!");
    });

    it("can execute getters", () => {
      const sentence = Sentence.deserialize("Hello World!");
      expect(sentence.wordCount).toEqual(2);
    });

    class IsTransactionStale extends Value(Boolean) { }

    it("boolean: deserializes and reserializes", () => {
      const isStale = IsTransactionStale.deserialize(false);

      expect(isStale).toBeInstanceOf(IsTransactionStale);
      expect(isStale.serialize()).toEqual(false);
    });
  });

  describe("Wrapping", () => {
    class Amount extends Value(Number) {
      add(other: Amount) {
        return new Amount(this.value + other.value);
      }
    }

    class Money extends Value(Amount) {
      add(addend: Money) {
        return new Money(this.value.add(addend.value));
      }
    }



    it("deserializes and reserializes", () => {
      const money = Money.deserialize(2);

      expect(money.serialize()).toEqual(2);
    });

    it("uses value internally", () => {
      const money = Money.deserialize(2);

      expect(money.value).toBeInstanceOf(Amount);
    });
  });

  describe("Optional", () => {
    it("deserializes and reserializes", () => {
      class Amount extends Derive(Shaped(Optional(Number))) {

        do() {
          // @ts-expect-error - value is optional
          this.value.toExponential();

          // @ts-expect-error - no nesting
          this.value?.value.toExponential();
        }
      }

      new (Derive(Shaped(Number)))(2);

      new Amount(2);
      new Amount(undefined);

      const empty = Amount.deserialize(undefined);
      expect(empty).toBeInstanceOf(Amount);
      expect(empty.serialize()).toEqual(undefined);

      const amount = Amount.deserialize(2);
      expect(amount).toBeInstanceOf(Amount);
      expect(amount.serialize()).toEqual(2);
    });

    it("support objects", () => {
      class Amount extends Derive(Shaped(Optional({ age: Number }))) {
        do() {
          // @ts-expect-error - value is optional
          this.value.toExponential();

          this.value?.age;
        }
      }

      const empty = Amount.deserialize(undefined);
      expect(empty).toBeInstanceOf(Amount);
      expect(empty.serialize()).toEqual(undefined);

      const amount = Amount.deserialize({ age: 2 });
      expect(amount).toBeInstanceOf(Amount);
      expect(amount.serialize()).toEqual({ age: 2 });

      class Money extends Value(Optional(Number)) {
        add(addend: Money) {
          return new Money((this.value || 0) + (addend.value || 0));
        }
      }

      class Transfer extends Value({ in: Money, out: Money }) {
        get flow() {
          return (this.in.value || 0) - (this.out.value || 0);
        }
      }

      const transfer = Transfer.deserialize({ in: 2, out: 3 });

      expect(transfer).toBeInstanceOf(Transfer);
      expect(transfer.serialize()).toEqual({ in: 2, out: 3 });
      expect(transfer.flow).toBe(-1);

      const emptyTransfer = Transfer.deserialize({
        in: undefined,
        out: undefined,
      });

      expect(emptyTransfer).toBeInstanceOf(Transfer);
      expect(emptyTransfer.serialize()).toEqual({
        in: undefined,
        out: undefined,
      });
      expect(emptyTransfer.flow).toBe(0);
    });
  });

  describe("Inheritance", () => {
    class Amount extends Value(Number) {
      add(other: Amount) {
        return new Amount(this.value + other.value);
      }
    }

    class Money extends Amount {
      add(addend: Money) {
        return new Money(this.value + addend.value);
      }
    }

    it("deserializes and reserializes", () => {
      const money = Money.deserialize(2);

      expect(money.serialize()).toEqual(2);
    });
  });

  describe("Object", () => {
    class Money extends Value(Number) { }
    class Transfer extends Value({ in: Money, out: Money }) {
      get flow() {
        return this.in.serialize() - this.out.serialize();
      }
    }

    it("deserializes and reserializes", () => {
      const transfer = Transfer.deserialize({ in: 2, out: 3 });

      expect(transfer).toBeInstanceOf(Transfer);
      expect(transfer.serialize()).toEqual({ in: 2, out: 3 });
    });

    it("uses values internally", () => {
      const transfer = Transfer.deserialize({ in: 2, out: 3 });
      const { in: input, out: output } = transfer;

      expect(input).toBeInstanceOf(Money);
      expect(output).toBeInstanceOf(Money);
    });

    it("supports domain logic", () => {
      const transfer = Transfer.deserialize({ in: 2, out: 3 });

      expect(transfer.flow).toBe(-1);
    });
  });

  describe("Array", () => {
    describe("of Primitives", () => {
      class Prices extends Value([Number]) { }

      it("deserializes and reserializes", () => {
        const prices = Prices.deserialize([1, 2, 3]);
        console.log(prices);
        expect(prices.serialize()).toEqual([1, 2, 3]);
        expect(prices).toBeInstanceOf(Prices);
      });
    });

    describe("of Values", () => {
      class Money extends Value(Number) { }
      class Prices extends Value([Money]) { }

      it("deserializes and reserializes", () => {
        const prices = Prices.deserialize([1, 2, 3]);

        expect(prices).toBeInstanceOf(Prices);
        expect(prices.serialize()).toEqual([1, 2, 3]);
      });

      it("uses values internally", () => {
        const prices = Prices.deserialize([1, 2, 3]);

        expect(prices.value[0]).toBeInstanceOf(Money);
      });
    });

    describe("of Objects", () => {
      class Money extends Value(Number) { }
      class Transfer extends Value({ in: Money, out: Money }) {
        get flow() {
          return this.in.serialize() - this.out.serialize();
        }
      }
      class Extract extends Value([Transfer]) {
        get flow() {
          return this.value.reduce((acc, transfer) => acc + transfer.flow, 0);
        }
      }

      it("deserializes and reserializes", () => {
        const extract = Extract.deserialize([
          { in: 2, out: 3 },
          { in: 3, out: 4 },
        ]);

        expect(extract).toBeInstanceOf(Extract);
        expect(extract.serialize()).toEqual([
          { in: 2, out: 3 },
          { in: 3, out: 4 },
        ]);
      });

      it("uses values internally", () => {
        const extract = Extract.deserialize([{ in: 2, out: 3 }]);

        const [transfer] = extract.value;

        expect(transfer).toBeInstanceOf(Transfer);

        const { in: input, out: output } = transfer;

        expect(input).toBeInstanceOf(Money);
        expect(output).toBeInstanceOf(Money);
      });

      it("supports domain logic", () => {
        const extract = Extract.deserialize([
          { in: 2, out: 3 },
          { in: 3, out: 4 },
        ]);

        expect(extract.flow).toBe(-2);
      });
    });

    describe("of Arrays", () => {
      class Money extends Value(Number) { }
      class Matrix extends Value([[Money]]) {
        get total() {
          let total = 0;

          for (const row of this.value) {
            for (const cell of row) {
              total += cell.serialize();
            }
          }

          return total;
        }
      }

      it("deserializes and reserializes", () => {
        const matrix = Matrix.deserialize([
          [1, 2],
          [3, 4],
        ]);

        expect(matrix).toBeInstanceOf(Matrix);
        expect(matrix.serialize()).toEqual([
          [1, 2],
          [3, 4],
        ]);
      });

      it("uses values internally", () => {
        const matrix = Matrix.deserialize([
          [1, 2],
          [3, 4],
        ]);

        const [[cell]] = matrix.value;

        expect(cell).toBeInstanceOf(Money);
      });

      it("supports domain logic", () => {
        const matrix = Matrix.deserialize([
          [1, 2],
          [3, 4],
        ]);

        expect(matrix.total).toBe(10);
      });
    });
  });

  describe.skip("Tuple", () => {
    describe("of Primitives", () => {
      class Geo extends Value([Number, Number] as const) {
        get total() {
          const [lat, lon] = this.value;
          return lat + lon;
        }
      }

      it("deserializes and serializes", () => {
        const geo = Geo.deserialize([1, 1]);

        expect(geo).toBeInstanceOf(Geo);
        expect(geo.serialize()).toEqual([1, 1]);
      });

      it("supports domain logic", () => {
        const geo = Geo.deserialize([1, 1]);

        expect(geo.total).toBe(2);
      });
    });

    describe("of Values", () => {
      class Point extends Value(Number) { }

      class Geo extends Value([Point, Point] as const) {
        get total() {
          const [lat, lon] = this.value;
          return lat.serialize() + lon.serialize();
        }
      }

      it("deserializes and serializes", () => {
        const geo = Geo.deserialize([1, 1]);

        expect(geo).toBeInstanceOf(Geo);
        expect(geo.serialize()).toEqual([1, 1]);
      });

      it("uses values internally", () => {
        const geo = Geo.deserialize([1, 1]);
        const [lat, lon] = geo.value;

        expect(lat).toBeInstanceOf(Point);
        expect(lon).toBeInstanceOf(Point);
      });

      it("supports domain logic", () => {
        const geo = Geo.deserialize([1, 1]);

        expect(geo.total).toBe(2);
      });
    });

    describe("of Objects", () => {
      class Money extends Value(Number) { }
      class Transfer extends Value([
        { amount: Money },
        { message: String },
      ] as const) {
        get size() {
          const [funds, notice] = this.value;

          return funds.amount.serialize() + notice.message.length;
        }
      }

      it("deserializes and serializes", () => {
        const transfer = Transfer.deserialize([
          { amount: 2 },
          { message: "Thanks!" },
        ]);

        expect(transfer).toBeInstanceOf(Transfer);
        expect(transfer.serialize()).toEqual([
          { amount: 2 },
          { message: "Thanks!" },
        ]);
      });

      it("uses values internally", () => {
        const transfer = Transfer.deserialize([
          { amount: 2 },
          { message: "Thanks!" },
        ]);

        const [funds] = transfer.value;

        expect(funds.amount).toBeInstanceOf(Money);
      });

      it("supports domain logic", () => {
        const transfer = Transfer.deserialize([
          { amount: 2 },
          { message: "Thanks!" },
        ]);

        expect(transfer.size).toBe(9);
      });
    });
  });
});
