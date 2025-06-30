import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";

export const WithStore = <T>() =>
  Subtrait([{} as typeof BaseHandler], (base) => {
    abstract class WithStore extends base {
      store: T;
      constructor(props: {
        store: T;
      }) {
        super(props);
        this.store = props.store;
      }
    }
    return WithStore;
  });
