# Data update policy

- All future data updates must be incremental. Preserve existing daily records for past dates (Asia/Shanghai) exactly; do not delete, replace, reclassify, or rewrite them without explicit user authorization.
- Add new dates and allow the current day's upstream data to finish updating. Preserve existing appearances if they disappear upstream.
- Merge topic list updates and new problems while retaining existing topics and problems. Derive their daily date links from the preserved daily index.
- Keep these guarantees in the scheduled GitHub Actions build and test them before deploying changes to data ingestion.
- Sync every three hours. Review upstream changes since the last synchronized commit (fall back to the last two days when unavailable), and publish historical differences as pending notifications. Only an explicit approval of the matching change ID may merge a historical correction; never treat notification viewing as approval.
