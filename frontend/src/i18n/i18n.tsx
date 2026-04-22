import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type Lang = 'fr' | 'en';

const translations: Record<Lang, Record<string, string>> = {
    fr: {
        // ── Common ──
        'common.save': 'Enregistrer',
        'common.cancel': 'Annuler',
        'common.delete': 'Supprimer',
        'common.edit': 'Modifier',
        'common.create': 'Créer',
        'common.loading': 'Chargement...',
        'common.saving': 'Sauvegarde...',
        'common.search': 'Rechercher...',
        'common.actions': 'ACTIONS',
        'common.select': '— Sélectionner —',
        'common.logout': '🚪 Déconnexion',
        'common.back_dashboard': '← Retour au Tableau de Bord',
        'common.update_failed': 'Échec de la mise à jour',
        'common.delete_failed': 'Échec de la suppression',
        'common.save_failed': 'Échec de la sauvegarde',
        'common.all_fields_required': 'Tous les champs sont obligatoires',

        // ── Login ──
        'login.title': 'Bienvenue',
        'login.subtitle': 'Connectez-vous au système de gestion POI FTTH',
        'login.email': 'Adresse Email',
        'login.password': 'Mot de passe',
        'login.submit': 'Se connecter',
        'login.submitting': 'Connexion...',
        'login.no_account': "Vous n'avez pas de compte ?",
        'login.create_one': 'Créer un compte',
        'login.failed': 'Échec de la connexion. Veuillez réessayer.',
        'login.choose_section': 'Choisir une section',
        'login.choose_subtitle': 'Sélectionnez la section à consulter',
        'login.rcc_desc': 'Tableau de bord global',
        'login.bein_desc': 'Section BEIN uniquement',

        // ── Register ──
        'register.title': 'Créer un compte',
        'register.subtitle': 'Rejoignez le système de gestion POI FTTH',
        'register.first_name': 'Prénom',
        'register.last_name': 'Nom',
        'register.email': 'Adresse Email',
        'register.role': 'Rôle',
        'register.select_role': '— Sélectionner un rôle —',
        'register.password': 'Mot de passe',
        'register.confirm_password': 'Confirmer le mot de passe',
        'register.submit': 'Créer le compte',
        'register.submitting': 'Création du compte...',
        'register.has_account': 'Vous avez déjà un compte ?',
        'register.sign_in': 'Se connecter',
        'register.passwords_mismatch': 'Les mots de passe ne correspondent pas',
        'register.password_min': 'Le mot de passe doit contenir au moins 6 caractères',
        'register.select_role_error': 'Veuillez sélectionner un rôle',
        'register.failed': "Échec de l'inscription. Veuillez réessayer.",

        // ── Dashboard ──
        'dashboard.title': 'Tableau de Bord — VUE GLOBAL',
        'dashboard.subtitle': "Suivi des études AR — Vue d'ensemble par secteur",
        'dashboard.user_mgmt': '👥 Gestion des Utilisateurs',
        'dashboard.add_sector': '+ Ajouter un secteur',
        'dashboard.total_dossiers': 'Total Dossiers',
        'dashboard.taux_nc': 'Taux Non Conformité',
        'dashboard.dossier_be': 'Dossier Main BE',
        'dashboard.dossier_chaff': 'Dossier Main CHAFF',
        'dashboard.vue_globale': 'Vue Globale par Secteur',
        'dashboard.no_sectors': 'Aucun secteur disponible.',
        'dashboard.dossier_repartition': 'Répartition Dossier Main BE / CHAFF',
        'dashboard.loading': 'Chargement du tableau de bord...',
        'dashboard.modify_sector': 'Modifier',
        'dashboard.add_sector_modal': 'Ajouter un Secteur',
        'dashboard.sector_name': 'Nom du Secteur *',
        'dashboard.sector_placeholder': 'Ex: MEN-ROD, GDP AQ...',
        'dashboard.update': 'Mettre à jour',
        'dashboard.delete_confirm': 'Supprimer le secteur',
        'dashboard.global': 'GLOBAL',
        'dashboard.search_all_dossiers': 'Rechercher un dossier dans tous les secteurs…',
        'dashboard.search_results_title': 'Dossiers trouvés (tous secteurs)',
        'dashboard.search_no_hits': 'Aucun dossier ne correspond à cette recherche.',
        'dashboard.search_col_sector': 'Secteur',
        'dashboard.search_col_preview': 'Aperçu',
        'dashboard.search_col_open': 'Action',
        'dashboard.search_open_sector': 'Ouvrir le secteur',
        'dashboard.search_cap_hint': `Affichage limité aux ${500} premiers résultats. Affinez la recherche si besoin.`,
        'dashboard.dre_ko_nav_hint': 'Voir uniquement les dossiers DRE KO dans ce secteur',

        // ── Sector Detail ──
        'sector.dossiers_title': 'Dossiers',
        'sector.subtitle': 'Détail des dossiers',
        'sector.dossier_count': 'dossier(s)',
        'sector.manage_cols': '⚙️ Gérer les colonnes',
        'sector.add_dossier': '+ Ajouter un dossier',
        'sector.vt_a_faire': 'Nombre VT à faire',
        'sector.nb_dossiers': 'Nb Dossiers',
        'sector.search': 'Rechercher un dossier...',
        'sector.no_dossier': 'Aucun dossier trouvé pour',
        'sector.click_add': 'Cliquez "Ajouter un dossier" pour commencer.',
        'sector.modify_dossier': 'Modifier Dossier',
        'sector.add_dossier_modal': 'Ajouter un Dossier',
        'sector.page': 'Page',
        'sector.update_btn': 'Mettre à jour',
        'sector.create_btn': 'Créer',
        'sector.col_modal_title': '⚙️ Gérer les Colonnes',
        'sector.col_hint': 'Ajoutez, renommez, réordonnez ou supprimez des colonnes. Les modifications s\'appliquent uniquement à ce secteur.',
        'sector.col_name': 'Nom de la colonne',
        'sector.col_type_text': 'Texte',
        'sector.col_type_date': 'Date',
        'sector.col_type_number': 'Nombre',
        'sector.col_type_textarea': 'Zone de texte',
        'sector.col_required': 'Requis',
        'sector.col_add': '+ Ajouter une colonne',
        'sector.col_save': 'Enregistrer les colonnes',
        'sector.col_saving': 'Sauvegarde...',
        'sector.delete_confirm': 'Supprimer ce dossier ?',
        'sector.metric_banner_dre_ko': 'Filtre DRE KO (vue globale)',
        'sector.clear_metric_filter': 'Afficher tous les dossiers',
        'sector.metric_filter_empty':
            'Aucun dossier : aucune colonne liée au DRE (DRE, Date DRE, DRE KO, etc.) ne contient KO, NC ou NON. Vérifiez les noms de colonnes dans les données ou lancez un recalcul.',
        'sector.metric_dre_ko_vue_hint':
            'Écart : la vue globale affichait {{V}} DRE KO (import ou dernier enregistrement). Ici {{F}} dossier(s) avec uniquement KO, NC ou NON dans la colonne DRE (N/C = NC). Après recalcul depuis les dossiers, le total peut se mettre à jour.',

        // ── User Management ──
        'users.title': '👥 Gestion des Utilisateurs',
        'users.subtitle': "Gérez les permissions d'accès et de modification pour chaque utilisateur",
        'users.create_account': '+ Créer un compte',
        'users.total': 'Total Utilisateurs',
        'users.editors': 'Éditeurs',
        'users.read_only': 'Lecture seule',
        'users.full_access': '⚡ Accès complet (Admin)',
        'users.edit_right': 'Droit de modification',
        'users.can_edit': '✅ Peut modifier',
        'users.view_only': '🔒 Lecture seule',
        'users.allowed_sectors': 'Secteurs autorisés',
        'users.all_sectors': '🌐 Tous les secteurs',
        'users.limited_access': '⚠ Accès limité à',
        'users.sectors': 'secteur(s)',
        'users.create_modal_title': '➕ Créer un Compte Utilisateur',
        'users.first_name': 'Prénom *',
        'users.last_name': 'Nom *',
        'users.email': 'Email *',
        'users.password': 'Mot de passe *',
        'users.role': 'Rôle *',
        'users.select_role': '— Sélectionner un rôle —',
        'users.creating': 'Création...',
        'users.create_btn': 'Créer le compte',
        'users.loading': 'Chargement des utilisateurs...',
        'users.delete_confirm': 'Voulez-vous vraiment supprimer',
        'users.delete_user': 'Supprimer cet utilisateur',
        'users.check_all': '☑ Cocher tout',
        'users.uncheck_all': '☐ Décocher tout',
    },
    en: {
        // ── Common ──
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.create': 'Create',
        'common.loading': 'Loading...',
        'common.saving': 'Saving...',
        'common.search': 'Search...',
        'common.actions': 'ACTIONS',
        'common.select': '— Select —',
        'common.logout': '🚪 Logout',
        'common.back_dashboard': '← Back to Dashboard',
        'common.update_failed': 'Update failed',
        'common.delete_failed': 'Delete failed',
        'common.save_failed': 'Save failed',
        'common.all_fields_required': 'All fields are required',

        // ── Login ──
        'login.title': 'Welcome Back',
        'login.subtitle': 'Sign in to POI FTTH Management System',
        'login.email': 'Email Address',
        'login.password': 'Password',
        'login.submit': 'Sign In',
        'login.submitting': 'Signing in...',
        'login.no_account': "Don't have an account?",
        'login.create_one': 'Create one',
        'login.failed': 'Login failed. Please try again.',
        'login.choose_section': 'Choose a section',
        'login.choose_subtitle': 'Select which section to view',
        'login.rcc_desc': 'Global Dashboard',
        'login.bein_desc': 'BEIN Section only',

        // ── Register ──
        'register.title': 'Create Account',
        'register.subtitle': 'Join POI FTTH Management System',
        'register.first_name': 'First Name',
        'register.last_name': 'Last Name',
        'register.email': 'Email Address',
        'register.role': 'Role',
        'register.select_role': '— Select a role —',
        'register.password': 'Password',
        'register.confirm_password': 'Confirm Password',
        'register.submit': 'Create Account',
        'register.submitting': 'Creating account...',
        'register.has_account': 'Already have an account?',
        'register.sign_in': 'Sign in',
        'register.passwords_mismatch': 'Passwords do not match',
        'register.password_min': 'Password must be at least 6 characters',
        'register.select_role_error': 'Please select a role',
        'register.failed': 'Registration failed. Please try again.',

        // ── Dashboard ──
        'dashboard.title': 'Dashboard — GLOBAL VIEW',
        'dashboard.subtitle': 'Study tracking AR — Overview by sector',
        'dashboard.user_mgmt': '👥 User Management',
        'dashboard.add_sector': '+ Add Sector',
        'dashboard.total_dossiers': 'Total Files',
        'dashboard.taux_nc': 'Non-Compliance Rate',
        'dashboard.dossier_be': 'Files Main BE',
        'dashboard.dossier_chaff': 'Files Main CHAFF',
        'dashboard.vue_globale': 'Global View by Sector',
        'dashboard.no_sectors': 'No sectors available.',
        'dashboard.dossier_repartition': 'Distribution Files Main BE / CHAFF',
        'dashboard.loading': 'Loading dashboard...',
        'dashboard.modify_sector': 'Update',
        'dashboard.add_sector_modal': 'Add a Sector',
        'dashboard.sector_name': 'Sector Name *',
        'dashboard.sector_placeholder': 'Ex: MEN-ROD, GDP AQ...',
        'dashboard.update': 'Update',
        'dashboard.delete_confirm': 'Delete sector',
        'dashboard.global': 'GLOBAL',
        'dashboard.search_all_dossiers': 'Search a dossier across all sectors…',
        'dashboard.search_results_title': 'Matching dossiers (all sectors)',
        'dashboard.search_no_hits': 'No dossier matches this search.',
        'dashboard.search_col_sector': 'Sector',
        'dashboard.search_col_preview': 'Preview',
        'dashboard.search_col_open': 'Action',
        'dashboard.search_open_sector': 'Open sector',
        'dashboard.search_cap_hint': `Showing up to ${500} results. Refine your search if needed.`,
        'dashboard.dre_ko_nav_hint': 'Show only DRE KO dossiers in this sector',

        // ── Sector Detail ──
        'sector.dossiers_title': 'Files',
        'sector.subtitle': 'File details',
        'sector.dossier_count': 'file(s)',
        'sector.manage_cols': '⚙️ Manage Columns',
        'sector.add_dossier': '+ Add File',
        'sector.vt_a_faire': 'VT To Do Count',
        'sector.nb_dossiers': 'Total Files',
        'sector.search': 'Search a file...',
        'sector.no_dossier': 'No file found for',
        'sector.click_add': 'Click "Add File" to get started.',
        'sector.modify_dossier': 'Edit File',
        'sector.add_dossier_modal': 'Add a File',
        'sector.page': 'Page',
        'sector.update_btn': 'Update',
        'sector.create_btn': 'Create',
        'sector.col_modal_title': '⚙️ Manage Columns',
        'sector.col_hint': 'Add, rename, reorder or delete columns. Changes apply only to this sector.',
        'sector.col_name': 'Column name',
        'sector.col_type_text': 'Text',
        'sector.col_type_date': 'Date',
        'sector.col_type_number': 'Number',
        'sector.col_type_textarea': 'Textarea',
        'sector.col_required': 'Required',
        'sector.col_add': '+ Add a column',
        'sector.col_save': 'Save columns',
        'sector.col_saving': 'Saving...',
        'sector.delete_confirm': 'Delete this file?',
        'sector.metric_banner_dre_ko': 'DRE KO filter (global view)',
        'sector.clear_metric_filter': 'Show all dossiers',
        'sector.metric_filter_empty':
            'No dossier: no DRE-related column (DRE, Date DRE, DRE KO, etc.) contains KO, NC or NON. Check column names in the data or run a recalc.',
        'sector.metric_dre_ko_vue_hint':
            'Difference: the global view showed {{V}} DRE KO (import or last saved total). Here {{F}} dossier(s) with only KO, NC or NON in the DRE column (N/C counts as NC). After a recalc from dossiers, the total may update.',

        // ── User Management ──
        'users.title': '👥 User Management',
        'users.subtitle': 'Manage access and editing permissions for each user',
        'users.create_account': '+ Create Account',
        'users.total': 'Total Users',
        'users.editors': 'Editors',
        'users.read_only': 'Read Only',
        'users.full_access': '⚡ Full Access (Admin)',
        'users.edit_right': 'Edit Permission',
        'users.can_edit': '✅ Can edit',
        'users.view_only': '🔒 Read only',
        'users.allowed_sectors': 'Allowed Sectors',
        'users.all_sectors': '🌐 All sectors',
        'users.limited_access': '⚠ Limited access to',
        'users.sectors': 'sector(s)',
        'users.create_modal_title': '➕ Create User Account',
        'users.first_name': 'First Name *',
        'users.last_name': 'Last Name *',
        'users.email': 'Email *',
        'users.password': 'Password *',
        'users.role': 'Role *',
        'users.select_role': '— Select a role —',
        'users.creating': 'Creating...',
        'users.create_btn': 'Create Account',
        'users.loading': 'Loading users...',
        'users.delete_confirm': 'Are you sure you want to delete',
        'users.delete_user': 'Delete this user',
        'users.check_all': '☑ Check All',
        'users.uncheck_all': '☐ Uncheck All',
    },
};

interface LanguageContextType {
    lang: Lang;
    setLang: (lang: Lang) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
    lang: 'fr',
    setLang: () => { },
    t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [lang, setLangState] = useState<Lang>(() => {
        const saved = localStorage.getItem('app_lang');
        return (saved === 'en' || saved === 'fr') ? saved : 'fr';
    });

    const setLang = useCallback((newLang: Lang) => {
        setLangState(newLang);
        localStorage.setItem('app_lang', newLang);
    }, []);

    const t = useCallback((key: string): string => {
        return translations[lang][key] || key;
    }, [lang]);

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);

/** Small toggle button component for switching language */
export const LanguageToggle: React.FC = () => {
    const { lang, setLang } = useLanguage();
    return (
        <button
            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.45rem 0.9rem',
                background: '#fff3e0',
                color: '#fb8c00',
                border: '1.5px solid #ffe0b2',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '0.02em',
            }}
            title={lang === 'fr' ? 'Switch to English' : 'Passer en Français'}
        >
            {lang === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR'}
        </button>
    );
};

export default LanguageContext;
