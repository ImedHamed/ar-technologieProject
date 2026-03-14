import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage, LanguageToggle } from '../../i18n/i18n';
import { ThemeToggle } from '../../theme/ThemeContext';
import './AuthPages.css';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showChoice, setShowChoice] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            setShowChoice(true);
        } catch (err: any) {
            setError(err.response?.data?.error || t('login.failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleChoice = (choice: 'rcc' | 'bein') => {
        if (choice === 'rcc') {
            navigate('/admin/dashboard');
        } else {
            navigate('/admin/secteur/BEIN');
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
                        <h1 className="auth-title">{t('login.title')}</h1>
                        <p className="auth-subtitle">{t('login.subtitle')}</p>
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

                    <div className="form-group">
                        <label htmlFor="email">{t('login.email')}</label>
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
                        <label htmlFor="password">{t('login.password')}</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner-small"></span>
                                {t('login.submitting')}
                            </>
                        ) : (
                            t('login.submit')
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        {t('login.no_account')}{' '}
                        <Link to="/register" className="auth-link">
                            {t('login.create_one')}
                        </Link>
                    </p>
                </div>
            </div>

            {/* RCC / BEIN Choice Popup */}
            {showChoice && (
                <div className="choice-overlay">
                    <div className="choice-card">
                        <h2 className="choice-title">{t('login.choose_section')}</h2>
                        <p className="choice-subtitle">{t('login.choose_subtitle')}</p>
                        <div className="choice-buttons">
                            <button className="choice-btn choice-rcc" onClick={() => handleChoice('rcc')}>
                                <span className="choice-icon">📊</span>
                                <span className="choice-label">RCC</span>
                                <span className="choice-desc">{t('login.rcc_desc')}</span>
                            </button>
                            <button className="choice-btn choice-bein" onClick={() => handleChoice('bein')}>
                                <span className="choice-icon">📋</span>
                                <span className="choice-label">BEIN</span>
                                <span className="choice-desc">{t('login.bein_desc')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginPage;
