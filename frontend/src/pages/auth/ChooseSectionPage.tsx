import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage, LanguageToggle } from '../../i18n/i18n';
import { ThemeToggle } from '../../theme/ThemeContext';
import suiviEtudeService from '../../services/suivi-etude.service';
import './AuthPages.css';

function normalizeSecteurName(raw: unknown): string {
    if (raw == null) return '';
    let s = String(raw).replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ').trim();
    if (!s) return '';
    if (s.startsWith('=')) {
        const quoted = s.match(/^=\s*'([^']+?)'\s*!?.*$/);
        if (quoted) {
            s = quoted[1];
        } else {
            const unquoted = s.match(/^=\s*([^!]+?)\s*!?.*$/);
            if (unquoted) s = unquoted[1];
        }
    }
    s = s.replace(/^['"]+|['"]+$/g, '');
    s = s.replace(/!+$/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s.toUpperCase();
}

const ChooseSectionPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [showBeinChoices, setShowBeinChoices] = React.useState(false);

    const handleChoice = (choice: 'rcc' | 'bein') => {
        if (choice === 'rcc') {
            navigate('/admin/dashboard');
        } else {
            setShowBeinChoices((prev) => !prev);
        }
    };

    const handleBeinChoice = async (target: 'bein' | 'beinPayer') => {
        const wanted = target === 'bein' ? 'BEIN' : 'BEIN A PAYER';
        try {
            const data = await suiviEtudeService.getAll();
            const exact = data.rows.find((r) => normalizeSecteurName(r.secteur) === wanted);
            if (exact) {
                navigate(`/admin/secteur/${encodeURIComponent(exact.secteur)}`);
                return;
            }
        } catch {
            // fallback below
        }
        navigate(`/admin/secteur/${encodeURIComponent(wanted)}`);
    };

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="choice-card" style={{ position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                    <LanguageToggle />
                    <ThemeToggle />
                </div>
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

                {showBeinChoices && (
                    <div className="bein-choice-panel">
                        <p className="bein-choice-title">{t('login.bein_choice_prompt')}</p>
                        <div className="bein-choice-buttons">
                            <button
                                type="button"
                                className="bein-subchoice-btn"
                                onClick={() => { void handleBeinChoice('bein'); }}
                            >
                                <span className="bein-subchoice-label">{t('login.bein_only_label')}</span>
                                <span className="bein-subchoice-desc">{t('login.bein_desc')}</span>
                            </button>
                            <button
                                type="button"
                                className="bein-subchoice-btn bein-subchoice-secondary"
                                onClick={() => { void handleBeinChoice('beinPayer'); }}
                            >
                                <span className="bein-subchoice-label">{t('login.bein_a_payer_label')}</span>
                                <span className="bein-subchoice-desc">{t('login.bein_a_payer_desc')}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChooseSectionPage;
