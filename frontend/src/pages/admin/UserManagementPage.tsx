import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../i18n/i18n';
import userService from '../../services/user.service';
import type { RoleOption } from '../../services/user.service';
import suiviEtudeService from '../../services/suivi-etude.service';
import type { User } from '../../types';
import './UserManagementPage.css';

const UserManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const { t } = useLanguage();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [secteurs, setSecteurs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    // Create user modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({ email: '', password: '', firstName: '', lastName: '', roleId: '' });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!isAdmin) {
            navigate('/admin/dashboard');
            return;
        }
        fetchData();
    }, [isAdmin, navigate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersData, secteursData, rolesData] = await Promise.all([
                userService.getAll(),
                suiviEtudeService.getAll(),
                userService.getRoles(),
            ]);
            setUsers(usersData);
            setSecteurs(secteursData.rows.map((r) => r.secteur));
            setRoles(rolesData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleCanEdit = async (user: User) => {
        setSaving(user.id);
        try {
            const updated = await userService.updatePermissions(user.id, {
                canEdit: !user.canEdit,
            });
            setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
        } catch (error) {
            alert(t('common.update_failed'));
        } finally {
            setSaving(null);
        }
    };

    const handleSecteurChange = async (user: User, secteur: string, checked: boolean) => {
        const currentSecteurs = user.allowedSecteurs || [];
        const newSecteurs = checked
            ? [...currentSecteurs, secteur]
            : currentSecteurs.filter((s) => s !== secteur);

        setSaving(user.id);
        try {
            const updated = await userService.updatePermissions(user.id, {
                allowedSecteurs: newSecteurs,
            });
            setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
        } catch (error) {
            alert(t('common.update_failed'));
        } finally {
            setSaving(null);
        }
    };

    const handleCheckAllSecteurs = async (user: User) => {
        const allChecked = secteurs.every(s => (user.allowedSecteurs || []).includes(s));
        const newSecteurs = allChecked ? [] : [...secteurs];
        setSaving(user.id);
        try {
            const updated = await userService.updatePermissions(user.id, {
                allowedSecteurs: newSecteurs,
            });
            setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
        } catch (error) {
            alert(t('common.update_failed'));
        } finally {
            setSaving(null);
        }
    };

    // Create user
    const handleOpenCreate = () => {
        setCreateForm({ email: '', password: '', firstName: '', lastName: '', roleId: roles.length > 0 ? roles[0].id : '' });
        setShowCreateModal(true);
    };

    const handleCreateFormChange = (field: string, value: string) => {
        setCreateForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.email || !createForm.password || !createForm.firstName || !createForm.lastName || !createForm.roleId) {
            alert(t('common.all_fields_required'));
            return;
        }
        setCreating(true);
        try {
            await userService.createUser(createForm);
            setShowCreateModal(false);
            fetchData();
        } catch (error: any) {
            alert(error.response?.data?.error || 'Échec de la création');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteUser = async (user: User) => {
        const confirmed = window.confirm(
            `${t('users.delete_confirm')} ${user.firstName} ${user.lastName} ?`
        );
        if (!confirmed) return;

        setSaving(user.id);
        try {
            await userService.deleteUser(user.id);
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
        } catch (error: any) {
            alert(error.response?.data?.error || t('common.update_failed'));
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return <div className="loading-dashboard">{t('users.loading')}</div>;
    }

    return (
        <div className="user-management-page">
            <div className="user-mgmt-header">
                <div>
                    <span className="back-link" onClick={() => navigate('/admin/dashboard')}>
                        {t('common.back_dashboard')}
                    </span>
                    <h1>{t('users.title')}</h1>
                    <p>{t('users.subtitle')}</p>
                </div>
                <div className="header-actions">
                    <button className="btn-create-user" onClick={handleOpenCreate}>
                        {t('users.create_account')}
                    </button>
                </div>
            </div>

            <div className="user-mgmt-stats">
                <div className="user-stat-card">
                    <span className="stat-label">{t('users.total')}</span>
                    <span className="stat-value">{users.length}</span>
                </div>
                <div className="user-stat-card">
                    <span className="stat-label">{t('users.editors')}</span>
                    <span className="stat-value">{users.filter((u) => u.canEdit).length}</span>
                </div>
                <div className="user-stat-card">
                    <span className="stat-label">{t('users.read_only')}</span>
                    <span className="stat-value">{users.filter((u) => !u.canEdit).length}</span>
                </div>
            </div>

            <div className="user-list">
                {users.map((user) => {
                    const isAdminUser = ['Admin', 'admin', 'ADMIN'].includes(user.role?.name || '');
                    return (
                        <div key={user.id} className={`user-card ${saving === user.id ? 'saving' : ''}`}>
                            <div className="user-info">
                                <div className="user-avatar">
                                    {user.firstName[0]}{user.lastName[0]}
                                </div>
                                <div className="user-details">
                                    <h3>{user.firstName} {user.lastName}</h3>
                                    <p className="user-email">{user.email}</p>
                                    <span className={`user-role-badge ${isAdminUser ? 'admin' : 'viewer'}`}>
                                        {user.role?.name || 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {!isAdminUser && (
                                <button
                                    className="btn-delete-user"
                                    onClick={() => handleDeleteUser(user)}
                                    disabled={saving === user.id}
                                    title={t('users.delete_user')}
                                >
                                    🗑
                                </button>
                            )}

                            {isAdminUser ? (
                                <div className="user-perms">
                                    <p className="admin-notice">{t('users.full_access')}</p>
                                </div>
                            ) : (
                                <div className="user-perms">
                                    <div className="perm-section">
                                        <h4>{t('users.edit_right')}</h4>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={user.canEdit}
                                                onChange={() => handleToggleCanEdit(user)}
                                                disabled={saving === user.id}
                                            />
                                            <span className="toggle-slider"></span>
                                            <span className="toggle-label">
                                                {user.canEdit ? t('users.can_edit') : t('users.view_only')}
                                            </span>
                                        </label>
                                    </div>

                                    <div className="perm-section">
                                        <h4>{t('users.allowed_sectors')}</h4>
                                        <div className="secteur-controls">
                                            <button
                                                className={`btn-all-secteurs ${secteurs.every(s => (user.allowedSecteurs || []).includes(s)) ? 'active' : ''}`}
                                                onClick={() => handleCheckAllSecteurs(user)}
                                                disabled={saving === user.id}
                                            >
                                                {t('users.all_sectors')}
                                            </button>
                                        </div>
                                        <div className="secteur-checkboxes">
                                            {secteurs.map((s) => (
                                                <label key={s} className="secteur-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={(user.allowedSecteurs || []).includes(s)}
                                                        onChange={(e) => handleSecteurChange(user, s, e.target.checked)}
                                                        disabled={saving === user.id}
                                                    />
                                                    <span>{s}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {user.allowedSecteurs && user.allowedSecteurs.length > 0 && (
                                            <p className="secteur-hint">
                                                {t('users.limited_access')} {user.allowedSecteurs.length} {t('users.sectors')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="dos-modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="dos-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>{t('users.create_modal_title')}</h3>
                        <form onSubmit={handleCreateSubmit}>
                            <div className="create-form-grid">
                                <div className="create-form-group">
                                    <label htmlFor="create-firstName">{t('users.first_name')}</label>
                                    <input
                                        type="text"
                                        id="create-firstName"
                                        value={createForm.firstName}
                                        onChange={(e) => handleCreateFormChange('firstName', e.target.value)}
                                        placeholder="Prénom"
                                        required
                                    />
                                </div>
                                <div className="create-form-group">
                                    <label htmlFor="create-lastName">{t('users.last_name')}</label>
                                    <input
                                        type="text"
                                        id="create-lastName"
                                        value={createForm.lastName}
                                        onChange={(e) => handleCreateFormChange('lastName', e.target.value)}
                                        placeholder="Nom"
                                        required
                                    />
                                </div>
                                <div className="create-form-group full-width">
                                    <label htmlFor="create-email">{t('users.email')}</label>
                                    <input
                                        type="email"
                                        id="create-email"
                                        value={createForm.email}
                                        onChange={(e) => handleCreateFormChange('email', e.target.value)}
                                        placeholder="utilisateur@email.com"
                                        required
                                    />
                                </div>
                                <div className="create-form-group">
                                    <label htmlFor="create-password">{t('users.password')}</label>
                                    <input
                                        type="password"
                                        id="create-password"
                                        value={createForm.password}
                                        onChange={(e) => handleCreateFormChange('password', e.target.value)}
                                        placeholder="Mot de passe"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div className="create-form-group">
                                    <label htmlFor="create-role">{t('users.role')}</label>
                                    <select
                                        id="create-role"
                                        value={createForm.roleId}
                                        onChange={(e) => handleCreateFormChange('roleId', e.target.value)}
                                        required
                                    >
                                        <option value="">{t('users.select_role')}</option>
                                        {roles.map((r) => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="dos-modal-actions">
                                <button type="button" className="dos-btn-cancel" onClick={() => setShowCreateModal(false)} disabled={creating}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="dos-btn-save" disabled={creating}>
                                    {creating ? t('users.creating') : t('users.create_btn')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagementPage;
