/**
 * Filtre DRE KO (vue Excel) : uniquement KO, NC, NON explicites.
 * Colonnes / clés liées au DRE détectées de façon robuste (Date DRE, DRE KO, clé « DRE » dans le JSON, etc.).
 * À garder aligné avec backend/src/utils/dre-ko-filter.ts
 */

import type { ColumnConfig } from '../services/dossier-etude.service';

function getDataValue(data: Record<string, unknown>, col: ColumnConfig): unknown {
    if (data[col.key] !== undefined) return data[col.key];
    if (data[col.label] !== undefined) return data[col.label];
    const labelLower = col.label.toLowerCase();
    for (const key of Object.keys(data)) {
        if (key.toLowerCase() === labelLower) return data[key];
    }
    return undefined;
}

export function isDreRelatedColumn(col: { key: string; label: string }): boolean {
    const key = (col.key || '').trim().toLowerCase();
    const label = (col.label || '').trim().toLowerCase();
    const combined = `${key} ${label}`;
    if (combined.includes('adresse') || combined.includes('ordre')) return false;
    if (key === 'dre' || label === 'dre') return true;
    const compact = combined.replace(/\s+/g, '');
    if (compact.includes('dreko')) return true;
    if (key.includes('dre') || label.includes('dre')) return true;
    return false;
}

export function normalizeExplicitDreKoToken(raw: unknown): 'ko' | 'nc' | 'non' | null {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (s === '' || s === '-') return null;
    s = s.replace(/[\u00a0\u200b-\u200d\ufeff]/g, ' ');
    if (s.startsWith('=')) {
        s = s.replace(/^=\s*/, '').trim();
    }
    if (s === '' || s === '-') return null;
    s = s.normalize('NFD').replace(/\p{M}/gu, '');
    const lower = s.toLowerCase();
    const compact = lower.replace(/\s+/g, '');
    if (compact === 'ko' || compact === 'nc' || compact === 'n/c' || compact === 'non') {
        if (compact === 'ko') return 'ko';
        if (compact === 'nc' || compact === 'n/c') return 'nc';
        return 'non';
    }
    const tokens = lower.split(/[^a-z0-9/]+/).filter((t) => t.length > 0);
    for (const tok of tokens) {
        const c = tok.replace(/\s+/g, '');
        if (c === 'ko') return 'ko';
        if (c === 'nc' || c === 'n/c') return 'nc';
        if (c === 'non') return 'non';
    }
    return null;
}

export function isExplicitDreKoCellValue(raw: unknown): boolean {
    return normalizeExplicitDreKoToken(raw) !== null;
}

function collectDreCandidateValues(
    data: Record<string, unknown>,
    columns: ColumnConfig[],
): unknown[] {
    const values: unknown[] = [];
    const usedKeys = new Set<string>();

    for (const col of columns) {
        if (!isDreRelatedColumn(col)) continue;
        const v = getDataValue(data, col);
        usedKeys.add(col.key);
        if (col.label && col.label !== col.key) usedKeys.add(col.label);
        values.push(v);
    }

    for (const k of Object.keys(data)) {
        if (usedKeys.has(k)) continue;
        const fake = { key: k, label: k };
        if (!isDreRelatedColumn(fake)) continue;
        values.push(data[k]);
    }

    return values;
}

export function isDreKoDossierRow(data: Record<string, unknown>, columns: ColumnConfig[]): boolean {
    for (const v of collectDreCandidateValues(data, columns)) {
        if (isExplicitDreKoCellValue(v)) return true;
    }
    return false;
}
