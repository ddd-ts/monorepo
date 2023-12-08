import { Constructor } from "@ddd-ts/traits";
import { Serialized, ISerializer } from ".";

export type Equals<X, Y> = (<T>() => T extends { [K in keyof X]: X[K] }
	? 1
	: 2) extends <T>() => T extends { [K in keyof Y]: Y[K] } ? 1 : 2
	? true
	: false;

type Unfreezed = { FREEZED: "not_yet" };

export function Freeze<T = Unfreezed>() {
	return <C extends Constructor<ISerializer<any>>>(
		target: T extends Unfreezed
			? C
			: InstanceType<C> extends ISerializer<any>
			  ? Equals<Serialized<InstanceType<C>>, T> extends true
					? C
					: "ERROR: Serialized type does not match the given frozen type"
			  : "ERROR: Target is not a Serializer",
	): undefined => {};
}
