import apiClient from './api';

export interface ColumnConfig {
    key: string;
    label: string;
    type: 'text' | 'date' | 'textarea' | 'number' | 'select';
    required?: boolean;
    options?: string[];
}

export interface DossierEtude {
    id: string;
    secteur: string;
    data: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface DossierEtudeListResponse {
    dossiers: DossierEtude[];
    columnConfig: ColumnConfig[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

class DossierEtudeService {
    async getAll(params: {
        secteur?: string;
        page?: number;
        limit?: number;
        search?: string;
    } = {}): Promise<DossierEtudeListResponse> {
        const query = new URLSearchParams();
        if (params.secteur) query.append('secteur', params.secteur);
        if (params.page) query.append('page', params.page.toString());
        if (params.limit) query.append('limit', params.limit.toString());
        if (params.search) query.append('search', params.search);

        const response = await apiClient.get<DossierEtudeListResponse>(`/dossier-etudes?${query.toString()}`);
        return response.data;
    }

    async create(secteur: string, data: Record<string, any>): Promise<DossierEtude> {
        const response = await apiClient.post<{ dossier: DossierEtude }>('/dossier-etudes', { secteur, data });
        return response.data.dossier;
    }

    async update(id: string, data: Record<string, any>): Promise<DossierEtude> {
        const response = await apiClient.put<{ dossier: DossierEtude }>(`/dossier-etudes/${id}`, { data });
        return response.data.dossier;
    }

    async delete(id: string): Promise<void> {
        await apiClient.delete(`/dossier-etudes/${id}`);
    }

    async recalcSector(secteur: string): Promise<{ message: string; row: any | null }> {
        const response = await apiClient.post<{ message: string; row: any | null }>('/dossier-etudes/recalc-sector', { secteur });
        return response.data;
    }

    async exportExcel(secteur: string): Promise<void> {
        const response = await apiClient.get(`/excel/export`, {
            params: { secteur },
            responseType: 'blob',
        });
        const blob = new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${secteur.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    async importExcel(secteur: string, file: File, mode: 'add' | 'replace' = 'replace'): Promise<{ imported: number }> {
        const formData = new FormData();
        formData.append('secteur', secteur);
        formData.append('file', file);
        formData.append('mode', mode);
        const response = await apiClient.post('/excel/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    }
}

export default new DossierEtudeService();
