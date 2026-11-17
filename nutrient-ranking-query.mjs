// A read-only, parameterized PostgreSQL query. Percentages are query results, never stored fields.
// $1 is the checked catalogue snapshot, including explicitly versioned supplemental records.
export const NUTRIENT_RANKING_SQL=`
WITH modes(include_estimates) AS (VALUES (true),(false)),
foods AS (SELECT f FROM jsonb_array_elements($1::jsonb->'ingredients') f),
metrics AS (SELECT m FROM jsonb_array_elements($1::jsonb->'metrics') m),
matched AS (
 SELECT include_estimates,f,m,
  (SELECT n FROM jsonb_array_elements(COALESCE(f->'reported_nutrients',f->'nutrients','[]'::jsonb)) n
   WHERE n->>'metric_id'=m->>'metric_id' LIMIT 1) AS n
 FROM foods CROSS JOIN metrics CROSS JOIN modes
), extracted AS (
 SELECT *,CASE WHEN f ? 'reported_nutrients' THEN n->'value'
  WHEN n->>'result'='reference_imputation' THEN n->'filled_value'
  WHEN n->>'result'='primary_numeric' THEN n->'primary_value' END AS raw_value,
  COALESCE(n->>'result'='reference_imputation',false) AS estimated
 FROM matched
), normalized AS (
 SELECT *,CASE WHEN jsonb_typeof(raw_value)='number' THEN (raw_value#>>'{}')::numeric END AS amount
 FROM extracted
), classified AS (
 SELECT *,m->>'metric_id' AS metric_id,f->>'variant_id' AS variant_id,
 CASE WHEN f->>'source_basis' IS NOT NULL AND f->>'source_basis'<>'100g_food' THEN 'incompatible'
  WHEN n->>'result'='trace_retained' THEN 'trace'
  WHEN n IS NOT NULL AND n->>'unit' IS DISTINCT FROM m->>'unit' THEN 'incompatible'
  WHEN amount IS NULL OR amount<0 THEN 'missing'
  WHEN estimated AND NOT include_estimates THEN 'estimatesExcluded'
  ELSE 'known' END AS status
 FROM normalized
), ranked AS (
 SELECT *,rank() OVER(PARTITION BY include_estimates,metric_id ORDER BY amount DESC) AS rank,
  count(*) OVER(PARTITION BY include_estimates,metric_id,amount) AS tied,
  count(*) OVER(PARTITION BY include_estimates,metric_id) AS population
 FROM classified WHERE status='known'
), coverage AS (
 SELECT include_estimates,metric_id,
  jsonb_build_object('total',count(*),'known',count(*) FILTER(WHERE status='known'),
   'positive',count(*) FILTER(WHERE status='known' AND amount>0),
   'zero',count(*) FILTER(WHERE status='known' AND amount=0),
   'trace',count(*) FILTER(WHERE status='trace'),'missing',count(*) FILTER(WHERE status='missing'),
   'incompatible',count(*) FILTER(WHERE status='incompatible'),
   'estimatesExcluded',count(*) FILTER(WHERE status='estimatesExcluded'),
   'estimates',count(*) FILTER(WHERE status='known' AND estimated)) AS coverage
 FROM classified GROUP BY include_estimates,metric_id
), entries AS (
 SELECT c.include_estimates,c.metric_id,jsonb_build_object('metric_id',c.metric_id,'coverage',c.coverage,
 'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object('variant_id',r.variant_id,'value',r.amount,
  'unit',r.m->>'unit','estimated',r.estimated,
  'kind',CASE WHEN r.estimated THEN 'Reference estimate' WHEN r.f ? 'reported_nutrients' THEN 'Manufacturer reference' ELSE 'Source value' END,
  'rank',r.rank,'tied',r.tied,'total',r.population,
  'topPercent',ceil((r.rank+r.tied-1)::numeric*100/r.population))
  ORDER BY r.amount DESC,r.f->>'name_en' COLLATE "C",r.variant_id)
 FROM ranked r WHERE r.include_estimates=c.include_estimates AND r.metric_id=c.metric_id),'[]'::jsonb)) AS entry
 FROM coverage c
)
SELECT jsonb_build_object('engine','postgresql-window-functions','basis','100g_edible',
 'catalog_read_at',$1::jsonb->'read_at',
 'with_estimates',COALESCE(jsonb_agg(entry ORDER BY metric_id) FILTER(WHERE include_estimates),'[]'::jsonb),
 'source_only',COALESCE(jsonb_agg(entry ORDER BY metric_id) FILTER(WHERE NOT include_estimates),'[]'::jsonb)) AS rankings
FROM entries`;
