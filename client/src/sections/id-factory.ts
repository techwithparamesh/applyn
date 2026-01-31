export function createIdFactory(prefix: string) {
  let counter = 0;
  return () => `${prefix}_${(++counter).toString(36)}`;
}
