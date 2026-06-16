-- Add composite index for audit trail queries filtering by actor + action + time
CREATE INDEX `AuditLog_actorId_action_createdAt_idx` ON `AuditLog` (`actorId`, `action`, `createdAt`);
