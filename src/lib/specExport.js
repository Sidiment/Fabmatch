/** Builds the specification export for a project: each lot's record, documentation, and yardage estimate with its method. */
import { PRODUCTS } from './estimator.js';
import { formatDate, formatRubs, formatNrc, formatNumber } from './format.js';
import { methodSentence, planSummary } from '../components/estimateTable.js';
import { isPieceLot } from '../../shared/catalog.js';
import { estimateForLot, amountLabel, NOT_RECORDED } from './lotView.js';

const orBlank = (value) => (value === null || value === undefined || value === '' ? NOT_RECORDED : value);

function manufacturerLine(lot) {
  if (!lot.mfr) return `- Brand: ${NOT_RECORDED}`;
  if (lot.mfrVerified === false) return `- Brand (from the sample label, not verified): ${lot.mfr}`;
  return `- Verified manufacturer: ${lot.mfr}${lot.region ? `, ${lot.region}` : ''}`;
}

function amountLines(lot) {
  const confirmed = lot.lastConfirmed ? `last confirmed ${formatDate(lot.lastConfirmed)}` : 'not confirmed yet';
  if (isPieceLot(lot)) {
    return [
      `- Piece size: ${orBlank(lot.size)}`,
      `- Pieces on hand: ${amountLabel(lot)}, ${confirmed}`,
      `- Source: ${lot.source}${lot.sourceRow ? `, inventory spreadsheet row ${lot.sourceRow}` : ''}`,
    ];
  }
  return [
    `- Width: ${lot.width ? `${lot.width} in` : NOT_RECORDED}`,
    `- Yardage on hand: ${amountLabel(lot)}, ${confirmed}`,
  ];
}

function colorLine(lot) {
  if (!lot.family) return `- Color: ${NOT_RECORDED}`;
  return `- Color: ${lot.family.fullName} (${lot.family.code}), ${lot.tone.tone.toLowerCase()} tone, ${lot.tone.name}`;
}

function patternLine(lot) {
  const direction = lot.directional === null || lot.directional === undefined ? '' : lot.directional ? ', runs in one direction' : '';
  return `- Pattern: ${orBlank(lot.pattern)}${direction}`;
}

function lotSection(lot, assumptions) {
  const lines = [
    `## ${lot.title} (${lot.id})`,
    '',
    manufacturerLine(lot),
    `- Application: ${orBlank(lot.cat)}`,
    `- Fiber: ${orBlank(lot.fiber)}`,
    ...amountLines(lot),
    colorLine(lot),
    patternLine(lot),
    `- Flammability (manufacturer's sheet): ${lot.fire.join(', ') || 'Not listed'}`,
    `- Abrasion (ACT guideline, Wyzenbeek): ${lot.rubs ? formatRubs(lot.rubs) : 'Not listed'}`,
    `- Acoustic: ${lot.nrc ? formatNrc(lot.nrc) : 'Not listed'}`,
    `- Documentation on file: ${lot.docs.length ? lot.docs.join(', ') : 'None yet'} (publisher: manufacturer)`,
    '',
    `### Products ${isPieceLot(lot) ? 'these pieces' : 'this yardage'} can support`,
    '',
  ];
  PRODUCTS.forEach((product) => {
    const r = estimateForLot(lot, product, assumptions);
    const note = product.placeholder ? ' (size to be confirmed)' : '';
    let text = 'Does not fit';
    if (r.fits && r.panels) text = `${formatNumber(r.quantity)} ${product.unit} (${planSummary(r)})`;
    else if (r.fits) text = `${formatNumber(r.quantity)} ${product.unit}${r.yardsPerUnit ? `, ${r.yardsPerUnit.toFixed(2)} yd each` : ''}`;
    else if (/not recorded/.test(r.reason || '')) text = 'Not recorded';
    lines.push(`- ${product.name}${note}: ${text}`);
  });
  lines.push('', methodSentence(lot, assumptions), '', '### Estimated diversion', '', 'No diversion figure is shown until the method is verified.', '');
  return lines.join('\n');
}

export function buildSpecMarkdown(project, lots, { assumptions = {}, date = new Date() } = {}) {
  const header = [
    `# ${project.name}: textile specification`,
    '',
    `Exported from Fabmatch on ${date.toISOString().slice(0, 10)}. ${lots.length} ${lots.length === 1 ? 'lot' : 'lots'}. Sample data from the R&D and Pilot stage.`,
    '',
    'Ratings are published by each fabric\'s manufacturer and shown as listed. Yardage figures are estimates with their method shown. Fabmatch, a Redesign Collective company.',
    '',
  ];
  return [...header, ...lots.map((lot) => lotSection(lot, assumptions))].join('\n');
}

export function specFileName(project, date = new Date()) {
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
  return `fabmatch-spec-${slug}-${date.toISOString().slice(0, 10)}.md`;
}

export function downloadText(fileName, text, doc = document) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = fileName;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
