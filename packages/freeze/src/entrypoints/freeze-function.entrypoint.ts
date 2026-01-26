import { ts } from "ts-morph";
import { relative } from "node:path";
import fs from "node:fs";
import { exploreType } from "../utils/explore-type";
import { getPrettyType } from "../utils/get-pretty-type";
import { project } from "./project";

const cwd = process.cwd();

const functionFile = project.getSourceFile(`${__dirname}/../references/freeze.function.d.ts`);
if (!functionFile) {
  throw new Error("The freeze function is not used in the project.");
}

const references = functionFile.getFunction("freeze")?.findReferences();

if (!references) {
  throw new Error(
    "The freeze function is imported, but not used in the project.",
  );
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
      prettyType.type.compilerType,
      project.getTypeChecker().compilerObject,
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
    const serializedFilename = lowercasefirstletter(
      `${name}.serialized`,
    );

    const directory = refref.getSourceFile().getDirectory();

    callExpression.getSourceFile().addImportDeclaration({
      moduleSpecifier: `./${serializedFilename}`,
      namedImports: [serializedName],
    });

    callExpression.addTypeArgument(serializedName);

    project.saveSync();

    const output = [
      ...other.values(),
      `export type ${serializedName} = ${result}`,
    ].join("\n");

    fs.writeFileSync(`${directory.getPath()}/${serializedFilename}.ts`, output);

    console.log(
      `${rpath} - ${name}: Frozen as ${serializedName} in ${serializedFilename}.ts`,
    );
  }
}
