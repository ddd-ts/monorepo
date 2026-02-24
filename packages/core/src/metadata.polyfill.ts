declare global {
  interface SymbolConstructor {
    readonly metadata: unique symbol;
  }
}

(Symbol as any).metadata = Symbol.for("metadata");

export {};
