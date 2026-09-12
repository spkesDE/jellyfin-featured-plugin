export interface ConfigOption {
  value: string;
  label: string;
}

export function namedOptions(items: ReadonlyArray<{ Id: string; Name: string }>): ConfigOption[] {
  return items.map(({ Id, Name }) => ({ value: Id, label: Name }));
}

export function valueOptions(values: readonly string[]): ConfigOption[] {
  return values.map((value) => ({ value, label: value }));
}
