-- Parameters: $1 = local business date (YYYY-MM-DD); $2 = IANA shop timezone.
-- Amounts are cents. completed_at records payment completion, not cart creation.
-- Currency stays in the grouping so amounts in different currencies are never added.
SELECT payment_method, currency, COUNT(*) AS sales,
       SUM(total_amount) AS total_cents,
       SUM(total_amount) / 100.0 AS total_major_units
FROM "Transaction"
WHERE status = 'COMPLETE'
  AND completed_at >= ($1::date::timestamp AT TIME ZONE $2)
  AND completed_at < (($1::date + 1)::timestamp AT TIME ZONE $2)
GROUP BY payment_method, currency
ORDER BY payment_method, currency;
