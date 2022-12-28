import { closeable, map } from "../../tools/iterator";
import { EsFact } from "../event-store";
import { Queue } from "../../tools/queue";
import { Stream } from "./stream";

export class ProjectedStream extends Stream {
  followers = new Set<Queue<EsFact>>();
  competitions = new Map<string, Queue<EsFact>>();

  onCloseCallbacks: any[] = [];

  async *read(from = 0n) {
    for await (const datedFact of super.readRaw(from)) {
      const { occuredAt, ...fact } = datedFact;
      yield fact;
    }
  }

  onClose(callback: any) {
    this.onCloseCallbacks.push(callback);
  }

  async follow(from = 0n) {
    const follower = new Queue<EsFact>();
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

  private getCompetition(competitionName: string) {
    if (!this.competitions.has(competitionName)) {
      const competition = new Queue<EsFact>();
      const unsubscribe = this.subscribe((datedFact) => {
        const { occuredAt, ...fact } = datedFact;
        competition.push(fact);
      });
      competition.onClose(unsubscribe);
      this.competitions.set(competitionName, competition);
    }
    return this.competitions.get(competitionName)!;
  }

  async compete(competitionName: string) {
    const competition = this.getCompetition(competitionName);

    return closeable(
      map(competition[Symbol.asyncIterator](), (fact) => ({
        fact,
        retry: () => setImmediate(() => competition.push(fact)),
        succeed: () => {},
        skip: () => {},
      })),
      async () => {
        // competition.close();
        // this.competitions.delete(competitionName);
        // console.log("closing competitor");
      }
    );
  }
}
