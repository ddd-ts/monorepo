import {
  Serializer,
  UpcastSerializer,
  V0VersionnedSerializer,
  VersionnedSerializer,
} from "./serializer";

describe("Serializer", () => {
  class User {
    constructor(public readonly id: string, public readonly name: string) {}

    static deserialize(id: string, name: string) {
      return new User(id, name);
    }
  }

  it("should be able to serialize and deserialize", () => {
    class UserSerializer extends Serializer<User> {
      serialize(user: User) {
        return { id: user.id, name: user.name };
      }

      deserialize(serialized: ReturnType<this["serialize"]>) {
        return User.deserialize(serialized.id, serialized.name);
      }

      getIdFromModel(user: User) {
        return user.id;
      }
    }

    const serializer = new UserSerializer();

    const user = new User("1", "John Doe");

    const serialized = serializer.serialize(user);
    const deserialized = serializer.deserialize(serialized);

    expect(deserialized).toEqual(user);
  });

  class UserSerializerV0 extends V0VersionnedSerializer<User> {
    deserialize(serialized: any) {
      return User.deserialize(serialized.id, serialized.name || serialized.id); // in v0, name was not present
    }

    getIdFromModel(user: User) {
      return user.id;
    }
  }

  class UserSerializerV1 extends VersionnedSerializer<User> {
    version = 1n;

    serialize(user: User) {
      return { id: user.id, name: user.name, version: this.version };
    }

    deserialize(serialized: ReturnType<this["serialize"]>) {
      return User.deserialize(serialized.id, serialized.name);
    }

    getIdFromModel(user: User) {
      return user.id;
    }
  }

  class UserSerializerV2 extends VersionnedSerializer<User> {
    version = 2n;

    private serializerName(name: string) {
      return `${name} (v2)`;
    }

    private deserializerName(name: string) {
      return name.split(" ")[0]; // intentionally destructive
    }

    serialize(user: User) {
      return {
        id: user.id,
        name: this.serializerName(user.name),
        version: this.version,
      };
    }

    deserialize(serialized: ReturnType<this["serialize"]>) {
      return User.deserialize(
        serialized.id,
        this.deserializerName(serialized.name)
      );
    }

    getIdFromModel(user: User) {
      return user.id;
    }
  }

  it("should be able to serialize and deserialize with version", () => {
    const serializerV1 = new UserSerializerV1();
    const serializerV2 = new UserSerializerV2();
    const serializer = new UpcastSerializer([serializerV1, serializerV2]);

    const user = new User("1", "John Doe");

    const serializedV1 = serializerV1.serialize(user);

    const deserialized = serializer.deserialize(serializedV1);
    expect(deserialized).toEqual(user);

    const serialized = serializer.serialize(user);
    expect(serialized).toEqual({
      id: user.id,
      name: `${user.name} (v2)`,
      version: serializerV2.version,
    });
  });

  it("should use the 0n serializer if the input is not versionned", () => {
    const serializerV0 = new UserSerializerV0();
    const serializerV1 = new UserSerializerV1();
    const serializerV2 = new UserSerializerV2();
    const serializer = new UpcastSerializer([
      serializerV0,
      serializerV1,
      serializerV2,
    ]);

    const user = serializer.deserialize({ id: "2" });

    expect(user).toEqual(new User("2", "2"));
  });
});
