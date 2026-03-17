import { Router } from 'express';
import multer from 'multer';
import excelController from '../controllers/excel.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/excel/export?secteur=XXX
 * @desc    Export all dossiers for a sector as Excel
 * @access  Private
 */
router.get('/export', excelController.exportExcel.bind(excelController));

/**
 * @route   POST /api/v1/excel/import
 * @desc    Import dossiers from an uploaded Excel file
 * @access  Private
 */
router.post('/import', upload.single('file'), excelController.importExcel.bind(excelController));

/**
 * @route   GET /api/v1/excel/export-full
 * @desc    Export the full workbook (VUE GLOBAL + all sector sheets)
 * @access  Private
 */
router.get('/export-full', excelController.exportFull.bind(excelController));

/**
 * @route   POST /api/v1/excel/import-full
 * @desc    Import the full workbook (VUE GLOBAL + all sector sheets)
 * @access  Private
 */
router.post('/import-full', upload.single('file'), excelController.importFull.bind(excelController));

export default router;
