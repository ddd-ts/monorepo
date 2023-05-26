import { Model } from "./model";

export type Serialized<S extends { serialize: (...args: any[]) => any }> =
  Awaited<ReturnType<S["serialize"]>>;

export abstract class Serializer<Model> {
  abstract serialize(model: Model): {} | Promise<{}>;
  abstract deserialize(serialized: Serialized<this>): Model | Promise<Model>;
  abstract getIdFromModel(model: Model): { toString(): string };

  abstract getIdFromSerialized(serialized: Serialized<this>): {
    toString(): string;
  };
}

export abstract class VersionnedSerializer<Model> extends Serializer<Model> {
  abstract version: bigint;
  async serialize(model: Model) {
    return {
      version: this.version,
      ...(await this.serializeModel(model)),
    };
  }

  async deserialize(serialized: Serialized<this>): Promise<Model> {
    return this.deserializeModel(serialized);
  }

  abstract serializeModel(model: Model): Promise<any>;
  abstract deserializeModel(serialized: Serialized<this>): Promise<Model>;
}

export abstract class V0VersionnedSerializer<
  Model
> extends VersionnedSerializer<Model> {
  version = 0n;

  serializeModel(model: Model): Promise<{ version: bigint }> {
    throw new Error(`Not implemented`);
  }
}

export class UpcastSerializer<M extends Model> implements Serializer<M> {
  constructor(
    private readonly serializers: (Serializer<M> & { version: bigint })[]
  ) {
    this.serializers = this.serializers.sort(
      (a, b) => Number(a.version) - Number(b.version)
    );
  }

  get latest() {
    return this.serializers[this.serializers.length - 1];
  }

  get oldest() {
    return this.serializers[0];
  }

  private getSerializer(version: number) {
    let serializer = this.serializers[version];
    if (!serializer || Number(serializer.version) !== Number(version)) {
      this.serializers.find(
        (serializer) => Number(serializer.version) === Number(version)
      );
    }
    if (!serializer) {
      throw new Error(`No serializer found for version ${version}`);
    }
    return serializer;
  }

  getIdFromModel(model: M) {
    if (!this.latest) {
      throw new Error(`No serializer found`);
    }

    return this.latest.getIdFromModel(model);
  }

  getIdFromSerialized(serialized: any) {
    if (!serialized.version) {
      if (!this.oldest) {
        throw new Error(`No serializer found`);
      }
      return this.oldest.getIdFromSerialized(serialized);
    }

    const serializer = this.getSerializer(serialized.version);

    return serializer.getIdFromSerialized(serialized);
  }

  serialize(model: M) {
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

    const serializer = this.getSerializer(serialized.version);

    return serializer.deserialize(serialized);
  }
}
