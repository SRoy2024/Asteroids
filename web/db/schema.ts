import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(), pilot: text("pilot").notNull(), tokenHash: text("token_hash").notNull(),
  name: text("name").notNull(), seed: integer("seed").notNull(), createdAt: integer("created_at").notNull(),
  finishedAt: integer("finished_at"), score: integer("score"), frames: integer("frames"), hits: integer("hits"), ipHash: text("ip_hash").notNull(),
}, table => [index("runs_pilot_created").on(table.pilot, table.createdAt),
  index("runs_ip_created").on(table.ipHash, table.createdAt), index("runs_score").on(table.score)]);
