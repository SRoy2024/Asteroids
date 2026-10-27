CREATE TABLE `arena_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `arena_rooms_active` ON `arena_rooms` (`updated_at`);--> statement-breakpoint
CREATE TABLE `arena_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot` text NOT NULL,
	`name` text NOT NULL,
	`score` integer NOT NULL,
	`kills` integer NOT NULL,
	`duration` integer NOT NULL,
	`ended_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `arena_scores_rank` ON `arena_scores` (`score`);--> statement-breakpoint
CREATE INDEX `arena_scores_pilot` ON `arena_scores` (`pilot`);