import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage, LanguageToggle } from '../../i18n/i18n';
import { ThemeToggle } from '../../theme/ThemeContext';
import userService from '../../services/user.service';
import type { RoleOption } from '../../services/user.service';
import './AuthPages.css';

const RegisterPage: React.FC = () => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [roleId, setRoleId] = useState('');
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();
    const { t } = useLanguage();

    useEffect(() => {
        userService.getRoles().then((r) => setRoles(r.filter((role) => role.name !== 'Admin'))).catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError(t('register.passwords_mismatch'));
            return;
        }

        if (password.length < 6) {
            setError(t('register.password_min'));
            return;
        }

        if (!roleId) {
            setError(t('register.select_role_error'));
            return;
        }

        setLoading(true);

        try {
            await register(email, password, firstName, lastName, roleId);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || t('register.failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="auth-card">
                <div className="auth-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="auth-title">{t('register.title')}</h1>
                        <p className="auth-subtitle">{t('register.subtitle')}</p>
                    </div>
                    <LanguageToggle />
                    <ThemeToggle />
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="error-message">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="firstName">{t('register.first_name')}</label>
                            <input
                                id="firstName"
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="John"
                                required
                                autoComplete="given-name"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="lastName">{t('register.last_name')}</label>
                            <input
                                id="lastName"
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Doe"
                                required
                                autoComplete="family-name"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">{t('register.email')}</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="role">{t('register.role')}</label>
                        <select
                            id="role"
                            value={roleId}
                            onChange={(e) => setRoleId(e.target.value)}
                            required
                            className="auth-select"
                        >
                            <option value="">{t('register.select_role')}</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">{t('register.password')}</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="new-password"
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">{t('register.confirm_password')}</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="new-password"
                            minLength={6}
                        />
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner-small"></span>
                                {t('register.submitting')}
                            </>
                        ) : (
                            t('register.submit')
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        {t('register.has_account')}{' '}
                        <Link to="/login" className="auth-link">
                            {t('register.sign_in')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
