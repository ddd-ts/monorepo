import { IEsEvent, ISavedChange } from "../interfaces/es-event";

export interface Projector {
  handle(savedChange: ISavedChange<IEsEvent>): Promise<void>;
}
