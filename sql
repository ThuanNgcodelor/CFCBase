-- Adminer 5.4.2 MySQL 8.0.46 dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

INSERT INTO `approval_steps` (`id`, `acted_at`, `reason`, `status`, `step_level`, `approver_id`, `booking_car_id`, `booking_room_id`) VALUES
('21c4ba18-fd14-4eaa-b664-74ad0addba72',	'2026-07-11 17:03:23.077442',	'ádsad',	'REJECTED',	1,	'ae5c7ebd-8f20-41eb-a60b-ca23b8b4dbd1',	'47be7880-6af2-454f-92f9-6522c230e0ad',	NULL),
('3c7103be-0fb5-4387-86d4-b65cbbf2c23b',	'2026-07-11 17:02:09.949150',	'gà',	'APPROVED',	1,	'ae5c7ebd-8f20-41eb-a60b-ca23b8b4dbd1',	'66834255-6fe7-4574-9d7f-848ed40410d6',	NULL),
('931ae01f-bc49-4d83-9210-4333860c78a0',	'2026-07-10 06:12:58.746296',	NULL,	'APPROVED',	1,	'ae5c7ebd-8f20-41eb-a60b-ca23b8b4dbd1',	NULL,	'a0b0e115-c731-4510-999e-2634cbf8572b'),
('9d628b49-4ef7-47e8-aa91-8ca228af7c94',	'2026-07-10 06:24:27.776050',	NULL,	'REJECTED',	1,	'ae5c7ebd-8f20-41eb-a60b-ca23b8b4dbd1',	'c740f6e8-c780-4ef0-8085-b633d6b125f4',	NULL),
('9ec5f724-9330-47da-a704-b88bf1bf7762',	'2026-07-11 17:04:54.085168',	'ádas',	'APPROVED',	1,	'ae5c7ebd-8f20-41eb-a60b-ca23b8b4dbd1',	'8764982f-0b62-4b3b-84ca-c46abdbe4dcb',	NULL),
('d686d790-507a-426c-96cc-1166bdc873f2',	'2026-07-10 06:09:55.151088',	NULL,	'APPROVED',	1,	'ae5c7ebd-8f20-41eb-a60b-ca23b8b4dbd1',	'05773d17-425a-4798-a656-f5a234e0be1b',	NULL);

DROP TABLE IF EXISTS `rooms`;
CREATE TABLE `rooms` (
  `id` varchar(255) NOT NULL,
  `capacity` int NOT NULL,
  `equipment` varchar(255) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `status` enum('ACTIVE','INACTIVE','MAINTENANCE') DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DROP TABLE IF EXISTS `vehicle_types`;
CREATE TABLE `vehicle_types` (
  `id` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DROP TABLE IF EXISTS `vehicles`;
CREATE TABLE `vehicles` (
  `id` varchar(255) NOT NULL,
  `license_plate` varchar(255) NOT NULL,
  `seat_count` int NOT NULL,
  `status` enum('ACTIVE','INACTIVE','MAINTENANCE') DEFAULT NULL,
  `vehicle_type_id` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK9vovnbiegxevdhqfcwvp2g8pj` (`license_plate`),
  KEY `FKk3cs3vldlan30kg1x6b57i4fe` (`vehicle_type_id`),
  CONSTRAINT `FKk3cs3vldlan30kg1x6b57i4fe` FOREIGN KEY (`vehicle_type_id`) REFERENCES `vehicle_types` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- 2026-07-12 15:41:57 UTC
