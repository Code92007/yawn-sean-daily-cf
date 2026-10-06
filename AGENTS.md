# Data update policy

- All future data updates must be incremental. Preserve existing daily records for past dates (Asia/Shanghai) exactly; do not delete, replace, reclassify, or rewrite them without explicit user authorization.
- Add new dates and allow the current day's upstream data to finish updating. Preserve existing appearances if they disappear upstream.
- Merge topic list updates and new problems while retaining existing topics and problems. Derive their daily date links from the preserved daily index.
- Keep these guarantees in the scheduled GitHub Actions build and test them before deploying changes to data ingestion.
