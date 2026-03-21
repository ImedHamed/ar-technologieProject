import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../i18n/i18n';
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
    const maxLen = col.type === 'textarea' ? 120 : 35;
    if (typeof val === 'string' && val.length > maxLen) return val.substring(0, maxLen) + '...';
    return String(val);
}

// ═══════════════════════════════════════════════════
// PER-SECTOR ETAT MAPPING — each sector only sees its own états
// ═══════════════════════════════════════════════════
const SECTOR_ETAT_MAP: Record<string, string[]> = {
    'MEN-ROD': [
        '01 AT VT', '01.2 A REMONTER', '02 RETOUR VT',
        '03 DOSSIER A REPRENDRE', '04 DOSSIER A MONTER',
        '05 AT INFO CAF REF', '05.1 ETU TRANSMISE',
        '06 AT DEVIS CLIENT', '07 AT TRVX CLIENT',
        '09 AT DEVIS ORANGE/RIP', '10 AT PV', '10.1 ATT DT',
        '11 AT DTA', '12 AT MAJ SI', '13 ETAT 5',
        '14 POI EN TRAVAUX',
    ],
    'QPR-CRO': [
        '01 AT VT', '01.2 A REMONTER', '02 RETOUR VT',
        '04 DOSSIER A MONTER',
        '05 AT INFO CAF REF', '05.1 ETU TRANSMISE',
        '06 AT DEVIS CLIENT', '07 AT TRVX CLIENT',
        '09 AT DEVIS ORANGE/RIP', '10 AT PV',
        '12 AT MAJ SI', '13 ETAT 5',
        '14 POI EN TRAVAUX', '14.1 AT RETOUR DOE', '15 POI FACTU',
    ],
    'GDP AQ': [
        '01 AT VT', '01.2 A REMONTER', '02 RETOUR VT',
        '03 DOSSIER A REPRENDRE', '04 DOSSIER A MONTER',
        '05 AT INFO CAF REF', '05.1 ETU TRANSMISE',
        '06 AT DEVIS CLIENT', '07 AT TRVX CLIENT',
        '09 AT DEVIS ORANGE/RIP', '10 AT PV',
        '11 AT DTA', '12 AT MAJ SI',
        '14 POI EN TRAVAUX', '14.1 AT RETOUR DOE',
    ],
    'SPI AQ': [
        '01 AT VT', '01.2 A REMONTER', '02 RETOUR VT',
        '05 AT PV', '05.1 AT DTA', '06 AT MAJ SI',
        '07 AT INFO CAF REF', '08 AT DEVIS ORANGE/RIP',
        '09 POI EN TRAVAUX', '09.1 ATT DOE',
    ],
    'COMAC CAPFT': [
        '01 Dossier à monter', '04 Dossier à reprendre',
        '05 Dossier terminer',
    ],
    'SPI Bretagne': [
        '01 Dossier Bloqué', '02 Dossier envoyé',
        '03 Etude terminé',
    ],
};

// Fallback: full list for sectors not yet mapped
const ETAT_OPTIONS_FALLBACK = [
    '01 VT A FAIRE', '01 AT VT', '01.2 A REMONTER', '01.3 Etude CDC',
    '02 RETOUR VT', '03 DOSSIER A REPRENDRE', '04 DOSSIER A MONTER',
    '05 AT INFO CAF REF', '05.1 ETU TRANSMISE', '05 Dossier terminer',
    '06 AT DEVIS CLIENT', '07 AT TRVX CLIENT', '08 AT COMAC/CAPFT',
    '09 AT DEVIS ORANGE/RIP', '10 AT PV', '10.1 ATT DT',
    '11 AT DTA', '12 AT MAJ SI', '13 ETAT 5',
    '14 POI EN TRAVAUX', '14.1 AT RETOUR DOE', '15 POI FACTU',
    '16 DOSSIER PAYE',
];

// Check if a column key/label refers to the COMAC/CAPFT column
function isComacCapftColumn(col: ColumnConfig): boolean {
    const lower = (col.key + ' ' + col.label).toLowerCase();
    return lower.includes('comac') || lower.includes('capft');
}

