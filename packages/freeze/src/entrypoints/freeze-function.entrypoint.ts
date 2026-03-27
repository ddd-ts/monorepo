import { ts, type ReferencedSymbol } from "ts-morph";
import { relative } from "node:path";
import fs from "node:fs";
import prettier from "@prettier/sync";
import { exploreType } from "../utils/explore-type";
import { getPrettyType } from "../utils/get-pretty-type";
import { project } from "./project";
import packageJson from "../../package.json";

console.log("Freezing functions...");

const cwd = process.cwd();

const resolveFromDistIndex = () => {
  const functionFilePath = `${__dirname}/../../dist/index.d.ts`;

  const functionFile = project.getSourceFile(functionFilePath);
  if (!functionFile) {
    throw new Error(`Cannot find index.d.ts at path ${functionFilePath}`);
  }

  const freezeFunction = functionFile.getExportedDeclarations().get("freeze")?.[0].asKind(ts.SyntaxKind.FunctionDeclaration);
  if (!freezeFunction) {
    throw new Error(`Cannot find function for freeze in ${functionFilePath}`);
  }

  const references = freezeFunction.findReferences();
  if (!references) {
    throw new Error("Cannot find declaration of the freeze function");
  }
  
  return references;
};

const resolveFromSource = () => {
  const functionFilePath = `${__dirname}/../references/freeze.function.ts`;

  const functionFile = project.getSourceFile(functionFilePath);
  if (!functionFile) {
    throw new Error(`Cannot find freeze.function.ts at path ${functionFilePath}`);
  }

  const references = functionFile.getFunction("freeze")?.findReferences();

  if (!references) {
    throw new Error("Cannot find declaration of the freeze function");
  }
  
  return references;
};

const resolveFromDist = () => {
  const functionFilePath = `${__dirname}/../references/freeze.function.d.ts`;

  const functionFile = project.getSourceFile(functionFilePath);
  if (!functionFile) {
    throw new Error(`Cannot find freeze.function.d.ts at path ${functionFilePath}`);
  }

  const references = functionFile.getFunction("freeze")?.findReferences();

  if (!references) {
    throw new Error("Cannot find declaration of the freeze function");
  }
  
  return references;
};

let references: ReferencedSymbol[] | undefined;
try {
  references = resolveFromDistIndex();
} catch {
  try {
    references = resolveFromDist();
  } catch {
    try {
      references = resolveFromSource();
    } catch {
      throw new Error("Cannot find references for freeze function in dist/index.d.ts, dist/references/freeze.function.d.ts or src/references/freeze.function.ts");
    }
  }
}

function lowercasefirstletter(str: string) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

for (const ref of references) {
  for (const refref of ref.getReferences()) {
    const callExpression = refref
      .getNode()
      .getParentIfKind(ts.SyntaxKind.CallExpression);
    if (!callExpression) continue;

    const rpath = relative(cwd, callExpression.getSourceFile().getFilePath());

    const typeArguments = callExpression.getTypeArguments();

    const freezeParameters = typeArguments[0].asKind(ts.SyntaxKind.TypeLiteral);
    const alreadyFrozen = typeArguments[1];

    if (!freezeParameters) {
      console.log(
        `${rpath}:${callExpression.getStartLineNumber()}: No freeze parameters`,
      );
      continue;
    }

    const nameProperty = freezeParameters.getProperty("name");
    if (!nameProperty) {
      console.log(
        `${rpath}:${callExpression.getStartLineNumber()}: No name property`,
      );
      continue;
    }
    const name = nameProperty.getType().getLiteralValue();
    if (typeof name !== "string") {
      console.log(
        `${rpath}:${callExpression.getStartLineNumber()}: Name is not a string literal`,
      );
      continue;
    }

    if (alreadyFrozen) {
      console.log(
        `${rpath} - ${name}: Already frozen with <${alreadyFrozen.getText()}>`,
      );
      continue;
    }

    const typeProperty = freezeParameters.getProperty("type");
    if (!typeProperty) {
      console.log(
        `${rpath} - ${name}: No type property`,
      );
      continue;
    }
    const type = typeProperty.getType();

    const prettyType = getPrettyType(type, callExpression);

    const other = new Map();
    let result = exploreType(
      prettyType.type.compilerType as any,
      project.getTypeChecker().compilerObject as any,
      other,
    );
    const aliasName = prettyType.alias.getName();
    prettyType.dispose();
    for (const [key, value] of other) {
      if (key.name !== aliasName) continue;
      result = result.replace(new RegExp(`\\b${aliasName}\\b`, "g"), value.replace(new RegExp(`^type ${aliasName} = `), ""));
      other.delete(key);
    }

    const serializedName = name;
    
    const filenameProperty = freezeParameters.getProperty("filename");
    const filenamePropertyValue = filenameProperty?.getType().getLiteralValue() as string | undefined;
    
    const extensionProperty = freezeParameters.getProperty("extension");
    const extensionPropertyValue = extensionProperty?.getType().getLiteralValue() as string | undefined;
    const serializedExtension = extensionPropertyValue ?? ".serialized";

    const serializedFilename = (
      filenamePropertyValue ??
      lowercasefirstletter(`${serializedName}${serializedExtension}`)
    );

    const directory = refref.getSourceFile().getDirectory();

    callExpression.getSourceFile().addImportDeclaration({
      moduleSpecifier: `./${serializedFilename}`,
      namedImports: [serializedName],
    });

    callExpression.addTypeArgument(serializedName);

    project.saveSync();

    const output = [
      `// Auto-generated by ${packageJson.name}`,
      ...other.values(),
      `export type ${serializedName} = ${result}`,
    ].join("\n");

    const formattedOutput = prettier.format(output, { parser: "typescript" });
    fs.writeFileSync(`${directory.getPath()}/${serializedFilename}.ts`, formattedOutput);

    console.log(
      `${rpath} - ${name}: Frozen as ${serializedName} in ${serializedFilename}.ts`,
    );
  }
}
