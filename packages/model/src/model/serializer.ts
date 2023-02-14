export type Serialized<S extends { serialize: (...args: any[]) => any }> =
  Awaited<ReturnType<S["serialize"]>>;

export abstract class Serializer<Model> {
  abstract serialize(model: Model): Promise<any>;
  abstract deserialize(serialized: Serialized<this>): Promise<Model>;
  abstract getIdFromModel(model: Model): { toString(): string };

  abstract getIdFromSerialized(serialized: Serialized<this>): {
    toString(): string;
  };
}

export abstract class VersionnedSerializer<Model> extends Serializer<Model> {
  abstract version: bigint;
  abstract serialize(model: Model): Promise<{ version: bigint }>;
  abstract deserialize(serialized: Serialized<this>): Promise<Model>;
}

export abstract class V0VersionnedSerializer<
  Model
> extends VersionnedSerializer<Model> {
  version = 0n;

  serialize(model: Model): Promise<{ version: bigint }> {
    throw new Error(`Not implemented`);
  }
}

export class UpcastSerializer<Model> {
  constructor(private readonly serializers: VersionnedSerializer<Model>[]) {}

  get sorted() {
    return [...this.serializers].sort(
      (a, b) => Number(a.version) - Number(b.version)
    );
  }

  get latest() {
    return this.sorted.pop();
  }

  get oldest() {
    return this.sorted.shift();
  }

  serialize(model: Model) {
    if (!this.latest) {
      throw new Error(`No serializer found`);
    }

    return this.latest.serialize(model);
  }

  deserialize(serialized: any) {
    if (!serialized.version) {
      if (!this.oldest) {
        throw new Error(`No serializer found`);
      }
      return this.oldest.deserialize(serialized);
    }

    const serializer = this.serializers.find(
      (serializer) => serializer.version === serialized.version
    );

    if (!serializer) {
      throw new Error(`No serializer found for version ${serialized.version}`);
    }

    return serializer.deserialize(serialized);
  }
}
