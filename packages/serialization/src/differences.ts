type Path<
	Current extends string,
	T extends string | number | symbol,
> = Current extends ""
	? T
	: `${Current}.${T extends string | number ? T : "some symbol"}`;

type Difference = { path: string };
type ShouldHandleUnion<L, R> = IsUnion<L> | IsUnion<R>;

type HandleUnion<
	L,
	R,
	Current extends string,
	Diffs extends Difference[],
> = IsUnion<L> extends true
	? IsUnion<R> extends true
		? [
				...{
					[K in keyof UnionToArray<L>]: K extends `${number}`
						? UnionToArray<L>[K] extends infer UnionElement
							? UnionElement extends R
								? Diffs
								: [
										...Diffs,
										{
											path: Current;
											message: "element of Left union not found in Right union";
											left: UnionElement;
											right: UnionToArray<R>;
										},
								  ]
							: Diffs
						: Diffs;
				}[keyof UnionToArray<L>],
				...{
					[K in keyof UnionToArray<R>]: K extends `${number}`
						? UnionToArray<R>[K] extends infer UnionElement
							? UnionElement extends L
								? Diffs
								: [
										...Diffs,
										{
											path: Current;
											message: "element of Right union not found in Left union";
											left: UnionToArray<L>;
											right: UnionElement;
										},
								  ]
							: Diffs
						: Diffs;
				}[keyof UnionToArray<R>],
		  ]
		: [
				...Diffs,
				{
					path: Current;
					message: "Left is an union but Right isnt";
					left: L;
					right: R;
				},
		  ]
	: IsUnion<R> extends true
	  ? [
				...Diffs,
				{
					path: Current;
					message: "Right is a union but Left isnt";
					left: L;
					right: R;
				},
		  ]
	  : Diffs;

type ShouldHandleObject<L, R> = L extends object
	? R extends object
		? true
		: true
	: R extends object
	  ? true
	  : false;

type HandleObject<
	L,
	R,
	Current extends string,
	Diffs extends Difference[],
> = L extends object
	? R extends object
		? {
				[K in keyof L | keyof R]: K extends keyof L & keyof R
					? Diff<L[K], R[K], Path<Current, K>, Diffs>
					: K extends keyof L
					  ? [
								...Diffs,
								{
									path: Path<Current, K>;
									message: "Right does not have this key";
									left: L[K];
									right: undefined;
								},
						  ]
					  : K extends keyof R
						  ? [
									...Diffs,
									{
										path: Path<Current, K>;
										message: "Left does not have this key";
										left: undefined;
										right: R[K];
									},
							  ]
						  : Diffs;
		  }[keyof L | keyof R]
		: [
				...Diffs,
				{
					path: Current;
					message: "Left is an object but Right isnt";
					left: L;
					right: R;
				},
		  ]
	: R extends object
	  ? [
				...Diffs,
				{
					path: Current;
					message: "Right is an object but Left isnt";
					left: L;
					right: R;
				},
		  ]
	  : Diffs;

type HandlePrimitive<
	L,
	R,
	Current extends string,
	Diffs extends Difference[],
> = L extends R
	? R extends L
		? Diffs
		: [
				...Diffs,
				{
					path: Current;
					message: "Right does not extends Left";
					left: L;
					right: R;
				},
		  ]
	: [
			...Diffs,
			{
				path: Current;
				message: "Left does not extends Right";
				left: L;
				right: R;
			},
	  ];

type Diff<
	L,
	R,
	Current extends string = "",
	Diffs extends Difference[] = [],
> = ShouldHandleUnion<L, R> extends true
	? HandleUnion<L, R, Current, Diffs>
	: ShouldHandleObject<L, R> extends true
	  ? HandleObject<L, R, Current, Diffs>
	  : HandlePrimitive<L, R, Current, Diffs>;

export type Differences<L, R> = Equals<L, R> extends true
	? never
	: Diff<L, R, "", []> extends infer U
	  ? // biome-ignore lint/suspicious/noExplicitAny: <explanation>
		  U extends Array<any>
			? U[number]
			: never
	  : never;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never;

type UnionToOvlds<U> = UnionToIntersection<
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	U extends any ? (f: U) => void : never
>;

type PopUnion<U> = UnionToOvlds<U> extends (a: infer A) => void ? A : never;

type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

type UnionToArray<T, A extends unknown[] = []> = IsUnion<T> extends true
	? UnionToArray<Exclude<T, PopUnion<T>>, [PopUnion<T>, ...A]>
	: [T, ...A];

export type Equals<X, Y> = (() => X) extends () => Y
	? (() => Y) extends () => X
		? true
		: false
	: false;
