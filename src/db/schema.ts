import {
  pgTable,
  text,
  integer,
  smallint,
  timestamp,
  uuid,
  pgEnum,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
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

export const mediaTypeEnum = pgEnum("media_type", ["tv", "movie"]);
export const userTitleStatusEnum = pgEnum("user_title_status", [
  "WATCHLIST",
  "RATED",
]);

export const titles = pgTable("titles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tmdbId: integer("tmdb_id").notNull(),
  mediaType: mediaTypeEnum("media_type").notNull(),
  title: text("title").notNull(),
  poster: text("poster"),
  year: integer("year"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userTitles = pgTable("user_titles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  titleId: uuid("title_id")
    .notNull()
    .references(() => titles.id, { onDelete: "cascade" }),
  status: userTitleStatusEnum("status").notNull(),
  rating: smallint("rating"),
  ratedAt: timestamp("rated_at", { withTimezone: true }),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const recOriginEnum = pgEnum("rec_origin", [
  "PROFILE",
  "SEED",
  "CUSTOM_LIST",
]);

export const recSourceEnum = pgEnum("rec_source", ["GEMINI"]);

export const recommendationSets = pgTable("recommendation_sets", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  key: text("key").notNull(),

  // materialized unique to avoid composite unique via table callbacks
  userKey: text("user_key").notNull().unique(), // `${userId}:${key}`

  origin: recOriginEnum("origin").notNull(),
  source: recSourceEnum("source").notNull().default("GEMINI"),

  inputSnapshot: jsonb("input_snapshot").notNull(), // JSONB payload you sent to Gemini

  // optional seed info
  seedMediaType: mediaTypeEnum("seed_media_type"),
  seedTmdbId: integer("seed_tmdb_id"),
  seedImdbId: text("seed_imdb_id"),
  seedTitle: text("seed_title"),

  cacheVersion: text("cache_version").notNull().default("1"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isStale: boolean("is_stale").notNull().default(false),
});

export const recommendationItems = pgTable("recommendation_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  setId: uuid("set_id")
    .notNull()
    .references(() => recommendationSets.id, { onDelete: "cascade" }),

  // stable order inside the set
  rank: integer("rank").notNull(),

  title: text("title").notNull(),
  description: text("description"),
  reason: text("reason"),
  tags: text("tags").array(), // text[]

  // optional normalization hooks
  suggestedMediaType: mediaTypeEnum("suggested_media_type"),
  suggestedTmdbId: integer("suggested_tmdb_id"),
  suggestedImdbId: text("suggested_imdb_id"),

  rawJson: jsonb("raw_json").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
