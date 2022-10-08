import { Actor } from "../../actor/actor";
import { Task, TaskId, TaskName } from "../domain/task";

export class AddTaskCommand {
  type = "AddTask" as const;
  constructor(public readonly name: TaskName, public readonly actor: Actor) {}
}

interface TaskStore {
  save(task: Task): Promise<void>;
}

export class AddTaskCommandHandler {
  on = ["AddTask"] as const;

  constructor(private readonly store: TaskStore) {}

  authenticate = (actor: Actor) => actor.isAuthenticated();

  async execute(command: AddTaskCommand): Promise<TaskId> {
    const task = Task.new(command.name);
    await this.store.save(task);
    return task.taskId;
  }
}
