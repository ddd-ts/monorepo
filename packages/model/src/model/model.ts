export type ModelId = { serialize(): string } | { toString(): string }

export abstract class Model {
    abstract id: ModelId
}
