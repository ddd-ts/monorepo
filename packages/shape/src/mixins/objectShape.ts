import {
	DefinitionParameter,
	DefinitionRuntime,
	DefinitionSerialized,
} from "../definitions/definition";
import { DictDefinition, DictShorthand } from "../definitions/dict";
import { ShorthandToLonghand } from "../definitions/shorthands";
import { shorthandToLonghand } from "../shorthandToLonghand";
import { Class, Constructor, Expand } from "../types";

export type IsShapeConstructor<D extends DictShorthand | DictDefinition<any>> =
	Constructor<{
		serialize: () => Expand<DefinitionSerialized<ShorthandToLonghand<D>>>;
	}> & {
		deserialize: ShorthandToLonghand<D>["deserialize"];
		isShape: true;
	};

class DefaultShapeBaseClass {}

export const ObjectShape = <
	const D extends DictShorthand | DictDefinition<any>,
	const B extends Class<{}>,
>(
	definition: D,
	base: B = DefaultShapeBaseClass as B,
) => {
	const longhand = shorthandToLonghand(definition);

	class Intermediate extends base {
		base = base;
		static isShape = true as const;

		constructor(data: DefinitionParameter<ShorthandToLonghand<D>>) {
			const converted = longhand.paramToRuntime(data);
			super(converted);
			Object.assign(this, converted);
		}

		static deserialize<T extends IsShapeConstructor<D>>(
			this: T,
			serialized: Expand<DefinitionSerialized<ShorthandToLonghand<D>>>,
		) {
			return new this(longhand.deserialize(serialized as any));
		}

		serialize(): Expand<DefinitionSerialized<ShorthandToLonghand<D>>> {
			return longhand.serialize(this) as any;
		}
	}


  for (const method in longhand.instanceMethods) {
    Intermediate.prototype[method] = function (...args: any[]) {
      return (longhand as any).instanceMethods[method as any](this.value)(
        ...args,
      );
    };
  }

  for (const property in longhand.staticProperties) {
    (Intermediate as any)[property] = (longhand as any).staticProperties[
      property
    ];
  }

  type InstanceMethods = {
    [k in keyof typeof longhand.instanceMethods]: ReturnType<
      ShorthandToLonghand<D>["instanceMethods"][k]
    >;
  };

  type StaticProperties = {
    [k in keyof typeof longhand.staticProperties]: ShorthandToLonghand<D>["staticProperties"][k];
  };

	return Intermediate as unknown as {
		isShape: true;
		new (
			data: Expand<DefinitionParameter<ShorthandToLonghand<D>>>,
		): DefinitionRuntime<ShorthandToLonghand<D>> & {
			serialize(): Expand<DefinitionSerialized<ShorthandToLonghand<D>>>;
		} & InstanceType<B> & InstanceMethods;
		deserialize<T extends Constructor<any>>(
			this: T,
			serialized: Expand<DefinitionSerialized<ShorthandToLonghand<D>>>,
		): InstanceType<T>;
	} & Omit<B, ""> & StaticProperties;
};
