// Prepare the 009 library expansion capture from the three registered public datasets.
// Usage: node migrations/prepare-009-library-expansion.mjs <usda_sr_legacy_2018-04.zip> <usda_foundation_2026-10.zip> <cofid_2021.xlsx>
// Each file must match the SHA-256 already registered in colourfuel_catalog.dataset. Values are copied
// from the source records only: numbers stay numbers, CoFID "Tr" stays trace, anything else is missing.
// CoFID has no USDA-definition carbohydrate/fibre/sugars, so those three metrics stay missing for CoFID foods.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const sha = b => createHash('sha256').update(b).digest('hex');
const [srZip, fdZip, cofidXlsx] = process.argv.slice(2);
if (!cofidXlsx) throw Error('Pass the SR Legacy zip, the Foundation zip and the CoFID xlsx');
const REGISTERED = {
  usda_sr_legacy_2018_04: [srZip, '0fe8ae486a2c8eb42cb96413f058deb51863a46c8fb8eeb4b1fb45006dd338ef'],
  usda_foundation_2026_10: [fdZip, 'dd414cc9f1a132626bad354ef6655972c78b44aff14f16114dc899708663c579'],
  uk_cofid_2021: [cofidXlsx, '436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d'],
};
for (const [id, [file, want]] of Object.entries(REGISTERED)) if (sha(readFileSync(file)) !== want) throw Error(`${id}: file does not match the registered SHA-256`);

const unzip = (zip, member) => execFileSync('unzip', ['-p', zip, member], { maxBuffer: 1 << 30 }).toString('utf8');
const firstJson = zip => execFileSync('unzip', ['-Z1', zip]).toString().split('\n').find(n => n.endsWith('.json'));

