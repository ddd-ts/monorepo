import { Project, ts } from "ts-morph";
import { relative } from "node:path";
import { exploreType } from "./utils/explore-type";
import fs from "node:fs";

const cwd = process.cwd();
const tsConfigFilePath = `${cwd}/tsconfig.json`;

const project = new Project({
  tsConfigFilePath,
});

const decoratorFile = project.getSourceFile(`${__dirname}/references/freeze.decorator.d.ts`);
if (!decoratorFile) {
  throw new Error("The @Freeze decorator is not used in the project.");
}

const references = decoratorFile.getFunction("Freeze")?.findReferences();

if (!references) {
  throw new Error(
    "The @Freeze decorator is imported, but not used in the project.",
  );
}

function lowercasefirstletter(str: string) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

for (const ref of references) {
  for (const refref of ref.getReferences()) {
    const decorator = refref
      .getNode()
      .getParent()
      ?.getParent()
      ?.asKind(ts.SyntaxKind.Decorator);
    if (!decorator) continue;

    const rpath = relative(cwd, decorator.getSourceFile().getFilePath());

    const classDeclaration = decorator.getParentIfKind(
      ts.SyntaxKind.ClassDeclaration,
    );
    if (!classDeclaration) continue;

    const typeParameter = decorator.getTypeArguments()[0];
    if (typeParameter) {
      console.log(
        `${classDeclaration.getName()}: Already frozen with <${typeParameter.getText()}>`,
      );
      continue;
    }

    const serializeProperty = classDeclaration
      .getType()
      .getProperty("serialize");
    if (!serializeProperty) {
      console.log(
        `${rpath} - ${classDeclaration.getName()}: No serialize property`,
      );
      continue;
    }

    const serializeMethod = project
      .getTypeChecker()
      .getTypeOfSymbolAtLocation(serializeProperty, classDeclaration)
      .getCallSignatures()[0];

    let serialized = serializeMethod.getReturnType();
    if (serialized.getSymbol()?.getName() === "Promise") {
      serialized = serialized.getTypeArguments()[0];
    }

    const version = serialized
      .getProperty("version")
      ?.getTypeAtLocation(classDeclaration)
      .getText();

    if (!version || Number.isNaN(Number(version))) {
      console.log(
        `${rpath} - ${classDeclaration.getName()}: No version property (or not a number) : ${version}`,
      );
      continue;
    }

    console.log(
      `${rpath} - ${classDeclaration.getName()}: Freezing with version ${version}`,
    );
    const other = new Map();
    const result = exploreType(
      serialized.compilerType as any,
      project.getTypeChecker().compilerObject as any,
      other,
    );

    const type = serializeMethod
      .getParameters()[0]
      .getTypeAtLocation(classDeclaration);
    const symbol = type.getSymbol()?.getName();
    const aliasSymbol = type.getAliasSymbol()?.getName();
    let name: string | undefined;
    if (symbol) {
      name = symbol;
      console.log(
        `${rpath} - ${classDeclaration.getName()}: Using symbol ${symbol}`,
      );
    } else if (aliasSymbol) {
      name = aliasSymbol;
      console.log(
        `${rpath} - ${classDeclaration.getName()}: Using aliasSymbol ${aliasSymbol}`,
      );
    }

    if (!name) {
      console.log(
        `${rpath} - ${classDeclaration.getName()}: Cannot find name of serialized type`,
      );
      continue;
    }

    const serializedName = `${name}Serialized${version}n`;
    const serializedFilename = lowercasefirstletter(
      `${name}.serialized.${version}n`,
    );

    const directory = refref.getSourceFile().getDirectory();

    decorator.getSourceFile().addImportDeclaration({
      moduleSpecifier: `./${serializedFilename}`,
      namedImports: [serializedName],
    });

    decorator.addTypeArgument(serializedName);

    project.saveSync();

    const output = [
      ...other.values(),
      `export type ${serializedName} = ${result}`,
    ].join("\n");

    fs.writeFileSync(`${directory.getPath()}/${serializedFilename}.ts`, output);
  }
}
