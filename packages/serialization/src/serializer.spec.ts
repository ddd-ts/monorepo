import { Shape } from "@ddd-ts/shape"
import { AutoSerializer, Serializer, SerializerHistory, UpcastSerializer } from "./serializer"

describe('Serializer', () => {

    it('should serialize and deserialize a class at a specific version', () => {

        class Dog extends Shape({ name: String }) { }
        class V1DogSerializer extends AutoSerializer(Dog)(1n) { }

        const serializer = new V1DogSerializer()

        const dog = serializer.deserialize({ name: 'Fido', version: 1n })
        const serialized = serializer.serialize(dog)

        expect(serialized).toEqual({ name: 'Fido', version: 1n })
    })

    it('should allow to redact multiple versions for a single domain object', () => {

        class Dog extends Shape({ firstName: String, lastName: String }) { }
        class V0DogSerializer extends Serializer<Dog>()(0n) {
            serialize(value: Dog) {
                return {
                    name: `${value.firstName} ${value.lastName}`,
                    version: this.version,
                }
            }

            deserialize(value: ReturnType<this['serialize']>): Dog {
                const [firstName, lastName] = value.name.split(' ')
                return new Dog({ firstName, lastName })
            }
        }
        class V1DogSerializer extends Serializer(Dog)(1n) {
            serialize(value: Dog) {
                return {
                    first: `${value.firstName}`,
                    last: `${value.lastName}`,
                    version: this.version,
                }
            }

            deserialize(value: ReturnType<this['serialize']>): Dog {
                return new Dog({ firstName: value.first, lastName: value.last })
            }
        }

        class V2DogSerializer extends AutoSerializer(Dog)(2n) { }


        const dog = new Dog({ firstName: 'Fido', lastName: 'TheDog' })

        const v0Serializer = new V0DogSerializer()
        const v1Serializer = new V1DogSerializer()
        const v2Serializer = new V2DogSerializer()

        const v0Dog = v0Serializer.serialize(dog)
        expect(v0Dog).toEqual({ name: 'Fido TheDog', version: 0n })

        const v1Dog = v1Serializer.serialize(dog)
        expect(v1Dog).toEqual({ first: 'Fido', last: 'TheDog', version: 1n })

        const v2Dog = v2Serializer.serialize(dog)
        expect(v2Dog).toEqual({ firstName: 'Fido', lastName: 'TheDog', version: 2n })

        const v0Deserialized = v0Serializer.deserialize(v0Dog)
        expect(v0Deserialized).toEqual(dog)

        const v1Deserialized = v1Serializer.deserialize(v1Dog)
        expect(v1Deserialized).toEqual(dog)

        const v2Deserialized = v2Serializer.deserialize(v2Dog)
        expect(v2Deserialized).toEqual(dog)

        const upcastSerializer = new UpcastSerializer([
            v2Serializer,
            v0Serializer,
            v1Serializer,
        ])

        // assume no version is v0
        const unknownDog = upcastSerializer.deserialize({ name: 'Fido TheDog' })
        expect(unknownDog).toEqual(dog)

        const v0Deserialized2 = upcastSerializer.deserialize(v0Dog)
        expect(v0Deserialized2).toEqual(dog)

        const v1Deserialized2 = upcastSerializer.deserialize(v1Dog)
        expect(v1Deserialized2).toEqual(dog)

        const v2Deserialized2 = upcastSerializer.deserialize(v2Dog)
        expect(v2Deserialized2).toEqual(dog)
    })
})