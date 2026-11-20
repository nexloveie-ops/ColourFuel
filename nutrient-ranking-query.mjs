// A read-only, parameterized PostgreSQL query. Percentages are query results, never stored fields.
// $1 is the checked catalogue snapshot, read entirely from persistent catalogue tables.
export const NUTRIENT_RANKING_SQL=`
WITH modes(include_estimates) AS (VALUES (true),(false)),
foods AS (SELECT f->>'variant_id' AS variant_id,f->>'name_en' AS name_en,f->>'source_basis' AS source_basis,f ? 'reported_nutrients' AS reported,
 COALESCE(f->'reported_nutrients',f->'nutrients','[]'::jsonb) AS list FROM jsonb_array_elements($1::jsonb->'ingredients') f),
metrics AS (SELECT m->>'metric_id' AS metric_id,m->>'unit' AS unit FROM jsonb_array_elements($1::jsonb->'metrics') m),
entries_by_food AS (
 SELECT DISTINCT ON (variant_id,n->>'metric_id') variant_id,n->>'metric_id' AS metric_id,n
 FROM foods CROSS JOIN LATERAL jsonb_array_elements(list) WITH ORDINALITY x(n,pos)
 ORDER BY variant_id,n->>'metric_id',pos
), matched AS (
 SELECT md.include_estimates,f.variant_id,f.name_en,f.source_basis,f.reported,m.metric_id,m.unit,e.n
 FROM foods f CROSS JOIN metrics m CROSS JOIN modes md
 LEFT JOIN entries_by_food e ON e.variant_id=f.variant_id AND e.metric_id=m.metric_id
), extracted AS (
 SELECT *,CASE WHEN reported THEN n->'value'
  WHEN n->>'result'='reference_imputation' THEN n->'filled_value'
  WHEN n->>'result'='primary_numeric' THEN n->'primary_value' END AS raw_value,
  COALESCE(n->>'result'='reference_imputation',false) AS estimated
 FROM matched
), normalized AS (
 SELECT *,CASE WHEN jsonb_typeof(raw_value)='number' THEN (raw_value#>>'{}')::numeric END AS amount
 FROM extracted
), classified AS (
 SELECT *,
 CASE WHEN source_basis IS NOT NULL AND source_basis<>'100g_food' THEN 'incompatible'
  WHEN n->>'result'='trace_retained' THEN 'trace'
  WHEN n IS NOT NULL AND n->>'unit' IS DISTINCT FROM unit THEN 'incompatible'
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
), ranked_rows AS (
 SELECT r.include_estimates,r.metric_id,jsonb_agg(jsonb_build_object('variant_id',r.variant_id,'value',r.amount,
  'unit',r.unit,'estimated',r.estimated,
  'kind',CASE WHEN r.estimated THEN 'Reference estimate' WHEN r.reported THEN 'Manufacturer reference' ELSE 'Source value' END,
  'rank',r.rank,'tied',r.tied,'total',r.population,
  'topPercent',ceil((r.rank+r.tied-1)::numeric*100/r.population))
  ORDER BY r.amount DESC,r.name_en COLLATE "C",r.variant_id) AS rows
 FROM ranked r GROUP BY r.include_estimates,r.metric_id
), entries AS (
 SELECT c.include_estimates,c.metric_id,jsonb_build_object('metric_id',c.metric_id,'coverage',c.coverage,
 'rows',COALESCE(rr.rows,'[]'::jsonb)) AS entry
 FROM coverage c LEFT JOIN ranked_rows rr ON rr.include_estimates=c.include_estimates AND rr.metric_id=c.metric_id
)
SELECT jsonb_build_object('engine','postgresql-window-functions','basis','100g_edible',
 'catalog_read_at',$1::jsonb->'read_at',
 'with_estimates',COALESCE(jsonb_agg(entry ORDER BY metric_id) FILTER(WHERE include_estimates),'[]'::jsonb),
 'source_only',COALESCE(jsonb_agg(entry ORDER BY metric_id) FILTER(WHERE NOT include_estimates),'[]'::jsonb)) AS rankings
FROM entries`;