function isSelectColumn(col: ColumnConfig, secteur?: string): boolean {
    if (col.type === 'select') return true;
    if (col.key === 'etat' || col.label.toLowerCase() === 'etat') return true;
    // In COMAC CAPFT sector, the COMAC/CAPFT column becomes a dropdown
    if (secteur === 'COMAC CAPFT' && isComacCapftColumn(col)) return true;
    return false;
}

// Keep backward compatibility
function isEtatColumn(col: ColumnConfig): boolean {
    return col.key === 'etat' || col.label.toLowerCase() === 'etat';
}

// Get dropdown options for a column, filtered by sector for ETAT columns
function getColumnOptions(col: ColumnConfig, secteur?: string): string[] {
    if (col.options && col.options.length > 0) return col.options;
    if (isEtatColumn(col)) {
        if (secteur && SECTOR_ETAT_MAP[secteur]) {
            return SECTOR_ETAT_MAP[secteur];
        }
        return ETAT_OPTIONS_FALLBACK;
    }
    // COMAC/CAPFT column in the COMAC CAPFT sector → restricted dropdown
    if (secteur === 'COMAC CAPFT' && isComacCapftColumn(col)) {
        return ['COMAC', 'CAPFT'];
    }
    return [];
}

// ETAT color map — exact hex colors from Excel conditional formatting rules
const ETAT_COLORS: Record<string, { bg: string; color: string }> = {
    '01 vt a faire': { bg: '#92D050', color: '#000' },
    '01 at vt': { bg: '#92D050', color: '#000' },
    '01.2 a remonter': { bg: '#FFC000', color: '#000' },
    '01.3 etude cdc': { bg: '#E2EFDA', color: '#375623' },
    '02 retour vt': { bg: '#7030A0', color: '#fff' },
    '03 dossier a reprendre': { bg: '#FF6600', color: '#fff' },
    '04 dossier a monter': { bg: '#FF0000', color: '#fff' },
    '05 at info caf ref': { bg: '#BDD7EE', color: '#000' },
    '05.1 etu transmise': { bg: '#C5E0B4', color: '#375623' },
    '05 dossier terminer': { bg: '#548235', color: '#fff' },
    '06 at devis client': { bg: '#00B0F0', color: '#000' },
    '07 at trvx client': { bg: '#D9E2F3', color: '#000' },
    '08 at comac/capft': { bg: '#E2EFDA', color: '#000' },
    '08 at devis orange/rip': { bg: '#FFC000', color: '#000' },
    '09 at devis orange/rip': { bg: '#FFC000', color: '#000' },
    '09 poi en travaux': { bg: '#FFFF00', color: '#000' },
    '09.1 att doe': { bg: '#9DC3E6', color: '#0070C0' },
    '10 at pv': { bg: '#F4B084', color: '#000' },
    '10.1 att dt': { bg: '#E2EFDA', color: '#000' },
    '11 at dta': { bg: '#D6DCE4', color: '#000' },
    '05.1 at dta': { bg: '#D6DCE4', color: '#000' },
    '06 at maj si': { bg: '#B4C6E7', color: '#000' },
    '12 at maj si': { bg: '#B4C6E7', color: '#000' },
    '13 etat 5': { bg: '#00B050', color: '#fff' },
    '14 poi en travaux': { bg: '#FFFF00', color: '#000' },
    '14.1 at retour doe': { bg: '#9DC3E6', color: '#0070C0' },
    '15 poi factu': { bg: '#A9D18E', color: '#000' },
    '16 dossier paye': { bg: '#FCA7A7', color: '#000' },
    // COMAC CAPFT
    '01 dossier à monter': { bg: '#FF0000', color: '#fff' },
    '04 dossier à reprendre': { bg: '#FF6600', color: '#fff' },
    // SPI Bretagne
    '01 dossier bloqué': { bg: '#FF0000', color: '#fff' },
    '02 dossier envoyé': { bg: '#92D050', color: '#000' },
    '03 etude terminé': { bg: '#00B050', color: '#fff' },
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
    const { t } = useLanguage();
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

    // Group by column
    const [groupByKey, setGroupByKey] = useState<string | null>(null);

    // Column resizing
    // Load persisted column widths from localStorage
    const storageKey = `colWidths_${sectorName}`;
    const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });
    const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

    const onResizeMouseDown = useCallback((e: React.MouseEvent, colKey: string) => {
        e.preventDefault();
        e.stopPropagation();
        const th = (e.target as HTMLElement).parentElement!;
        const startW = th.offsetWidth;
        resizingRef.current = { key: colKey, startX: e.clientX, startW };

        const onMouseMove = (ev: MouseEvent) => {
            if (!resizingRef.current) return;
            const { key, startX, startW } = resizingRef.current;
            const diff = ev.clientX - startX;
            const newW = Math.max(50, startW + diff);
            setColWidths(prev => {
                const next = { ...prev, [key]: newW };
                try { localStorage.setItem(`colWidths_${sectorName}`, JSON.stringify(next)); } catch { }
                return next;
            });
        };
        const onMouseUp = () => {
            resizingRef.current = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    // Generic inline cell editing — tracks which cell is being edited as "dossierId_colKey"
    const [inlineEditKey, setInlineEditKey] = useState<string | null>(null);
    const [inlineEditValue, setInlineEditValue] = useState<string>('');
    const [inlineSaving, setInlineSaving] = useState<string | null>(null);

    const startInlineEdit = (dossier: DossierEtude, col: ColumnConfig) => {
        const cellKey = `${dossier.id}_${col.key}`;
        const rawVal = getDataValue(dossier.data, col);
        if (col.type === 'date') {
            setInlineEditValue(toInputDate(rawVal));
        } else {
            setInlineEditValue(rawVal ?? '');
        }
        setInlineEditKey(cellKey);
    };

    const handleInlineSave = async (dossier: DossierEtude, col: ColumnConfig, value: string) => {
        setInlineEditKey(null);
        let saveValue: string = value;
        if (col.type === 'date' && value) {
            const [y, m, d] = value.split('-');
            saveValue = `${d}/${m}/${y}`;
        }
        const oldVal = getDataValue(dossier.data, col) || '';
        if (saveValue === oldVal) return;
        const cellKey = `${dossier.id}_${col.key}`;
        setInlineSaving(cellKey);
        try {
            const updatedData = { ...dossier.data, [col.key]: saveValue };
            await dossierEtudeService.update(dossier.id, updatedData);
            setDossiers(prev => prev.map(dd =>
                dd.id === dossier.id ? { ...dd, data: updatedData } : dd
            ));
        } catch {
            alert('Échec de la mise à jour');
        } finally {
            setInlineSaving(null);
        }
    };

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

    // Group sorted dossiers by selected column
    const groupedDossiers = React.useMemo(() => {
        if (!groupByKey) return null;
        const col = columns.find(c => c.key === groupByKey);
        if (!col) return null;
        const groups: { label: string; dossiers: DossierEtude[] }[] = [];
        const groupMap = new Map<string, DossierEtude[]>();
        for (const d of sortedDossiers) {
            const val = getDataValue(d.data, col);
            const label = (val === null || val === undefined || val === '') ? '— Vide —' : String(val);
            if (!groupMap.has(label)) {
                groupMap.set(label, []);
            }
            groupMap.get(label)!.push(d);
        }
        for (const [label, dossiers] of groupMap) {
            groups.push({ label, dossiers });
        }
        return groups;
    }, [sortedDossiers, groupByKey, columns]);

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

    const colListRef = useRef<HTMLDivElement>(null);

    const handleAddColumn = () => {
        const key = `col_${Date.now()}`;
        setEditColumns((prev) => [...prev, { key, label: 'Nouvelle Colonne', type: 'text', required: false }]);
        // Auto-scroll to bottom so the newly added column is visible
        setTimeout(() => {
            if (colListRef.current) {
                colListRef.current.scrollTop = colListRef.current.scrollHeight;
            }
        }, 50);
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

    // ─── Excel Import / Export ────────────────────────────────
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const importFileRef = useRef<HTMLInputElement>(null);

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            await dossierEtudeService.exportExcel(sectorName);
        } catch {
            alert('Échec de l\'export Excel');
        } finally {
            setExporting(false);
        }
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const result = await dossierEtudeService.importExcel(sectorName, file);
            alert(`✅ ${result.imported} dossiers importés avec succès`);
            fetchData(1);
        } catch {
            alert('Échec de l\'import Excel');
        } finally {
            setImporting(false);
            if (importFileRef.current) importFileRef.current.value = '';
        }
    };

    const pageButtons = () => {
        const pages: number[] = [];
        const total = pagination.totalPages;
        const current = pagination.page;
        for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) pages.push(i);
        return pages;
    };

    // ─── Computed stats ───────────────────────────────────────
    const vtAFaireCount = React.useMemo(() => {
        const etatCol = columns.find(c => isEtatColumn(c));
        if (!etatCol) return 0;
        return dossiers.filter(d => {
            const val = getDataValue(d.data, etatCol);
            return val && String(val).toLowerCase().trim() === '01 vt a faire';
        }).length;
    }, [dossiers, columns]);

    // ─── Render ───────────────────────────────────────────────

    if (loading && dossiers.length === 0) {
        return <div className="loading-dossiers">{t('common.loading')} {sectorName}...</div>;
    }

    return (
        <div className="secteur-detail-page">
            {/* Header */}
            <div className="secteur-detail-header">
                <div className="header-left">
                    <span className="back-link" onClick={() => navigate(sectorName.toUpperCase() === 'BEIN' ? '/admin/choose-section' : '/admin/dashboard')}>
                        {t('common.back_dashboard')}
                    </span>
                    <h1>📋 {sectorName}</h1>
                    <p className="subtitle">{t('sector.subtitle')} — {pagination.total} {t('sector.dossier_count')}</p>
                </div>
                <div className="header-right">
                    {canEdit && (
                        <>
                            <button className="btn-export-excel" onClick={handleExportExcel} disabled={exporting}>
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
                                onChange={handleImportExcel}
                            />
                            <button className="btn-manage-cols" onClick={openColumnManager}>
                                {t('sector.manage_cols')}
                            </button>
                            <button className="btn-add-dossier" onClick={handleAdd}>
                                {t('sector.add_dossier')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Stats bar */}
            <div className="secteur-stats-bar">
                <div className="secteur-stat-card primary">
                    <span className="stat-card-label">{t('sector.vt_a_faire')}</span>
                    <span className="stat-card-value">{vtAFaireCount}</span>
                </div>
                <div className="secteur-stat-card info">
                    <span className="stat-card-label">{t('sector.nb_dossiers')}</span>
                    <span className="stat-card-value">{pagination.total}</span>
                </div>
            </div>

            {/* Filters */}
            <div className="secteur-filters">
                <input
                    type="text"
                    className="filter-input"
                    placeholder={`🔍 ${t('sector.search')}`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <div className="group-by-wrapper">
                    <label className="group-by-label">📊 Grouper par :</label>
                    <select
                        className="group-by-select"
                        value={groupByKey || ''}
                        onChange={(e) => setGroupByKey(e.target.value || null)}
                    >
                        <option value="">— Aucun —</option>
                        {columns.map((col) => (
                            <option key={col.key} value={col.key}>{col.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Dynamic Table */}
            <div className="vue-global-section">
                <h2>{t('sector.dossiers_title')} — {sectorName}</h2>
                <div className="excel-table-wrapper">
                    <table className="excel-table" id="dossier-table" style={{
                        tableLayout: 'fixed',
                        width: (() => {
                            const DEFAULT_W = 150;
                            const TEXTAREA_W = 300;
                            const ACTION_W = 80;
                            const total = columns.reduce((sum, col) => {
                                return sum + (colWidths[col.key] || (col.type === 'textarea' ? TEXTAREA_W : DEFAULT_W));
                            }, canEdit ? ACTION_W : 0);
                            return `${Math.max(total, 100)}px`;
                        })(),
                    }}>
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSort(col)}
                                        style={{
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            position: 'relative',
                                            width: `${colWidths[col.key] || (col.type === 'textarea' ? 300 : 150)}px`,
                                            minWidth: '50px',
                                        }}
                                    >
                                        {col.label.toUpperCase()}
                                        {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                                        <div
                                            onMouseDown={(e) => onResizeMouseDown(e, col.key)}
                                            style={{
                                                position: 'absolute',
                                                right: 0,
                                                top: 0,
                                                bottom: 0,
                                                width: '5px',
                                                cursor: 'col-resize',
                                                zIndex: 1,
                                            }}
                                        />
                                    </th>
                                ))}
                                {canEdit && <th style={{ width: '80px', minWidth: '80px' }}>{t('common.actions')}</th>}
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
                                (groupedDossiers || [{ label: '', dossiers: sortedDossiers }]).map((group, gi) => (
                                    <React.Fragment key={`group-${gi}`}>
                                        {groupByKey && (
                                            <tr className="group-header-row">
                                                <td colSpan={columns.length + (canEdit ? 1 : 0)}>
                                                    <span className="group-header-label">{group.label}</span>
                                                    <span className="group-header-count">{group.dossiers.length}</span>
                                                </td>
                                            </tr>
                                        )}
                                        {group.dossiers.map((d) => (
                                            <tr key={d.id}>
                                                {columns.map((col) => {
                                                    const cellKey = `${d.id}_${col.key}`;
                                                    const isEditing = inlineEditKey === cellKey;
                                                    const isSaving = inlineSaving === cellKey;

                                                    return (
                                                        <td key={col.key} title={String(getDataValue(d.data, col) || '')}>
                                                            {isEditing && canEdit ? (
                                                                isSelectColumn(col, sectorName) ? (
                                                                    <select
                                                                        className="inline-etat-select"
                                                                        value={inlineEditValue}
                                                                        onChange={(e) => { setInlineEditValue(e.target.value); handleInlineSave(d, col, e.target.value); }}
                                                                        onBlur={() => setInlineEditKey(null)}
                                                                        autoFocus
                                                                        style={{ maxWidth: '180px', fontSize: '0.78rem', padding: '2px 4px', borderRadius: '4px', border: '1.5px solid #1976d2' }}
                                                                    >
                                                                        <option value="">— Sélectionner —</option>
                                                                        {getColumnOptions(col, sectorName).map((opt) => (
                                                                            <option key={opt} value={opt}>{opt}</option>
                                                                        ))}
                                                                    </select>
                                                                ) : col.type === 'date' ? (
                                                                    <input
                                                                        type="date"
                                                                        className="inline-date-input"
                                                                        value={inlineEditValue}
                                                                        onChange={(e) => { setInlineEditValue(e.target.value); handleInlineSave(d, col, e.target.value); }}
                                                                        onBlur={() => setInlineEditKey(null)}
                                                                        autoFocus
                                                                        style={{ fontSize: '0.78rem', padding: '2px 4px', borderRadius: '4px', border: '1.5px solid #1976d2', maxWidth: '150px' }}
                                                                    />
                                                                ) : col.type === 'textarea' ? (
                                                                    <textarea
                                                                        className="inline-textarea-input"
                                                                        value={inlineEditValue}
                                                                        onChange={(e) => setInlineEditValue(e.target.value)}
                                                                        onBlur={() => handleInlineSave(d, col, inlineEditValue)}
                                                                        onKeyDown={(e) => { if (e.key === 'Escape') setInlineEditKey(null); }}
                                                                        autoFocus
                                                                        rows={3}
                                                                        style={{ fontSize: '0.78rem', padding: '4px', borderRadius: '4px', border: '1.5px solid #1976d2', width: '100%', minWidth: '250px', resize: 'vertical' }}
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type={col.type === 'number' ? 'number' : 'text'}
                                                                        className="inline-text-input"
                                                                        value={inlineEditValue}
                                                                        onChange={(e) => setInlineEditValue(e.target.value)}
                                                                        onBlur={() => handleInlineSave(d, col, inlineEditValue)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                                                                            if (e.key === 'Escape') setInlineEditKey(null);
                                                                        }}
                                                                        autoFocus
                                                                        style={{ fontSize: '0.78rem', padding: '2px 6px', borderRadius: '4px', border: '1.5px solid #1976d2', width: '100%' }}
                                                                    />
                                                                )
                                                            ) : isPoiColumn(col) && getDataValue(d.data, col) ? (
                                                                <a
                                                                    href={`${POI_BASE_URL}${getDataValue(d.data, col)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="poi-link"
                                                                    onDoubleClick={(e) => { e.preventDefault(); if (canEdit) startInlineEdit(d, col); }}
                                                                >
                                                                    {isSaving ? '⏳...' : `🔗 ${getCellValue(d.data, col)}`}
                                                                </a>
                                                            ) : (
                                                                <span
                                                                    style={{ ...getCellStyle(col, getDataValue(d.data, col), d.data, columns), cursor: canEdit ? 'pointer' : 'default' }}
                                                                    onDoubleClick={() => { if (canEdit) startInlineEdit(d, col); }}
                                                                >
                                                                    {isSaving ? '⏳...' : getCellValue(d.data, col)}
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                {canEdit && (
                                                    <td>
                                                        <div className="row-actions">
                                                            <button className="btn-row-action btn-row-edit" onClick={() => handleEdit(d)}>✏️</button>
                                                            <button className="btn-row-action btn-row-delete" onClick={() => handleDelete(d)}>🗑️</button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </React.Fragment>
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
                        {t('sector.page')} {pagination.page} / {pagination.totalPages} — {pagination.total} {t('sector.dossier_count')}
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
                        <h3>{editingDossier ? t('sector.modify_dossier') : `${t('sector.add_dossier_modal')} — ${sectorName}`}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="dos-form-grid">
                                {columns.map((col) => (
                                    <div className={`dos-form-group ${col.type === 'textarea' ? 'full-width' : ''}`} key={col.key}>
                                        <label htmlFor={col.key}>
                                            {col.label} {col.required && '*'}
                                        </label>
                                        {isSelectColumn(col, sectorName) ? (
                                            <select
                                                id={col.key}
                                                value={formData[col.key] || ''}
                                                onChange={(e) => handleFormChange(col.key, e.target.value)}
                                            >
                                                <option value="">{t('common.select')}</option>
                                                {getColumnOptions(col, sectorName).map((opt) => (
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
                                <button type="button" className="dos-btn-cancel" onClick={() => setShowDossierModal(false)} disabled={submitting}>{t('common.cancel')}</button>
                                <button type="submit" className="dos-btn-save" disabled={submitting}>
                                    {submitting ? t('common.saving') : editingDossier ? t('sector.update_btn') : t('sector.create_btn')}
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
                        <h3>{t('sector.col_modal_title')} — {sectorName}</h3>
                        <p className="col-hint">{t('sector.col_hint')}</p>

                        <div className="col-list" ref={colListRef}>
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
                                            placeholder={t('sector.col_name')}
                                        />
                                        <select
                                            value={col.type}
                                            onChange={(e) => handleColumnTypeChange(index, e.target.value as ColumnConfig['type'])}
                                            className="col-type-select"
                                        >
                                            <option value="text">{t('sector.col_type_text')}</option>
                                            <option value="date">{t('sector.col_type_date')}</option>
                                            <option value="number">{t('sector.col_type_number')}</option>
                                            <option value="textarea">{t('sector.col_type_textarea')}</option>
                                            <option value="select">Liste déroulante</option>
                                        </select>
                                        {col.type === 'select' && (
                                            <textarea
                                                className="col-options-input"
                                                placeholder="Options (une par ligne)"
                                                value={(col.options || []).join('\n')}
                                                onChange={(e) => {
                                                    const opts = e.target.value.split('\n');
                                                    setEditColumns((prev) => {
                                                        const updated = [...prev];
                                                        updated[index] = { ...updated[index], options: opts };
                                                        return updated;
                                                    });
                                                }}
                                                rows={4}
                                                style={{ fontSize: '0.72rem', padding: '4px', borderRadius: '4px', border: '1.5px solid #ddd', width: '100%', minWidth: '150px', resize: 'vertical', marginTop: '4px' }}
                                            />
                                        )}
                                        <label className="col-required-label">
                                            <input
                                                type="checkbox"
                                                checked={col.required || false}
                                                onChange={() => handleColumnRequiredChange(index)}
                                            />
                                            {t('sector.col_required')}
                                        </label>
                                    </div>
                                    <button type="button" className="col-remove-btn" onClick={() => handleRemoveColumn(index)}>🗑️</button>
                                </div>
                            ))}
                        </div>

                        <button type="button" className="col-add-btn" onClick={handleAddColumn}>
                            {t('sector.col_add')}
                        </button>

                        <div className="dos-modal-actions">
                            <button type="button" className="dos-btn-cancel" onClick={() => setShowColumnModal(false)} disabled={savingColumns}>{t('common.cancel')}</button>
                            <button type="button" className="dos-btn-save" onClick={handleSaveColumns} disabled={savingColumns}>
                                {savingColumns ? t('sector.col_saving') : t('sector.col_save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecteurDetailPage;
