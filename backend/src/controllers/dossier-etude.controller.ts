import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Derive column config dynamically from dossier data keys.
 * Used as fallback when a sector has no stored columnConfig.
 */
async function deriveColumnConfigFromData(secteur: string): Promise<any[]> {
    const dossiers = await prisma.dossierEtude.findMany({
        where: { secteur },
        take: 5,
    });
    if (dossiers.length === 0) return [];
    const keySet = new Set<string>();
    for (const d of dossiers) {
        const data = d.data as Record<string, any>;
        for (const key of Object.keys(data)) {
            keySet.add(key);
        }
    }
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

// Mapping from lowercase ETAT values → SuiviEtude field names
const ETAT_TO_FIELD: Record<string, string> = {
    '01 vt a faire': 'vtAFaire',
    '01.2 a remonter': 'aRemonter',
    '01.3 etude cdc': 'vtAFaire',
    '02 retour vt': 'retourVt',
    '03 dossier a reprendre': 'dossAReprendre',
    '04 dossier a monter': 'dossAMonter',
    '05 at info caf ref': 'attInfosCafRef',
    '06 at devis client': 'attDevisClient',
    '07 at trvx client': 'attTravauxClient',
    '08 at comac/capft': 'attComacCafft',
    '09 at devis orange/rip': 'attDevisOrangeRip',
    '10 at pv': 'attPv',
    '11 at dta': 'attDta',
    '12 at maj si': 'attMajSi',
    '13 etat 5': 'etat5',
    '14 poi en travaux': 'poiEnTravaux',
    '14.1 at retour doe': 'atRetourDoe',
    '15 poi factu': 'recolAFaire',
    '16 dossier paye': 'recolAFaire', // maps to same field or adjust as needed
};

/**
 * Recalculate all etat-based counts for a sector from actual dossier data
 * and update the SuiviEtude row.
 */
async function recalcSectorCounts(secteur: string) {
    try {
        const dossiers = await prisma.dossierEtude.findMany({ where: { secteur } });
        const total = dossiers.length;

        // Initialize counters
        const counts: Record<string, number> = {};
        for (const field of Object.values(ETAT_TO_FIELD)) {
            counts[field] = 0;
        }

        // Find the etat column key from the sector's column config
        const sector = await prisma.suiviEtude.findUnique({ where: { secteur } });
        const colConfig = (sector?.columnConfig as any[]) || [];
        const etatCol = colConfig.find(
            (c: any) => c.key?.toLowerCase() === 'etat' || c.label?.toLowerCase() === 'etat'
        );
        const etatKey = etatCol?.key || 'ETAT';

        // Count dossiers per etat value
        for (const d of dossiers) {
            const data = d.data as Record<string, any>;
            // Try the etat key, then label, then case-insensitive match
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

        // Update the SuiviEtude row
        if (sector) {
            await prisma.suiviEtude.update({
                where: { secteur },
                data: {
                    nbDossiers: total,
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

export class DossierEtudeController {
    /**
     * GET /api/v1/dossier-etudes?secteur=MEN-ROD
     */
    async list(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const secteur = req.query.secteur as string | undefined;
            const search = req.query.search as string | undefined;
            const skip = (page - 1) * limit;

            const where: any = {};
            if (secteur) where.secteur = secteur;

            const [dossiers, total] = await Promise.all([
                prisma.dossierEtude.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'asc' },
                }),
                prisma.dossierEtude.count({ where }),
            ]);

            // Get column config for the sector
            let columnConfig: any[] = [];
            if (secteur) {
                const sector = await prisma.suiviEtude.findUnique({ where: { secteur } });
                if (sector?.columnConfig && (sector.columnConfig as any[]).length > 0) {
                    columnConfig = sector.columnConfig as any;
                } else {
                    columnConfig = await deriveColumnConfigFromData(secteur);
                }
            }

            // Filter by search across data JSON values
            let filteredDossiers = dossiers;
            if (search) {
                const searchLower = search.toLowerCase();
                filteredDossiers = dossiers.filter((d: any) => {
                    const data = d.data as Record<string, any>;
                    return Object.values(data).some(
                        (v) => v && String(v).toLowerCase().includes(searchLower)
                    );
                });
            }

            res.json({
                dossiers: filteredDossiers,
                columnConfig,
                pagination: {
                    page,
                    limit,
                    total: search ? filteredDossiers.length : total,
                    totalPages: Math.ceil((search ? filteredDossiers.length : total) / limit),
                },
            });
        } catch (error: any) {
            console.error('List dossier etudes error:', error);
            res.status(500).json({ error: 'Failed to fetch dossiers' });
        }
    }

    /**
     * POST /api/v1/dossier-etudes
     */
    async create(req: Request, res: Response): Promise<void> {
        try {
            const { secteur, data: rowData } = req.body;

            if (!secteur) {
                res.status(400).json({ error: 'Secteur is required' });
                return;
            }

            const dossier = await prisma.dossierEtude.create({
                data: {
                    secteur: secteur.trim(),
                    data: rowData || {},
                },
            });

            // Recalculate global vue counts
            await recalcSectorCounts(secteur.trim());

            res.status(201).json({ message: 'Dossier created', dossier });
        } catch (error: any) {
            console.error('Create dossier error:', error);
            res.status(500).json({ error: 'Failed to create dossier' });
        }
    }

    /**
     * PUT /api/v1/dossier-etudes/:id
     */
    async update(req: Request, res: Response): Promise<void> {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { data: rowData } = req.body;

            const existing = await prisma.dossierEtude.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ error: 'Dossier not found' });
                return;
            }

            const dossier = await prisma.dossierEtude.update({
                where: { id },
                data: { data: rowData || {} },
            });

            // Recalculate global vue counts
            await recalcSectorCounts(existing.secteur);

            res.json({ message: 'Dossier updated', dossier });
        } catch (error: any) {
            console.error('Update dossier error:', error);
            res.status(500).json({ error: 'Failed to update dossier' });
        }
    }

    /**
     * DELETE /api/v1/dossier-etudes/:id
     */
    async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

            const existing = await prisma.dossierEtude.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ error: 'Dossier not found' });
                return;
            }

            await prisma.dossierEtude.delete({ where: { id } });

            // Recalculate global vue counts
            await recalcSectorCounts(existing.secteur);

            res.json({ message: 'Dossier deleted' });
        } catch (error: any) {
            console.error('Delete dossier error:', error);
            res.status(500).json({ error: 'Failed to delete dossier' });
        }
    }
    /**
     * POST /api/v1/dossier-etudes/recalc-all
     * Recalculate all sector counts from actual dossier data
     */
    async recalcAll(_req: Request, res: Response): Promise<void> {
        try {
            const sectors = await prisma.suiviEtude.findMany();
            for (const sector of sectors) {
                await recalcSectorCounts(sector.secteur);
            }
            res.json({ message: `Recalculated counts for ${sectors.length} sectors` });
        } catch (error: any) {
            console.error('RecalcAll error:', error);
            res.status(500).json({ error: 'Failed to recalculate' });
        }
    }
}

export default new DossierEtudeController();
