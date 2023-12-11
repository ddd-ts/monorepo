import { Differences } from "./differences";

{
	// it should return never when left and right are the same
	const a: never = {} as Differences<string, string>;
	const b: never = {} as Differences<number, number>;
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	const c: never = {} as Differences<{}, {}>;
	const d: never = {} as Differences<[], []>;
	const e: never = {} as Differences<true, true>;
	const f: never = {} as Differences<string | number, number | string>;

	type ga = { a: string | number } | { b: string };
	type gb = { a: number | string } | { b: string };
	const g: never = {} as Differences<ga, gb>;
}

{
	// it should detect top level differences
	type L = string;
	type R = number;
	type D = Differences<L, R>;

	const error: D = {
		path: "",
		message: "Left does not extends Right",
		left: "string",
		right: 0,
	};
}

{
	// it should detect shallow differences
	type L = { a: string };
	type R = { a: number };
	type D = Differences<L, R>;

	const error: D = {
		path: "a",
		message: "Left does not extends Right",
		left: "string",
		right: 0,
	};
}

{
	// it should detect deep differences
	type L = { a: string; b: { c: number } };
	type R = { a: string; b: { c: string } };
	type D = Differences<L, R>;

	const error: D = {
		path: "b.c",
		message: "Left does not extends Right",
		left: 0,
		right: "string",
	};
}

{
	// it should detect when left is an object but right isnt
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	type L = { a: {} };
	type R = { a: string };
	type D = Differences<L, R>;

	const error: D = {
		path: "a",
		message: "Left is an object but Right isnt",
		left: {},
		right: "string",
	};
}

{
	// it should detect when right is an object but left isnt
	type L = { a: string };
	// biome-ignore lint/complexity/noBannedTypes: <explanation>
	type R = { a: {} };
	type D = Differences<L, R>;

	const error: D = {
		path: "a",
		message: "Right is an object but Left isnt",
		left: "string",
		right: {},
	};
}

{
	// it should detect missing properties
	type L = { a: string; b: { c: number } };
	type R = { a: string; b: { c: number; d: string } };
	type D = Differences<L, R>;

	const error: D = {
		path: "b.d",
		message: "Left does not have this key",
		left: undefined,
		right: "string",
	};
}

{
	// it should detect multiple differences
	type L = { a: string; b: { c: number } };
	type R = { a: number; b: { c: string } };
	type D = Differences<L, R>;

	const error1: D = {
		path: "a",
		message: "Left does not extends Right",
		left: "string",
		right: 0,
	};
	const error2: D = {
		path: "b.c",
		message: "Left does not extends Right",
		left: 0,
		right: "string",
	};
}

{
	// it should detect unions with uncompatible types
	type L = { type: "room"; thing: true } | { type: "folder"; other: true };
	type R =
		| { type: "room"; thing: true }
		| { type: "folder"; other: true | false };

	type D = Differences<L, R>;
	const error: D = {
		path: "",
		message: "element of Right union not found in Left union",
		left: [
			{ type: "room", thing: true },
			{ type: "folder", other: true },
		],
		right: { type: "folder", other: Boolean() },
	};
}

{
	// it should detect deep unions with uncompatible types
	type L = { a: { b: { c: { d: number } | { e: string } } } };
	type R = { a: { b: { c: { d: number } | { e: number } } } };
	type D = Differences<L, R>;
}
{
	type L = { a: { b: { c: { d: number | string } } } };
	type R = { a: { b: { c: { d: number } } } };
	type D = Differences<L, R>;
}
