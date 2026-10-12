# Class

Wraps an existing class that already implements `serialize()` and `static deserialize()`. This lets you integrate third-party or pre-existing classes into the shape system.

## Import

```ts
import { Class } from "@ddd-ts/shape";
```

## Usage

```ts
class Money {
  constructor(public amount: number, public currency: string) {}

  serialize() {
    return { amount: this.amount, currency: this.currency };
  }

  static deserialize(data: { amount: number; currency: string }) {
    return new Money(data.amount, data.currency);
  }
}

class Product extends Dict({
  name: String,
  price: Class(Money),
}) {}

const product = Product.deserialize({ name: "Book", price: { amount: 10, currency: "EUR" } });
product.price instanceof Money; // true
product.price.amount; // 10
product.serialize(); // { name: "Book", price: { amount: 10, currency: "EUR" } }
```

## Requirements

The wrapped class must have:
- An instance method `serialize()` that returns a serializable value
- A static method `deserialize(value)` that returns a new instance

## When to use

Use `Class(...)` when you have an existing class you don't want to rewrite as a shape. If you're defining a new type, prefer `Primitive`, `Dict`, or other shapes directly.

## As a standalone shape

```ts
class WrappedMoney extends Class(Money) {}

const m = new WrappedMoney(new Money(10, "EUR"));
m.value;       // Money instance
m.serialize(); // { amount: 10, currency: "EUR" }

const restored = WrappedMoney.deserialize({ amount: 10, currency: "EUR" });
restored.value instanceof Money; // true
```

## Instance API

| Member | Type | Description |
|--------|------|-------------|
| `value` | instance of the wrapped class | The wrapped instance |
| `serialize()` | return type of the class's serialize | Delegates to the wrapped class |

## Static API

| Member | Type | Description |
|--------|------|-------------|
| `deserialize(value)` | returns instance | Reconstruct via the wrapped class |
| `$serialize(value)` | serialized form | Delegates to the class's serialize |
| `$deserialize(value)` | class instance | Delegates to the class's deserialize |
| `$shape` | `"class"` | Shape discriminator |
| `$of` | the wrapped class constructor | Reference to the original class |
