export interface IKinded<Name extends string = string> {
  $kind: Name;
}

export interface IKindedContructor<Name extends string = string> {
  new (...args: any[]): IKinded<Name>;
  $kind: Name;
}
