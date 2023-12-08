import * as ts from "typescript";

export function freeze(
	file: string,
	getNode: (file: ts.SourceFile, checker: ts.TypeChecker) => ts.Node,
) {
	const program = ts.createProgram([file], {});
	const checker = program.getTypeChecker();
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	const sourceFile = program
		.getSourceFiles()
		.find((s) => s.fileName.includes(file))!;
	const toFreeze = getNode(sourceFile, checker);
	const type = checker.getTypeAtLocation(toFreeze);

	// Explore the type definition
	const other = new Map();
	const explored = exploreType(type, checker, new Set(), other);
	const typeDefinitions = [...other.values()].join("\n");
	return `${typeDefinitions}\ntype Output = ${explored};`;
}

// const file = process.argv[2];

// // Load source files and create program
// const program = ts.createProgram([file], {});

// // Get type checker
// const checker = program.getTypeChecker();

// // Find the type declaration
// const sourceFile = program.getSourceFiles().find(s => s.fileName.includes(file))!;

// // Find the "Serialized" exported type
// const serializedType = sourceFile.statements
//     .filter(ts.isTypeAliasDeclaration)
//     .find(s => s.name.getText() === 'Serialized')
// if (!serializedType) throw new Error('Could not find Serialized type');

function listFlagsNames(flags: number) {
	const names = [];
	for (const flagName in ts.TypeFlags) {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		if ((ts.TypeFlags[flagName as any] as any) & flags) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			names.push([flagName, ts.TypeFlags[flagName as any]]);
		}
	}
	return names;
}

export function exploreType(
	type: ts.Type,
	checker: ts.TypeChecker,
	seen: Set<ts.Symbol> = new Set(),
	declarations: Map<ts.Symbol, string> = new Map(),
): string {
	if (type.aliasSymbol && seen.has(type.aliasSymbol)) {
		return type.aliasSymbol.name;
	}

	if (type.aliasSymbol) {
		const aliasType = checker.getDeclaredTypeOfSymbol(type.aliasSymbol);
		seen.add(type.aliasSymbol);
		const definition = exploreNativeType(
			aliasType,
			checker,
			seen,
			declarations,
		);
		declarations.set(
			type.aliasSymbol,
			`type ${type.aliasSymbol.name} = ${definition}`,
		);
		return type.aliasSymbol.name;
	}

	return exploreNativeType(type, checker, seen, declarations);
}

function exploreNativeType(
	type: ts.Type,
	checker: ts.TypeChecker,
	seen: Set<ts.Symbol> = new Set(),
	declarations: Map<ts.Symbol, string> = new Map(),
): string {
	if (type.flags & 402784252) {
		return checker.typeToString(type);
	}
	if (type.isUnionOrIntersection()) {
		const operator = type.isUnion() ? "|" : "&";
		return type.types
			.map((t) => exploreType(t, checker, seen, declarations))
			.join(` ${operator} `);
	}

	if (type.getSymbol()?.getName() === "ReadonlyArray") {
		const typeReference = type as ts.TypeReference;
		const elementType = typeReference.typeArguments
			? typeReference.typeArguments[0]
			: undefined;
		return elementType
			? `readonly (${exploreType(elementType, checker, seen, declarations)})[]`
			: "ReadonlyArray<any>";
	}

	if (checker.isTupleType(type)) {
		const typeReference = type as ts.TypeReference;
		const elementTypes = typeReference.typeArguments || [];
		return `[${elementTypes
			.map((t) => exploreType(t, checker, seen, declarations))
			.join(", ")}]`;
	}

	if (checker.isArrayType(type)) {
		const typeReference = type as ts.TypeReference;
		const elementType = typeReference.typeArguments
			? typeReference.typeArguments[0]
			: undefined;
		return elementType
			? `(${exploreType(elementType, checker, seen, declarations)})[]`
			: "any[]";
	}

	if (type.getSymbol()?.getName() === "Date") {
		return "Date";
	}

	if (type.flags & ts.TypeFlags.Object) {
		const properties = checker.getPropertiesOfType(type);

		return `{ ${properties.reduce((acc, property) => {
			const propertyType = checker.getTypeOfSymbol(property);
			const optional = property.flags & ts.SymbolFlags.Optional ? "?" : "";
			const readonly = property
				.getDeclarations()
				?.some(
					(declaration) =>
						ts.isPropertySignature(declaration) &&
						declaration.modifiers?.some(
							(modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
						),
				)
				? "readonly "
				: "";
			return (
				acc +
				`${readonly}${property.name}${optional}: ${exploreType(
					propertyType,
					checker,
					seen,
					declarations,
				)}; `
			);
		}, "")}}`;
	}

	if (type.flags & ts.TypeFlags.TypeParameter) {
		return (type as ts.TypeParameter).symbol.name;
	}

	return JSON.stringify({
		name: checker.typeToString(type),
		flags: listFlagsNames(type.flags),
	});
}
