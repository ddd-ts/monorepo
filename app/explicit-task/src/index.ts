import { SerializationRegistry } from "./framework/serialization.registry";
import { AddTaskCommandHandler } from "./modules/task/application/add-task.command";
import { Task, TaskId } from "./modules/task/domain/task";
import { TaskIdSerializer } from "./modules/task/infrastructure/task-id.serializer";
import { Email, Password, User } from "./modules/user/domain/user";
import { EmailSerializer } from "./modules/user/infrastructure/email.serializer";

import { StaticCommandBus } from "@ddd-ts/cqrs/dist";
import { InMemoryTaskStore } from "./modules/task/infrastructure/in-memory.task.store";
import { TaskSerializer } from "./modules/task/infrastructure/task.serializer";
import { InMemoryUserStore } from "./modules/user/infrastructure/in-memory.user.store";
import { SignUpCommandHandler } from "./modules/user/application/sign-up.command";
import { PasswordSerializer } from "./modules/user/infrastructure/password.serializer";
import { UserSerializer } from "./modules/user/infrastructure/user.serializer";

function boot() {
  let commandBus = new StaticCommandBus();

  const serialization = new SerializationRegistry()
    .add(Email, new EmailSerializer())
    .add(TaskId, new TaskIdSerializer())
    .add(Task, new TaskSerializer(new TaskIdSerializer()))
    .add(Password, new PasswordSerializer())
    .add(
      User,
      new UserSerializer(new EmailSerializer(), new PasswordSerializer())
    );

  const taskStore = new InMemoryTaskStore(serialization.get(Task));
  const userStore = new InMemoryUserStore(serialization.get(User));

  commandBus
    .register(new AddTaskCommandHandler(taskStore))
    .register(new SignUpCommandHandler(userStore));
}
