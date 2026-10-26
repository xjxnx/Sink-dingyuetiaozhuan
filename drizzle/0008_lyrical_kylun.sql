ALTER TABLE `links` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `links_sort_order_created_at_slug_idx` ON `links` (`sort_order`,"created_at" desc,`slug`);--> statement-breakpoint
CREATE INDEX `links_homepage_pinned_sort_order_idx` ON `links` (`show_on_homepage`,"pinned" desc,`sort_order`,"created_at" desc,`slug`);