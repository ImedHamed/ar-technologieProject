import { Request, Response } from 'express';
import prisma from '../config/database';



export class SuiviEtudeController {
    /**
     * GET /api/v1/suivi-etudes
     * Get all sector rows + computed global totals
     */
    async list(_req: Request, res: Response): Promise<void> {
        try {
            const rows = await prisma.suiviEtude.findMany({
                orderBy: { secteur: 'asc' },
            });

            // Compute global totals
            const totals = {
                nbDossiers: 0,
                dreKo: 0,
                vtAFaire: 0,
                aRemonter: 0,
                retourVt: 0,
                dossAReprendre: 0,
                dossAMonter: 0,
                attInfosCafRef: 0,
                attDevisOrangeRip: 0,
                attDevisClient: 0,
                attTravauxClient: 0,
                attPv: 0,
                attDta: 0,
                attComacCafft: 0,
                attMajSi: 0,
                poiEnTravaux: 0,
                atRetourDoe: 0,
                recolAFaire: 0,
                etat5: 0,
                dossierMainBe: 0,
                dossierMainChaff: 0,
            };

            for (const row of rows) {
                totals.nbDossiers += row.nbDossiers;
                totals.dreKo += row.dreKo;
                totals.vtAFaire += row.vtAFaire;
                totals.aRemonter += row.aRemonter;
                totals.retourVt += row.retourVt;
                totals.dossAReprendre += row.dossAReprendre;
                totals.dossAMonter += row.dossAMonter;
                totals.attInfosCafRef += row.attInfosCafRef;
                totals.attDevisOrangeRip += row.attDevisOrangeRip;
                totals.attDevisClient += row.attDevisClient;
                totals.attTravauxClient += row.attTravauxClient;
                totals.attPv += row.attPv;
                totals.attDta += row.attDta;
                totals.attComacCafft += row.attComacCafft;
                totals.attMajSi += row.attMajSi;
                totals.poiEnTravaux += row.poiEnTravaux;
                totals.atRetourDoe += row.atRetourDoe;
                totals.recolAFaire += row.recolAFaire;
                totals.etat5 += row.etat5;
                totals.dossierMainBe += row.dossierMainBe;
                totals.dossierMainChaff += row.dossierMainChaff;
            }

            // Taux Non Conformité = dreKo / nbDossiers (if > 0)
            const tauxNonConformite =
                totals.nbDossiers > 0
                    ? ((totals.dreKo / totals.nbDossiers) * 100).toFixed(1)
                    : '0';

            res.json({
                rows,
                totals,
                tauxNonConformite,
            });
        } catch (error: any) {
            console.error('List suivi etudes error:', error);
            res.status(500).json({ error: 'Failed to fetch suivi etudes' });
        }
    }

    /**
     * POST /api/v1/suivi-etudes
     * Create a new sector row
     */
    async create(req: Request, res: Response): Promise<void> {
        try {
            const data = req.body;

            if (!data.secteur || !data.secteur.trim()) {
                res.status(400).json({ error: 'Secteur is required' });
                return;
            }

            // Check uniqueness
            const existing = await prisma.suiviEtude.findUnique({
                where: { secteur: data.secteur.trim() },
            });
            if (existing) {
                res.status(409).json({ error: 'Secteur already exists' });
                return;
            }

            const row = await prisma.suiviEtude.create({
                data: {
                    secteur: data.secteur.trim(),
                    nbDossiers: data.nbDossiers || 0,
                    dreKo: data.dreKo || 0,
                    vtAFaire: data.vtAFaire || 0,
                    aRemonter: data.aRemonter || 0,
                    retourVt: data.retourVt || 0,
                    dossAReprendre: data.dossAReprendre || 0,
                    dossAMonter: data.dossAMonter || 0,
                    attInfosCafRef: data.attInfosCafRef || 0,
                    attDevisOrangeRip: data.attDevisOrangeRip || 0,
                    attDevisClient: data.attDevisClient || 0,
                    attTravauxClient: data.attTravauxClient || 0,
                    attPv: data.attPv || 0,
                    attDta: data.attDta || 0,
                    attComacCafft: data.attComacCafft || 0,
                    attMajSi: data.attMajSi || 0,
                    poiEnTravaux: data.poiEnTravaux || 0,
                    atRetourDoe: data.atRetourDoe || 0,
                    recolAFaire: data.recolAFaire || 0,
                    etat5: data.etat5 || 0,
                    dossierMainBe: data.dossierMainBe || 0,
                    dossierMainChaff: data.dossierMainChaff || 0,
                    columnConfig: [],
                },
            });

            res.status(201).json({ message: 'Sector row created', row });
        } catch (error: any) {
            console.error('Create suivi etude error:', error);
            res.status(500).json({ error: 'Failed to create sector row' });
        }
    }

    /**
     * PUT /api/v1/suivi-etudes/:id
     * Update a sector row
     */
    async update(req: Request, res: Response): Promise<void> {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const data = req.body;

            const existing = await prisma.suiviEtude.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ error: 'Sector row not found' });
                return;
            }

            // Build update data - only include fields that are provided
            const updateData: any = {};
            const numericFields = [
                'nbDossiers', 'dreKo', 'vtAFaire', 'aRemonter', 'retourVt',
                'dossAReprendre', 'dossAMonter', 'attInfosCafRef', 'attDevisOrangeRip',
                'attDevisClient', 'attTravauxClient', 'attPv', 'attDta', 'attComacCafft',
                'attMajSi', 'poiEnTravaux', 'atRetourDoe', 'recolAFaire', 'etat5',
                'dossierMainBe', 'dossierMainChaff',
            ];

            if (data.secteur !== undefined) {
                updateData.secteur = data.secteur.trim();
            }

            for (const field of numericFields) {
                if (data[field] !== undefined) {
                    updateData[field] = parseInt(data[field]) || 0;
                }
            }

            const row = await prisma.suiviEtude.update({
                where: { id },
                data: updateData,
            });

            res.json({ message: 'Sector row updated', row });
        } catch (error: any) {
            console.error('Update suivi etude error:', error);
            res.status(500).json({ error: 'Failed to update sector row' });
        }
    }

    /**
     * DELETE /api/v1/suivi-etudes/:id
     * Delete a sector row
     */
    async delete(req: Request, res: Response): Promise<void> {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

            const existing = await prisma.suiviEtude.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ error: 'Sector row not found' });
                return;
            }

            await prisma.suiviEtude.delete({ where: { id } });

            res.json({ message: 'Sector row deleted' });
        } catch (error: any) {
            console.error('Delete suivi etude error:', error);
            res.status(500).json({ error: 'Failed to delete sector row' });
        }
    }

    /**
     * PUT /api/v1/suivi-etudes/:id/columns
     * Update column configuration for a sector
     */
    async updateColumns(req: Request, res: Response): Promise<void> {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { columnConfig } = req.body;

            if (!columnConfig || !Array.isArray(columnConfig)) {
                res.status(400).json({ error: 'columnConfig must be an array' });
                return;
            }

            const existing = await prisma.suiviEtude.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ error: 'Sector not found' });
                return;
            }

            const row = await prisma.suiviEtude.update({
                where: { id },
                data: { columnConfig },
            });

            res.json({ message: 'Column config updated', row });
        } catch (error: any) {
            console.error('Update columns error:', error);
            res.status(500).json({ error: 'Failed to update columns' });
        }
    }
}

export default new SuiviEtudeController();
