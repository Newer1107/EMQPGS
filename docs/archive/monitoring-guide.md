# Monitoring Guide

## Endpoints

- `GET /api/health` - health summary, optionally protected by `x-health-token`
- `GET /api/monitoring` - COE metrics dashboard payload

## What Is Monitored

- MySQL reachability and basic query latency
- MinIO bucket availability
- In-progress workflow counts for:
  - AI analysis
  - paper generation
  - export generation
  - system backup
- Counts of users, banks, reports, exports, backups, and stored objects

## Operational Checks

- Watch for long-running export generation after COE release windows
- Watch for backup failures caused by missing `mysqldump`
- Verify MinIO bucket counts roughly match expected artifact growth
- Review audit logs for repeated 403 and 429 responses
