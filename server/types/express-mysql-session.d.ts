declare module "express-mysql-session" {
  import type session from "express-session";

  type StoreConstructor = new (
    options: Record<string, unknown>,
    connection?: unknown,
    callback?: (error?: unknown) => void,
  ) => session.Store;

  export default function MySQLStoreFactory(
    sessionModule: typeof session,
  ): StoreConstructor;
}
