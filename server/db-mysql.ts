import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function parseMysqlUrl(urlString: string) {
  const url = new URL(urlString);
  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must start with mysql:// when STORAGE=mysql");
  }

  const database = url.pathname.replace(/^\//, "");
  if (!database) {
    throw new Error("DATABASE_URL must include a database name");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

export function getMysqlDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when STORAGE=mysql");
  }

  if (!pool) {
    const opts = parseMysqlUrl(process.env.DATABASE_URL);
    pool = mysql.createPool({
      ...opts,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }

  if (!db) {
    db = drizzle(pool);
  }

  return db;
}
