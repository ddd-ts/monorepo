# @ddd-ts/traits 👥💡

A TypeScript typesafe library for implementing the trait pattern.

## Installation ⬇️

```
npm install @ddd-ts/traits
```

## Usage 🚀

The `@ddd-ts/traits` library provides utility functions for implementing the trait pattern in TypeScript. Traits allow you to compose reusable behaviors and mix them into classes without the need for inheritance.


  - [Importing](#importing-)
  - [Creating Traits](#creating-traits-)
  - [Deriving Traits](#deriving-traits-)
  - [Overloading Trait Methods](#overloading-trait-methods-)
  - [Deriving Multiple Traits](#deriving-multiple-traits-)
  - [Traits with Constructors](#traits-with-constructors-)
  - [Type Checking with Traits](#type-checking-with-traits-)
  - [Generic Traits](#generic-traits-)
  - [Subtraits](#subtraits-)
  - [Subtraits with Props](#subtraits-with-props-)
  - [Forwarding Supertraits Props](#forwarding-supertraits-props-)
  - [Limitations](#limitations-)


### Importing 📥

```typescript
import { Derive, Subtrait, Trait, implementsTrait } from "@ddd-ts/traits";
```

### Creating Traits ✨

A trait is defined using the `Trait` function, which takes a base class and returns a new class that extends the base class with additional behavior.

```typescript
const Swim = Trait(
  (base) =>
    class extends base {
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
```

### Deriving Traits 🧬

To apply a trait to a class, use the `Derive` function. It takes the trait as an argument and returns a new class that extends the base class with the trait's behavior.

```typescript
class Fish extends Derive(Swim) {}

const fish = new Fish({});

console.log(fish.swim()); // Output: 1
```

### Overloading Trait Methods ⚙️

You can override a trait method in a derived class by defining the same method and using the `super` keyword to call the base implementation.

```typescript
class Dog extends Derive(Swim) {
  swim() {
    return super.swim() * 0.2;
  }
}

const dog = new Dog({});

console.log(dog.swim()); // Output: 0.2
```

### Deriving Multiple Traits 🌟

You can derive multiple traits by passing them as arguments to the `Derive` function.

```typescript
class Dog extends Derive(Swim, Walk) {}

const dog = new Dog({});

console.log(dog.swim()); // Output: 1
console.log(dog.walk()); // Output: 1
```

### Traits with Constructors 🏗️

If a trait requires initialization with certain properties, you can define a constructor in the trait class. When deriving a trait, you can pass the required properties to the `super` constructor.

```typescript
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

class Athlete extends Derive(Run) {
  constructor() {
    super({ speed: 10 });
  }
}

const athlete = new Athlete();

console.log(athlete.run()); // Output: 20
```

### Type Checking with Traits ✅

You can use the `implementsTrait` function to check if an instance implements a specific trait.

```typescript
class Athlete extends Derive(Run) {
  constructor() {
    super({ speed: 10 });
  }
}

const athlete = new Athlete();

console.log(athlete instanceof Athlete); // Output: true
console.log(implementsTrait(athlete, Run)); // Output: true
```

### Generic Traits 🎛️

Traits can also be generic, allowing you to specify additional type parameters when applying the trait.

```typescript
const Eat = <E>() =>
  Trait(
    (base) =>
      class extends base {
        eat(_e: E) {}
      }
  );

class Animal extends Derive(Eat<string>()) {
  do() {
    this.eat("a");
    // @ts-expect-error should

 not allow to eat a number
    this.eat(1);
  }
}
```

### Subtraits 🌳

Subtraits allow you to define traits that depend on other traits. The `Subtrait` function is used to create a subtrait, specifying the supertraits it depends on and the additional behavior it provides.

```typescript
const Walk = Trait(
  (base) =>
    class extends base {
      walk() {}
    }
);

const Run = Subtrait(
  [Walk] as const, // supertrait of subtrait defined here
  (base, Props) =>
    class extends base {
      run() {
        this.walk();
        this.walk();
        this.walk();
      }
    }
);

class Athlete extends Derive(Walk, Run) {
  do() {
    this.walk();
    this.run();
  }
}
```

### Subtraits with Props 🔧

Subtraits can also accept additional properties in their constructors. The supertraits' properties are automatically forwarded to the subtrait's constructor.

```typescript
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

console.log(athlete.start()); // Output: 22
```

### Forwarding Supertraits Props ↔️

When using subtraits with multiple supertraits, the properties of all supertraits are automatically forwarded to the subtrait's constructor.

```typescript
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

const Fly = Trait(
  (base) =>
    class extends base {
      wings: number;
      constructor(props: { wings: number }) {
        super({});
        this.wings = props.wings;
      }
      fly() {
        return this.wings;
      }
    }
);

const Land = Subtrait(
  [Walk, Fly], // supertraits of subtrait defined here
  (base, Props) =>
    class extends base {
      constructor(props: { weight: number } & typeof Props) {
        super(props);
      }
      land() {
        return this.walk() + this.fly() - this.weight;
      }
    }
);

class Athlete extends Derive(Walk, Fly, Land) {}

const athlete = new Athlete({ speed: 10, weight: 10, wings: 10 });

console.log(athlete.land()); // Output: 20
```

### Limitations ⚠️

- The ordering of supertraits is important. Subtraits must be derived in the correct order of their dependencies.

## License 📄

This project is licensed under the [MIT License](LICENSE).