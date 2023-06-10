import { v4 } from "uuid";
import { Constructor } from "@ddd-ts/types";
import { Derive } from "@ddd-ts/traits";
import { Shaped } from "@ddd-ts/shape";

export type Serializable =
  | { [key: string | number]: string | number | boolean | Serializable }
  | Serializable[];

export type Change<T> = T & { revision: undefined };
export type Fact<T> = T & { revision: bigint };

export const Event = <S extends {}>(shape: S) => {
  return class E extends Derive(Shaped({ id: String, payload: shape })) {
    id = v4();
    type = this.constructor.name;

    revision?: bigint;

    static newChange<T extends Constructor>(
      this: T,
      payload: InstanceType<T>["payload"]
    ) {
      const instance = new this({
        id: v4(),
        payload,
      });

      return instance as Change<InstanceType<T>>;
    }

    static newFact<T extends Constructor>(
      this: T,
      payload: InstanceType<T>["payload"],
      revision: bigint
    ) {
      const instance = new this({
        id: v4(),
        payload,
      }) as InstanceType<T>;

      instance.revision = revision;

      return instance as Fact<InstanceType<T>>;
    }

    static deserialize<
      T extends Constructor,
      Serialized extends {
        id: string;
        payload: InstanceType<T>["payload"];
        revision?: bigint;
      }
    >(
      this: T,
      serialized: Serialized
    ): Serialized["revision"] extends bigint
      ? Fact<InstanceType<T>>
      : Change<InstanceType<T>> {
      const instance = new this({
        id: serialized.id,
        payload: serialized.payload,
      });

      if (typeof serialized.revision !== "undefined") {
        instance.revision = serialized.revision;
      }

      return instance as any;
    }
  };
};

// export const Event = <S>(shape: S) => {
//   return class extends Derive(Shaped({ id: String, payload: shape })) {
//     // id = v4();
//     // type = this.constructor.name;

//     // revision?: bigint;

//     // static newChange<T extends Constructor>(
//     //   this: T,
//     //   payload: InstanceType<T>["payload"]
//     // ) {
//     //   const instance = new this({
//     //     id: v4(),
//     //     payload,
//     //   });

//     //   return instance as Change<InstanceType<T>>;
//     // }

//     // static newFact<T extends Constructor>(
//     //   this: T,
//     //   revision: bigint,
//     //   payload: InstanceType<T>["payload"]
//     // ) {
//     //   const instance = new this({
//     //     id: v4(),
//     //     payload,
//     //   }) as InstanceType<T>;

//     //   instance.revision = revision;

//     //   return instance as Fact<InstanceType<T>>;
//     // }

//   //   static deserialize<
//   //     T extends Constructor,
//   //     Serialized extends {
//   //       id: string;
//   //       payload: InstanceType<T>["payload"];
//   //       revision?: bigint;
//   //     }
//   //   >(
//   //     this: T,
//   //     serialized: Serialized
//   //   ): Serialized["revision"] extends bigint
//   //     ? Fact<InstanceType<T>>
//   //     : Change<InstanceType<T>> {
//   //     const instance = new this({
//   //       id: serialized.id,
//   //       payload: serialized.payload,
//   //     });

//   //     if (serialized.revision) {
//   //       instance.revision = serialized.revision;
//   //     }

//   //     return instance as any;
//   //   }
//   // };
// };
