type Constructor<T = any> = new (...args: any[]) => T

export type PromiseOr<T> = T | Promise<T>

export abstract class ISerializer<T> {
    abstract for: Constructor<T>
    abstract version: bigint
    abstract serialize(value: T): PromiseOr<unknown & { version: bigint }>
    abstract deserialize(value: { version: bigint }): PromiseOr<T>
}

export const Serializer = <T extends Constructor, const V extends bigint>(ctor: T, version: V) => {
    abstract class I extends ISerializer<InstanceType<T>> {
        for = ctor
        version = version
    }
    return I
}

export type Serialized<T extends { serialize(...args: any[]): any }> = Awaited<ReturnType<T['serialize']>>


type Serializable = (Constructor<{ serialize(): any }>) & {
    deserialize(value: any): any
}

export const AutoSerializer = <T extends Serializable, const V extends bigint>(serializable: T, version: V) => {
    return class extends Serializer(serializable, version) {
        serialize(value: InstanceType<T>): ReturnType<InstanceType<T>['serialize']> & { version: V } {
            return {
                ...value.serialize(),
                version,
            }
        }

        deserialize(serialized: ReturnType<this['serialize']>): InstanceType<T> {
            const { version, ...rest } = serialized
            return serializable.deserialize(rest)
        }
    }
}

export class SerializerHistory<T> {
    public serializers: Map<bigint, ISerializer<T>>
    public for: Constructor<T>

    constructor(serializers: ISerializer<T>[]) {
        this.serializers = new Map()
        this.for = serializers[0].for
        for (const serializer of serializers) {
            this.serializers.set(serializer.version, serializer)
        }
    }

    get(version: bigint) {
        return this.serializers.get(version)
    }

    latest() {
        const version = Array.from(this.serializers.keys()).sort().pop()
        if (!version) {
            throw new Error('No serializers registered')
        }
        const serializer = this.serializers.get(version)
        if (!serializer) {
            throw new Error(`No serializer registered for version ${version}`)
        }
        return serializer
    }
}

export class UpcastSerializer<T> {
    public for: Constructor<T>
    constructor(protected history: SerializerHistory<T>) {
        this.for = history.for
    }

    serialize(value: T) {
        return this.history.latest().serialize(value)
    }

    deserialize(value: any) {
        let version = value.version

        if (typeof version !== 'bigint') {
            version = 0n
        }

        const serializer = this.history.get(version)

        if (!serializer) {
            throw new Error(`No serializer registered for version ${version}`)
        }

        return serializer.deserialize(value)
    }
}