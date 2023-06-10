import { Model } from "./model";

export type Serialized<S extends { serialize: (...args: any[]) => any }> =
  Awaited<ReturnType<S["serialize"]>>;

export abstract class Serializer<
  Model,
  Serialized extends { version: bigint } = { version: bigint }
> {
  abstract readonly version: bigint;
  abstract serialize(
    model: Model
  ): { version: bigint } | Promise<{ version: bigint }>;
  abstract deserialize(
    serialized: Omit<Serialized, "version">
  ): Model | Promise<Model>;
}

export class UpcastSerializer<M extends Model>
  implements Omit<Serializer<M>, "version">
{
  constructor(private readonly serializers: Serializer<M>[]) {
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
    let guess = this.serializers[version]; // fast guess
    if (guess && Number(guess.version) === version) {
      return guess;
    }

    const serializer = this.serializers.find(
      (serializer) => Number(serializer.version) === Number(version)
    );

    if (!serializer) {
      throw new Error(`No serializer found for version ${version}`);
    }
    return serializer;
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
