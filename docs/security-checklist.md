# Security Checklist

- JWT access and refresh cookies are `httpOnly`
- Session idle timeout is enforced through refresh-token validation
- CSRF protection is enabled for all non-GET API requests
- RBAC is enforced in both `proxy.ts` and route handlers
- Generic storage presign access is restricted for export and backup buckets
- Signed object URLs use short expiry windows
- Rate limiting is enabled at API wrapper level
- Secure response headers are configured in `next.config.ts`
- Audit logs are append-only and chained with `previousHash` + `integrityHash`
- Locked question banks are immutable
- Export downloads are COE-only
- Health endpoint supports optional shared-secret header
