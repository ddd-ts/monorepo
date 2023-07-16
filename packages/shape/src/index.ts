import { Derive, Trait } from "@ddd-ts/traits";

type Constructor = new (...args: any[]) => any;

type PrimitiveShape =
	| NumberConstructor
	| StringConstructor
	| BooleanConstructor
	| DateConstructor
	| BigIntConstructor;

type PrimitiveShapeToPrimitive<T extends PrimitiveShape> =
	T extends NumberConstructor
		? number
		: T extends StringConstructor
		? string
		: T extends BooleanConstructor
		? boolean
		: T extends DateConstructor
		? Date
		: never;

type SerializedShape<S> = S extends PrimitiveShape
	? PrimitiveShapeToPrimitive<S>
	: S extends { optional: infer U }
	? SerializedShape<U> | undefined
	: S extends Constructor & { deserialize(serialized: infer U): any }
	? U
	: S extends Array<infer U>
	? Array<SerializedShape<U>>
	: S extends readonly [...any[]]
	? { [K in keyof S]: SerializedShape<S[K]> }
	: S extends Record<string, any>
	? { [K in keyof S]: SerializedShape<S[K]> }
	: any;

type RuntimeShape<S> = S extends PrimitiveShape
	? PrimitiveShapeToPrimitive<S>
	: S extends { optional: infer U }
	? RuntimeShape<U>
	: S extends Constructor
	? InstanceType<S>
	: S extends Array<infer U>
	? Array<RuntimeShape<U>>
	: S extends readonly [...any[]]
	? { [K in keyof S]: RuntimeShape<S[K]> }
	: S extends Record<string, any>
	? { [K in keyof S]: RuntimeShape<S[K]> }
	: never;

function serialize<S>(shape: S, runtime: RuntimeShape<S>): SerializedShape<S> {
	if (shape === Number) {
		shape;
		return runtime as any;
	}

	if (shape === Boolean) {
		return runtime as any;
	}

	if (shape === String) {
		return runtime as any;
	}

	if (shape === BigInt) {
		return runtime as any;
	}

	if (shape === Date) {
		return runtime as any;
	}

	if ("optional" in (shape as any)) {
		if (runtime === undefined) {
			return undefined as any;
		}
		return serialize((shape as any).optional, runtime as any);
	}

	if ("serialize" in (runtime as any)) {
		return (runtime as any).serialize();
	}

	if (Array.isArray(shape)) {
		if (shape.length === 1) {
			return (runtime as any).map((element: any) =>
				serialize(shape[0] as any, element as any),
			) as any;
		}

		throw new Error("handle tuples");
	}

	const serialized: any = {};
	for (const key in shape) {
		const subshape = shape[key];
		serialized[key] = serialize(subshape, (runtime as any)[key]);
	}
	return serialized;
}

function deserialize<S>(
	shape: S,
	serialized: SerializedShape<S>,
): RuntimeShape<S> {
	if (shape === Number) {
		return serialized as any;
	}

	if (shape === Boolean) {
		return serialized as any;
	}

	if (shape === String) {
		return serialized as any;
	}

	if (shape === BigInt) {
		return serialized as any;
	}

	if (shape === Date) {
		return new Date(serialized as any) as any;
	}

	if ("optional" in (shape as any)) {
		if (serialized === undefined) {
			return undefined as any;
		}
		return deserialize((shape as any).optional, serialized) as any;
	}

	if ("deserialize" in (shape as any)) {
		return (shape as any).deserialize(serialized);
	}

	if (Array.isArray(shape)) {
		if (shape.length === 1) {
			return (serialized as any[]).map((element) =>
				deserialize(shape[0], element),
			) as any;
		}

		throw new Error("handle tuples");
	}

	const deserialized: any = {};
	for (const key in shape) {
		const subshape: any = shape[key];
		deserialized[key] = deserialize(subshape, (serialized as any)[key]);
	}
	return deserialized;
}

function isNested(shape: any): boolean {
	const isPrimitive =
		shape === Number ||
		shape === Boolean ||
		shape === String ||
		shape === Date ||
		shape === BigInt;

	if ("optional" in shape) {
		return true;
	}

	if (isPrimitive) return true;

	if (Array.isArray(shape)) {
		return true;
	}

	const isWrappingPrimitive = shape?.shape ? isNested(shape.shape) : false;
	return isWrappingPrimitive;
}

export const Shaped = <S>(shape: S) =>
	Trait((base) => {
		const nested = isNested(shape);
		abstract class Intermediate extends base {
			static shape = shape;
			constructor(props: RuntimeShape<S>) {
				super(props as any);
				if (nested) {
					(this as any).value = props as any;
				} else {
					Object.assign(this, props);
				}
			}

			serialize(): SerializedShape<S> {
				const { serialize: _, ...props } = this;
				return serialize(shape, nested ? (this as any).value : props);
			}

			static deserialize<T extends Constructor>(this: T, serialized: SerializedShape<S>) {
				return new this(deserialize(shape, serialized)) as InstanceType<T>;
			}
		}

		return Intermediate as typeof Intermediate & {
			new (...props: ConstructorParameters<typeof Intermediate>): InstanceType<
				typeof Intermediate
			> &
				MergedProps<S>;
		};
	});

type MergedProps<S> = S extends Constructor & { shape: any }
	? { value: InstanceType<S> }
	: S extends { optional: infer U extends Constructor & { shape: any } }
	? { value: InstanceType<U> | undefined }
	: S extends PrimitiveShape
	? { value: RuntimeShape<S> }
	: S extends { optional: infer U extends PrimitiveShape }
	? { value: RuntimeShape<U> | undefined }
	: S extends Array<any>
	? { value: RuntimeShape<S> }
	: S extends { optional: infer U extends Array<any> }
	? { value: RuntimeShape<U> | undefined }
	: S extends readonly [...any[]]
	? { value: RuntimeShape<S> }
	: S extends { optional: infer U extends readonly [...any[]] }
	? { value: RuntimeShape<U> | undefined }
	: S extends { optional: infer U }
	? { value: RuntimeShape<U> | undefined }
	: RuntimeShape<S>;

export const Shape = <S>(shape: S) => Derive(Shaped(shape));
export const Optional = <S>(shape: S) => ({ optional: shape });
