-- STAFF duplicaba a WAITER. Se conserva el valor del enum para no romper migraciones previas.
UPDATE "User" SET "role" = 'WAITER' WHERE "role" = 'STAFF';
