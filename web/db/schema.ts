import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(), pilot: text("pilot").notNull(), tokenHash: text("token_hash").notNull(),
  name: text("name").notNull(), seed: integer("seed").notNull(), createdAt: integer("created_at").notNull(),
  finishedAt: integer("finished_at"), score: integer("score"), frames: integer("frames"), hits: integer("hits"), ipHash: text("ip_hash").notNull(),
}, table => [index("runs_pilot_created").on(table.pilot, table.createdAt),
  index("runs_ip_created").on(table.ipHash, table.createdAt), index("runs_score").on(table.score)]);
export const arenaRooms = sqliteTable('arena_rooms', {
  id: text('id').primaryKey(), state: text('state').notNull(), version: integer('version').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [index('arena_rooms_active').on(t.updatedAt)]);
export const arenaScores = sqliteTable('arena_scores', {
  id: text('id').primaryKey(), pilot: text('pilot').notNull(), name: text('name').notNull(),
  score: integer('score').notNull(), kills: integer('kills').notNull(), duration: integer('duration').notNull(), endedAt: integer('ended_at').notNull(),
}, t => [index('arena_scores_rank').on(t.score), index('arena_scores_pilot').on(t.pilot)]);
