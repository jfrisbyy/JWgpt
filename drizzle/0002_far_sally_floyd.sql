CREATE TABLE `family_contributions` (
	`session_id` text NOT NULL,
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`session_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `family_participants` (
	`session_id` text NOT NULL,
	`owner` text NOT NULL,
	PRIMARY KEY(`session_id`, `owner`)
);
--> statement-breakpoint
CREATE INDEX `idx_family_participant` ON `family_participants` (`owner`);--> statement-breakpoint
CREATE TABLE `family_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_state` (
	`id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`document` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`updated_at` text NOT NULL
);
