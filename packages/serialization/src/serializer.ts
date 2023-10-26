type Constructor<T = any> = new (...args: any[]) => T

export type PromiseOr<T> = T | Promise<T>

export abstract class ISerializer<T> {
    abstract serialize(value: T): PromiseOr<unknown & { version: bigint }>
    abstract deserialize(value: { version: bigint }): PromiseOr<T>
}

type VersionnedSerializer<T> = ISerializer<T> & { version: bigint }

export const Serializer = <T>(version: bigint) => {
    abstract class I extends ISerializer<T> implements VersionnedSerializer<T> {
        version = version
    }
    return I
}


export type Serialized<T extends { serialize(...args: any[]): any }> = Awaited<ReturnType<T['serialize']>>


type Serializable = (Constructor<{ serialize(): any }>) & {
    deserialize(value: any): any
}

export const AutoSerializer = <T extends Serializable, const V extends bigint>(serializable: T, version: V) => {
    return class extends Serializer<InstanceType<T>>(version) {
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

    constructor(serializers: VersionnedSerializer<T>[]) {
        this.serializers = new Map()

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
    protected history: SerializerHistory<T>
    constructor(protected serializers: VersionnedSerializer<T>[]) {
        this.history = new SerializerHistory<T>(this.serializers)

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