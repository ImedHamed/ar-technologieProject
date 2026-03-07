import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import dossierEtudeService from '../../services/dossier-etude.service';
import suiviEtudeService from '../../services/suivi-etude.service';
import type { DossierEtude, ColumnConfig } from '../../services/dossier-etude.service';
import './SecteurDetailPage.css';

// 🔗 POI SharePoint link — Replace with your SharePoint base URL
// The POI value will be appended to this URL
const POI_BASE_URL = 'https://your-sharepoint-site.sharepoint.com/sites/poi/';

function isPoiColumn(col: ColumnConfig): boolean {
    return col.key === 'POI' || col.label.toUpperCase() === 'POI';
}

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    try {
        // If already in DD/MM/YYYY format, return as-is
        const frMatch = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (frMatch) return dateStr as string;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr);
        return d.toLocaleDateString('fr-FR');
    } catch {
        return String(dateStr) || '-';
    }
}

function toInputDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    try {
        // Handle DD/MM/YYYY format
        const frMatch = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (frMatch) {
            const [, day, month, year] = frMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    } catch {
        return '';
    }
}

// Resolve data value: try col.key first, then col.label, then case-insensitive label match
function getDataValue(data: Record<string, any>, col: ColumnConfig): any {
    if (data[col.key] !== undefined) return data[col.key];
    if (data[col.label] !== undefined) return data[col.label];
    // Case-insensitive label match
    const labelLower = col.label.toLowerCase();
    for (const key of Object.keys(data)) {
        if (key.toLowerCase() === labelLower) return data[key];
    }
    return undefined;
}

function getCellValue(data: Record<string, any>, col: ColumnConfig): string {
    const val = getDataValue(data, col);
    if (val === null || val === undefined || val === '') return '-';
    if (col.type === 'date') return formatDate(val);
    if (typeof val === 'string' && val.length > 35) return val.substring(0, 35) + '...';
    return String(val);
}

// ETAT dropdown options — exact values from Excel conditional formatting
const ETAT_OPTIONS = [
    '01 VT A FAIRE',
    '01.2 A REMONTER',
    '02 RETOUR VT',
    '03 DOSSIER A REPRENDRE',
    '04 DOSSIER A MONTER',
    '05 AT INFO CAF REF',
    '06 AT DEVIS CLIENT',
    '07 AT TRVX CLIENT',
    '08 AT COMAC/CAPFT',
    '09 AT DEVIS ORANGE/RIP',
    '10 AT PV',
    '11 AT DTA',
    '12 AT MAJ SI',
    '13 ETAT 5',
    '14 POI EN TRAVAUX',
    '14.1 AT RETOUR DOE',
    '15 POI FACTU',
    '16 DOSSIER PAYE',
];

function isEtatColumn(col: ColumnConfig): boolean {
    return col.key === 'etat' || col.label.toLowerCase() === 'etat';
}

// ETAT color map — exact hex colors from Excel conditional formatting rules
const ETAT_COLORS: Record<string, { bg: string; color: string }> = {
    '01 vt a faire': { bg: '#92D050', color: '#000' },
    '01.2 a remonter': { bg: '#FFC000', color: '#000' },
    '02 retour vt': { bg: '#7030A0', color: '#fff' },
    '03 dossier a reprendre': { bg: '#FF6600', color: '#fff' },
    '04 dossier a monter': { bg: '#FF0000', color: '#fff' },
    '05 at info caf ref': { bg: '#BDD7EE', color: '#000' },
    '06 at devis client': { bg: '#00B0F0', color: '#000' },
    '07 at trvx client': { bg: '#D9E2F3', color: '#000' },
    '08 at comac/capft': { bg: '#E2EFDA', color: '#000' },
    '09 at devis orange/rip': { bg: '#FFC000', color: '#000' },
    '10 at pv': { bg: '#F4B084', color: '#000' },
    '11 at dta': { bg: '#D6DCE4', color: '#000' },
    '12 at maj si': { bg: '#B4C6E7', color: '#000' },
    '13 etat 5': { bg: '#00B050', color: '#fff' },
    '14 poi en travaux': { bg: '#FFFF00', color: '#000' },
    '14.1 at retour doe': { bg: '#9DC3E6', color: '#0070C0' },
    '15 poi factu': { bg: '#A9D18E', color: '#000' },
    '16 dossier paye': { bg: '#FCA7A7', color: '#000' },
};

