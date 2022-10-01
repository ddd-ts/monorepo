import { AddTaskCommand, AddTaskCommandHandler } from "./add-task.command";
import { InMemoryTaskStore } from "../infrastructure/in-memory.task.store";
import { TaskSerializer } from "../infrastructure/task.serializer";
import { TaskIdSerializer } from "../infrastructure/task-id.serializer";
import { Task, TaskId, TaskName } from "../domain/task";

describe("AddTaskCommand", () => {
  function createHandler() {
    const store = new InMemoryTaskStore(
      new TaskSerializer(new TaskIdSerializer())
    );
    const handler = new AddTaskCommandHandler(store);
    return { handler, store };
  }

  it("adds a task", async () => {
    const { handler, store } = createHandler();
    const name = new TaskName("test");
    await handler.execute(new AddTaskCommand(name));

    const tasks = await store.loadAll();
    expect(tasks).toEqual([new Task(new TaskId(expect.any(String)), name)]);
  });
});
