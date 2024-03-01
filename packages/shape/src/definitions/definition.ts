export type Definition<
	Runtime = any, 
	Serialized = any, 
	Param = Runtime, 
	InstanceMethods extends Record<string, any> = {}, 
	StaticProperties extends Record<string, any> = {}> = {
	paramToRuntime: (param: Param) => Runtime;
	serialize(runtime: Runtime): Serialized;
	deserialize(serialized: Serialized): Param;
	instanceMethods: InstanceMethods;
	staticProperties: StaticProperties;
	__used?: Param;
	isDict?: true;
};

export type DefinitionRuntime<D extends Definition> = Parameters<
	D["serialize"]
>[0];
export type DefinitionSerialized<D extends Definition> = ReturnType<
	D["serialize"]
>;
export type DefinitionParameter<D extends Definition> = D extends Definition<
	any,
	any,
	infer P
>
	? P
	: never;
