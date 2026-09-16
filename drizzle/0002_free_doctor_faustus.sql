ALTER TABLE `users` ADD `username` varchar(40);--> statement-breakpoint
ALTER TABLE `users` ADD `isPublic` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);