function findEtatColor(data: Record<string, any>, columns: ColumnConfig[]): { bg: string; color: string } | null {
    const etatCol = columns.find(c => isEtatColumn(c));
    if (!etatCol) return null;
    const val = getDataValue(data, etatCol);
    if (!val) return null;
    const lower = String(val).toLowerCase().trim();
    if (ETAT_COLORS[lower]) return ETAT_COLORS[lower];
    for (const [key, style] of Object.entries(ETAT_COLORS)) {
        if (lower.includes(key)) return style;
    }
    return null;
}

// Cell style: ETAT gets badge, DATE gets ETAT background color
function getCellStyle(col: ColumnConfig, _val: any, data: Record<string, any>, columns: ColumnConfig[]): React.CSSProperties {
    const resolvedVal = getDataValue(data, col);
    if (resolvedVal === null || resolvedVal === undefined || resolvedVal === '' || resolvedVal === '-') {
        return { color: '#9e9e9e' };
    }
    // ETAT column — colored badge
    if (isEtatColumn(col) && resolvedVal) {
        const lower = String(resolvedVal).toLowerCase().trim();
        const match = ETAT_COLORS[lower] || Object.values(ETAT_COLORS).find((_, i) =>
            lower.includes(Object.keys(ETAT_COLORS)[i])
        );
        if (match) {
            return { background: match.bg, color: match.color, padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.72rem', display: 'inline-block' };
        }
        return {};
    }
    // DATE columns — colored with ETAT background
    if (col.type === 'date') {
        const etatColor = findEtatColor(data, columns);
        if (etatColor) {
            return { background: etatColor.bg, color: etatColor.color, padding: '2px 6px', borderRadius: '3px', fontWeight: 700, display: 'inline-block' };
        }
        return { color: '#0d47a1', fontWeight: 700 };
    }
    return {};
}

const SecteurDetailPage: React.FC = () => {
    const { secteur } = useParams<{ secteur: string }>();
    const navigate = useNavigate();
    const { canEdit, allowedSecteurs } = useAuth();
    const sectorName = secteur ? decodeURIComponent(secteur) : '';

    // Block access if secteur is not in allowedSecteurs
    if (allowedSecteurs.length > 0 && !allowedSecteurs.includes(sectorName)) {
        return (
            <div className="secteur-detail-page">
                <div className="secteur-detail-header">
                    <div className="header-left">
                        <span className="back-link" onClick={() => navigate('/admin/dashboard')}>← Retour au Tableau de Bord</span>
                        <h1>🚫 Accès Refusé</h1>
                        <p className="subtitle">Vous n'avez pas accès au secteur "{sectorName}".</p>
                    </div>
                </div>
            </div>
        );
    }

    const [dossiers, setDossiers] = useState<DossierEtude[]>([]);
    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [sectorId, setSectorId] = useState<string | null>(null);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Dossier CRUD modal
    const [showDossierModal, setShowDossierModal] = useState(false);
    const [editingDossier, setEditingDossier] = useState<DossierEtude | null>(null);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    // Column management modal
    const [showColumnModal, setShowColumnModal] = useState(false);
    const [editColumns, setEditColumns] = useState<ColumnConfig[]>([]);
    const [savingColumns, setSavingColumns] = useState(false);

    // Sorting
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const handleSort = (col: ColumnConfig) => {
        const key = col.key;
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    // Parse DD/MM/YYYY to sortable timestamp
    const parseDateValue = (val: any): number => {
        if (!val) return 0;
        const str = String(val);
        const frMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (frMatch) {
            const [, d, m, y] = frMatch;
            return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const sortedDossiers = React.useMemo(() => {
        if (!sortKey) return dossiers;
        const col = columns.find(c => c.key === sortKey);
        if (!col) return dossiers;
        return [...dossiers].sort((a, b) => {
            const valA = getDataValue(a.data, col);
            const valB = getDataValue(b.data, col);
            let cmp = 0;
            if (col.type === 'date') {
                cmp = parseDateValue(valA) - parseDateValue(valB);
            } else if (col.type === 'number') {
                cmp = (Number(valA) || 0) - (Number(valB) || 0);
            } else {
                cmp = String(valA || '').localeCompare(String(valB || ''), 'fr');
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [dossiers, sortKey, sortDir, columns]);

    // Fetch sector info to get the sector ID
    const fetchSectorId = useCallback(async () => {
        try {
            const data = await suiviEtudeService.getAll();
            const sector = data.rows.find((r) => r.secteur === sectorName);
            if (sector) {
                setSectorId(sector.id);
            }
        } catch (error) {
            console.error('Failed to fetch sector:', error);
        }
    }, [sectorName]);

    const fetchData = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const data = await dossierEtudeService.getAll({
                secteur: sectorName,
                page,
                limit: 50,
                search: search || undefined,
            });
            setDossiers(data.dossiers);
            setColumns(data.columnConfig);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Failed to fetch dossiers:', error);
        } finally {
            setLoading(false);
        }
    }, [sectorName, search]);

    useEffect(() => {
        fetchSectorId();
        fetchData();
    }, [fetchSectorId, fetchData]);

    // ─── Dossier CRUD ─────────────────────────────────────────

    const handleAdd = () => {
        setEditingDossier(null);
        const empty: Record<string, string> = {};
        columns.forEach((c) => (empty[c.key] = ''));
        setFormData(empty);
        setShowDossierModal(true);
    };

    const handleEdit = (dossier: DossierEtude) => {
        setEditingDossier(dossier);
        const data: Record<string, string> = {};
        columns.forEach((c) => {
            const val = getDataValue(dossier.data, c);
            if (c.type === 'date') {
                data[c.key] = toInputDate(val);
            } else {
                data[c.key] = val ?? '';
            }
        });
        setFormData(data);
        setShowDossierModal(true);
    };

    const handleDelete = async (dossier: DossierEtude) => {
        const codeLabel = dossier.data.codeOeie || dossier.id.substring(0, 8);
        if (!window.confirm(`Supprimer le dossier "${codeLabel}" ?`)) return;
        try {
            await dossierEtudeService.delete(dossier.id);
            fetchData(pagination.page);
        } catch {
            alert('Échec de la suppression');
        }
    };

    const handleFormChange = (key: string, value: string) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Validate required
        const missing = columns.filter((c) => c.required && !formData[c.key]?.trim());
        if (missing.length > 0) {
            alert(`Champs obligatoires: ${missing.map((c) => c.label).join(', ')}`);
            return;
        }
        setSubmitting(true);
        try {
            if (editingDossier) {
                await dossierEtudeService.update(editingDossier.id, formData);
            } else {
                await dossierEtudeService.create(sectorName, formData);
            }
            setShowDossierModal(false);
            fetchData(pagination.page);
        } catch (error: any) {
            alert(error.response?.data?.error || 'Échec de la sauvegarde');
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Column Management ────────────────────────────────────

    const openColumnManager = () => {
        setEditColumns(columns.map((c) => ({ ...c })));
        setShowColumnModal(true);
    };

    const handleColumnLabelChange = (index: number, label: string) => {
        setEditColumns((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], label };
            return updated;
        });
    };

    const handleColumnTypeChange = (index: number, type: ColumnConfig['type']) => {
        setEditColumns((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], type };
            return updated;
        });
    };

    const handleColumnRequiredChange = (index: number) => {
        setEditColumns((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], required: !updated[index].required };
            return updated;
        });
    };

    const handleAddColumn = () => {
        const key = `col_${Date.now()}`;
        setEditColumns((prev) => [...prev, { key, label: 'Nouvelle Colonne', type: 'text', required: false }]);
    };

    const handleRemoveColumn = (index: number) => {
        setEditColumns((prev) => prev.filter((_, i) => i !== index));
    };

    const handleMoveColumn = (index: number, direction: -1 | 1) => {
        setEditColumns((prev) => {
            const updated = [...prev];
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= updated.length) return prev;
            [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
            return updated;
        });
    };

    const handleSaveColumns = async () => {
        if (!sectorId) {
            alert('Secteur non trouvé. Créez d\'abord le secteur dans le tableau de bord.');
            return;
        }
        if (editColumns.length === 0) {
            alert('Vous devez avoir au moins une colonne');
            return;
        }
        setSavingColumns(true);
        try {
            await suiviEtudeService.updateColumns(sectorId, editColumns);
            setShowColumnModal(false);
            fetchData(pagination.page);
        } catch (error: any) {
            alert(error.response?.data?.error || 'Échec de la sauvegarde des colonnes');
        } finally {
            setSavingColumns(false);
        }
    };

    // ─── Pagination ───────────────────────────────────────────

    const handlePageChange = (page: number) => fetchData(page);

    const pageButtons = () => {
        const pages: number[] = [];
        const total = pagination.totalPages;
        const current = pagination.page;
        for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) pages.push(i);
        return pages;
    };

    // ─── Render ───────────────────────────────────────────────

    if (loading && dossiers.length === 0) {
        return <div className="loading-dossiers">Chargement des dossiers {sectorName}...</div>;
    }

    return (
        <div className="secteur-detail-page">
            {/* Header */}
            <div className="secteur-detail-header">
                <div className="header-left">
                    <span className="back-link" onClick={() => navigate('/admin/dashboard')}>
                        ← Retour au Tableau de Bord
                    </span>
                    <h1>📋 {sectorName}</h1>
                    <p className="subtitle">Détail des dossiers — {pagination.total} dossier(s)</p>
                </div>
                <div className="header-right">
                    {canEdit && (
                        <>
                            <button className="btn-manage-cols" onClick={openColumnManager}>
                                ⚙️ Gérer les colonnes
                            </button>
                            <button className="btn-add-dossier" onClick={handleAdd}>
                                + Ajouter un dossier
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Stats bar */}
            <div className="secteur-stats-bar">
                <div className="secteur-stat-card primary">
                    <span className="stat-card-label">Total Dossiers</span>
                    <span className="stat-card-value">{pagination.total}</span>
                </div>
                <div className="secteur-stat-card info">
                    <span className="stat-card-label">Colonnes</span>
                    <span className="stat-card-value">{columns.length}</span>
                </div>
            </div>

            {/* Filters */}
            <div className="secteur-filters">
                <input
                    type="text"
                    className="filter-input"
                    placeholder="🔍 Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Dynamic Table */}
            <div className="vue-global-section">
                <h2>Dossiers — {sectorName}</h2>
                <div className="excel-table-wrapper">
                    <table className="excel-table" id="dossier-table">
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSort(col)}
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        {col.label.toUpperCase()}
                                        {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                                    </th>
                                ))}
                                {canEdit && <th>ACTIONS</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {dossiers.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                        Aucun dossier trouvé pour {sectorName}. Cliquez "Ajouter un dossier" pour commencer.
                                    </td>
                                </tr>
                            ) : (
                                sortedDossiers.map((d) => (
                                    <tr key={d.id}>
                                        {columns.map((col) => (
                                            <td key={col.key} title={String(getDataValue(d.data, col) || '')}>
                                                {isPoiColumn(col) && getDataValue(d.data, col) ? (
                                                    <a
                                                        href={`${POI_BASE_URL}${getDataValue(d.data, col)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="poi-link"
                                                    >
                                                        🔗 {getCellValue(d.data, col)}
                                                    </a>
                                                ) : (
                                                    <span style={getCellStyle(col, getDataValue(d.data, col), d.data, columns)}>
                                                        {getCellValue(d.data, col)}
                                                    </span>
                                                )}
                                            </td>
                                        ))}
                                        {canEdit && (
                                            <td>
                                                <div className="row-actions">
                                                    <button className="btn-row-action btn-row-edit" onClick={() => handleEdit(d)}>✏️</button>
                                                    <button className="btn-row-action btn-row-delete" onClick={() => handleDelete(d)}>🗑️</button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="dossier-pagination">
                    <span className="pagination-info">
                        Page {pagination.page} / {pagination.totalPages} — {pagination.total} dossier(s)
                    </span>
                    <div className="pagination-buttons">
                        <button className="btn-page" disabled={pagination.page <= 1} onClick={() => handlePageChange(pagination.page - 1)}>←</button>
                        {pageButtons().map((p) => (
                            <button key={p} className={`btn-page ${p === pagination.page ? 'active' : ''}`} onClick={() => handlePageChange(p)}>{p}</button>
                        ))}
                        <button className="btn-page" disabled={pagination.page >= pagination.totalPages} onClick={() => handlePageChange(pagination.page + 1)}>→</button>
                    </div>
                </div>
            )}

            {/* Create/Edit Dossier Modal */}
            {showDossierModal && (
                <div className="dos-modal-overlay" onClick={() => setShowDossierModal(false)}>
                    <div className="dos-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>{editingDossier ? `Modifier Dossier` : `Ajouter un Dossier — ${sectorName}`}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="dos-form-grid">
                                {columns.map((col) => (
                                    <div className={`dos-form-group ${col.type === 'textarea' ? 'full-width' : ''}`} key={col.key}>
                                        <label htmlFor={col.key}>
                                            {col.label} {col.required && '*'}
                                        </label>
                                        {isEtatColumn(col) ? (
                                            <select
                                                id={col.key}
                                                value={formData[col.key] || ''}
                                                onChange={(e) => handleFormChange(col.key, e.target.value)}
                                            >
                                                <option value="">— Sélectionner —</option>
                                                {ETAT_OPTIONS.map((opt) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : col.type === 'textarea' ? (
                                            <textarea
                                                id={col.key}
                                                value={formData[col.key] || ''}
                                                onChange={(e) => handleFormChange(col.key, e.target.value)}
                                                rows={3}
                                            />
                                        ) : col.type === 'date' ? (
                                            <input
                                                type="date"
                                                id={col.key}
                                                value={formData[col.key] || ''}
                                                onChange={(e) => handleFormChange(col.key, e.target.value)}
                                            />
                                        ) : col.type === 'number' ? (
                                            <input
                                                type="number"
                                                id={col.key}
                                                value={formData[col.key] || ''}
                                                onChange={(e) => handleFormChange(col.key, e.target.value)}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                id={col.key}
                                                value={formData[col.key] || ''}
                                                onChange={(e) => handleFormChange(col.key, e.target.value)}
                                                required={col.required}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="dos-modal-actions">
                                <button type="button" className="dos-btn-cancel" onClick={() => setShowDossierModal(false)} disabled={submitting}>Annuler</button>
                                <button type="submit" className="dos-btn-save" disabled={submitting}>
                                    {submitting ? 'Sauvegarde...' : editingDossier ? 'Mettre à jour' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Column Management Modal */}
            {showColumnModal && (
                <div className="dos-modal-overlay" onClick={() => setShowColumnModal(false)}>
                    <div className="dos-modal-content col-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>⚙️ Gérer les Colonnes — {sectorName}</h3>
                        <p className="col-hint">Ajoutez, renommez, réordonnez ou supprimez des colonnes. Les modifications s'appliquent uniquement à ce secteur.</p>

                        <div className="col-list">
                            {editColumns.map((col, index) => (
                                <div className="col-item" key={col.key}>
                                    <div className="col-order-btns">
                                        <button type="button" className="col-move-btn" onClick={() => handleMoveColumn(index, -1)} disabled={index === 0}>▲</button>
                                        <button type="button" className="col-move-btn" onClick={() => handleMoveColumn(index, 1)} disabled={index === editColumns.length - 1}>▼</button>
                                    </div>
                                    <div className="col-fields">
                                        <input
                                            type="text"
                                            value={col.label}
                                            onChange={(e) => handleColumnLabelChange(index, e.target.value)}
                                            className="col-label-input"
                                            placeholder="Nom de la colonne"
                                        />
                                        <select
                                            value={col.type}
                                            onChange={(e) => handleColumnTypeChange(index, e.target.value as ColumnConfig['type'])}
                                            className="col-type-select"
                                        >
                                            <option value="text">Texte</option>
                                            <option value="date">Date</option>
                                            <option value="number">Nombre</option>
                                            <option value="textarea">Zone de texte</option>
                                        </select>
                                        <label className="col-required-label">
                                            <input
                                                type="checkbox"
                                                checked={col.required || false}
                                                onChange={() => handleColumnRequiredChange(index)}
                                            />
                                            Requis
                                        </label>
                                    </div>
                                    <button type="button" className="col-remove-btn" onClick={() => handleRemoveColumn(index)}>🗑️</button>
                                </div>
                            ))}
                        </div>

                        <button type="button" className="col-add-btn" onClick={handleAddColumn}>
                            + Ajouter une colonne
                        </button>

                        <div className="dos-modal-actions">
                            <button type="button" className="dos-btn-cancel" onClick={() => setShowColumnModal(false)} disabled={savingColumns}>Annuler</button>
                            <button type="button" className="dos-btn-save" onClick={handleSaveColumns} disabled={savingColumns}>
                                {savingColumns ? 'Sauvegarde...' : 'Enregistrer les colonnes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecteurDetailPage;
