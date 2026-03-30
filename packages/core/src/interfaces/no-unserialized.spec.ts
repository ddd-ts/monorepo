import { noUnserialized } from "./no-unserialized";

if (false) {
  // Nested identifiers with a `serialize` method should be rejected.
  type EventId = { serialize(): string };
  const nestedUnserialized: { id: EventId } = null!;

  // SHOULD NOT WORK (FLAT)
  // @ts-expect-error nested identifiers should not be accepted
  noUnserialized(nestedUnserialized);

  // SHOULD NOT WORK (NESTED)
  // @ts-expect-error nested identifiers should not be accepted
  noUnserialized({ id: nestedUnserialized });

  // SHOULD NOT WORK (DEEP NESTED)
  // @ts-expect-error nested identifiers should not be accepted
  noUnserialized({ event: { id: nestedUnserialized } });

  // SHOULD NOT WORK (MULTIPLE NESTED)
  // @ts-expect-error nested identifiers should not be accepted
  noUnserialized({ event: { id: nestedUnserialized }, otherId: nestedUnserialized });

  // SHOULD WORK
  type SerializedEvent = { id: string; name: string };
  const fullySerialized: SerializedEvent = null as any;
  const checkedSerialized: SerializedEvent = noUnserialized(fullySerialized);
}
