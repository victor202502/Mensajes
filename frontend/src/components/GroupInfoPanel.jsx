// frontend/src/components/GroupInfoPanel.jsx
// NEU (Phase 4): zentrale Verwaltungsoberfläche einer Gruppe.
// Reine Präsentationskomponente — kompletter Datenfluss kommt als Props von
// App.jsx, gleiches Muster wie ContactsPanel.
import React, { useState, useEffect } from 'react';
import { FiX, FiEdit2, FiUserPlus, FiUserMinus, FiLogOut, FiTrash2, FiShield, FiUser } from 'react-icons/fi';
import Avatar from './Avatar';
import './ContactsPanel.css'; // Wiederverwendung von Overlay/Panel/Listen/Buttons-Styles
import './AuthForm.css'; // Wiederverwendung von .form-input
import './GroupInfoPanel.css'; // nur die gruppenspezifischen Ergänzungen

// Rein visuelle Hilfsfunktion (client-seitig, nur für Anzeigezwecke — die
// eigentliche Durchsetzung passiert immer serverseitig).
const canKickLocally = (actorRole, targetRole) => {
  if (actorRole === 'owner') return targetRole !== 'owner';
  if (actorRole === 'moderator') return targetRole === 'member';
  return false;
};
const canManageLocally = (role) => role === 'owner' || role === 'moderator';

const ROLE_LABELS = { owner: 'Owner', moderator: 'Moderator', member: 'Mitglied' };

const GroupInfoPanel = ({
  isOpen,
  onClose,
  group,
  contacts,
  onEditGroup,
  onInviteMember,
  onKickMember,
  onChangeRole,
  onLeaveGroup,
  onDeleteGroup,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [emojiDraft, setEmojiDraft] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (group) {
      setNameDraft(group.name || '');
      setDescriptionDraft(group.description || '');
      setEmojiDraft(group.avatarEmoji || '');
    }
    setIsEditing(false);
    setIsInviting(false);
  }, [group?.id]);

  if (!isOpen || !group) return null;

  const canManage = canManageLocally(group.myRole);
  const isOwner = group.myRole === 'owner';
  const memberIds = new Set(group.members.map((m) => m.id));
  const invitableContacts = (contacts || []).filter((c) => !memberIds.has(c.id));

  const handleSaveEdit = () => {
    onEditGroup(group.id, {
      name: nameDraft.trim(),
      description: descriptionDraft.trim(),
      avatarEmoji: emojiDraft.trim(),
    });
    setIsEditing(false);
  };

  return (
    <div className="contacts-overlay" onClick={onClose}>
      <div className="contacts-panel group-info-panel" onClick={(e) => e.stopPropagation()}>
        <div className="contacts-panel-header">
          <h3>Gruppeninfo</h3>
          <button className="contacts-close-btn" onClick={onClose} aria-label="Schließen">
            <FiX />
          </button>
        </div>

        <div className="contacts-panel-body">
          <div className="group-info-summary">
            <Avatar name={group.name} emoji={group.avatarEmoji} size="lg" />
            {isEditing ? (
              <div className="group-edit-form">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Gruppenname"
                  className="form-input group-edit-input"
                  maxLength={100}
                />
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  placeholder="Beschreibung (optional)"
                  className="form-input group-edit-input group-edit-textarea"
                  rows={2}
                />
                <input
                  type="text"
                  value={emojiDraft}
                  onChange={(e) => setEmojiDraft(e.target.value.slice(0, 2))}
                  placeholder="Emoji (optional, z. B. 🚀)"
                  className="form-input group-edit-input"
                />
                <div className="group-edit-actions">
                  <button type="button" className="btn-ghost-sm" onClick={() => setIsEditing(false)}>Abbrechen</button>
                  <button type="button" className="btn-request-sm" onClick={handleSaveEdit}>Speichern</button>
                </div>
              </div>
            ) : (
              <>
                <h4 className="group-info-name">{group.name}</h4>
                {group.description && <p className="group-info-description">{group.description}</p>}
                {canManage && (
                  <button type="button" className="btn-ghost-sm group-edit-trigger" onClick={() => setIsEditing(true)}>
                    <FiEdit2 /> Bearbeiten
                  </button>
                )}
              </>
            )}
          </div>

          <div className="contacts-section">
            <h4>{group.members.length} {group.members.length === 1 ? 'Mitglied' : 'Mitglieder'}</h4>
            <ul className="contacts-list">
              {group.members.map((member) => (
                <li key={member.id} className="contacts-list-item">
                  <Avatar name={member.username} size="sm" />
                  <span className="contacts-list-name">{member.username}</span>
                  <span className={`group-role-badge group-role-${member.role}`}>
                    {member.role === 'owner' && <FiShield />}
                    {member.role === 'moderator' && <FiShield />}
                    {member.role === 'member' && <FiUser />}
                    {ROLE_LABELS[member.role]}
                  </span>
                  {isOwner && member.role !== 'owner' && (
                    <button
                      type="button"
                      className="btn-icon-sm"
                      title={member.role === 'moderator' ? 'Zu Mitglied degradieren' : 'Zu Moderator befördern'}
                      onClick={() => onChangeRole(group.id, member.id, member.role === 'moderator' ? 'member' : 'moderator')}
                    >
                      <FiShield />
                    </button>
                  )}
                  {canKickLocally(group.myRole, member.role) && (
                    <button
                      type="button"
                      className="btn-icon-sm"
                      title="Entfernen"
                      onClick={() => onKickMember(group.id, member.id)}
                    >
                      <FiUserMinus />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {canManage && (
            <div className="contacts-section">
              <h4>Mitglied einladen</h4>
              {!isInviting ? (
                <button type="button" className="btn-ghost-sm" onClick={() => setIsInviting(true)}>
                  <FiUserPlus /> Kontakt hinzufügen
                </button>
              ) : invitableContacts.length === 0 ? (
                <p className="contacts-empty">Alle deine Kontakte sind bereits in dieser Gruppe.</p>
              ) : (
                <ul className="contacts-list">
                  {invitableContacts.map((c) => (
                    <li key={c.id} className="contacts-list-item">
                      <Avatar name={c.username} size="sm" />
                      <span className="contacts-list-name">{c.username}</span>
                      <button type="button" className="btn-request-sm" onClick={() => onInviteMember(group.id, c.id)}>
                        Hinzufügen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="contacts-section group-info-danger-zone">
            <button type="button" className="btn-ghost-sm" onClick={() => onLeaveGroup(group.id)}>
              <FiLogOut /> Gruppe verlassen
            </button>
            {isOwner && (
              <button type="button" className="btn-ghost-sm group-danger-btn" onClick={() => onDeleteGroup(group.id)}>
                <FiTrash2 /> Gruppe löschen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoPanel;
