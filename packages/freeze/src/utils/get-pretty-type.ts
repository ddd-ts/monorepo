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
      type UnknownArray = readonly unknown[];
      type MapsSetsOrArrays = ReadonlyMap<unknown, unknown> | WeakMap<WeakKey, unknown> | ReadonlySet<unknown> | WeakSet<WeakKey> | UnknownArray;
      type Primitive =
        | null
        | undefined
        | string
        | number
        | boolean
        | symbol
        | bigint;
      type IsNever<T> = [T] extends [never] ? true : false;
      type BuiltIns = Primitive | void | Date | RegExp;
      type NonRecursiveType = BuiltIns | Function | (new (...arguments_: any[]) => unknown) | Promise<unknown>;
      type IsPlainObject<T> =
        IsNever<T> extends true
          ? false
          : T extends NonRecursiveType | MapsSetsOrArrays
            ? false
            : T extends object
              ? true
              : false;
      // the code above is from type-fest. it's an extract of the IsPlainObject type with all the dependencies it has

      type DeepPretty<T> = IsPlainObject<T> extends true
        ? { [K in keyof T]: DeepPretty<T[K]> } & {}
        : T extends (infer U)[]
          ? DeepPretty<U>[] & {}
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