// ---- USDA ----
const usda = new Map();
for (const [zip, key, type] of [[srZip, 'SRLegacyFoods', 'SR'], [fdZip, 'FoundationFoods', 'FD']]) {
  for (const f of JSON.parse(unzip(zip, firstJson(zip)))[key]) {
    const desc = f.description.replace(/ \(Includes foods for USDA's Food Distribution Program\)/, '');
    usda.set(`${type}:${desc}`, { type, id: f.fdcId, description: f.description,
      n: Object.fromEntries((f.foodNutrients || []).filter(x => x.nutrient && x.amount != null).map(x => [x.nutrient.number, { v: x.amount, unit: x.nutrient.unitName }])) });
  }
}
const FDC = {
  energy_reported: ['208', '958', '957'], protein: ['203'], fat: ['204'], water: ['255'], saturated_fat: ['606'], monounsaturated_fat: ['645'],
  polyunsaturated_fat: ['646'], cholesterol: ['601'], calcium: ['301'], iron: ['303'], magnesium: ['304'], phosphorus: ['305'], potassium: ['306'],
  sodium: ['307'], zinc: ['309'], copper: ['312'], manganese: ['315'], selenium: ['317'], iodine: ['314'], chloride: [], biotin: ['416'],
  thiamin: ['404'], riboflavin: ['405'], niacin: ['406'], pantothenic_acid: ['410'], vitamin_b6: ['415'], vitamin_b12: ['418'], vitamin_c: ['401'],
  vitamin_k1: ['430'], folate_total: ['417'], carbohydrate_by_difference: ['205'], fibre_total_dietary: ['291'], sugars_total: ['269', '269.3'],
};
const UNIT = { G: 'g', MG: 'mg', UG: 'µg', KCAL: 'kcal' };

// ---- CoFID (xlsx = zip of XML) ----
const dec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const strings = [...unzip(cofidXlsx, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
const rels = Object.fromEntries([...unzip(cofidXlsx, 'xl/_rels/workbook.xml.rels').matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)].map(m => [m[1], m[2]]));
const sheetFile = Object.fromEntries([...unzip(cofidXlsx, 'xl/workbook.xml').matchAll(/<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"/g)].map(m => [dec(m[1]), 'xl/' + rels[m[2]].replace(/^\/?xl\//, '')]));
const colIndex = r => [...r.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
function sheet(name) {
  const rows = [];
  for (const m of unzip(cofidXlsx, sheetFile[name]).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const r = [];
    for (const c of m[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const t = (c[2].match(/t="(\w+)"/) || [])[1];
      let v = (c[3] || '').match(/<v>([\s\S]*?)<\/v>/); v = v ? v[1] : ((c[3] || '').match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
      if (v != null) r[colIndex(c[1])] = t === 's' ? strings[+v] : dec(v);
    }
    rows.push(r);
  }
  const h = rows.findIndex(r => String(r[1]).trim().toLowerCase() === 'food name');
  const data = rows.slice(h + 2).filter(r => r[0] && /^\d/.test(r[0]));
  const counts = new Map(); for (const r of data) counts.set(r[0], (counts.get(r[0]) || 0) + 1);
  // CoFID 2021 reuses code 13-669 for two foods; a reused code is never accepted as a source.
  return { head: rows[h], count: data.length, rows: new Map(data.filter(r => counts.get(r[0]) === 1).map(r => [r[0], r])) };
}
const cofidSheets = ['1.3 Proximates', '1.4 Inorganics', '1.5 Vitamins'].map(sheet);
if (cofidSheets.some(s => s.count !== 2887)) throw Error('CoFID record count changed: ' + cofidSheets.map(s => s.count));
const COFID = {
  energy_reported: 'Energy (kcal) (kcal)', protein: 'Protein (g)', fat: 'Fat (g)', water: 'Water (g)', saturated_fat: 'Satd FA /100g fd (g)',
  monounsaturated_fat: 'Mono FA /100g food (g)', polyunsaturated_fat: 'Poly FA /100g food (g)', cholesterol: 'Cholesterol (mg)',
  calcium: 'Calcium (mg)', iron: 'Iron (mg)', magnesium: 'Magnesium (mg)', phosphorus: 'Phosphorus (mg)', potassium: 'Potassium (mg)', sodium: 'Sodium (mg)',
  zinc: 'Zinc (mg)', copper: 'Copper (mg)', manganese: 'Manganese (mg)', selenium: 'Selenium (µg)', iodine: 'Iodine (µg)', chloride: 'Chloride (mg)',
  biotin: 'Biotin (µg)', thiamin: 'Thiamin (mg)', riboflavin: 'Riboflavin (mg)', niacin: 'Niacin (mg)', pantothenic_acid: 'Pantothenate (mg)',
  vitamin_b6: 'Vitamin B6 (mg)', vitamin_b12: 'Vitamin B12 (µg)', vitamin_c: 'Vitamin C (mg)', vitamin_k1: 'Vitamin K1 (µg)', folate_total: 'Folate (µg)',
};
function cofidRecord(code) {
  const parts = cofidSheets.map(s => s.rows.get(code));
  if (parts.some(p => !p)) return null;
  const value = col => { for (const [i, s] of cofidSheets.entries()) { const k = s.head.indexOf(col); if (k >= 0) return parts[i][k]; } throw Error('No CoFID column ' + col); };
  return { code, name: parts[0][1], description: parts[0][2] || '', hash: sha(JSON.stringify(parts)).slice(0, 12), value };
}

// ---- metrics (fixed order from the catalogue) ----
const METRICS = JSON.parse(readFileSync(new URL('../fixtures/persistent-catalog-source.json', import.meta.url))).metrics.map(m => ({ id: m.metric_id, unit: m.unit, name: m.name_en }));
if (METRICS.length !== 33) throw Error('Expected 33 metrics');

const foods = [];
for (const line of readFileSync(new URL('./009-food-list.txt', import.meta.url), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [vid, name, category, zh, src] = line.split('|');
  const [ingredient, state] = vid.split('--');
  let out;
  if (src.startsWith('C:')) {
    const r = cofidRecord(src.slice(2)); if (!r) throw Error('CoFID record not found: ' + src);
    const rid = `uk_cofid_2021:${r.code}:${r.hash}`;
    out = { record_id: rid, dataset_id: 'uk_cofid_2021', source_name: r.name, source_food_id: r.code, source_description: r.description,
      source_url: 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
      nutrients: METRICS.map(m => {
        const col = COFID[m.id];
        const raw = col ? r.value(col) : null;
        if (raw === 'Tr') return { metric_id: m.id, unit: m.unit, result: 'trace_retained', primary_value: null, primary_qualifier: 'trace', primary_record_id: rid };
        if (raw != null && /^-?\d+(\.\d+)?(E-?\d+)?$/i.test(String(raw).trim())) return { metric_id: m.id, unit: m.unit, result: 'primary_numeric', primary_value: Number(raw), primary_qualifier: 'reported_numeric', primary_record_id: rid };
        return { metric_id: m.id, unit: m.unit, result: 'missing', primary_value: null, source_qualifier: col ? (raw === 'N' ? 'not_determined' : 'missing') : 'not_in_source_definition' };
      }) };
  } else {
    const f = usda.get(src); if (!f) throw Error('USDA record not found: ' + src);
    const ds = f.type === 'SR' ? 'usda_sr_legacy_2018_04' : 'usda_foundation_2026_10';
    const rid = `${ds}:${f.id}`;
    out = { record_id: rid, dataset_id: ds, source_name: f.description, source_food_id: String(f.id), source_description: f.description,
      source_url: `https://fdc.nal.usda.gov/food-details/${f.id}/nutrients`,
      nutrients: METRICS.map(m => {
        const hit = (FDC[m.id] || []).map(no => f.n[no]).find(x => x && Number.isFinite(x.v) && UNIT[String(x.unit).toUpperCase()] === m.unit);
        return hit ? { metric_id: m.id, unit: m.unit, result: 'primary_numeric', primary_value: hit.v, primary_qualifier: 'reported_numeric', primary_record_id: rid }
          : { metric_id: m.id, unit: m.unit, result: 'missing', primary_value: null, source_qualifier: 'missing' };
      }) };
  }
  const energy = out.nutrients.find(n => n.metric_id === 'energy_reported'), protein = out.nutrients.find(n => n.metric_id === 'protein');
  if (energy.result === 'missing' || protein.result === 'missing') throw Error(`${vid}: energy and protein are required`);
  foods.push({ variant_id: vid, ingredient_id: ingredient, state, name_en: name, category, aliases: [name, zh], ...out });
}
const capture = { batch: 'ireland-core-2026-11-20', prepared_from: Object.fromEntries(Object.entries(REGISTERED).map(([k, [, h]]) => [k, h])), metrics: METRICS.map(m => m.id), foods };
const json = JSON.stringify(capture, null, 1) + '\n';
writeFileSync(new URL('../fixtures/library-expansion-009.json', import.meta.url), json);
writeFileSync(new URL('../fixtures/library-expansion-009.sha256', import.meta.url), sha(json) + '\n');
console.log(`Prepared ${foods.length} foods; capture SHA-256 ${sha(json)}`);
