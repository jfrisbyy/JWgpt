CREATE TABLE `invitations` (
	`hash` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` text NOT NULL,
	`redeemed_by` text,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`owner` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`profile` text DEFAULT '{}' NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personal_records` (
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `kind`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_records_owner_kind` ON `personal_records` (`owner`,`kind`);--> statement-breakpoint
CREATE TABLE `share_recipients` (
	`share_id` text NOT NULL,
	`recipient` text NOT NULL,
	PRIMARY KEY(`share_id`, `recipient`)
);
--> statement-breakpoint
CREATE INDEX `idx_shares_recipient` ON `share_recipients` (`recipient`);--> statement-breakpoint
CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`document` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shares_owner` ON `shares` (`owner`);--> statement-breakpoint
CREATE TABLE `usage` (
	`owner` text NOT NULL,
	`bucket` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `bucket`)
);
