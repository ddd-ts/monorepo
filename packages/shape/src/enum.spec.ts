import { Enum } from "./enum"

describe('Enum', () => {
    class Bool extends Enum(['yes', 'no']) { }
    it('should instanciate', () => {
        new Bool('yes')
        new Bool('no')
        // @ts-expect-error it should not be possible to instanciate with invalid value
        new Bool('maybe')
    })

    it('should serialize and deserialize', () => {
        const test: 'yes' | 'no' = Bool.deserialize('yes').serialize()
        expect(test).toBe('yes')
    })

    it('should pattern match', async () => {
        const test: 'yeap' | 'nope' = await Bool.deserialize('yes').match({
            yes: async () => 'yeap' as const,
            no: async () => 'nope' as const
        })
        expect(test).toBe('yeap')

        // @ts-expect-error it should not be possible to pattern match with incomplete cases
        Bool.deserialize('yes').match({
            yes: () => 'yeap' as const,
        })

        // it should allow catch all instead of other cases
        Bool.deserialize('yes').match({
            yes: () => 'yeap' as const,
            _: () => 'nope' as const
        })
    })

    it('should become predictible after conditional', () => {
        const value = Bool.yes()
        if (value.is('yes')) {
            const test: 'yes' = value.serialize()
            expect(test).toBe('yes')
        }
    })


    // For next time :p
    //
    // it.skip('should allow struct enums', () => {
    //     class Triangle extends Shape(Number) { }

    //     class Geometry extends Enum({
    //         Point: null,
    //         Circle: Number,
    //         Rectangle: { side: Number }
    //         Triangle,
    //     }){}

    //     const rect = Geometry.deserialize({
    //         variant: 'Rectangle',
    //         params: {
    //             side: 2
    //         }
    //     }).serialize()

    //     expect(rect).toEqual({
    //         variant: 'Rectangle',
    //         params: {
    //             side: 2
    //         }
    //     })

    //     const triangle = Geometry.deserialize({
    //         variant: 'Triangle',
    //         params: 3
    //     })


    //     if(triangle.is('Triangle')){
    //         triangle.value === 3
    //     } 
    // })
})