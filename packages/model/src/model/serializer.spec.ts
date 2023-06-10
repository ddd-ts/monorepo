import { Serialized, Serializer, UpcastSerializer } from "./serializer";

describe("Serializer", () => {
  class User {
    constructor(public readonly id: string, public readonly name: string) {}

    static deserialize(id: string, name: string) {
      return new User(id, name);
    }
  }

  it("should be able to serialize and deserialize", async () => {
    class UserSerializer extends Serializer<User> {
      version = 1n;
      async serialize(user: User) {
        return { id: user.id, name: user.name, version: this.version };
      }

      async deserialize(serialized: Serialized<this>) {
        return User.deserialize(serialized.id, serialized.name);
      }
    }

    const serializer = new UserSerializer();

    const user = new User("1", "John Doe");

    const serialized = await serializer.serialize(user);
    const deserialized = await serializer.deserialize(serialized);

    expect(deserialized).toEqual(user);
  });

  class UserSerializerV0 extends Serializer<User> {
    version = 0n;

    async serialize(user: User): Promise<any> {
      throw new Error("not implemented");
    }

    async deserialize(serialized: any) {
      return User.deserialize(serialized.id, serialized.name || serialized.id); // in v0, name was not present
    }
  }

  class UserSerializerV1 extends Serializer<User> {
    version = 1n;

    async serialize(user: User) {
      return { id: user.id, name: user.name, version: this.version };
    }

    async deserialize(serialized: Serialized<this>) {
      return User.deserialize(serialized.id, serialized.name);
    }
  }

  class UserSerializerV2 extends Serializer<User> {
    version = 2n;

    private serializerName(name: string) {
      return `${name} (v2)`;
    }

    private deserializerName(name: string) {
      return name.split(" ")[0]; // intentionally destructive
    }

    async serialize(user: User) {
      return {
        id: user.id,
        name: this.serializerName(user.name),
        version: this.version,
      };
    }

    async deserialize(serialized: Serialized<this>) {
      return User.deserialize(
        serialized.id,
        this.deserializerName(serialized.name)
      );
    }
  }

  it("should be able to serialize and deserialize with version", async () => {
    const serializerV1 = new UserSerializerV1();
    const serializerV2 = new UserSerializerV2();
    const serializer = new UpcastSerializer([serializerV1, serializerV2]);

    const user = new User("1", "John Doe");

    const serializedV1 = await serializerV1.serialize(user);

    const deserialized = await serializer.deserialize(serializedV1);
    expect(deserialized).toEqual(user);

    const serialized = await serializer.serialize(user);
    expect(serialized).toEqual({
      id: user.id,
      name: `${user.name} (v2)`,
      version: serializerV2.version,
    });
  });

  it("should use the 0n serializer if the input is not versionned", async () => {
    const serializerV0 = new UserSerializerV0();
    const serializerV1 = new UserSerializerV1();
    const serializerV2 = new UserSerializerV2();
    const serializer = new UpcastSerializer([
      serializerV0,
      serializerV1,
      serializerV2,
    ]);

    const user = await serializer.deserialize({ id: "2" });

    expect(user).toEqual(new User("2", "2"));
  });
});
