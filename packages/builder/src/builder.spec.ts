import { Value, SerializedShape } from "@ddd-ts/value";
type Constructor = new (...args: any[]) => any;

const getBuilder = <B extends Constructor>(Base: B) => {
  type Params = ConstructorParameters<typeof Base>;

  return class Builder {
    public params: ConstructorParameters<B> = [] as any;
    //public values: Map<keyof InstanceType<typeof Base>, any> = new Map();
    // key: ConstructorParameters<typeof Base>,
    constructor() {}

    setValue<I extends number>(index: I, value: ConstructorParameters<B>[I]) {
      this.params[index] = value;
      return this;
    }

    build(): InstanceType<typeof Base> {
      return new Base(...this.params);
    }
  };
};

describe("builder", () => {
  it("should create a builder from simple aggregate", () => {
    class Human {
      constructor(public name: string, public age: number) {}
    }

    type A = ConstructorParameters<typeof Human>;
    class HumanBuilder extends getBuilder(Human) {}

    const builder = new HumanBuilder();
    const human = builder.setValue(0, "Jojo").setValue(1, 5).build();

    expect(human.name).toBe("Jojo");
    expect(human.age).toBe(5);

    expect(true).toBe(true);
  });
});
