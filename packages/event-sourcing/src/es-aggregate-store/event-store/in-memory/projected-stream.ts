import { Fact } from "../../../event/event";
import { Deposited } from "../../../test";
import { closeable, map } from "../../tools/iterator";
import { Queue } from "./queue";
import { Stream } from "./stream";

export class ProjectedStream extends Stream {
  followers = new Set<Queue<Fact<Deposited>>>();
  competitions = new Map<string, Queue<Fact<Deposited>>>();

  async *read(from = 0n) {
    for await (const datedFact of super.readRaw(from)) {
      const { occuredAt, ...fact } = datedFact;
      yield fact;
    }
  }

  async follow(from = 0n) {
    const follower = new Queue<Fact<Deposited>>();
    this.followers.add(follower);

    for await (const fact of this.read(from)) {
      follower.push(fact);
    }

    const unsubscribe = this.subscribe((datedFact) => {
      const { occuredAt, ...fact } = datedFact;
      follower.push(fact);
    });
    follower.onClose(unsubscribe);

    return follower;
  }

  compete(competitionName: string) {
    if (!this.competitions.has(competitionName)) {
      const competition = new Queue<Fact<Deposited>>();
      const unsubscribe = this.subscribe((datedFact) => {
        const { occuredAt, ...fact } = datedFact;
        competition.push(fact);
      });
      competition.onClose(unsubscribe);
      this.competitions.set(competitionName, competition);
    }

    const competition = this.competitions.get(competitionName)!;

    return closeable(
      map(competition[Symbol.asyncIterator](), (fact) => ({
        fact,
        retry: () => competition.push(fact),
        succeed: () => {},
        skip: () => {},
      })),
      async () => {
        console.log("closed");
      }
    );
  }
}
