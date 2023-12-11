import { Constructor } from "@ddd-ts/traits";
import { Differences, Equals } from "./differences";

type Unfreezed = { FREEZED: "not_yet" };

type Freezable<T> = {
	serialize(): T;
};

export function Freeze<T = Unfreezed>() {
	return <C extends Constructor<any>>(
		target: T extends Unfreezed
			? C
			: InstanceType<C> extends Freezable<infer G>
			  ? Equals<T, G> extends true
					? C
					: Differences<T, G>
			  : never,
	) => {};
}
