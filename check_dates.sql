-- Count classes grouped by date
SELECT date, COUNT(*) as class_count, string_agg(title, ', ') as titles
FROM classes
GROUP BY date
ORDER BY date DESC
LIMIT 20;
