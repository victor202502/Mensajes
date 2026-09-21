// frontend/src/components/CreateGroupModal.jsx
// NEU (Phase 4): Dialog zum Erstellen einer neuen Gruppe.
import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import Avatar from './Avatar';
import './ContactsPanel.css'; // Wiederverwendung von Overlay/Panel/Listen-Styles
import './AuthForm.css'; // Wiederverwendung von .form-input/.form-submit-btn
import './CreateGroupModal.css';

const CreateGroupModal = ({ isOpen, onClose, contacts, onCreateGroup }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  if (!isOpen) return null;

  const toggleMember = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setEmoji('');
    setSelectedIds([]);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    onCreateGroup({
      name: name.trim(),
      description: description.trim(),
      avatarEmoji: emoji.trim(),
      memberIds: selectedIds,
    });
    handleClose();
  };

  return (
    <div className="contacts-overlay" onClick={handleClose}>
      <div className="contacts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="contacts-panel-header">
          <h3>Neue Gruppe</h3>
          <button className="contacts-close-btn" onClick={handleClose} aria-label="Schließen">
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="contacts-panel-body create-group-form">
          <div className="form-group">
            <label htmlFor="create-group-name">Gruppenname</label>
            <input
              id="create-group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              maxLength={100}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="create-group-description">Beschreibung (optional)</label>
            <input
              id="create-group-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="create-group-emoji">Emoji (optional)</label>
            <input
              id="create-group-emoji"
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              className="form-input"
              placeholder="🚀"
            />
          </div>

          {contacts && contacts.length > 0 && (
            <div className="contacts-section create-group-members">
              <h4>Mitglieder hinzufügen</h4>
              <ul className="contacts-list">
                {contacts.map((c) => (
                  <li
                    key={c.id}
                    className={`contacts-list-item create-group-member-item ${selectedIds.includes(c.id) ? 'is-selected' : ''}`}
                    onClick={() => toggleMember(c.id)}
                  >
                    <Avatar name={c.username} size="sm" />
                    <span className="contacts-list-name">{c.username}</span>
                    <span className={`create-group-checkbox ${selectedIds.includes(c.id) ? 'is-checked' : ''}`} aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="submit" className="form-submit-btn" disabled={name.trim().length < 2}>
            Gruppe erstellen
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
