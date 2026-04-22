import { Router } from 'express';
import dossierEtudeController from '../controllers/dossier-etude.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', dossierEtudeController.list.bind(dossierEtudeController));
router.post('/recalc-all', dossierEtudeController.recalcAll.bind(dossierEtudeController));
router.post('/recalc-sector', dossierEtudeController.recalcSector.bind(dossierEtudeController));
router.post('/', dossierEtudeController.create.bind(dossierEtudeController));
router.put('/:id', dossierEtudeController.update.bind(dossierEtudeController));
router.delete('/:id', dossierEtudeController.delete.bind(dossierEtudeController));

export default router;
