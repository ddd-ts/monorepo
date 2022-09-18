async function* count(from: number = 0, step: number = 1) {
  let i = from;
  while (true) yield (i += step);
}

// async function* double(iterable: AsyncGenerator<number>) {
//   for await (const i of iterable) {
//     yield i * 2;
//   }
// }

async function* defer(iterable: AsyncGenerator<number>, ms: number) {
  for await (const i of iterable) {
    await new Promise((r) => setTimeout(r, ms));
    yield i;
  }
}

function queue<T>() {
  const pushQueue: T[] = [];
  const pullQueue: Array<(i: T) => any> = [];

  function push(i: T) {
    const resolve = pullQueue.shift();
    if (resolve) {
      resolve(i);
    } else {
      pushQueue.push(i);
    }
  }

  async function* iterator() {
    while (true) {
      const i = pushQueue.shift();
      if (i) {
        yield i;
      } else {
        yield new Promise<T>((resolve) => {
          pullQueue.push(resolve);
        });
      }
    }
  }

  return [push, iterator] as const;
}

async function* merge(
  first: AsyncIterable<number>,
  second: AsyncIterable<number>
) {
  const [push, iterator] = queue<number>();

  const f = first[Symbol.asyncIterator]();
  const s = second[Symbol.asyncIterator]();

  f.next().then((result) => {
    push(result);
  })(async () => {
    for await (const i of first) {
      push(i);
      console.log("yoooo", i);
    }
  })();

  (async () => {
    for await (const i of second) {
      push(i);
    }
  })();

  yield* iterator();
}

async function go() {ww
  for await (const i of merge(
    defer(count(0, 1), 1000),
    defer(count(0, 2), 2000)
  )) {
    if (i > 10) {
      break;
    }
    console.log(i);
  }
}

go();
