import apiClient from './api';
import type { User } from '../types';

export interface RoleOption {
    id: string;
    name: string;
    description: string | null;
}

class UserService {
    async getAll(): Promise<User[]> {
        const response = await apiClient.get<{ users: User[] }>('/users');
        return response.data.users;
    }

    async getRoles(): Promise<RoleOption[]> {
        const response = await apiClient.get<{ roles: RoleOption[] }>('/users/roles');
        return response.data.roles;
    }

    async createUser(data: { email: string; password: string; firstName: string; lastName: string; roleId: string }): Promise<User> {
        const response = await apiClient.post<{ user: User }>('/users', data);
        return response.data.user;
    }

    async updatePermissions(id: string, data: { canEdit?: boolean; allowedSecteurs?: string[] }): Promise<User> {
        const response = await apiClient.put<{ user: User }>(`/users/${id}/permissions`, data);
        return response.data.user;
    }

    async deleteUser(id: string): Promise<void> {
        await apiClient.delete(`/users/${id}`);
    }
}

export default new UserService();
