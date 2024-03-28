import { combine } from "./asyncTools";

describe("async tools", () => {
  it("combines async iterators", async () => {
    const ended = jest.fn()

    async function* createAsyncIterator(count: number) {
      for (let i = 0; i < count; i += 1) {
        yield i;
      }
      ended();
    }

    const allNumbers: number[] = [];

    for await (const nb of combine([
      createAsyncIterator(1),
      createAsyncIterator(2),
      createAsyncIterator(3),
      createAsyncIterator(4),
      createAsyncIterator(5),
    ])) {
      allNumbers.push(nb);
    }

    expect(allNumbers.sort()).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4]);
    expect(ended).toHaveBeenCalledTimes(5);
  });
});
