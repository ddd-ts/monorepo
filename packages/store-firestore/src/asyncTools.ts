export async function* combine<T>(iterables: AsyncIterable<T>[]) {
  const asyncIterators = iterables.map((iterable) => iterable[Symbol.asyncIterator]());

  function getNext(asyncIterator: AsyncIterator<any>, index: number) {
    return asyncIterator.next().then((result) => ({
      index,
      result,
    }));
  }

  const nextPromises = asyncIterators.map(getNext);
  const finished = new Set<number>()

  try {
    while (finished.size !== asyncIterators.length) {
      const { index, result } = await Promise.race(nextPromises);
      if (result.done) {
        finished.add(index)
      } else {
        nextPromises[index] = getNext(asyncIterators[index]!, index);
        yield result.value;
      }
    }
  } finally {
    for (const [index, iterator] of asyncIterators.entries()) {
      if (finished.has(index) && iterator.return) {
        iterator.return().catch(console.error);
      }
    }
  }
}

export async function* batch<T>(iterator: AsyncIterable<T>, size: number) {
  let batch = [];

  for await (const item of iterator) {
    batch.push(item);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) {
    yield batch;
  }
}
