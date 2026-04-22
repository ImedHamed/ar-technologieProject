import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage, LanguageToggle } from '../../i18n/i18n';
import { ThemeToggle } from '../../theme/ThemeContext';
import suiviEtudeService from '../../services/suivi-etude.service';
import type { SuiviEtudeRow, SuiviEtudeTotals } from '../../services/suivi-etude.service';
import ImportModeDialog from '../../components/ImportModeDialog';
import type { ImportMode } from '../../components/ImportModeDialog';
import dossierEtudeService, { type DossierEtude } from '../../services/dossier-etude.service';
import './AdminDashboardPage.css';

const GLOBAL_DOSSIER_SEARCH_LIMIT = 500;

function dossierDataPreview(data: Record<string, unknown> | undefined, maxLen = 160): string {
    if (!data || typeof data !== 'object') return '—';
    const parts: string[] = [];
    for (const [k, v] of Object.entries(data)) {
        if (v == null || v === '') continue;
        const s = String(v).replace(/\s+/g, ' ').trim();
        if (!s) continue;
        const chunk = s.length > 48 ? `${k}: ${s.slice(0, 45)}…` : `${k}: ${s}`;
        parts.push(chunk);
        if (parts.join(' · ').length >= maxLen) break;
    }
    const out = parts.join(' · ');
    return out.length > maxLen ? `${out.slice(0, maxLen - 1)}…` : (out || '—');
}

// All numeric fields for the form
const NUMERIC_FIELDS: { key: keyof SuiviEtudeRow; label: string }[] = [
    { key: 'nbDossiers', label: 'NB DE DOSSIERS' },
    { key: 'dreKo', label: 'DRE KO' },
    { key: 'vtAFaire', label: 'VT A FAIRE' },
    { key: 'aRemonter', label: 'A REMONTER' },
    { key: 'retourVt', label: 'RETOUR VT' },
    { key: 'dossAReprendre', label: 'DOSS A REPRENDRE' },
    { key: 'dossAMonter', label: 'DOSS A MONTER' },
    { key: 'attInfosCafRef', label: 'ATT INFOS CAF REF' },
    { key: 'attDevisOrangeRip', label: 'ATT DEVIS ORANGE/RIP' },
    { key: 'attDevisClient', label: 'ATT DEVIS CLIENT' },
    { key: 'attTravauxClient', label: 'ATT TRAVAUX CLIENT' },
    { key: 'attPv', label: 'ATT PV' },
    { key: 'attDta', label: 'ATT DTA' },
    { key: 'attComacCafft', label: 'ATT COMAC/CAFFT' },
    { key: 'attMajSi', label: 'ATT MAJ SI' },
    { key: 'poiEnTravaux', label: 'POI EN TRAVAUX' },
    { key: 'atRetourDoe', label: 'AT RETOUR DOE' },
    { key: 'recolAFaire', label: 'RECOL A FAIRE' },
    { key: 'etat5', label: 'ETAT 5' },
];

// Table column headers (for the main table) — ACTIONS column added dynamically
const BASE_COLUMNS = [
    'SECTEUR',
    ...NUMERIC_FIELDS.map((f) => f.label),
];

