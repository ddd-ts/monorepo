import { AbstractConstructor } from "../es-aggregate-store/event-store";

export interface ISerializer<M, Id, Serialized extends { id: string }> {
  getIdFromModel(model: M): Id;
  serialize(model: M): Serialized;
  deserialize(serialized: Serialized): M;
}

// // Used to ensure compatibility with legacy code, by taking serializer type
// // instead of old defined type
// export type GetSerialized<T extends ISerializer<any, any, any>> = ReturnType<
//   T["serialize"]
// >;

// export function Serializer<Model, Id, Serialized extends { id: string }>({
//   serialize,
//   deserialize,
//   getIdFromModel,
// }: {
//   getIdFromModel: (model: Model) => Id;
//   serialize: (model: Model) => Serialized;
//   deserialize: (serialized: Serialized) => Model;
// }): AbstractConstructor<ISerializer<Model, Id, Serialized>> {
//   abstract class S implements ISerializer<Model, Id, Serialized> {
//     getIdFromModel(model: Model) {
//       return getIdFromModel(model);
//     }

//     serialize(model: Model) {
//       return serialize(model);
//     }

//     deserialize(serialized: Serialized) {
//       return deserialize(serialized);
//     }
//   }

//   return S;
// }

export abstract class Serializer<Model> {
  abstract serialize(model: Model): { id: string };
  abstract deserialize(serialized: ReturnType<this["serialize"]>): Model;
  abstract getIdFromModel(model: Model): { toString(): string };
}
