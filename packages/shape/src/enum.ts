import { Constructor } from "@ddd-ts/traits";

export const Enum = <const V extends string>(values: V[]) => {
	const I = class EnumIntermediate {
		static values = values[0];
		constructor(public value: V) { }

		serialize(): this['value'] {
			return this.value;
		}

		is<U extends V>(value: U): this is this & { value: U, serialize(): U } {
			return this.value === value;
		}

		match<T extends EnumIntermediate, M extends MatcherParam<V>>(this: T, matcher: M): M extends Required<MatcherParam<V>> ? {
			[K in V]: M[K] extends () => infer R ? R : never
		}[V] : {
			[K in V]: M[K] extends () => infer R ? R : never
		}[V] | (M extends { _: () => infer R } ? R : never) {
			const fn = matcher[this.value];
			if (fn) {
				return fn() as any
			}
			const catchAll = (matcher as any)._
			return catchAll() as any

		}

		static deserialize<T extends Constructor>(this: T, value: V) {
			return new this(value) as InstanceType<T>
		}
	}

	for (const v of values) {

		(I as any)[v] = function <T extends Constructor>(this: T) {
			return new this(v) as InstanceType<T>
		}
	}

	return I as typeof I & {
		[K in V]: <T extends Constructor>(this: T) => InstanceType<T>
	}
}

type Matcher<cases extends string> = {
	[K in cases]?: () => any;
}

type Catchall = { _: () => any }

type MatcherParam<cases extends string> = Required<Matcher<cases>> | (Matcher<cases> & Catchall)
