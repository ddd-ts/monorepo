export type Serialized<S extends Serializer<any>> = ReturnType<S["serialize"]>;

export abstract class Serializer<Model> {
  abstract serialize(model: Model): { id: string };
  abstract deserialize(serialized: ReturnType<this["serialize"]>): Model;
  abstract getIdFromModel(model: Model): { toString(): string };
}
