import { shorthandToLonghand } from "../shorthandToLonghand";
import {
	Definition,
	DefinitionParameter,
	DefinitionRuntime,
	DefinitionSerialized,
} from "./definition";
import { AnyShorthand, ShorthandToLonghand } from "./shorthands";

export type DictConfiguration = { [key: string]: AnyShorthand | Definition };
export type DictShorthand = DictConfiguration;

type Identity<T> = {
	[k in keyof T]: T[k];
};

type OnlyOptionalKeys<C extends DictConfiguration> = {
	[k in keyof C]: C[k] extends { optional: true } ? k : never;
}[keyof C];

type OnlyRequiredKeys<C extends DictConfiguration> = {
	[k in keyof C]: C[k] extends { optional: true } ? never : k;
}[keyof C];

type DictRuntime<C extends DictConfiguration> = Identity<
	{
		[k in OnlyRequiredKeys<C>]: DefinitionRuntime<ShorthandToLonghand<C[k]>>;
	} & {
		[k in OnlyOptionalKeys<C>]?: DefinitionRuntime<ShorthandToLonghand<C[k]>>;
	}
>;

type DictSerialized<C extends DictConfiguration> = Identity<
	{
		[k in OnlyRequiredKeys<C>]: DefinitionSerialized<ShorthandToLonghand<C[k]>>;
	} & {
		[k in OnlyOptionalKeys<C>]?: DefinitionSerialized<
			ShorthandToLonghand<C[k]>
		>;
	}
>;

type DictParameter<C extends DictConfiguration> = Identity<
	{
		[k in OnlyRequiredKeys<C>]: DefinitionParameter<ShorthandToLonghand<C[k]>>;
	} & {
		[k in OnlyOptionalKeys<C>]?: DefinitionParameter<ShorthandToLonghand<C[k]>>;
	}
>;

export type DictDefinition<C extends DictConfiguration = DictConfiguration> =
	Definition<DictRuntime<C>, DictSerialized<C>, DictParameter<C>>;
export function Dict<C extends DictConfiguration>(
	configuration: C,
): DictDefinition<C> {
	const longhand = Object.entries(configuration).reduce<{
		[key: string]: Definition;
	}>((acc, [key, value]) => {
		acc[key] = shorthandToLonghand(value);
		return acc;
	}, {});

	return {
		paramToRuntime: (param) => {
			return Object.entries(longhand).reduce<Record<string, any>>(
				(acc, [key, value]) => {
					const typedKey = key as keyof DictParameter<C>;
					const paramAtKey = param[typedKey];
					acc[key] = value.paramToRuntime(paramAtKey);
					return acc;
				},
				{},
			) as DictRuntime<C>;
		},
		serialize: (runtime) => {
			const serialized = {} as any;
			for (const key in longhand) {
				const typedKey = key as keyof DictRuntime<C>;
				serialized[key] = longhand[key]!.serialize(runtime[typedKey]);
			}
			return serialized;
		},
		deserialize: (serialized) => {
			const runtime = {} as any;
			for (const key in longhand) {
				const typedKey = key as keyof DictRuntime<C>;
				runtime[key] = longhand[key]!.deserialize(serialized[typedKey]);
			}
			return runtime;
		},
		isDict: true,
	};
}
