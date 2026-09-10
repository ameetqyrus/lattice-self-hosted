CREATE TABLE `assertions` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`predicate` text NOT NULL,
	`object` text NOT NULL,
	`statement` text NOT NULL,
	`assertion_type` text NOT NULL,
	`memory_type` text NOT NULL,
	`confidence` real NOT NULL,
	`rationale` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`observed_at` text NOT NULL,
	`source_created_at` text,
	`ingested_at` text NOT NULL,
	`superseded_by` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`ontology_version` integer NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`subject`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`object`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assertion_subject` ON `assertions` (`subject`,`valid_from`);--> statement-breakpoint
CREATE INDEX `assertion_object` ON `assertions` (`object`,`valid_from`);--> statement-breakpoint
CREATE INDEX `assertion_type` ON `assertions` (`assertion_type`,`status`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`created_at` text NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `connectors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`last_sync` text,
	`cursor` text,
	`detail` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`domain` text NOT NULL,
	`identity` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	`merged_into` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entity_identity` ON `entities` (`type`,`identity`);--> statement-breakpoint
CREATE INDEX `entity_type` ON `entities` (`type`,`domain`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`assertion_id` text NOT NULL,
	`source_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`quote` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`locator` text,
	`kind` text NOT NULL,
	FOREIGN KEY (`assertion_id`) REFERENCES `assertions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revision_id`) REFERENCES `revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `evidence_assertion` ON `evidence` (`assertion_id`);--> statement-breakpoint
CREATE INDEX `evidence_source` ON `evidence` (`source_id`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`target` text NOT NULL,
	`action` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`source_id` text,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_status` ON `jobs` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`observed_at` text NOT NULL,
	`source_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `metric_series` ON `metrics` (`entity_id`,`metric`,`observed_at`);--> statement-breakpoint
CREATE TABLE `ontology` (
	`version` integer PRIMARY KEY NOT NULL,
	`schema` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`approved_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passages` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`source_id` text NOT NULL,
	`body` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`locator` text,
	`embedding` text,
	`embedding_model` text,
	FOREIGN KEY (`revision_id`) REFERENCES `revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `passage_source` ON `passages` (`source_id`);--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`object_key` text NOT NULL,
	`source_created_at` text,
	`observed_at` text NOT NULL,
	`ingested_at` text NOT NULL,
	`status` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_revision` ON `revisions` (`source_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `revision_source` ON `revisions` (`source_id`,`ingested_at`);--> statement-breakpoint
CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`filters` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`domain` text NOT NULL,
	`visibility` text DEFAULT 'PRIVATE' NOT NULL,
	`excluded` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_identity` ON `sources` (`provider`,`external_id`);--> statement-breakpoint
CREATE INDEX `source_provider` ON `sources` (`provider`);