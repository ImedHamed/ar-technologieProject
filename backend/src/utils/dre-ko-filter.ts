/**
 * Filtre DRE KO aligné sur la vue Excel : NB.SI(colonne_DRE; "<=" & AUJOURDHUI()).
 * Un dossier est DRE KO si une valeur de colonne liée au DRE est une date <= aujourd'hui.
 * Détection robuste : colonnes / clés JSON contenant « DRE » (hors faux positifs type adresse).
 * À garder aligné avec frontend/src/utils/dre-ko-filter.ts
 */

function getDataValForMetric(
    data: Record<string, any>,
    col: { key: string; label: string },
): unknown {
    if (data[col.key] !== undefined) return data[col.key];
    if (data[col.label] !== undefined) return data[col.label];
    const labelLower = col.label.toLowerCase();
    for (const key of Object.keys(data)) {
        if (key.toLowerCase() === labelLower) return data[key];
    }
    return undefined;
}

/** Colonne ou champ JSON lié au DRE (clés type dre_statut, date_dre… — pas seulement le mot isolé « dre »). */
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

function excelSerialToDate(serial: number): Date | null {
    if (!Number.isFinite(serial)) return null;
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
}

function parsePotentialDate(raw: unknown): Date | null {
    if (raw == null) return null;

    if (raw instanceof Date) {
        return isNaN(raw.getTime()) ? null : raw;
    }

    if (typeof raw === 'number') {
        return excelSerialToDate(raw);
    }

    let s = String(raw).trim();
    if (!s || s === '-') return null;
    if (s.startsWith('=')) s = s.replace(/^=\s*/, '').trim();
    if (!s || s === '-') return null;

    const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (fr) {
        const [, d, m, y] = fr;
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        return isNaN(date.getTime()) ? null : date;
    }

    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (iso) {
        const [, y, m, d] = iso;
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        return isNaN(date.getTime()) ? null : date;
    }

    const asNum = Number(s.replace(',', '.'));
    if (Number.isFinite(asNum) && /^\d+(?:[.,]\d+)?$/.test(s)) {
        const excelDate = excelSerialToDate(asNum);
        if (excelDate) return excelDate;
    }

    const date = new Date(s);
    return isNaN(date.getTime()) ? null : date;
}

export function isDreKoDateCellValue(raw: unknown, now: Date = new Date()): boolean {
    const d = parsePotentialDate(raw);
    if (!d) return false;
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return d.getTime() <= todayEnd.getTime();
}

/**
 * Détecte KO / NC / NON explicites dans une cellule (mot entier ou cellule entière).
 * Gère accents, espaces insécables, préfixe « = » (export Excel), libellés type « Motif : KO ».
 */
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
    data: Record<string, any>,
    colConfig: { key: string; label: string }[],
): unknown[] {
    const values: unknown[] = [];
    const usedKeys = new Set<string>();

    for (const col of colConfig) {
        if (!isDreRelatedColumn(col)) continue;
        const v = getDataValForMetric(data, col);
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

export function isDreKoDossierRow(
    data: Record<string, any>,
    colConfig: { key: string; label: string }[],
): boolean {
    if (!colConfig.length && Object.keys(data).length === 0) return false;
    for (const v of collectDreCandidateValues(data, colConfig)) {
        if (isDreKoDateCellValue(v)) return true;
    }
    return false;
}

export function countDreKoInDossiers(
    dossiers: { data: any }[],
    colConfig: { key: string; label: string }[],
): number {
    return dossiers.filter((d) => isDreKoDossierRow(d.data as Record<string, any>, colConfig)).length;
}
