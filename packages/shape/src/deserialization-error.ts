export type DeserializationErrorContext = {
  expected?: string;
  rejectedValue?: unknown;
  registryEntry?: { name: string; version?: number };
};

export class DeserializationError extends Error {
  readonly path: string[];
  readonly rejectedValue: unknown;
  readonly expected?: string;
  registryEntry?: { name: string; version?: number };
  override readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      path?: string[];
      rejectedValue?: unknown;
      expected?: string;
      registryEntry?: { name: string; version?: number };
      cause?: unknown;
    } = {},
  ) {
    const { path = [], rejectedValue, expected, registryEntry, cause } = options;
    const formattedPath = path.length ? `/${path.join("/")}` : "";
    super(
      `${message}${formattedPath ? ` (at ${formattedPath})` : ""}`,
    );
    this.name = "DeserializationError";
    this.path = path;
    this.rejectedValue = rejectedValue;
    this.expected = expected;
    this.registryEntry = registryEntry;
    this.cause = cause;
  }

  prependPath(segment: string): DeserializationError {
    return new DeserializationError(this.unprefixedMessage(), {
      path: [segment, ...this.path],
      rejectedValue: this.rejectedValue,
      expected: this.expected,
      registryEntry: this.registryEntry,
      cause: this.cause ?? this,
    });
  }

  private unprefixedMessage(): string {
    const idx = this.message.lastIndexOf(" (at /");
    return idx >= 0 ? this.message.slice(0, idx) : this.message;
  }

  static wrap(
    error: unknown,
    segment: string,
    rejectedValue?: unknown,
  ): DeserializationError {
    if (error instanceof DeserializationError) {
      return error.prependPath(segment);
    }
    const cause = error instanceof Error ? error : undefined;
    const message = cause?.message ?? String(error);
    return new DeserializationError(message, {
      path: [segment],
      rejectedValue,
      cause: cause ?? error,
    });
  }
}
