import {
  Constructor,
  Derive,
  Props,
  Subtrait,
  Trait,
  implementsTrait,
} from ".";

describe("Traits", () => {
  const Swim = Trait(
    (base) =>
      class Swim extends base {
        swim() {
          return 1;
        }
      }
  );

  const Walk = Trait(
    (base) =>
      class extends base {
        walk() {
          return 1;
        }
      }
  );

  it("derives a trait", () => {
    class Fish extends Derive(Swim) {
      do() {
        // @ts-expect-error should be strictly typed
        this.test();
      }
    }

    const fish = new Fish({});

    expect(fish.swim()).toBe(1);
  });

  it("overloads a trait method", () => {
    class Dog extends Derive(Swim) {
      swim() {
        return super.swim() * 0.2;
      }
    }

    const dog = new Dog({});

    expect(dog.swim()).toBe(0.2);
  });

  it("derives multiple traits", () => {
    class Dog extends Derive(Swim, Walk) { }

    const dog = new Dog({});

    expect(dog.swim()).toBe(1);
    expect(dog.walk()).toBe(1);
  });

  const Run = Trait(
    (base) =>
      class extends base {
        speed: number;
        constructor(props: { speed: number }) {
          super(props);
          this.speed = props.speed;
        }
        run() {
          return 2 * this.speed;
        }
      }
  );

  it("derives a trait with a constructor", () => {
    class Athlete extends Derive(Run) {
      constructor() {
        super({ speed: 10 });
      }
    }

    class ErrorAthlete extends Derive(Run) {
      constructor() {
        // @ts-expect-error ensures the super constructor is called with the right props
        super({});
      }
    }

    const walker = new Athlete();

    expect(walker.run()).toBe(20);
  });

  const Jump = Trait(
    (base) =>
      class extends base {
        agility: number;
        constructor(props: { agility: number }) {
          super(props);
          this.agility = props.agility;
        }
        jump() {
          return 1;
        }
      }
  );

  it("derives multiple trait with a constructor", () => {
    class Athlete extends Derive(Run, Jump) {
      constructor() {
        super({ speed: 10, agility: 10 });
      }
    }

    const walker = new Athlete();

    expect(walker.run()).toBe(20);
  });

  it("asserts an instance implements a trait", () => {

    const Unused = Trait(
      (base) =>
        class extends base {
          constructor(props: { agility: number }) {
            super(props);
          }
        })


    class Athlete extends Derive(Run, Jump) {
      constructor() {
        super({ speed: 10, agility: 10 });
      }
    }

    const athlete = new Athlete();

    expect(athlete instanceof Athlete).toBe(true);
    expect(implementsTrait(athlete, Run)).toBe(true);
    expect(implementsTrait(athlete, Jump)).toBe(true);
    expect(implementsTrait(athlete, Unused)).toBe(false);

    const unknown: unknown = athlete;
    if (implementsTrait(unknown, Run) && implementsTrait(unknown, Jump)) {
      // if type error, ensure the type guard works
      unknown.run();
      unknown.jump();
    }
  });

  it("allows generic traits", () => {
    const Eat = <E>() =>
      Trait(
        (base) =>
          class extends base {
            eat(_e: E) { }
          }
      );

    class Animal extends Derive(Eat<string>()) {
      do() {
        this.eat("a");
        // @ts-expect-error should not allow to eat a number
        this.eat(1);
      }
    }
  });

  it("allows to easily access prop types", () => {
    const WithProperties = <T>() =>
      Trait(
        (base) =>
          class extends base {
            a: string;
            b: T;
            c: number;
            constructor(props: { a: string; b: T; c: number }) {
              super(props);
              this.a = props.a;
              this.b = props.b;
              this.c = props.c;
            }
          }
      );

    class Thing extends Derive(WithProperties<boolean>()) {
      constructor(props: Props<typeof Thing> & { d: null }) {
        super(props);
      }

      do() {
        const a: string = this.a;
        const b: boolean = this.b;
        const c: number = this.c;
      }
    }
  });

  it("allows a trait to construct the base class", () => {
    const WithProperties = <T>() =>
      Trait(
        (base) =>
          class extends base {
            a: string;
            b: T;
            c: number;
            constructor(props: { a: string; b: T; c: number }) {
              super(props);
              this.a = props.a;
              this.b = props.b;
              this.c = props.c;
            }
            static new<T extends Constructor>(
              this: T,
              props: ConstructorParameters<T>[0]
            ) {
              return new this({ ...props }) as InstanceType<T>;
            }
          }
      );

    class Thing extends Derive(WithProperties<boolean>()) {
      constructor(props: Props<typeof Thing> & { d: null }) {
        super(props);
      }
    }

    Thing.new({ a: "a", b: true, c: 1, d: null });
  });

  describe("Subtraits", () => {
    it("allows to specify supertraits", () => {
      const Walk = Trait(
        (base) =>
          class Walk extends base {
            walk() { }
          }
      );

      const Run = Subtrait(
        [Walk], // supertrait of subtrait defined here
        (base) =>
          class Run extends base {
            run() {
              this.walk();
              this.walk();
              this.walk();
            }
          }
      );

      // @ts-expect-error should not allow to create a runner without a walker
      class ErrorAthlete extends Derive(Run) { }

      // @ts-expect-error ordering matters: an athlete is a Runner because it is a walker
      class ErrorAthlete2 extends Derive(Run, Walk) { }

      class Athlete extends Derive(Walk, Run) {
        do() {
          this.walk();
          this.run();
        }
      }
    });

    it("allows to specify supertraits with props", () => {
      const Walk = Trait(
        (base) =>
          class extends base {
            walk() {
              return 2;
            }
          }
      );

      const Run = Subtrait(
        [Walk], // supertrait of subtrait defined here
        (base) =>
          class extends base {
            speed: number;
            constructor(props: { speed: number }) {
              super({});
              this.speed = props.speed;
            }
            run() {
              return this.walk() * this.speed;
            }
          }
      );

      class Athlete extends Derive(Walk, Run) {
        constructor() {
          super({ speed: 10 });
        }
        start() {
          return this.walk() + this.run();
        }
      }

      const athlete = new Athlete();

      expect(athlete.start()).toBe(22);
    });

    it("ensures supertraits props are forwarded", () => {
      const Walk = Trait(
        (base) =>
          class extends base {
            speed: number;
            constructor(props: { speed: number }) {
              super(props);
              this.speed = props.speed;
            }
            walk() {
              return this.speed * 0.1;
            }
          }
      );

      const Run = Subtrait(
        [Walk], // supertrait of subtrait defined here
        (base, Props) =>
          class extends base {
            weigth: number;
            constructor(props: { weigth: number } & typeof Props) {
              super(props);
              this.weigth = props.weigth;
            }
            run() {
              return this.walk() * 10 + this.weigth;
            }
          }
      );

      class Athlete extends Derive(Walk, Run) {
        start() {
          return this.walk() + this.run();
        }
      }

      // @ts-expect-error missing subtrait props
      new Athlete({ speed: 10 });

      // @ts-expect-error missing supertrait props
      new Athlete({ weigth: 10 });

      const athlete = new Athlete({ speed: 10, weigth: 10 });

      expect(athlete.start()).toBe(21);
    });

    it("ensures supertraits props are forwarded with multiple subtraits", () => {
      const Walk = Trait(
        (base) =>
          class Walk extends base {
            speed: number;
            constructor(props: { speed: number }) {
              super({});
              this.speed = props.speed;
            }
            walk() {
              return this.speed * 0.1;
            }
          }
      );

      const Fly = Trait(
        (base) =>
          class Fly extends base {
            wings: number;
            constructor(props: { wings: number }) {
              super({});
              this.wings = props.wings;
            }
            fly() {
              // @ts-expect-error wings is a number
              const s: string = this.wings;
              return this.wings;
            }
          }
      );

      const Land = Subtrait(
        [Walk, Fly], // supertrait of subtrait defined here
        (base, Props) =>
          class Land extends base {
            weigth: number;
            constructor(props: { weigth: number } & typeof Props) {
              super(props);
              this.weigth = props.weigth;
            }
            land() {
              return this.walk() + this.fly() - this.weigth;
            }
          }
      );

      // @ts-expect-error Land requires Walk & Fly
      (class extends Derive(Land) { });

      // @ts-expect-error Land requires Walk & Fly
      (class extends Derive(Walk, Land) { });

      // @ts-expect-error Land requires Walk & Fly
      (class extends Derive(Fly, Land) { });

      // @ts-expect-error Land requires Walk & Fly in correct order
      (class extends Derive(Land, Walk, Fly) { });

      class Athlete extends Derive(Walk, Fly, Land) { }

      // @ts-expect-error missing props
      new Athlete({ speed: 10 });
      // @ts-expect-error missing props
      new Athlete({ wings: 10 });
      // @ts-expect-error missing props
      new Athlete({ weigth: 10 });
      // @ts-expect-error missing props
      new Athlete({ speed: 10, weigth: 10 });
      // @ts-expect-error missing props
      new Athlete({ speed: 10, wings: 10 });
      // @ts-expect-error missing props
      new Athlete({ weigth: 10, wings: 10 });

      new Athlete({ speed: 10, weigth: 10, wings: 10 });
    });

    it("ensures a class can derive traits that dont depend on all other traits", () => {
      const Walk = Trait(
        (base) =>
          class Walk extends base {
            speed: number;
            constructor(props: { speed: number }) {
              super({});
              this.speed = props.speed;
            }
            walk() {
              return this.speed * 0.1;
            }
          }
      );

      const Fly = Trait(
        (base) =>
          class Fly extends base {
            wings: number;
            constructor(props: { wings: number }) {
              super({});
              this.wings = props.wings;
            }
            fly() {
              // @ts-expect-error wings is a number
              const s: string = this.wings;
              return this.wings;
            }
          }
      );

      const Land = Subtrait(
        [Walk], // supertrait of subtrait defined here
        (base, Props) =>
          class Land extends base {
            weigth: number;
            constructor(props: { weigth: number } & typeof Props) {
              super(props);
              this.weigth = props.weigth;
            }
            land() {
              return this.walk() - this.weigth;
            }

            static isLander() {
              return true;
            }
          }
      );

      // @ts-expect-error Land requires Walk & Fly
      (class extends Derive(Land) { });

      // @ts-expect-error Land requires Walk
      (class extends Derive(Fly, Land) { });

      // @ts-expect-error Land requires Walk & Fly in correct order
      (class extends Derive(Land, Walk, Fly) { });
      // @ts-expect-error Land requires Walk & Fly in correct order
      (class extends Derive(Fly, Land, Walk) { });

      class Athlete extends Derive(Walk, Fly, Land) { }

      // @ts-expect-error missing props
      new Athlete({ speed: 10 });
      // @ts-expect-error missing props
      new Athlete({ wings: 10 });
      // @ts-expect-error missing props
      new Athlete({ weigth: 10 });
      // @ts-expect-error missing props
      new Athlete({ speed: 10, weigth: 10 });
      // @ts-expect-error missing props
      new Athlete({ speed: 10, wings: 10 });
      // @ts-expect-error missing props
      new Athlete({ weigth: 10, wings: 10 });

      new Athlete({ speed: 10, weigth: 10, wings: 10 });
    });
  });

  it('works with optional primitive param', () => {
    const WithString = Trait((base) =>
      class extends base {
        constructor(props: string | undefined) {
          super(props)
        }
      })


    class A extends Derive(WithString) {
      constructor() {
        super(undefined)
      }
    }
  })

  it('allow abstract traits', () => {
    const SomeTrait = Trait((base) => {
      abstract class I extends base {
        abstract do(): void;
      }
      return I
    })


    // @ts-expect-error it should implement the abstract method
    class A extends Derive(SomeTrait) { }
  })
});