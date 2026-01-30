import * as ts from "typescript";

export function exploreType(
  type: ts.Type,
  checker: ts.TypeChecker,
  declarations: Map<ts.Symbol, string> = new Map(),
  seen: Set<string> = new Set(["Date", "Record"]),
): string {
  // seen.add(type.symbol?.getName() || "");
  if (type.aliasSymbol && seen.has(type.aliasSymbol.getName())) {
    const a = type.aliasTypeArguments;
    return `${type.aliasSymbol.name}${
      a
        ? `<${a
            .map((a) => exploreType(a, checker, declarations, seen))
            .join(", ")}>`
        : ""
    }`;
  }

  if (type.aliasSymbol) {
    const aliasType = checker.getDeclaredTypeOfSymbol(type.aliasSymbol);
    seen.add(type.aliasSymbol.getName());
    const definition = exploreNativeType(
      aliasType,
      checker,
      declarations,
      seen,
    );
    declarations.set(
      type.aliasSymbol,
      `type ${type.aliasSymbol.name} = ${definition}`,
    );
    return exploreType(aliasType, checker, declarations, seen);
  }

  return exploreNativeType(type, checker, declarations, seen);
}

const PrimitiveFlag = 402784252;

function exploreNativeType(
  type: ts.Type,
  checker: ts.TypeChecker,
  declarations: Map<ts.Symbol, string> = new Map(),
  seen: Set<string> = new Set(),
): string {
  if (type.flags & ts.TypeFlags.EnumLiteral) {
    const v = (type as any).value;
    if (typeof v === "string") {
      return `"${v}"`;
    }
    return v;
  }

  if (type.flags & PrimitiveFlag) {
    return checker.typeToString(type);
  }
  if (type.isUnionOrIntersection()) {
    const operator = type.isUnion() ? "|" : "&";
    return type.types
      .map((t) => exploreType(t, checker, declarations, seen))
      .join(` ${operator} `);
  }

  if (type.getSymbol()?.getName() === "ReadonlyArray") {
    const typeReference = type as ts.TypeReference;
    const elementType = typeReference.typeArguments
      ? typeReference.typeArguments[0]
      : undefined;
    return elementType
      ? `readonly (${exploreType(elementType, checker, declarations, seen)})[]`
      : "ReadonlyArray<any>";
  }

  if (checker.isTupleType(type)) {
    const typeReference = type as ts.TypeReference;
    const elementTypes = typeReference.typeArguments || [];
    return `[${elementTypes
      .map((t) => exploreType(t, checker, declarations, seen))
      .join(", ")}]`;
  }

  if (checker.isArrayType(type)) {
    const typeReference = type as ts.TypeReference;
    const elementType = typeReference.typeArguments
      ? typeReference.typeArguments[0]
      : undefined;
    return elementType
      ? `(${exploreType(elementType, checker, declarations, seen)})[]`
      : "any[]";
  }

  if (type.aliasTypeArguments) {
    const typeReference = type as ts.TypeReference;
    const elementTypes = typeReference.aliasTypeArguments || [];
    return `${type.aliasSymbol?.name}<${elementTypes
      .map((t) => t.symbol.name)
      .join(", ")}>`;
  }

  if (type.getSymbol()?.getName() === "Date") {
    return "Date";
  }

  if (type.flags & ts.TypeFlags.Object) {
    const properties = checker.getPropertiesOfType(type);

    const indexInfos = checker.getIndexInfosOfType(type);

    let index = "";
    if (indexInfos.length > 0) {
      const indexInfo = indexInfos[0];
      const indexType = indexInfo.keyType;
      const indexTypeString = exploreType(
        indexType,
        checker,
        declarations,
        seen,
      );
      const valueType = indexInfo.type;
      const valueTypeString = exploreType(
        valueType,
        checker,
        declarations,
        seen,
      );
      index = `[key: ${indexTypeString}]: ${valueTypeString}; `;
    }

    return `{ ${index}${properties.reduce((acc, property) => {
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
      return `${acc}${readonly}${property.name}${optional}: ${exploreType(
        propertyType,
        checker,
        declarations,
        seen,
      )}; `;
    }, "")}}`;
  }

  if (type.flags & ts.TypeFlags.TypeParameter) {
    return (type as ts.TypeParameter).symbol.name;
  }

  return JSON.stringify({
    name: checker.typeToString(type),
    flags: listTypeFlagsNames(type.flags),
  });
}

function listTypeFlagsNames(flags: number) {
  const names = [];
  for (const flagName in ts.TypeFlags) {
    if ((ts.TypeFlags[flagName as any] as any) & flags) {
      names.push([flagName, ts.TypeFlags[flagName as any]]);
    }
  }
  return names;
}
