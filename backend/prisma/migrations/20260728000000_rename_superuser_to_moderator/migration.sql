-- Rename the SUPERUSER role to MODERATOR (existing rows keep their value under the new name).
ALTER TYPE "Role" RENAME VALUE 'SUPERUSER' TO 'MODERATOR';
