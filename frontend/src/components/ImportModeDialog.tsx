import React, { useState } from 'react';
import './ImportModeDialog.css';

export type ImportMode = 'add' | 'replace';

interface ImportModeDialogProps {
    open: boolean;
    scope: string; // e.g. "VUE GLOBAL" or a sector name
    onConfirm: (mode: ImportMode) => void;
    onCancel: () => void;
}

const ImportModeDialog: React.FC<ImportModeDialogProps> = ({ open, scope, onConfirm, onCancel }) => {
    const [mode, setMode] = useState<ImportMode>('add');

    if (!open) return null;

    return (
        <div className="import-mode-overlay" onClick={onCancel}>
            <div className="import-mode-dialog" onClick={(e) => e.stopPropagation()}>
                <h3>📤 Mode d'importation</h3>
                <p className="dialog-subtitle">
                    Choisissez comment importer les données pour <strong>{scope}</strong>
                </p>

                <div className="import-mode-options">
                    <label
                        className={`import-mode-option${mode === 'add' ? ' selected' : ''}`}
                        onClick={() => setMode('add')}
                    >
                        <input
                            type="radio"
                            name="importMode"
                            value="add"
                            checked={mode === 'add'}
                            onChange={() => setMode('add')}
                        />
                        <div className="option-text">
                            <span className="option-label">➕ Ajouter aux données existantes</span>
                            <span className="option-desc">
                                Les nouvelles données seront ajoutées sans supprimer les données actuelles.
                            </span>
                        </div>
                    </label>

                    <label
                        className={`import-mode-option${mode === 'replace' ? ' selected' : ''}`}
                        onClick={() => setMode('replace')}
                    >
                        <input
                            type="radio"
                            name="importMode"
                            value="replace"
                            checked={mode === 'replace'}
                            onChange={() => setMode('replace')}
                        />
                        <div className="option-text">
                            <span className="option-label">🔄 Remplacer les données existantes</span>
                            <span className="option-desc">
                                Toutes les données actuelles seront supprimées et remplacées par les nouvelles.
                            </span>
                        </div>
                    </label>
                </div>

                {mode === 'replace' && (
                    <div className="import-mode-warning">
                        ⚠️ Attention : cette action supprimera toutes les données existantes de manière irréversible.
                    </div>
                )}

                <div className="import-mode-actions">
                    <button className="btn-cancel" onClick={onCancel}>Annuler</button>
                    <button
                        className={`btn-confirm${mode === 'replace' ? ' danger' : ''}`}
                        onClick={() => onConfirm(mode)}
                    >
                        {mode === 'replace' ? '🗑️ Remplacer et Importer' : '✅ Ajouter et Importer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModeDialog;
