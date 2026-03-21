import apiClient from './api';

export interface SuiviEtudeRow {
    id: string;
    secteur: string;
    nbDossiers: number;
    dreKo: number;
    vtAFaire: number;
    aRemonter: number;
    retourVt: number;
    dossAReprendre: number;
    dossAMonter: number;
    attInfosCafRef: number;
    attDevisOrangeRip: number;
    attDevisClient: number;
    attTravauxClient: number;
    attPv: number;
    attDta: number;
    attComacCafft: number;
    attMajSi: number;
    poiEnTravaux: number;
    atRetourDoe: number;
    recolAFaire: number;
    etat5: number;
    dossierMainBe: number;
    dossierMainChaff: number;
    createdAt: string;
    updatedAt: string;
}

export interface SuiviEtudeTotals {
    nbDossiers: number;
    dreKo: number;
    vtAFaire: number;
    aRemonter: number;
    retourVt: number;
    dossAReprendre: number;
    dossAMonter: number;
    attInfosCafRef: number;
    attDevisOrangeRip: number;
    attDevisClient: number;
    attTravauxClient: number;
    attPv: number;
    attDta: number;
    attComacCafft: number;
    attMajSi: number;
    poiEnTravaux: number;
    atRetourDoe: number;
    recolAFaire: number;
    etat5: number;
    dossierMainBe: number;
    dossierMainChaff: number;
}

export interface SuiviEtudeListResponse {
    rows: SuiviEtudeRow[];
    totals: SuiviEtudeTotals;
    tauxNonConformite: string;
}

class SuiviEtudeService {
    async getAll(): Promise<SuiviEtudeListResponse> {
        const response = await apiClient.get<SuiviEtudeListResponse>('/suivi-etudes');
        return response.data;
    }

    async create(data: Partial<SuiviEtudeRow>): Promise<SuiviEtudeRow> {
        const response = await apiClient.post<{ row: SuiviEtudeRow }>('/suivi-etudes', data);
        return response.data.row;
    }

    async update(id: string, data: Partial<SuiviEtudeRow>): Promise<SuiviEtudeRow> {
        const response = await apiClient.put<{ row: SuiviEtudeRow }>(`/suivi-etudes/${id}`, data);
        return response.data.row;
    }

    async delete(id: string): Promise<void> {
        await apiClient.delete(`/suivi-etudes/${id}`);
    }

    async updateColumns(id: string, columnConfig: any[]): Promise<SuiviEtudeRow> {
        const response = await apiClient.put<{ row: SuiviEtudeRow }>(`/suivi-etudes/${id}/columns`, { columnConfig });
        return response.data.row;
    }

    async exportFull(): Promise<void> {
        const response = await apiClient.get('/excel/export-full', { responseType: 'blob' });
        const blob = new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Suivi_etudes_export.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    async importFull(file: File, mode: 'add' | 'replace' = 'replace'): Promise<{ secteursImported: number; totalDossiers: number }> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', mode);
        const response = await apiClient.post('/excel/import-full', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    }
}

export default new SuiviEtudeService();
