export abstract class Projector {
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
