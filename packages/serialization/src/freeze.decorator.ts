import { Constructor } from "@ddd-ts/traits";
import { Differences, Equals } from "./differences";

type Freezable<T> = {
	serialize(...args: any[]): T;
};
export function Freeze<T = any>() {
	return <C>(
		target: C,
	): C extends Constructor<any>
		? InstanceType<C> extends Freezable<infer G>
		? Equals<T, Awaited<G>> extends true
		? C
		: Differences<T, Awaited<G>>
		: never
		: never => {
		return target as any;
	};
}
