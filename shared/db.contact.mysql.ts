import { mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const contactSubmissions = mysqlTable("contact_submissions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
