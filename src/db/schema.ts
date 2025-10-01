import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  // Primary key: stable id from the OAuth account (e.g. "google:123456789")
  id: text("id").primaryKey(),

  email: text("email").notNull(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
