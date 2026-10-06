# Data update policy

- All future data updates must be incremental. Preserve existing daily records for past dates (Asia/Shanghai) exactly; do not delete, replace, reclassify, or rewrite them without explicit user authorization.
- Add new dates and allow the current day's upstream data to finish updating. Preserve existing appearances if they disappear upstream.
- Merge topic list updates and new problems while retaining existing topics and problems. Derive their daily date links from the preserved daily index.
- Keep these guarantees in the scheduled GitHub Actions build and test them before deploying changes to data ingestion.
- Sync at Asia/Shanghai 08:00–12:00 and 20:00–24:00 hourly, plus 16:00 (the 12:00–20:00 window runs every four hours). Do not schedule overnight runs between 00:00 and 08:00. Review upstream changes since the last synchronized commit (fall back to the last two days when unavailable), and publish historical differences as pending notifications. Only an explicit approval of the matching change ID may merge a historical correction; never treat notification viewing as approval.
