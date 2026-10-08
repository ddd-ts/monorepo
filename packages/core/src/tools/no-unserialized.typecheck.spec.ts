import { noUnserialized } from "./no-unserialized";

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

// SHOULD NOT WORK (ARRAY)
// @ts-expect-error nested identifiers should not be accepted
noUnserialized({ events: [nestedUnserialized] });

// SHOULD WORK
type SerializedEvent = { id: string; name: string };
const fullySerialized: SerializedEvent = null as any;
const checkedSerialized: SerializedEvent = noUnserialized(fullySerialized);

// SHOULD WORK WITH DATES
const withDate = noUnserialized({ date: new Date() });

// SHOULD WORK WITH ARRAYS
const withArray = noUnserialized({ dates: [new Date(), new Date()] });

it("pass", () => {
  expect(true).toBeTruthy();
});
