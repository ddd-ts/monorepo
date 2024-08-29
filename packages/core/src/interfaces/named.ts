export interface INamed<Name extends string = string> {
  name: Name;
}

export interface INamedContructor<Name extends string = string> {
  new (...args: any[]): INamed<Name>;
  $name: Name;
}
