// frontend/src/components/UserList.jsx
import React from 'react';

const UserList = ({ users, onSelectUser, selectedUserId }) => {
  // Bedingung, wenn keine Benutzer vorhanden sind
  if (!users || users.length === 0) {
    return (
      <div className="user-list" style={{ padding: '10px', color: '#888' }}>
        {/* <<< CAMBIO: Text übersetzt >>> */}
        <p>Keine anderen Benutzer verfügbar.</p>
      </div>
    );
  }

  // Rendern der Benutzerliste
  return (
    <div
      className="user-list"
      style={{
        borderRight: '1px solid #eee', // Etwas hellerer Rand
        padding: '10px',
        minWidth: '180px', // Etwas breiter
        // Höhe sollte durch den übergeordneten Flex-Container in App.jsx gesteuert werden
        // height: 'calc(100vh - 100px)', // Entfernen oder anpassen, wenn nötig
        overflowY: 'auto', // Scrollen, wenn nötig
        backgroundColor: '#f8f9fa' // Passender Hintergrund
      }}
    >
      {/* <<< CAMBIO: Text übersetzt >>> */}
      <h4 style={{ marginTop: '0', marginBottom: '15px', color: '#555' }}>Benutzer</h4>
      <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
        {users.map((user) => (
          <li
            key={user.id}
            onClick={() => onSelectUser(user)}
            style={{
              cursor: 'pointer',
              padding: '10px 12px', // Etwas mehr Padding
              marginBottom: '5px',
              borderRadius: '4px',
              backgroundColor: selectedUserId === user.id ? '#007bff' : 'transparent', // Blauer Hintergrund für Auswahl
              color: selectedUserId === user.id ? 'white' : '#333', // Weißer Text für Auswahl
              fontWeight: selectedUserId === user.id ? 'bold' : 'normal',
              transition: 'background-color 0.2s ease' // Sanfter Übergang
            }}
            // <<< CAMBIO: Text übersetzt >>>
            title={`Chatten mit ${user.username}`} // Tooltip beim Hovern
            // Hover-Effekt (optional, könnte auch in CSS gemacht werden)
            onMouseEnter={(e) => { if (selectedUserId !== user.id) e.currentTarget.style.backgroundColor = '#e9ecef'; }}
            onMouseLeave={(e) => { if (selectedUserId !== user.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {user.username}
          </li>
        ))}
      </ul>
      
    </div>
  );
};

export default UserList;