// Default form data
const defaultFormData: Record<string, string | number> = {
    secteur: '',
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

const AdminDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAdmin, canEdit, allowedSecteurs, logout, user } = useAuth();
    const { t } = useLanguage();
    const [rows, setRows] = useState<SuiviEtudeRow[]>([]);
    const [totals, setTotals] = useState<SuiviEtudeTotals | null>(null);
    const [tauxNonConformite, setTauxNonConformite] = useState('0');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRow, setEditingRow] = useState<SuiviEtudeRow | null>(null);
    const [formData, setFormData] = useState<Record<string, string | number>>(defaultFormData);
    const [submitting, setSubmitting] = useState(false);

    // Full Excel import/export
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const importFileRef = useRef<HTMLInputElement>(null);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

    const [globalSearch, setGlobalSearch] = useState('');
    const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState('');
    const [globalSearchHits, setGlobalSearchHits] = useState<DossierEtude[]>([]);
    const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
    const [openingDreKoSecteur, setOpeningDreKoSecteur] = useState<string | null>(null);

    const handleExportFull = async () => {
        setExporting(true);
        try {
            await suiviEtudeService.exportFull();
        } catch {
            alert('Échec de l\'export Excel');
        } finally {
            setExporting(false);
        }
    };

    // Step 1: User picks a file → show the import mode dialog
    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingImportFile(file);
        setShowImportDialog(true);
    };

    // Step 2: User confirms mode → run the import
    const handleImportConfirm = async (mode: ImportMode) => {
        setShowImportDialog(false);
        if (!pendingImportFile) return;
        setImporting(true);
        try {
            const result = await suiviEtudeService.importFull(pendingImportFile, mode);
            alert(`✅ Import terminé (${mode === 'add' ? 'ajout' : 'remplacement'}): ${result.secteursImported} secteurs, ${result.totalDossiers} dossiers`);
            fetchData();
        } catch {
            alert('Échec de l\'import Excel');
        } finally {
            setImporting(false);
            setPendingImportFile(null);
            if (importFileRef.current) importFileRef.current.value = '';
        }
    };

    const handleImportCancel = () => {
        setShowImportDialog(false);
        setPendingImportFile(null);
        if (importFileRef.current) importFileRef.current.value = '';
    };

    // Filter rows by allowed secteurs
    const filteredRows = useMemo(
        () =>
            allowedSecteurs.length > 0 ? rows.filter((r) => allowedSecteurs.includes(r.secteur)) : rows,
        [rows, allowedSecteurs],
    );

    const globalSearchMoreThanLimit =
        debouncedGlobalSearch && globalSearchHits.length >= GLOBAL_DOSSIER_SEARCH_LIMIT;

    const TABLE_COLUMNS = canEdit ? [...BASE_COLUMNS, 'ACTIONS'] : BASE_COLUMNS;

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await suiviEtudeService.getAll();
            setRows(data.rows);
            setTotals(data.totals);
            setTauxNonConformite(data.tauxNonConformite);
        } catch (error) {
            console.error('Failed to fetch suivi etudes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedGlobalSearch(globalSearch.trim()), 400);
        return () => window.clearTimeout(t);
    }, [globalSearch]);

    useEffect(() => {
        if (!debouncedGlobalSearch) {
            setGlobalSearchHits([]);
            setGlobalSearchLoading(false);
            return;
        }
        let cancelled = false;
        setGlobalSearchLoading(true);
        dossierEtudeService
            .getAll({
                search: debouncedGlobalSearch,
                page: 1,
                limit: GLOBAL_DOSSIER_SEARCH_LIMIT,
            })
            .then((data) => {
                if (!cancelled) setGlobalSearchHits(data.dossiers);
            })
            .catch(() => {
                if (!cancelled) setGlobalSearchHits([]);
            })
            .finally(() => {
                if (!cancelled) setGlobalSearchLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [debouncedGlobalSearch]);

    const handleAdd = () => {
        setEditingRow(null);
        setFormData({ ...defaultFormData });
        setShowModal(true);
    };

    const handleEdit = (row: SuiviEtudeRow) => {
        setEditingRow(row);
        const data: Record<string, string | number> = { secteur: row.secteur };
        for (const field of NUMERIC_FIELDS) {
            data[field.key] = row[field.key] as number;
        }
        data.dossierMainBe = row.dossierMainBe;
        data.dossierMainChaff = row.dossierMainChaff;
        setFormData(data);
        setShowModal(true);
    };

    const handleDelete = async (row: SuiviEtudeRow) => {
        if (!window.confirm(`${t('dashboard.delete_confirm')} "${row.secteur}" ?`)) return;
        try {
            await suiviEtudeService.delete(row.id);
            fetchData();
        } catch (error) {
            alert('Échec de la suppression');
        }
    };

    const handleOpenDreKo = async (row: SuiviEtudeRow) => {
        let dreKoToShow = Number(row.dreKo ?? 0);
        setOpeningDreKoSecteur(row.secteur);
        try {
            const recalc = await dossierEtudeService.recalcSector(row.secteur);
            if (recalc.row) {
                const updated = recalc.row as SuiviEtudeRow;
                dreKoToShow = Number(updated.dreKo ?? dreKoToShow);
                setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            }
            const fresh = await suiviEtudeService.getAll();
            setRows(fresh.rows);
            setTotals(fresh.totals);
            setTauxNonConformite(fresh.tauxNonConformite);
            const latest = fresh.rows.find((r) => r.secteur === row.secteur);
            if (latest) dreKoToShow = Number(latest.dreKo ?? dreKoToShow);
        } catch (error) {
            console.error('Failed to recalc sector before DRE KO navigation:', error);
        } finally {
            setOpeningDreKoSecteur(null);
            navigate(
                `/admin/secteur/${encodeURIComponent(row.secteur)}?metric=dreKo&vueDreKo=${encodeURIComponent(String(dreKoToShow))}`,
            );
        }
    };

    const handleFormChange = (field: string, value: string) => {
        setFormData((prev) => ({
            ...prev,
            [field]: field === 'secteur' ? value : parseInt(value) || 0,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.secteur || !(formData.secteur as string).trim()) {
            alert('Le nom du secteur est obligatoire');
            return;
        }

        setSubmitting(true);
        try {
            if (editingRow) {
                await suiviEtudeService.update(editingRow.id, formData as any);
            } else {
                await suiviEtudeService.create(formData as any);
            }
            setShowModal(false);
            fetchData();
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Échec de la sauvegarde';
            alert(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const getCellClass = (value: number, fieldKey: string): string => {
        if (value === 0) return 'cell-value zero';
        if (fieldKey === 'dreKo' || fieldKey === 'dossAReprendre') return 'cell-value danger';
        if (fieldKey === 'retourVt' || fieldKey === 'aRemonter') return 'cell-value warning';
        return 'cell-value positive';
    };

    if (loading) {
        return <div className="loading-dashboard">{t('dashboard.loading')}</div>;
    }

    return (
        <div className="admin-dashboard">
            {/* Header */}
            <div className="admin-dashboard-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span className="back-link" onClick={() => navigate('/admin/choose-section')} style={{ cursor: 'pointer', color: '#fb8c00', fontSize: '0.8rem', fontWeight: 700 }}>
                        ← Retour
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src="/logo.png" alt="Logo" style={{ height: '45px', objectFit: 'contain' }} />
                        <h1>{t('dashboard.title')}</h1>
                    </div>
                </div>
                <div className="header-actions">
                    <ThemeToggle />
                    <LanguageToggle />
                    <button className="btn-export-excel" onClick={handleExportFull} disabled={exporting}>
                        {exporting ? '⏳...' : '📥 Exporter Excel'}
                    </button>
                    <button className="btn-import-excel" onClick={() => importFileRef.current?.click()} disabled={importing}>
                        {importing ? '⏳ Import...' : '📤 Importer Excel'}
                    </button>
                    <input
                        type="file"
                        ref={importFileRef}
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                        onChange={handleFileSelected}
                    />
                    {isAdmin && (
                        <button className="btn-add" onClick={() => navigate('/admin/users')}>
                            {t('dashboard.user_mgmt')}
                        </button>
                    )}
                    {canEdit && (
                        <button className="btn-add" onClick={handleAdd}>
                            {t('dashboard.add_sector')}
                        </button>
                    )}
                    <button className="btn-add" onClick={logout}>
                        {t('common.logout')}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {totals && (
                <div className="stats-row">
                    <div className="stat-highlight total">
                        <span className="stat-label">{t('dashboard.total_dossiers')}</span>
                        <span className="stat-number">{totals.nbDossiers}</span>
                    </div>
                    <div className="stat-highlight taux">
                        <span className="stat-label">{t('dashboard.taux_nc')}</span>
                        <span className="stat-number">{tauxNonConformite}%</span>
                    </div>
                    <div className="stat-highlight dossier-be">
                        <span className="stat-label">{t('dashboard.dossier_be')}</span>
                        <span className="stat-number">{totals.dossierMainBe}</span>
                    </div>
                    <div className="stat-highlight dossier-chaff">
                        <span className="stat-label">{t('dashboard.dossier_chaff')}</span>
                        <span className="stat-number">{totals.dossierMainChaff}</span>
                    </div>
                </div>
            )}

            {/* Main VUE GLOBAL Table */}
            <div className="vue-global-section">
                <h2>{t('dashboard.vue_globale')}</h2>
                <div className="vue-global-search-row">
                    <input
                        type="search"
                        className="dashboard-global-search-input"
                        placeholder={t('dashboard.search_all_dossiers')}
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        aria-label={t('dashboard.search_all_dossiers')}
                    />
                </div>
                {debouncedGlobalSearch && (
                    <div className="global-dossier-search-panel">
                        <h3 className="global-dossier-search-title">
                            {t('dashboard.search_results_title')}
                            {globalSearchLoading ? ` — ${t('common.loading')}` : ` (${globalSearchHits.length})`}
                        </h3>
                        {!globalSearchLoading && globalSearchHits.length === 0 && (
                            <p className="global-dossier-search-empty">{t('dashboard.search_no_hits')}</p>
                        )}
                        {!globalSearchLoading && globalSearchHits.length > 0 && (
                            <>
                                <div className="excel-table-wrapper global-dossier-search-wrapper">
                                    <table className="excel-table global-dossier-search-table">
                                        <thead>
                                            <tr>
                                                <th>{t('dashboard.search_col_sector')}</th>
                                                <th>{t('dashboard.search_col_preview')}</th>
                                                <th>{t('dashboard.search_col_open')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {globalSearchHits.map((d) => (
                                                <tr key={d.id}>
                                                    <td className="global-search-sector">{d.secteur}</td>
                                                    <td className="global-search-preview">
                                                        {dossierDataPreview(d.data as Record<string, unknown>)}
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="btn-open-sector"
                                                            onClick={() =>
                                                                navigate(`/admin/secteur/${encodeURIComponent(d.secteur)}`)
                                                            }
                                                        >
                                                            {t('dashboard.search_open_sector')}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {globalSearchMoreThanLimit && (
                                    <p className="global-dossier-search-cap">{t('dashboard.search_cap_hint')}</p>
                                )}
                            </>
                        )}
                    </div>
                )}
                <div className="excel-table-wrapper">
                    <table className="excel-table" id="vue-global-table">
                        <thead>
                            <tr>
                                {TABLE_COLUMNS.map((col) => (
                                    <th key={col}>{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={TABLE_COLUMNS.length} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                        {t('dashboard.no_sectors')}
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {filteredRows.map((row) => (
                                        <tr key={row.id}>
                                            <td>
                                                <a
                                                    href="#"
                                                    onClick={(e) => { e.preventDefault(); navigate(`/admin/secteur/${encodeURIComponent(row.secteur)}`); }}
                                                    className="dashboard-sector-link"
                                                >
                                                    {row.secteur}
                                                </a>
                                            </td>
                                            {NUMERIC_FIELDS.map((field) => (
                                                <td key={field.key}>
                                                    {field.key === 'dreKo' ? (
                                                        <button
                                                            type="button"
                                                            className={`${getCellClass(row[field.key] as number, field.key)} dre-ko-cell-btn`}
                                                            onClick={() => handleOpenDreKo(row)}
                                                            disabled={openingDreKoSecteur === row.secteur}
                                                            title={t('dashboard.dre_ko_nav_hint')}
                                                        >
                                                            {openingDreKoSecteur === row.secteur ? '…' : row[field.key]}
                                                        </button>
                                                    ) : (
                                                        <span className={getCellClass(row[field.key] as number, field.key)}>
                                                            {row[field.key]}
                                                        </span>
                                                    )}
                                                </td>
                                            ))}
                                            {canEdit && (
                                                <td>
                                                    <div className="row-actions">
                                                        <button className="btn-row-action btn-row-edit" onClick={() => handleEdit(row)}>
                                                            ✏️
                                                        </button>
                                                        <button className="btn-row-action btn-row-delete" onClick={() => handleDelete(row)}>
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {/* GLOBAL Totals Row */}
                                    {totals && (
                                        <tr className="totals-row">
                                            <td>{t('dashboard.global')}</td>
                                            {NUMERIC_FIELDS.map((field) => (
                                                <td key={field.key}>
                                                    <span className="cell-value">
                                                        {totals[field.key as keyof SuiviEtudeTotals]}
                                                    </span>
                                                </td>
                                            ))}
                                            <td></td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* DOSSIER MAIN Breakdown Table */}
            {rows.length > 0 && (
                <div className="dossier-main-section">
                    <h2>{t('dashboard.dossier_repartition')}</h2>
                    <div className="dossier-table-wrapper">
                        <table className="dossier-table">
                            <thead>
                                <tr>
                                    <th>DOSSIER MAIN BE</th>
                                    <th>DOSSIER MAIN CHAFF</th>
                                    <th>SECTEUR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id}>
                                        <td>{row.dossierMainBe}</td>
                                        <td>{row.dossierMainChaff}</td>
                                        <td>{row.secteur}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {totals && (
                                <tfoot>
                                    <tr>
                                        <td>{totals.dossierMainBe}</td>
                                        <td>{totals.dossierMainChaff}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="se-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="se-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>{editingRow ? `${t('dashboard.modify_sector')} — ${editingRow.secteur}` : t('dashboard.add_sector_modal')}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="se-form-grid">
                                {/* Secteur Name */}
                                <div className="se-form-group full-width">
                                    <label htmlFor="secteur">{t('dashboard.sector_name')}</label>
                                    <input
                                        type="text"
                                        id="secteur"
                                        value={formData.secteur}
                                        onChange={(e) => handleFormChange('secteur', e.target.value)}
                                        placeholder="Ex: MEN-ROD, GDP AQ..."
                                        required
                                    />
                                </div>

                                {/* Numeric Fields */}
                                {NUMERIC_FIELDS.map((field) => (
                                    <div className="se-form-group" key={field.key}>
                                        <label htmlFor={field.key}>{field.label}</label>
                                        <input
                                            type="number"
                                            id={field.key}
                                            min="0"
                                            value={formData[field.key] || 0}
                                            onChange={(e) => handleFormChange(field.key, e.target.value)}
                                        />
                                    </div>
                                ))}

                                {/* Dossier Main fields */}
                                <div className="se-form-group">
                                    <label htmlFor="dossierMainBe">DOSSIER MAIN BE</label>
                                    <input
                                        type="number"
                                        id="dossierMainBe"
                                        min="0"
                                        value={formData.dossierMainBe || 0}
                                        onChange={(e) => handleFormChange('dossierMainBe', e.target.value)}
                                    />
                                </div>
                                <div className="se-form-group">
                                    <label htmlFor="dossierMainChaff">DOSSIER MAIN CHAFF</label>
                                    <input
                                        type="number"
                                        id="dossierMainChaff"
                                        min="0"
                                        value={formData.dossierMainChaff || 0}
                                        onChange={(e) => handleFormChange('dossierMainChaff', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="se-modal-actions">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setShowModal(false)}
                                    disabled={submitting}
                                >
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="btn-save" disabled={submitting}>
                                    {submitting ? t('common.saving') : editingRow ? t('dashboard.update') : t('common.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import Mode Dialog */}
            <ImportModeDialog
                open={showImportDialog}
                scope="VUE GLOBAL"
                onConfirm={handleImportConfirm}
                onCancel={handleImportCancel}
            />
        </div>
    );
};

export default AdminDashboardPage;
