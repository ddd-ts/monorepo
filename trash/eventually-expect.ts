// class TimeoutError extends Error {}

// export function eventuallyExpect(
//   assertion: (() => any) | (() => Promise<any>),
//   timeout = 1000,
//   interval = 100
// ): Promise<void> {
//   return new Promise((resolve, reject) => {
//     const clock = setInterval(async () => {
//       try {
//         await assertion();
//         resolve();
//       } catch (err) {
//         if (err instanceof ReferenceError || err instanceof TypeError) {
//           clearInterval(clock);
//           reject(err);
//         }
//       }
//     }, interval);

//     setTimeout(() => {
//       clearInterval(clock);
//       reject(new TimeoutError());
//     }, timeout);
//   });
// }
