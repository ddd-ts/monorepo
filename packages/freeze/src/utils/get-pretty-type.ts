import { Type, TypeAliasDeclaration, Project, ts, Node } from "ts-morph";

export function getPrettyType(type: Type, contextNode: Node): {
  type: Type;
  alias: TypeAliasDeclaration;
  dispose: () => void;
} {
  const project: Project = contextNode.getProject();
  const checker = project.getTypeChecker().compilerObject;

  const typeTextForEmbedding = checker.typeToString(
    type.compilerType,
    undefined,
    ts.TypeFormatFlags.NoTruncation |
    ts.TypeFormatFlags.UseFullyQualifiedType |
    ts.TypeFormatFlags.InTypeAlias
  );

  const fileName = `__pretty_${Date.now()}_${Math.random().toString(16).slice(2)}.ts`;
  const sf = project.createSourceFile(
    fileName,
    `
      type DeepPretty<T> = T extends object
        ? T extends Function
          ? T
          : { [K in keyof T]: DeepPretty<T[K]> } & {}
        : T;
      declare const __v: ${typeTextForEmbedding};
      export type __X = DeepPretty<typeof __v>;
    `,
    { overwrite: true }
  );

  const alias = sf.getTypeAliasOrThrow("__X");
  const pretty = alias.getType();

  const dispose = () => {
    project.removeSourceFile(sf);
  };

  return { type: pretty, alias, dispose };
}
