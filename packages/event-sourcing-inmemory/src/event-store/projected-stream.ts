import { closeable, type IFact, map, Queue } from "@ddd-ts/core";
import { Stream } from "./stream";

export class ProjectedStream extends Stream {
  followers = new Set<Queue<IFact>>();
  competitions = new Map<string, Queue<IFact>>();

  onCloseCallbacks: any[] = [];

  onClose(callback: any) {
    this.onCloseCallbacks.push(callback);
  }

  async follow(from = 0) {
    const follower = new Queue<IFact>();
    this.followers.add(follower);

    for await (const fact of this.read(from)) {
      follower.push(fact);
    }

    const unsubscribe = this.subscribe((fact) => {
      if (fact.revision >= from) {
        follower.push(fact);
      }
    });
    follower.onClose(unsubscribe);

    return follower;
  }

  private getCompetition(competitionName: string) {
    if (!this.competitions.has(competitionName)) {
      const competition = new Queue<IFact>();
      const unsubscribe = this.subscribe((fact) => {
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
      },
    );
  }
}
