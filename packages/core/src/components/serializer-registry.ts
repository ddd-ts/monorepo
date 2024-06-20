import type { Constructor } from "@ddd-ts/types";
import type { INamed } from "../interfaces/named";
import type { ISerializer } from "../interfaces/serializer";

export class SerializerRegistry<
  Registered extends [INamed, ISerializer<INamed>][] = [],
> implements ISerializer<Registered[number][0]>
{
  store = new Map<string, any>();

  add<Item extends Constructor, S extends ISerializer<InstanceType<Item>>>(
    item: Item,
    serializer: S,
  ) {
    this.store.set(item.name, serializer);
    return this as unknown as SerializerRegistry<
      [...Registered, [InstanceType<Item>, S]]
    >;
  }

  get<Item extends INamed>(item: Item) {
    return this.store.get(item.name) as Extract<Registered, [Item, any]>[1];
  }

  serialize<Item extends Registered[number][0]>(item: Item) {
    const serializer = this.get(item);
    return serializer.serialize(item) as ReturnType<
      (typeof serializer)["serialize"]
    >;
  }

  deserialize<
    Serialized extends Parameters<Registered[number][1]["deserialize"]>[0],
  >(serialized: Serialized): ReturnType<Registered[number][1]["deserialize"]> {
    const serializer = this.get(serialized as any);
    return serializer.deserialize(serialized);
  }
}
