import { Project, ts } from "ts-morph";
import { relative } from "node:path";
import { exploreType } from "./freeze.fn";
import fs from "node:fs";

const cwd = process.cwd();
const tsConfigFilePath = `${cwd}/tsconfig.json`;

const project = new Project({
  tsConfigFilePath,
});

const functionfile = project.getSourceFile(
  `${__dirname}/freeze-function-2.d.ts`,
);

if (!functionfile) {
  throw new Error("The freeze function is not used in the project.");
}

const references = functionfile.getFunction("freeze")?.findReferences();

if (!references) {
  throw new Error(
    "The freeze function is imported, but not used in the project.",
  );
}

export { freeze } from "./freeze.fn";

function lowercasefirstletter(str: string) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

for (const ref of references) {
  for (const refref of ref.getReferences()) {
    const callExpression = refref
      .getNode()
      .getParentIfKind(ts.SyntaxKind.CallExpression);
    if (!callExpression) continue;

    const classImpl = callExpression.getArguments()[0];
    if (!classImpl) continue;

    const className = classImpl.getText();

    const rpath = relative(cwd, callExpression.getSourceFile().getFilePath());

    const typeParameter = callExpression.getTypeArguments()[0];
    if (typeParameter) {
      console.log(
        `${rpath} - ${className}: Already frozen with <${typeParameter.getText()}>`,
      );
      continue;
    }

    const serializeProperty = classImpl
      .getType()
      .getProperty("serialize");
    if (!serializeProperty) {
      console.log(
        `${rpath} - ${className}: No serialize property`,
      );
      continue;
    }

    const serializeMethod = project
      .getTypeChecker()
      .getTypeOfSymbolAtLocation(serializeProperty, classImpl)
      .getCallSignatures()[0];

    let serialized = serializeMethod.getReturnType();
    let serializedArr = [serialized.compilerType];
    if (serialized.getSymbol()?.getName() === "Promise") {
      serialized = serialized.getTypeArguments()[0];
      serializedArr = [serialized.compilerType];
    }
    if (serialized.compilerType.aliasSymbol?.getName() === "PromiseOr") {
      const aliasArg = serialized.compilerType.aliasTypeArguments?.[0];
      if (aliasArg?.isUnion()) {
        serializedArr = aliasArg.types;
      } else if (aliasArg) {
        serializedArr = [aliasArg]
      }
    }

    for (const serialized of serializedArr) {
      const versionProperty = project.getTypeChecker().compilerObject.getPropertyOfType(serialized, "version");
      if (!versionProperty) {
        console.log(
          `${rpath} - ${className}: No version property`,
        );
        continue;
      }
      const version = project.getTypeChecker().compilerObject.typeToString(project.getTypeChecker().compilerObject.getTypeOfSymbolAtLocation(
        versionProperty,
        classImpl.compilerNode,
      ))

      if (!version || Number.isNaN(Number(version))) {
        console.log(
          `${rpath} - ${className}: No version property (or not a number) : ${version}`,
        );
        continue;
      }

      console.log(
        `${rpath} - ${className}: Freezing with version ${version}`,
      );
      const other = new Map();
      const result = exploreType(
        serialized,
        project.getTypeChecker().compilerObject,
        other,
      );

      project.getTypeChecker().compilerObject.getPropertiesOfType(serialized)
      const nameProperty = project.getTypeChecker().compilerObject.getPropertyOfType(serialized, "$name");
      if (!nameProperty) {
        console.log(
          `${rpath} - ${className}: Cannot find name of serialized type`,
        );
        continue;
      }
      const name = JSON.parse(
        project.getTypeChecker().compilerObject.typeToString(
          project.getTypeChecker().compilerObject.getTypeOfSymbolAtLocation(
            nameProperty,
            classImpl.compilerNode,
          ),
        ),
      ) as string;

      const serializedName = `${name}Serialized${version}n`;
      const serializedFilename = lowercasefirstletter(
        `${name}.serialized.${version}n`,
      );

      const directory = refref.getSourceFile().getDirectory();

      // callExpression.getSourceFile().addImportDeclaration({
      //   moduleSpecifier: `./${serializedFilename}`,
      //   namedImports: [serializedName],
      // });

      // callExpression.addTypeArgument(serializedName);

      // project.saveSync();

      const output = [
        ...other.values(),
        `export type ${serializedName} = ${result}`,
      ].join("\n");

      fs.writeFileSync(`${directory.getPath()}/${serializedFilename}.ts`, output);
    }
  }
}
