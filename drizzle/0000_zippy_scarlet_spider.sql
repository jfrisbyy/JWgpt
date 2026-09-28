CREATE TABLE `studies` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_studies_owner_updated` ON `studies` (`owner`,`updated_at`);