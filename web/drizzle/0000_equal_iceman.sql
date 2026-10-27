CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`seed` integer NOT NULL,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	`score` integer,
	`frames` integer,
	`hits` integer,
	`ip_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_pilot_created` ON `runs` (`pilot`,`created_at`);--> statement-breakpoint
CREATE INDEX `runs_ip_created` ON `runs` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `runs_score` ON `runs` (`score`);