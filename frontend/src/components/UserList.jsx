// frontend/src/components/UserList.jsx
import React from 'react';
import Avatar from './Avatar';
import './UserList.css';

const UserList = ({ users, onSelectUser, selectedUserId }) => {
  // Bedingung, wenn keine Benutzer vorhanden sind
  if (!users || users.length === 0) {
    return (
      <div className="user-list">
        <div className="user-list-header">
          <h4>Benutzer</h4>
        </div>
        {/* <<< CAMBIO: Text übersetzt >>> */}
        <p className="user-list-empty">Keine anderen Benutzer verfügbar.</p>
      </div>
    );
  }

  // Rendern der Benutzerliste
  return (
    <div className="user-list">
      {/* <<< CAMBIO: Text übersetzt >>> */}
      <div className="user-list-header">
        <h4>Benutzer</h4>
      </div>
      <ul className="user-list-items">
        {users.map((user) => (
          <li
            key={user.id}
            onClick={() => onSelectUser(user)}
            className={`user-list-item ${selectedUserId === user.id ? 'is-selected' : ''}`}
            // <<< CAMBIO: Text übersetzt >>>
            title={`Chatten mit ${user.username}`} // Tooltip beim Hovern
          >
            <Avatar name={user.username} size="md" />
            <span className="user-list-item-name">{user.username}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserList;
