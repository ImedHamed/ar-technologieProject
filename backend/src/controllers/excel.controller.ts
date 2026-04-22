import { Request, Response } from 'express';
import prisma from '../config/database';
import * as XLSX from 'xlsx';
import { countDreKoInDossiers } from '../utils/dre-ko-filter';

function normalizeImportedSecteurName(raw: unknown): string {
    if (raw == null) return '';
    let s = String(raw).replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ').trim();
    if (!s) return '';

    // Handle Excel-style formulas referencing a sheet name, e.g. ='BEIN A PAYER '!A1
    if (s.startsWith('=')) {
        const quoted = s.match(/^=\s*'([^']+?)'\s*!?.*$/);
        if (quoted) {
            s = quoted[1];
        } else {
            const unquoted = s.match(/^=\s*([^!]+?)\s*!?.*$/);
            if (unquoted) s = unquoted[1];
        }
    }

    s = s.replace(/^['"]+|['"]+$/g, '');
    s = s.replace(/!+$/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

/**
 * Derive column config dynamically from dossier data keys.
 * Used as fallback when a sector has no stored columnConfig.
 */
async function deriveColumnConfig(secteur: string): Promise<any[]> {
    const dossiers = await prisma.dossierEtude.findMany({
        where: { secteur },
        take: 5, // sample a few dossiers to get all keys
    });
    if (dossiers.length === 0) return [];
    // Collect all unique keys from dossier data
    const keySet = new Set<string>();
    for (const d of dossiers) {
        const data = d.data as Record<string, any>;
        for (const key of Object.keys(data)) {
            keySet.add(key);
        }
    }
    // Build config from actual data keys
    const keys = Array.from(keySet);
    return keys.map((key, idx) => ({
        key,
        label: key,
        type: key.toLowerCase().includes('date') || key === 'DRE'
            || key.toLowerCase().includes('relance') || key.toLowerCase().includes('création')
            ? 'date' : (key.toLowerCase().includes('comment') ? 'textarea' : 'text'),
        required: idx === 0,
    }));
}

// Mapping from lowercase ETAT values → SuiviEtude field names (same as dossier controller)
const ETAT_TO_FIELD: Record<string, string> = {
    '01 vt a faire': 'vtAFaire',
    '01 at vt': 'vtAFaire',
    '01.2 a remonter': 'aRemonter',
    '01.3 etude cdc': 'vtAFaire',
    '02 retour vt': 'retourVt',
    '03 dossier a reprendre': 'dossAReprendre',
    '04 dossier a monter': 'dossAMonter',
    '05 at info caf ref': 'attInfosCafRef',
    '05.1 etu transmise': 'attInfosCafRef',
    '06 at devis client': 'attDevisClient',
    '07 at trvx client': 'attTravauxClient',
    '08 at comac/capft': 'attComacCafft',
    '09 at devis orange/rip': 'attDevisOrangeRip',
    '10 at pv': 'attPv',
    '10.1 att dt': 'attPv',
    '11 at dta': 'attDta',
    '12 at maj si': 'attMajSi',
    '13 etat 5': 'etat5',
    '14 poi en travaux': 'poiEnTravaux',
    '14.1 at retour doe': 'atRetourDoe',
    '15 poi factu': 'recolAFaire',
    '16 dossier paye': 'recolAFaire',
    // SPI AQ-specific étude mapping
    '05 at pv': 'attPv',
    '05.1 at dta': 'attDta',
    '06 at maj si': 'attMajSi',
    '07 at info caf ref': 'attInfosCafRef',
    '08 at devis orange/rip': 'attDevisOrangeRip',
    '09 poi en travaux': 'poiEnTravaux',
    '09.1 att doe': 'atRetourDoe',
    // COMAC CAPFT
    '01 dossier à monter': 'dossAMonter',
    '04 dossier à reprendre': 'dossAReprendre',
    '05 dossier terminer': 'etat5',
    // SPI Bretagne
    '01 dossier bloqué': 'dossAReprendre',
    '02 dossier envoyé': 'dossAMonter',
    '03 etude terminé': 'etat5',
};

/**
 * Recalculate sector counts from dossier data (mirrors dossier-etude.controller logic)
 */
async function recalcSectorCounts(secteur: string) {
    try {
        const dossiers = await prisma.dossierEtude.findMany({ where: { secteur } });
        const total = dossiers.length;

        const counts: Record<string, number> = {};
        for (const field of Object.values(ETAT_TO_FIELD)) {
            counts[field] = 0;
        }

        const sector = await prisma.suiviEtude.findUnique({ where: { secteur } });
        const colConfig = (sector?.columnConfig as any[]) || [];
        const etatCol = colConfig.find(
            (c: any) => c.key?.toLowerCase() === 'etat' || c.label?.toLowerCase() === 'etat'
        );
        const etatKey = etatCol?.key || 'ETAT';

        for (const d of dossiers) {
            const data = d.data as Record<string, any>;
            let etatVal = data[etatKey];
            if (etatVal === undefined) {
                for (const key of Object.keys(data)) {
                    if (key.toLowerCase() === 'etat') { etatVal = data[key]; break; }
                }
            }
            if (!etatVal) continue;
            const lower = String(etatVal).toLowerCase().trim();
            const field = ETAT_TO_FIELD[lower];
            if (field) counts[field] = (counts[field] || 0) + 1;
        }

        const dreKo = countDreKoInDossiers(dossiers, colConfig);

        if (sector) {
            await prisma.suiviEtude.update({
                where: { secteur },
                data: {
                    nbDossiers: total,
                    dreKo,
                    vtAFaire: counts.vtAFaire || 0,
                    aRemonter: counts.aRemonter || 0,
                    retourVt: counts.retourVt || 0,
                    dossAReprendre: counts.dossAReprendre || 0,
                    dossAMonter: counts.dossAMonter || 0,
                    attInfosCafRef: counts.attInfosCafRef || 0,
                    attDevisClient: counts.attDevisClient || 0,
                    attTravauxClient: counts.attTravauxClient || 0,
                    attComacCafft: counts.attComacCafft || 0,
                    attDevisOrangeRip: counts.attDevisOrangeRip || 0,
                    attPv: counts.attPv || 0,
                    attDta: counts.attDta || 0,
                    attMajSi: counts.attMajSi || 0,
                    etat5: counts.etat5 || 0,
                    poiEnTravaux: counts.poiEnTravaux || 0,
                    atRetourDoe: counts.atRetourDoe || 0,
                    recolAFaire: counts.recolAFaire || 0,
                },
            });
        }
    } catch (err) {
        console.error('recalcSectorCounts error:', err);
    }
}

export class ExcelController {
    /**
     * GET /api/v1/excel/export?secteur=XXX
     * Export all dossiers for a sector as an Excel file
     */
    async exportExcel(req: Request, res: Response): Promise<void> {
        try {
            const secteur = req.query.secteur as string;
            if (!secteur) {
                res.status(400).json({ error: 'secteur query parameter is required' });
                return;
            }

            // Get column config for this sector
            const sector = await prisma.suiviEtude.findUnique({ where: { secteur } });
            let columnConfig = (sector?.columnConfig as any[]);
            if (!columnConfig || columnConfig.length === 0) {
                columnConfig = await deriveColumnConfig(secteur);
            }

            // Get all dossiers (no pagination — export everything)
            const dossiers = await prisma.dossierEtude.findMany({
                where: { secteur },
                orderBy: { createdAt: 'asc' },
            });

            // Build header row from column config
            const headers = columnConfig.map((col: any) => col.label || col.key);

            // Build data rows
            const rows = dossiers.map((d) => {
                const data = d.data as Record<string, any>;
                return columnConfig.map((col: any) => {
                    // Try key first, then label, then case-insensitive
                    let val = data[col.key];
                    if (val === undefined) val = data[col.label];
                    if (val === undefined) {
                        const labelLower = (col.label || '').toLowerCase();
                        for (const k of Object.keys(data)) {
                            if (k.toLowerCase() === labelLower) { val = data[k]; break; }
                        }
                    }
                    return val ?? '';
                });
            });

            // Create workbook
            const wb = XLSX.utils.book_new();
            const wsData = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Auto-size columns
            ws['!cols'] = headers.map((h: string) => ({ wch: Math.max(h.length + 2, 15) }));

            XLSX.utils.book_append_sheet(wb, ws, secteur.substring(0, 31)); // Sheet name max 31 chars

            // Write to buffer and send
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            const filename = `${secteur.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(Buffer.from(buf));
        } catch (error: any) {
            console.error('Excel export error:', error);
            res.status(500).json({ error: 'Failed to export Excel file' });
        }
    }

    /**
     * POST /api/v1/excel/import
     * Import dossiers from an uploaded Excel file
     * Body: multipart/form-data with fields: secteur, file
     */
    async importExcel(req: Request, res: Response): Promise<void> {
        try {
            const secteur = req.body.secteur as string;
            const mode = (req.body.mode as string) || 'replace'; // 'add' or 'replace'
            const file = (req as any).file;

            if (!secteur) {
                res.status(400).json({ error: 'secteur field is required' });
                return;
            }
            if (!file) {
                res.status(400).json({ error: 'Excel file is required' });
                return;
            }

            // In replace mode, delete existing dossiers for this sector first
            if (mode === 'replace') {
                await prisma.dossierEtude.deleteMany({ where: { secteur } });
            }

            // Get column config for this sector
            const sector = await prisma.suiviEtude.findUnique({ where: { secteur } });
            const columnConfig = (sector?.columnConfig as any[]) || [];

            // Parse the uploaded Excel file from memory buffer
            const wb = XLSX.read(file.buffer, { type: 'buffer' });
            const sheetName = wb.SheetNames[0];
            if (!sheetName) {
                res.status(400).json({ error: 'Excel file has no sheets' });
                return;
            }

            const ws = wb.Sheets[sheetName];
            const allRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

            if (allRows.length < 2) {
                res.status(400).json({ error: 'Excel file must have a header row and at least one data row' });
                return;
            }

            // First row = headers
            const fileHeaders = (allRows[0] as any[]).map((h: any) => h ? String(h).trim() : '');

            // Map file headers to column config keys
            // Try exact match on label, then case-insensitive
            const headerToKey: (string | null)[] = fileHeaders.map((fh) => {
                // Exact label match
                const exact = columnConfig.find((c: any) => c.label === fh || c.key === fh);
                if (exact) return exact.key;
                // Case-insensitive
                const lower = fh.toLowerCase();
                const ci = columnConfig.find(
                    (c: any) => (c.label || '').toLowerCase() === lower || (c.key || '').toLowerCase() === lower
                );
                if (ci) return ci.key;
                // If no match in config, use the file header as key (allows extra columns)
                return fh || null;
            });

            // Build column config from Excel headers and update the sector
            const newColumnConfig = fileHeaders
                .filter(h => h) // skip empty headers
                .map((header, idx) => {
                    // Try to find existing config to preserve type/required settings
                    const existing = columnConfig.find((c: any) =>
                        c.label === header || c.key === header ||
                        (c.label || '').toLowerCase() === header.toLowerCase() ||
                        (c.key || '').toLowerCase() === header.toLowerCase()
                    );
                    return {
                        key: existing?.key || header,
                        label: header,
                        type: existing?.type || (header.toLowerCase().includes('date') || header === 'DRE' ? 'date' : 'text'),
                        required: existing?.required || idx === 0,
                    };
                });

            if (sector) {
                await prisma.suiviEtude.update({
                    where: { secteur },
                    data: { columnConfig: newColumnConfig },
                });
            }

            let imported = 0;
            for (let i = 1; i < allRows.length; i++) {
                const row = allRows[i] as any[];
                if (!row || row.every((c: any) => c === null || c === undefined || c === '')) continue;

                const dossierData: Record<string, any> = {};
                for (let j = 0; j < headerToKey.length; j++) {
                    const key = headerToKey[j];
                    if (!key) continue;
                    const value = row[j];
                    // Convert Excel date serial numbers to DD/MM/YYYY
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.includes('date') || key === 'DRE' ||
                        lowerKey.includes('relance') || lowerKey.includes('création')) {
                        if (typeof value === 'number') {
                            try {
                                const d = XLSX.SSF.parse_date_code(value);
                                if (d) {
                                    const dd = String(d.d).padStart(2, '0');
                                    const mm = String(d.m).padStart(2, '0');
                                    dossierData[key] = `${dd}/${mm}/${d.y}`;
                                    continue;
                                }
                            } catch { /* not a date */ }
                        }
                    }
                    // If cell exists in Excel but is empty, keep it as empty string
                    dossierData[key] = (value === undefined || value === null || String(value).trim() === '')
                        ? ''
                        : String(value);
                }

                if (Object.keys(dossierData).length > 0) {
                    await prisma.dossierEtude.create({
                        data: { secteur, data: dossierData },
                    });
                    imported++;
                }
            }

            // Recalculate sector counts
            await recalcSectorCounts(secteur);

            res.json({
                message: `Successfully imported ${imported} dossiers (mode: ${mode})`,
                imported,
                secteur,
                mode,
            });
        } catch (error: any) {
            console.error('Excel import error:', error);
            res.status(500).json({ error: 'Failed to import Excel file' });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // FULL EXPORT — Multi-sheet workbook (VUE GLOBAL + per-sector)
    // ═══════════════════════════════════════════════════════════

    /**
     * GET /api/v1/excel/export-full
     * Export the complete workbook: VUE GLOBAL sheet + one sheet per sector
     */
    async exportFull(_req: Request, res: Response): Promise<void> {
        try {
            const wb = XLSX.utils.book_new();

            // ── 1. VUE GLOBAL sheet ──
            const sectors = await prisma.suiviEtude.findMany({ orderBy: { secteur: 'asc' } });

            const vueHeaders = [
                'SECTEUR', 'NB DE DOSSIERS', 'DRE KO',
                'VT A FAIRE', 'A REMONTER', 'RETOUR VT',
                'DOSS A REPRENDRE', 'DOSS A MONTER',
                'ATT INFOS CAF REF', 'ATT DEVIS ORANGE/RIP', 'ATT DEVIS CLIENT',
                'ATT TRAVAUX CLIENT', 'ATT PV', 'ATT DTA',
                'ATT COMAC/CAFFT', 'ATT MAJ SI', 'POI EN TRAVAUX',
                'AT RETOUR DOE', 'RECOL A FAIRE', 'ETAT 5',
            ];

            const vueRows = sectors.map((s) => [
                s.secteur, s.nbDossiers, s.dreKo,
                s.vtAFaire, s.aRemonter, s.retourVt,
                s.dossAReprendre, s.dossAMonter,
                s.attInfosCafRef, s.attDevisOrangeRip, s.attDevisClient,
                s.attTravauxClient, s.attPv, s.attDta,
                s.attComacCafft, s.attMajSi, s.poiEnTravaux,
                s.atRetourDoe, s.recolAFaire, s.etat5,
            ]);

            // Totals row
            const totals = vueHeaders.slice(1).map((_, i) =>
                vueRows.reduce((sum, row) => sum + ((row[i + 1] as number) || 0), 0)
            );
            vueRows.push(['GLOBAL', ...totals]);

            // DOSSIER MAIN section
            vueRows.push([]);
            vueRows.push(['DOSSIER MAIN BE', 'DOSSIER MAIN CHAFF', 'SECTEUR']);
            for (const s of sectors) {
                vueRows.push([s.dossierMainBe, s.dossierMainChaff, s.secteur]);
            }

            const wsVue = XLSX.utils.aoa_to_sheet([vueHeaders, ...vueRows]);
            wsVue['!cols'] = vueHeaders.map((h) => ({ wch: Math.max(h.length + 2, 15) }));
            XLSX.utils.book_append_sheet(wb, wsVue, 'VUE GLOBAL');

            // ── 2. Per-sector dossier sheets ──
            for (const sector of sectors) {
                let columnConfig = (sector.columnConfig as any[]);
                if (!columnConfig || columnConfig.length === 0) {
                    columnConfig = await deriveColumnConfig(sector.secteur);
                }
                const dossiers = await prisma.dossierEtude.findMany({
                    where: { secteur: sector.secteur },
                    orderBy: { createdAt: 'asc' },
                });

                if (dossiers.length === 0) continue;

                const headers = columnConfig.map((col: any) => col.label || col.key);
                const rows = dossiers.map((d) => {
                    const data = d.data as Record<string, any>;
                    return columnConfig.map((col: any) => {
                        let val = data[col.key];
                        if (val === undefined) val = data[col.label];
                        if (val === undefined) {
                            const labelLower = (col.label || '').toLowerCase();
                            for (const k of Object.keys(data)) {
                                if (k.toLowerCase() === labelLower) { val = data[k]; break; }
                            }
                        }
                        return val ?? '';
                    });
                });

                const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                ws['!cols'] = headers.map((h: string) => ({ wch: Math.max(h.length + 2, 15) }));
                // Sheet name max 31 chars
                const sheetName = sector.secteur.substring(0, 31);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            }

            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="Suivi_etudes_export.xlsx"');
            res.send(Buffer.from(buf));
        } catch (error: any) {
            console.error('Full Excel export error:', error);
            res.status(500).json({ error: 'Failed to export full Excel file' });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // FULL IMPORT — Multi-sheet workbook (VUE GLOBAL + per-sector)
    // ═══════════════════════════════════════════════════════════

    // Known header identifiers for different sheets
    private static HEADER_MARKERS = [
        'Code OEIE', 'ETAT', 'COG', 'POI', 'Act', 'DEPT',
        'Département', 'COMMUNE', 'Référence',
    ];

    private static VUE_GLOBAL_SKIP = ['TOTAL', 'GLOBAL', 'SECTEUR', 'TAUX', 'DOSSIER MAIN'];

    private static findHeaderRow(allRows: any[][], maxSearch = 5): number {
        for (let i = 0; i < Math.min(allRows.length, maxSearch); i++) {
            const row = allRows[i] as any[];
            if (!row) continue;
            const stringCells = row.filter((c: any) => typeof c === 'string');
            if (stringCells.length >= 3) {
                const hasMarker = stringCells.some((c: string) =>
                    ExcelController.HEADER_MARKERS.some(m => c.trim() === m || c.trim().includes(m))
                );
                if (hasMarker) return i;
            }
        }
        return -1;
    }

    /**
     * POST /api/v1/excel/import-full
     * Import the complete workbook: VUE GLOBAL + per-sector dossier sheets
     */
    async importFull(req: Request, res: Response): Promise<void> {
        try {
            const file = (req as any).file;
            const mode = (req.body?.mode as string) || 'replace'; // 'add' or 'replace'
            if (!file) {
                res.status(400).json({ error: 'Excel file is required' });
                return;
            }

            const wb = XLSX.read(file.buffer, { type: 'buffer' });
            console.log(`📋 Sheets found: ${wb.SheetNames.join(', ')} (mode: ${mode})`);

            // ── 1. Import VUE GLOBAL ──
            const wsVue = wb.Sheets['VUE GLOBAL'];
            let secteursImported = 0;
            if (wsVue) {
                if (mode === 'replace') {
                    await prisma.suiviEtude.deleteMany();
                }
                const vueRows = XLSX.utils.sheet_to_json<any[]>(wsVue, { header: 1 });

                for (let i = 1; i < vueRows.length; i++) {
                    const row = vueRows[i] as any[];
                    if (!row || !row[0] || typeof row[0] !== 'string') continue;
                    const secteur = normalizeImportedSecteurName(row[0]);
                    if (!secteur) continue;
                    if (ExcelController.VUE_GLOBAL_SKIP.some(s => secteur.toUpperCase().includes(s))) continue;

                    const secteurData = {
                        nbDossiers: parseInt(row[1]) || 0,
                        dreKo: parseInt(row[2]) || 0,
                        vtAFaire: parseInt(row[3]) || 0,
                        aRemonter: parseInt(row[4]) || 0,
                        retourVt: parseInt(row[5]) || 0,
                        dossAReprendre: parseInt(row[6]) || 0,
                        dossAMonter: parseInt(row[7]) || 0,
                        attInfosCafRef: parseInt(row[8]) || 0,
                        attDevisOrangeRip: parseInt(row[9]) || 0,
                        attDevisClient: parseInt(row[10]) || 0,
                        attTravauxClient: parseInt(row[11]) || 0,
                        attPv: parseInt(row[12]) || 0,
                        attDta: parseInt(row[13]) || 0,
                        attComacCafft: parseInt(row[14]) || 0,
                        attMajSi: parseInt(row[15]) || 0,
                        poiEnTravaux: parseInt(row[16]) || 0,
                        atRetourDoe: parseInt(row[17]) || 0,
                        etat5: parseInt(row[19]) || 0,
                        columnConfig: [],
                    };

                    if (mode === 'add') {
                        // In add mode, upsert: create if new, update if exists
                        await prisma.suiviEtude.upsert({
                            where: { secteur },
                            create: { secteur, ...secteurData },
                            update: secteurData,
                        });
                    } else {
                        await prisma.suiviEtude.create({
                            data: { secteur, ...secteurData },
                        });
                    }
                    secteursImported++;
                }

                // DOSSIER MAIN BE/CHAFF section
                let beChaffHeaderIdx = -1;
                for (let i = 0; i < vueRows.length; i++) {
                    const row = vueRows[i] as any[];
                    if (row && row[0] && typeof row[0] === 'string' && row[0].includes('DOSSIER MAIN')) {
                        beChaffHeaderIdx = i;
                        break;
                    }
                }
                if (beChaffHeaderIdx >= 0) {
                    for (let i = beChaffHeaderIdx + 1; i < vueRows.length; i++) {
                        const row = vueRows[i] as any[];
                        if (!row || row.length < 3) continue;
                        const be = parseInt(row[0]) || 0;
                        const chaff = parseInt(row[1]) || 0;
                        const secteur = normalizeImportedSecteurName(row[2]);
                        if (!secteur) continue;
                        try {
                            await prisma.suiviEtude.update({
                                where: { secteur },
                                data: { dossierMainBe: be, dossierMainChaff: chaff },
                            });
                        } catch { /* secteur not found */ }
                    }
                }
            }

            // ── 2. Import dossier sheets (all sheets except VUE GLOBAL) ──
            if (mode === 'replace') {
                await prisma.dossierEtude.deleteMany();
            }
            let totalDossiers = 0;

            for (const sheetName of wb.SheetNames) {
                if (sheetName === 'VUE GLOBAL') continue;

                const ws = wb.Sheets[sheetName];
                if (!ws) continue;

                const allRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
                if (allRows.length < 2) continue;

                let headerIdx = ExcelController.findHeaderRow(allRows);
                if (headerIdx < 0 && allRows.length > 1) headerIdx = 1; // fallback
                if (headerIdx < 0) headerIdx = 0;

                const headers = (allRows[headerIdx] as any[]).map((h: any) => h ? String(h).trim() : '');
                const nonEmptyHeaders = headers.filter(Boolean);

                // Ensure secteur exists in suivi_etudes
                const secteur = normalizeImportedSecteurName(sheetName);
                if (!secteur) continue;
                const existing = await prisma.suiviEtude.findUnique({ where: { secteur } });
                // Always build columnConfig from actual Excel headers
                const excelColumnConfig = nonEmptyHeaders.map((h, idx) => ({
                    key: h,
                    label: h,
                    type: h.toLowerCase().includes('date') ? 'date' : 'text',
                    required: idx === 0,
                }));
                if (!existing) {
                    await prisma.suiviEtude.create({
                        data: {
                            secteur,
                            columnConfig: excelColumnConfig,
                        },
                    });
                } else {
                    // Always update columnConfig from Excel headers to match the actual sheet
                    await prisma.suiviEtude.update({
                        where: { secteur },
                        data: {
                            columnConfig: excelColumnConfig,
                        },
                    });
                }

                let sheetImported = 0;
                for (let i = headerIdx + 1; i < allRows.length; i++) {
                    const row = allRows[i] as any[];
                    if (!row || row.every((c: any) => c === null || c === undefined || c === '')) continue;

                    const dossierData: Record<string, any> = {};
                    for (let j = 0; j < headers.length; j++) {
                        const header = headers[j];
                        if (!header) continue;
                        let value = row[j];

                        // Convert Excel date numbers first
                        const lowerHeader = header.toLowerCase();
                        if (lowerHeader.includes('date') || header === 'DRE' ||
                            lowerHeader.includes('relance') || lowerHeader.includes('création')) {
                            if (typeof value === 'number') {
                                try {
                                    const d = XLSX.SSF.parse_date_code(value);
                                    if (d) {
                                        const dd = String(d.d).padStart(2, '0');
                                        const mm = String(d.m).padStart(2, '0');
                                        value = `${dd}/${mm}/${d.y}`;
                                    }
                                } catch { /* not a date */ }
                            }
                        }

                        // If cell exists in Excel but is empty, keep as empty string
                        if (value === undefined || value === null || String(value).trim() === '') {
                            dossierData[header] = '';
                        } else {
                            dossierData[header] = String(value);
                        }
                    }

                    if (Object.keys(dossierData).length > 0) {
                        await prisma.dossierEtude.create({
                            data: { secteur, data: dossierData },
                        });
                        sheetImported++;
                    }
                }
                totalDossiers += sheetImported;

                // Recalculate counts for this sector
                await recalcSectorCounts(secteur);
            }

            res.json({
                message: `Import complet (${mode}): ${secteursImported} secteurs, ${totalDossiers} dossiers`,
                secteursImported,
                totalDossiers,
                mode,
            });
        } catch (error: any) {
            console.error('Full Excel import error:', error);
            res.status(500).json({ error: 'Failed to import full Excel file' });
        }
    }
}

export default new ExcelController();
