// frontend/src/App.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { FiLogOut, FiMessageCircle } from 'react-icons/fi';
import LoginForm from './components/LoginForm'; // Stelle sicher, dass die Texte hier auch übersetzt sind
import RegisterForm from './components/RegisterForm'; // Stelle sicher, dass die Texte hier auch übersetzt sind
import ConversationList from './components/ConversationList'; // NEU (Phase 1): ersetzt UserList
import ChatWindow from './components/ChatWindow'; // Übersetze Texte hier bei Bedarf
import ContactsPanel from './components/ContactsPanel'; // NEU (Phase 2)
import SettingsMenu from './components/SettingsMenu'; // NEU (Phase 3)
import GroupChatWindow from './components/GroupChatWindow'; // NEU (Phase 4)
import GroupInfoPanel from './components/GroupInfoPanel'; // NEU (Phase 4)
import CreateGroupModal from './components/CreateGroupModal'; // NEU (Phase 4)
import ForwardMessageModal from './components/ForwardMessageModal'; // NEU (Phase 5)
import FavoritesPanel from './components/FavoritesPanel'; // NEU (Phase 5)
import GlobalSearchModal from './components/GlobalSearchModal'; // NEU (Phase 5)
import Avatar from './components/Avatar';
import { playNotificationSound } from './utils/notificationSound'; // NEU (Phase 3)
import './App.css';

// Configuración de URLs
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const SOCKET_URL = API_URL;

function App() {
  // --- Estados del Componente ---
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState(''); // Dieser Fehler kommt von LoginForm/RegisterForm oder Backend

  // Estados específicos del Chat
  const [usersList, setUsersList] = useState([]);
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [allMessages, setAllMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  // <<< CAMBIO: Estado inicial traducido >>>
  const [socketStatusMessage, setSocketStatusMessage] = useState('Getrennt.');
  const socketRef = useRef(null);

  // --- NEU (Phase 1): Zustände für die Konversationsliste ---
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [unreadCounts, setUnreadCounts] = useState({}); // { [partnerId]: count }
  // Ref, damit handleNewMessage (innerhalb des Socket-Effekts) immer den aktuell
  // geöffneten Chat kennt, OHNE selectedChatUser in die Abhängigkeiten des
  // Socket-Effekts aufzunehmen (das würde sonst bei jeder Auswahl die
  // bestehende Socket-Verbindung neu aufbauen).
  const selectedChatUserRef = useRef(null);

  // --- NEU (Phase 2): Zustände für das Kontakt-System ---
  const [contacts, setContacts] = useState([]); // akzeptierte Kontakte [{id, username}]
  const [incomingRequests, setIncomingRequests] = useState([]); // an mich gerichtete Anfragen
  const [outgoingRequests, setOutgoingRequests] = useState([]); // von mir gesendete Anfragen
  const [blockedUsers, setBlockedUsers] = useState([]); // von mir blockierte Benutzer
  const [isContactsPanelOpen, setIsContactsPanelOpen] = useState(false);

  // --- NEU (Phase 3): Zustände für Tipp-Anzeige, Benachrichtigungen und Sound ---
  const [typingUserId, setTypingUserId] = useState(null); // wer mir gerade schreibt (oder null)
  const typingTimeoutRef = useRef(null);
  // Geräte-/Browser-Einstellungen — bewusst NICHT an den Login gebunden, bleiben
  // deshalb auch nach handleLogout erhalten (wie eine Lautstärkeeinstellung).
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => (
    localStorage.getItem('notificationsEnabled') === 'true' &&
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  ));
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('soundEnabled') === 'true');
  // Refs, damit handleNewMessage (innerhalb des Socket-Effekts) immer die aktuellen
  // Einstellungen kennt, ohne sie in die Abhängigkeiten des Socket-Effekts
  // aufzunehmen (gleiches Muster wie selectedChatUserRef).
  const notificationsEnabledRef = useRef(notificationsEnabled);
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { notificationsEnabledRef.current = notificationsEnabled; }, [notificationsEnabled]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  // --- NEU (Phase 4): Zustände für das Gruppen-System ---
  const [groups, setGroups] = useState([]); // meine Gruppen [{id, name, description, avatarEmoji, role, memberCount}]
  const [groupMessages, setGroupMessages] = useState([]); // alle Nachrichten aller eigenen Gruppen
  const [groupReadState, setGroupReadState] = useState({}); // { [groupId]: lastReadAt }
  const [activeGroupId, setActiveGroupId] = useState(null); // aktuell geöffnete Gruppe (ID)
  const [activeGroupDetail, setActiveGroupDetail] = useState(null); // volle Detailansicht (Mitglieder+Rollen) der aktuell geöffneten Gruppe
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  // Ref analog zu selectedChatUserRef, für den newGroupMessage-Handler im Socket-Effekt
  const activeGroupIdRef = useRef(null);
  useEffect(() => { activeGroupIdRef.current = activeGroupId; }, [activeGroupId]);

  // --- NEU (Phase 5) ---
  const [favorites, setFavorites] = useState([]);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [isFavoritesPanelOpen, setIsFavoritesPanelOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // --- Función de Logout (Memoizada con useCallback) ---
  const handleLogout = useCallback(() => {
    console.log("App: Realizando logout...");
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    setUsersList([]);
    setSelectedChatUser(null);
    setAllMessages([]);
    setFilteredMessages([]);
    setIsConnected(false);
    // <<< CAMBIO: Estado traducido >>>
    setSocketStatusMessage('Getrennt.');
    setAuthError('');
    // <<< NEU (Phase 1): auch die neuen Zustände zurücksetzen >>>
    setOnlineUserIds(new Set());
    setUnreadCounts({});
    // <<< NEU (Phase 2): Kontakt-Zustände zurücksetzen >>>
    setContacts([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setBlockedUsers([]);
    setIsContactsPanelOpen(false);
    // <<< NEU (Phase 3): Tipp-Status zurücksetzen (Benachrichtigungs-/Sound-Einstellungen
    //     bleiben bewusst erhalten — das sind Geräteeinstellungen, keine Sitzungsdaten) >>>
    setTypingUserId(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    // <<< NEU (Phase 4): Gruppen-Zustände zurücksetzen >>>
    setGroups([]);
    setGroupMessages([]);
    setGroupReadState({});
    setActiveGroupId(null);
    setActiveGroupDetail(null);
    setIsCreateGroupModalOpen(false);
    setIsGroupInfoOpen(false);
    setFavorites([]);
    setForwardingMessage(null);
    setIsFavoritesPanelOpen(false);
    setIsSearchModalOpen(false);
  }, []);

  // --- Efecto para Restaurar Sesión al Cargar ---
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log("App: Benutzer aus localStorage wiederhergestellt:", parsedUser.username); // Log geändert
      } catch (e) {
        console.error("App: Fehler beim Parsen des Benutzers aus localStorage, Bereinigung...", e); // Log geändert
        handleLogout();
      }
    }
  }, [handleLogout]);

  // --- Función para Obtener Usuarios (Memoizada con useCallback) ---
  const fetchUsers = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    console.log("App: Benutzerliste wird angefordert..."); // Log geändert
    try {
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setUsersList(response.data || []);
    } catch (error) {
      console.error("App: Fehler beim Laden der Benutzerliste:", error.response?.data?.message || error.message); // Log geändert
      // <<< CAMBIO: Estado traducido >>>
      setSocketStatusMessage("Fehler beim Laden der Benutzer.");
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  // --- Función para Obtener Mensajes (Memoizada con useCallback) ---
  const fetchMessages = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
     console.log("App: Nachrichtenverlauf wird angefordert..."); // Log geändert
     try {
        const response = await axios.get(`${API_URL}/api/messages`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        setAllMessages(response.data || []);
     } catch (error) {
        console.error("App: Fehler beim Laden des Verlaufs:", error.response?.data?.message || error.message); // Log geändert
         // <<< CAMBIO: Estado traducido >>>
        setSocketStatusMessage("Fehler beim Laden des Verlaufs.");
         if (error.response?.status === 401) handleLogout();
     }
  }, [handleLogout]);

  // --- NEU (Phase 1): Online-Status aller Benutzer abrufen ---
  const fetchOnlineStatus = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    console.log("App: Online-Status wird angefordert...");
    try {
      const response = await axios.get(`${API_URL}/api/users/status`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setOnlineUserIds(new Set(response.data?.onlineUserIds || []));
    } catch (error) {
      console.error("App: Fehler beim Laden des Online-Status:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  // --- NEU (Phase 1): Ungelesen-Zähler pro Konversation abrufen ---
  const fetchUnreadCounts = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    console.log("App: Ungelesen-Zähler werden angefordert...");
    try {
      const response = await axios.get(`${API_URL}/api/conversations/unread`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const counts = {};
      (response.data || []).forEach((row) => {
        counts[row.partnerId] = row.unreadCount;
      });
      setUnreadCounts(counts);
    } catch (error) {
      console.error("App: Fehler beim Laden der Ungelesen-Zähler:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  // --- NEU (Phase 1): eine Konversation als gelesen markieren (optimistisches Update + Backend) ---
  const markConversationRead = useCallback(async (partnerId) => {
    setUnreadCounts((prev) => {
      if (!prev[partnerId]) return prev;
      const next = { ...prev };
      delete next[partnerId];
      return next;
    });
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    try {
      await axios.post(`${API_URL}/api/conversations/${partnerId}/read`, {}, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
    } catch (error) {
      console.error("App: Fehler beim Markieren als gelesen:", error.response?.data?.message || error.message);
    }
  }, []);

  // --- NEU (Phase 2): Kontakte, Anfragen und blockierte Benutzer abrufen ---
  const fetchContactsOverview = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    console.log("App: Kontakt-Übersicht wird angefordert...");
    try {
      const response = await axios.get(`${API_URL}/api/contacts/overview`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setContacts(response.data?.contacts || []);
      setIncomingRequests(response.data?.incoming || []);
      setOutgoingRequests(response.data?.outgoing || []);
      setBlockedUsers(response.data?.blocked || []);
    } catch (error) {
      console.error("App: Fehler beim Laden der Kontakt-Übersicht:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  // --- NEU (Phase 2): Hilfsfunktion, die eine Kontakt-Aktion ausführt und danach die Übersicht aktualisiert ---
  const runContactAction = useCallback(async (method, url) => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    try {
      await axios({
        method,
        url: `${API_URL}${url}`,
        headers: { Authorization: `Bearer ${currentToken}` },
      });
    } catch (error) {
      console.error(`App: Fehler bei Kontakt-Aktion (${method} ${url}):`, error.response?.data?.message || error.message);
      if (error.response?.status === 401) handleLogout();
    } finally {
      fetchContactsOverview();
    }
  }, [handleLogout, fetchContactsOverview]);

  const sendContactRequest = useCallback(
    (addresseeId) => {
      const currentToken = localStorage.getItem('authToken');
      if (!currentToken) return;
      axios
        .post(`${API_URL}/api/contacts/request`, { addresseeId }, {
          headers: { Authorization: `Bearer ${currentToken}` },
        })
        .catch((error) => {
          console.error("App: Fehler beim Senden der Kontaktanfrage:", error.response?.data?.message || error.message);
        })
        .finally(() => fetchContactsOverview());
    },
    [fetchContactsOverview]
  );
  const acceptContactRequest = useCallback((userId) => runContactAction('post', `/api/contacts/${userId}/accept`), [runContactAction]);
  const rejectContactRequest = useCallback((userId) => runContactAction('post', `/api/contacts/${userId}/reject`), [runContactAction]);
  const cancelContactRequest = useCallback((userId) => runContactAction('post', `/api/contacts/${userId}/cancel`), [runContactAction]);
  const unblockUser = useCallback((userId) => runContactAction('post', `/api/contacts/${userId}/unblock`), [runContactAction]);

  // --- NEU (Phase 2): Kontakt entfernen bzw. Benutzer blockieren — schließt zusätzlich
  //     den Chat, falls genau dieser Benutzer gerade geöffnet war (er verschwindet ja
  //     ohnehin aus der Kontaktliste). ---
  const removeContact = useCallback((userId) => {
    setSelectedChatUser((current) => (current?.id === userId ? null : current));
    runContactAction('delete', `/api/contacts/${userId}`);
  }, [runContactAction]);
  const blockUser = useCallback((userId) => {
    setSelectedChatUser((current) => (current?.id === userId ? null : current));
    runContactAction('post', `/api/contacts/${userId}/block`);
  }, [runContactAction]);

  // --- NEU (Phase 3): Browser-Benachrichtigungen an-/ausschalten (fragt bei Bedarf Berechtigung an) ---
  const toggleNotifications = useCallback(async () => {
    if (!notificationsEnabled) {
      if (typeof Notification === 'undefined') {
        console.warn('App: Dieser Browser unterstützt keine Benachrichtigungen.');
        return;
      }
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        return;
      }
    }
    setNotificationsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('notificationsEnabled', String(next));
      return next;
    });
  }, [notificationsEnabled]);

  // --- NEU (Phase 3): Sound bei neuer Nachricht an-/ausschalten ---
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('soundEnabled', String(next));
      return next;
    });
  }, []);

  // --- NEU (Phase 3): "Ich schreibe gerade" an den Socket melden ---
  const handleTyping = useCallback((recipientId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', { recipientId });
    }
  }, []);

  // --- NEU (Phase 4): Gruppen abrufen (Liste, Nachrichten, Lese-Zeiger) ---
  const fetchGroups = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    try {
      const response = await axios.get(`${API_URL}/api/groups`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setGroups(response.data || []);
    } catch (error) {
      console.error("App: Fehler beim Laden der Gruppen:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  const fetchGroupMessages = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    try {
      const response = await axios.get(`${API_URL}/api/groups/messages`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setGroupMessages(response.data || []);
    } catch (error) {
      console.error("App: Fehler beim Laden der Gruppennachrichten:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  const fetchGroupReadState = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    try {
      const response = await axios.get(`${API_URL}/api/groups/read-state`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const state = {};
      (response.data || []).forEach((row) => { state[row.groupId] = row.lastReadAt; });
      setGroupReadState(state);
    } catch (error) {
      console.error("App: Fehler beim Laden des Gruppen-Lesestatus:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  // Alle drei zusammen neu laden (nach jeder Gruppen-Aktion)
  const refreshGroupsData = useCallback(() => {
    fetchGroups();
    fetchGroupMessages();
    fetchGroupReadState();
  }, [fetchGroups, fetchGroupMessages, fetchGroupReadState]);

  const fetchGroupDetail = useCallback(async (groupId) => {
    // FIX (Phase 4 Debug): groupId defensiv validieren, bevor überhaupt eine
    // Anfrage gestartet wird (Punkt 3 der Fehleranalyse).
    if (!Number.isInteger(groupId)) {
      console.warn('App: fetchGroupDetail mit ungültiger groupId aufgerufen, abgebrochen:', groupId);
      return;
    }
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    try {
      // TEMPORÄR (Debug Phase 4): siehe Punkt 8 der Analyse — vor dem Entfernen
      // bitte bestätigen, dass "Gruppendetails geladen" immer die groupId zeigt,
      // die auch tatsächlich ausgewählt wurde.
      console.log('[DEBUG Phase 4] fetchGroupDetail: angefragte groupId =', groupId);
      const response = await axios.get(`${API_URL}/api/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      // FIX (Phase 4 Debug) — echte Race Condition: falls der Nutzer zwischen
      // Anfrage und Antwort bereits zu einer ANDEREN Gruppe gewechselt hat,
      // würde eine verspätet eintreffende alte Antwort sonst die aktuell
      // korrekten Daten überschreiben. Deshalb wird hier gegen die Ref (immer
      // aktuell, siehe activeGroupIdRef weiter oben) geprüft, nicht gegen die
      // groupId, mit der diese Funktion ursprünglich aufgerufen wurde.
      if (activeGroupIdRef.current !== groupId) {
        console.log('[DEBUG Phase 4] fetchGroupDetail: veraltete Antwort verworfen (angefragt:', groupId, ', aktuell aktiv:', activeGroupIdRef.current, ')');
        return;
      }
      console.log('[DEBUG Phase 4] fetchGroupDetail: Antwort erhalten für groupId =', response.data?.id, '(angefragt:', groupId, ')');
      setActiveGroupDetail(response.data);
    } catch (error) {
      console.error(`App: Fehler beim Laden der Gruppendetails ${groupId}:`, error.response?.data?.message || error.message);
    }
  }, []);

  const markGroupRead = useCallback(async (groupId) => {
    // FIX (Phase 4 Debug): auch hier defensiv validieren.
    if (!Number.isInteger(groupId)) {
      console.warn('App: markGroupRead mit ungültiger groupId aufgerufen, abgebrochen:', groupId);
      return;
    }
    setGroupReadState((prev) => ({ ...prev, [groupId]: new Date().toISOString() }));
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    try {
      await axios.post(`${API_URL}/api/groups/${groupId}/read`, {}, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
    } catch (error) {
      console.error(`App: Fehler beim Markieren der Gruppe ${groupId} als gelesen:`, error.response?.data?.message || error.message);
    }
  }, []);

  // --- NEU (Phase 4): eine Gruppe auswählen — schließt den 1:1-Chat, exakt spiegelbildlich
  //     zu dem, was handleSelectUser unten für activeGroupId zusätzlich tut ---
  // FIX (Phase 4 Debug) — URSACHE VON FEHLER 2/5: activeGroupDetail wurde beim
  // Gruppenwechsel bisher NICHT zurückgesetzt. Dadurch zeigte GroupChatWindow/
  // GroupInfoPanel für den kurzen Moment zwischen "neue Gruppe ausgewählt" und
  // "Detail-Antwort angekommen" noch die Detaildaten der VORHERIGEN Gruppe an
  // (activeGroupId war schon neu, activeGroupDetail noch alt) — inklusive
  // group.id, das dann beim Senden/Einladen verwendet wurde. Wer in diesem
  // Fenster eine Nachricht schickte, schickte sie an die falsche Gruppe.
  // Der Fix: activeGroupDetail sofort auf null setzen, sobald sich die
  // Auswahl ändert, damit niemals veraltete Daten einer anderen Gruppe
  // gerendert oder für Aktionen verwendet werden können.
  const handleSelectGroup = useCallback((groupId) => {
    if (!Number.isInteger(groupId)) {
      console.warn('App: handleSelectGroup mit ungültiger groupId aufgerufen, abgebrochen:', groupId);
      return;
    }
    console.log('[DEBUG Phase 4] handleSelectGroup: groupId =', groupId); // TEMPORÄR (Debug Phase 4)
    setSelectedChatUser(null);
    setActiveGroupDetail(null); // <<< FIX: veraltete Detaildaten der vorherigen Gruppe sofort verwerfen
    setActiveGroupId(groupId);
    fetchGroupDetail(groupId);
  }, [fetchGroupDetail]);

  const handleSendGroupMessage = useCallback(({ groupId, content }) => {
    // FIX (Phase 4 Debug) — Punkt 2/8 der Fehleranalyse: groupId defensiv
    // validieren, bevor überhaupt gesendet wird.
    if (!Number.isInteger(groupId)) {
      console.warn('App: sendGroupMessage mit ungültiger groupId blockiert:', groupId);
      return;
    }
    console.log('[DEBUG Phase 4] sendGroupMessage: groupId =', groupId); // TEMPORÄR (Debug Phase 4)
    if (socketRef.current?.connected && content) {
      socketRef.current.emit('sendGroupMessage', { groupId, content });
    }
  }, []);

  const createGroup = useCallback((payload) => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    console.log('[DEBUG Phase 4] createGroup: ausgewählte memberIds =', payload.memberIds); // TEMPORÄR (Debug Phase 4)
    axios
      .post(`${API_URL}/api/groups`, payload, { headers: { Authorization: `Bearer ${currentToken}` } })
      .then((response) => {
        console.log('[DEBUG Phase 4] createGroup: Antwort vom Server, neue groupId =', response.data?.id); // TEMPORÄR (Debug Phase 4)
        refreshGroupsData();
        if (response.data?.id) {
          handleSelectGroup(response.data.id);
        }
      })
      .catch((error) => {
        console.error("App: Fehler beim Erstellen der Gruppe:", error.response?.data?.message || error.message);
      });
  }, [refreshGroupsData, handleSelectGroup]);

  const runGroupAction = useCallback(async (method, url, data) => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    try {
      await axios({ method, url: `${API_URL}${url}`, data, headers: { Authorization: `Bearer ${currentToken}` } });
    } catch (error) {
      console.error(`App: Fehler bei Gruppen-Aktion (${method} ${url}):`, error.response?.data?.message || error.message);
    } finally {
      refreshGroupsData();
    }
  }, [refreshGroupsData]);

  // FIX (Phase 4 Debug): alle folgenden Aktionen validieren groupId/userId
  // defensiv, bevor überhaupt eine Anfrage gestartet wird (Punkt 3/9 der Analyse).
  const editGroup = useCallback((groupId, payload) => {
    if (!Number.isInteger(groupId)) return;
    runGroupAction('patch', `/api/groups/${groupId}`, payload).then(() => fetchGroupDetail(groupId));
  }, [runGroupAction, fetchGroupDetail]);

  const inviteGroupMember = useCallback((groupId, userId) => {
    if (!Number.isInteger(groupId) || !Number.isInteger(userId)) {
      console.warn('App: inviteGroupMember mit ungültiger ID blockiert:', { groupId, userId });
      return;
    }
    console.log('[DEBUG Phase 4] inviteGroupMember: groupId =', groupId, 'userId =', userId); // TEMPORÄR (Debug Phase 4)
    runGroupAction('post', `/api/groups/${groupId}/members`, { userId }).then(() => fetchGroupDetail(groupId));
  }, [runGroupAction, fetchGroupDetail]);

  const kickGroupMember = useCallback((groupId, userId) => {
    if (!Number.isInteger(groupId) || !Number.isInteger(userId)) return;
    runGroupAction('delete', `/api/groups/${groupId}/members/${userId}`).then(() => fetchGroupDetail(groupId));
  }, [runGroupAction, fetchGroupDetail]);

  const changeGroupMemberRole = useCallback((groupId, userId, role) => {
    if (!Number.isInteger(groupId) || !Number.isInteger(userId)) return;
    runGroupAction('patch', `/api/groups/${groupId}/members/${userId}/role`, { role }).then(() => fetchGroupDetail(groupId));
  }, [runGroupAction, fetchGroupDetail]);

  const leaveGroup = useCallback((groupId) => {
    if (!Number.isInteger(groupId)) return;
    setActiveGroupId((current) => (current === groupId ? null : current));
    setActiveGroupDetail(null);
    setIsGroupInfoOpen(false);
    runGroupAction('post', `/api/groups/${groupId}/leave`);
  }, [runGroupAction]);

  const deleteGroup = useCallback((groupId) => {
    if (!Number.isInteger(groupId)) return;
    setActiveGroupId((current) => (current === groupId ? null : current));
    setActiveGroupDetail(null);
    setIsGroupInfoOpen(false);
    runGroupAction('delete', `/api/groups/${groupId}`);
  }, [runGroupAction]);

  // --- NEU (Phase 5) ---
  const fetchFavorites = useCallback(async () => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) return;
    try {
      const response = await axios.get(`${API_URL}/api/favorites`, { headers: { Authorization: `Bearer ${currentToken}` } });
      setFavorites(response.data || []);
    } catch (error) {
      console.error("App: Fehler beim Laden der Favoriten:", error.response?.data?.message || error.message);
      if (error.response?.status === 401) handleLogout();
    }
  }, [handleLogout]);

  const editMessage = useCallback((messageId, content) => {
    if (socketRef.current?.connected) socketRef.current.emit('editMessage', { messageId, content });
  }, []);
  const deleteMessage = useCallback((messageId) => {
    if (socketRef.current?.connected) socketRef.current.emit('deleteMessage', { messageId });
  }, []);
  const editGroupMessage = useCallback((messageId, content) => {
    if (socketRef.current?.connected) socketRef.current.emit('editGroupMessage', { messageId, content });
  }, []);
  const deleteGroupMessage = useCallback((messageId) => {
    if (socketRef.current?.connected) socketRef.current.emit('deleteGroupMessage', { messageId });
  }, []);

  const pinMessage = useCallback((messageId) => {
    const t = localStorage.getItem('authToken'); if (!t) return;
    axios.post(`${API_URL}/api/messages/${messageId}/pin`, {}, { headers: { Authorization: `Bearer ${t}` } }).catch((e) => console.error("App: Fehler beim Anheften:", e.response?.data?.message || e.message));
  }, []);
  const unpinMessage = useCallback((messageId) => {
    const t = localStorage.getItem('authToken'); if (!t) return;
    axios.post(`${API_URL}/api/messages/${messageId}/unpin`, {}, { headers: { Authorization: `Bearer ${t}` } }).catch((e) => console.error("App: Fehler beim Lösen:", e.response?.data?.message || e.message));
  }, []);
  const pinGroupMessage = useCallback((groupId, messageId) => {
    const t = localStorage.getItem('authToken'); if (!t) return;
    axios.post(`${API_URL}/api/groups/${groupId}/messages/${messageId}/pin`, {}, { headers: { Authorization: `Bearer ${t}` } }).catch((e) => console.error("App: Fehler beim Anheften:", e.response?.data?.message || e.message));
  }, []);
  const unpinGroupMessage = useCallback((groupId, messageId) => {
    const t = localStorage.getItem('authToken'); if (!t) return;
    axios.post(`${API_URL}/api/groups/${groupId}/messages/${messageId}/unpin`, {}, { headers: { Authorization: `Bearer ${t}` } }).catch((e) => console.error("App: Fehler beim Lösen:", e.response?.data?.message || e.message));
  }, []);

  const toggleFavorite = useCallback((messageType, messageId, isCurrentlyFavorited) => {
    setFavorites((prev) => (
      isCurrentlyFavorited
        ? prev.filter((f) => !(f.messageType === messageType && f.messageId === messageId))
        : [...prev, { messageType, messageId }]
    ));
    const t = localStorage.getItem('authToken'); if (!t) return;
    const req = isCurrentlyFavorited
      ? axios.delete(`${API_URL}/api/favorites/${messageType}/${messageId}`, { headers: { Authorization: `Bearer ${t}` } })
      : axios.post(`${API_URL}/api/favorites`, { messageType, messageId }, { headers: { Authorization: `Bearer ${t}` } });
    req.catch((e) => console.error("App: Fehler beim Aktualisieren der Favoriten:", e.response?.data?.message || e.message));
  }, []);

  const forwardMessage = useCallback((destination) => {
    if (!forwardingMessage) return;
    if (destination.isGroup) {
      if (socketRef.current?.connected) {
        socketRef.current.emit('sendGroupMessage', { groupId: destination.id, content: forwardingMessage.content, forwardedFromUsername: forwardingMessage.forwardedFromUsername });
      }
    } else if (socketRef.current?.connected) {
      socketRef.current.emit('sendMessage', { recipientUsername: destination.username, content: forwardingMessage.content, forwardedFromUsername: forwardingMessage.forwardedFromUsername });
    }
    setForwardingMessage(null);
  }, [forwardingMessage]);

  const jumpToDirectChatFromSearch = useCallback((user) => {
    setActiveGroupId(null);
    setSelectedChatUser(user);
  }, []);
  const jumpToGroupFromSearch = useCallback((groupId) => {
    handleSelectGroup(groupId);
  }, [handleSelectGroup]);

  // --- Efecto Principal para Gestionar el Socket ---
  useEffect(() => {
    if (user && token) {
      // <<< CAMBIO: Estado traducido >>>
      setSocketStatusMessage('Verbinde...');
      if (socketRef.current) socketRef.current.disconnect();
      const socket = io(SOCKET_URL, { auth: { token }, forceNew: true, reconnectionAttempts: 3, timeout: 10000 });
      socketRef.current = socket;

      const handleConnect = () => {
        console.log('App: Socket verbunden! ID:', socket.id); // Log geändert
        setIsConnected(true);
        // <<< CAMBIO: Estado traducido >>>
        setSocketStatusMessage('Verbunden.');
        fetchUsers();
        fetchMessages();
        fetchOnlineStatus(); // NEU (Phase 1)
        fetchUnreadCounts(); // NEU (Phase 1)
        fetchContactsOverview(); // NEU (Phase 2)
        fetchGroups(); // NEU (Phase 4)
        fetchGroupMessages(); // NEU (Phase 4)
        fetchGroupReadState(); // NEU (Phase 4)
        fetchFavorites(); // NEU (Phase 5)
      };
      const handleDisconnect = (reason) => {
        console.log('App: Socket getrennt:', reason); // Log geändert
        setIsConnected(false);
        socketRef.current = null;
        if (reason === 'io server disconnect') {
           // <<< CAMBIO: Estado traducido >>>
           setSocketStatusMessage('Server-Trennung (Token ungültig/abgelaufen?).');
           handleLogout();
        } else if (reason === 'io client disconnect') {
            // <<< CAMBIO: Estado traducido >>>
            setSocketStatusMessage('Getrennt.');
        } else {
           // <<< CAMBIO: Estado traducido (teilweise) >>>
           setSocketStatusMessage(`Getrennt: ${reason}.`); // Grund bleibt Englisch
        }
      };
      const handleConnectError = (err) => {
        console.error('App: Socket-Verbindungsfehler:', err.message); // Log geändert
        setIsConnected(false);
        socketRef.current = null;
        if (err.message.includes("Authentication error")) {
            // <<< CAMBIO: Estado traducido >>>
            setSocketStatusMessage("Authentifizierungsfehler. Bitte erneut anmelden.");
            handleLogout();
        } else {
            // <<< CAMBIO: Estado traducido >>>
            setSocketStatusMessage("Netzwerk-/Serverfehler beim Verbinden.");
        }
      };
      const handleNewMessage = (incomingMessage) => {
        setAllMessages((prev) => [...prev, incomingMessage]);

        // <<< NEU (Phase 1): Ungelesen-Zähler pflegen >>>
        if (incomingMessage.sender.id !== user.id) {
          // <<< NEU (Phase 3): Zustellung bestätigen, damit der Absender "zugestellt" sieht >>>
          if (socket.connected) {
            socket.emit('ackDelivered', { messageId: incomingMessage.id });
          }

          const openPartner = selectedChatUserRef.current;
          if (openPartner && openPartner.id === incomingMessage.sender.id) {
            // Gespräch ist gerade geöffnet -> sofort als gelesen markieren
            markConversationRead(incomingMessage.sender.id);
          } else {
            setUnreadCounts((prev) => ({
              ...prev,
              [incomingMessage.sender.id]: (prev[incomingMessage.sender.id] || 0) + 1,
            }));
            // <<< NEU (Phase 3): Sound + Browser-Benachrichtigung, nur wenn dieses
            //     Gespräch gerade nicht geöffnet ist (gleiche Bedingung wie oben) >>>
            if (soundEnabledRef.current) {
              playNotificationSound();
            }
            if (notificationsEnabledRef.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              const notification = new Notification(incomingMessage.sender.username, {
                body: incomingMessage.content,
                icon: '/favicon.svg',
              });
              notification.onclick = () => {
                window.focus();
                setSelectedChatUser({ id: incomingMessage.sender.id, username: incomingMessage.sender.username });
                notification.close();
              };
            }
          }
        }
      };
      // NEU (Phase 3): Tipp-Anzeige des Partners mit automatischem Timeout
      const handlePartnerTyping = ({ userId: typingId }) => {
        setTypingUserId(typingId);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUserId((current) => (current === typingId ? null : current));
        }, 3000);
      };
      // NEU (Phase 3): Zustellstatus einer eigenen Nachricht aktualisieren
      const handleMessageStatusUpdate = ({ messageId, status }) => {
        if (status !== 'delivered') return;
        setAllMessages((prev) => prev.map((m) => (
          m.id === messageId && !m.deliveredAt ? { ...m, deliveredAt: new Date().toISOString() } : m
        )));
      };
      // NEU (Phase 3): der Empfänger hat alle meine Nachrichten an ihn gelesen
      const handleMessagesRead = ({ readerId }) => {
        setAllMessages((prev) => prev.map((m) => (
          m.sender.id === user.id && m.recipient?.id === readerId && !m.readAt
            ? { ...m, readAt: new Date().toISOString() }
            : m
        )));
      };
      // NEU (Phase 1): Online-/Offline-Änderungen anderer Benutzer live übernehmen
      const handleUserStatusChanged = ({ userId, isOnline }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          if (isOnline) {
            next.add(userId);
          } else {
            next.delete(userId);
          }
          return next;
        });
      };
      const handleMessageError = (errorData) => {
        console.warn("App: Nachrichtenfehler empfangen:", errorData.error); // Log geändert
        const currentSocket = socketRef.current;
        // <<< CAMBIO: Estado traducido >>>
        const statusAfterTimeout = currentSocket?.connected ? 'Verbunden.' : 'Getrennt.';
        // <<< CAMBIO: Estado traducido (teilweise) >>>
        // Es ist besser, den Fehler vom Backend nicht direkt zu übersetzen
        setSocketStatusMessage(`Fehler: ${errorData.error}`);
        setTimeout(() => setSocketStatusMessage(statusAfterTimeout), 3000);
      };
      // NEU (Phase 4): neue Gruppennachricht empfangen
      const handleNewGroupMessage = (incomingMessage) => {
        setGroupMessages((prev) => [...prev, incomingMessage]);
        if (activeGroupIdRef.current === incomingMessage.groupId) {
          markGroupRead(incomingMessage.groupId);
        }
      };
      // NEU (Phase 4): Gruppendaten (Name/Beschreibung/Mitglieder/Rollen) haben sich geändert
      const handleGroupUpdated = ({ groupId, removed }) => {
        fetchGroups();
        if (removed) {
          setActiveGroupId((current) => (current === groupId ? null : current));
          setActiveGroupDetail(null);
          setIsGroupInfoOpen(false);
        } else if (activeGroupIdRef.current === groupId) {
          fetchGroupDetail(groupId);
        }
      };
      // NEU (Phase 4): Gruppe wurde gelöscht
      const handleGroupDeleted = ({ groupId }) => {
        fetchGroups();
        setActiveGroupId((current) => (current === groupId ? null : current));
        if (activeGroupIdRef.current === groupId) {
          setActiveGroupDetail(null);
          setIsGroupInfoOpen(false);
        }
      };

      const handleMessageEdited = ({ messageId, content, editedAt }) => {
        setAllMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content, editedAt } : m)));
      };
      const handleMessageDeleted = ({ messageId }) => {
        setAllMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: null, deletedAt: new Date().toISOString() } : m)));
      };
      const handleGroupMessageEdited = ({ messageId, content, editedAt }) => {
        setGroupMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content, editedAt } : m)));
      };
      const handleGroupMessageDeleted = ({ messageId }) => {
        setGroupMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: null, deletedAt: new Date().toISOString() } : m)));
      };
      const handleMessagePinned = ({ messageId, pinnedAt }) => {
        setAllMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, pinnedAt } : m)));
      };
      const handleMessageUnpinned = ({ messageId }) => {
        setAllMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, pinnedAt: null } : m)));
      };
      const handleGroupMessagePinned = ({ messageId, pinnedAt }) => {
        setGroupMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, pinnedAt } : m)));
      };
      const handleGroupMessageUnpinned = ({ messageId }) => {
        setGroupMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, pinnedAt: null } : m)));
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleConnectError);
      socket.on('newMessage', handleNewMessage);
      socket.on('messageError', handleMessageError);
      socket.on('userStatusChanged', handleUserStatusChanged); // NEU (Phase 1)
      socket.on('partnerTyping', handlePartnerTyping); // NEU (Phase 3)
      socket.on('messageStatusUpdate', handleMessageStatusUpdate); // NEU (Phase 3)
      socket.on('messagesRead', handleMessagesRead); // NEU (Phase 3)
      socket.on('newGroupMessage', handleNewGroupMessage); // NEU (Phase 4)
      socket.on('groupUpdated', handleGroupUpdated); // NEU (Phase 4)
      socket.on('groupDeleted', handleGroupDeleted); // NEU (Phase 4)
      socket.on('messageEdited', handleMessageEdited); // NEU (Phase 5)
      socket.on('messageDeleted', handleMessageDeleted); // NEU (Phase 5)
      socket.on('groupMessageEdited', handleGroupMessageEdited); // NEU (Phase 5)
      socket.on('groupMessageDeleted', handleGroupMessageDeleted); // NEU (Phase 5)
      socket.on('messagePinned', handleMessagePinned); // NEU (Phase 5)
      socket.on('messageUnpinned', handleMessageUnpinned); // NEU (Phase 5)
      socket.on('groupMessagePinned', handleGroupMessagePinned); // NEU (Phase 5)
      socket.on('groupMessageUnpinned', handleGroupMessageUnpinned); // NEU (Phase 5)

      return () => {
        console.log("App: Socket-Effekt wird bereinigt..."); // Log geändert
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
        socket.off('newMessage', handleNewMessage);
        socket.off('messageError', handleMessageError);
        socket.off('userStatusChanged', handleUserStatusChanged); // NEU (Phase 1)
        socket.off('partnerTyping', handlePartnerTyping); // NEU (Phase 3)
        socket.off('messageStatusUpdate', handleMessageStatusUpdate); // NEU (Phase 3)
        socket.off('messagesRead', handleMessagesRead); // NEU (Phase 3)
        socket.off('newGroupMessage', handleNewGroupMessage); // NEU (Phase 4)
        socket.off('groupUpdated', handleGroupUpdated); // NEU (Phase 4)
        socket.off('groupDeleted', handleGroupDeleted); // NEU (Phase 4)
        socket.off('messageEdited', handleMessageEdited); // NEU (Phase 5)
        socket.off('messageDeleted', handleMessageDeleted); // NEU (Phase 5)
        socket.off('groupMessageEdited', handleGroupMessageEdited); // NEU (Phase 5)
        socket.off('groupMessageDeleted', handleGroupMessageDeleted); // NEU (Phase 5)
        socket.off('messagePinned', handleMessagePinned); // NEU (Phase 5)
        socket.off('messageUnpinned', handleMessageUnpinned); // NEU (Phase 5)
        socket.off('groupMessagePinned', handleGroupMessagePinned); // NEU (Phase 5)
        socket.off('groupMessageUnpinned', handleGroupMessageUnpinned); // NEU (Phase 5)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); // NEU (Phase 3)
        if (socket.connected) socket.disconnect();
        socketRef.current = null;
      };
    } else {
       if (socketRef.current) {
          console.log("App: Restlicher Socket wird getrennt, da kein Benutzer/Token vorhanden."); // Log geändert
          socketRef.current.disconnect();
          socketRef.current = null;
       }
      setIsConnected(false);
      // <<< CAMBIO: Estado traducido >>>
      setSocketStatusMessage('Getrennt.');
    }
  }, [user, token, handleLogout, fetchUsers, fetchMessages, fetchOnlineStatus, fetchUnreadCounts, markConversationRead, fetchContactsOverview, fetchGroups, fetchGroupMessages, fetchGroupReadState, fetchGroupDetail, markGroupRead, fetchFavorites]);

  // --- Efecto para Filtrar Mensajes (Sin cambios) ---
  useEffect(() => {
    if (!selectedChatUser || !user) {
      setFilteredMessages([]);
      return;
    }
    const filtered = allMessages.filter(msg =>
      (msg.sender.id === user.id && msg.recipient?.id === selectedChatUser.id) ||
      (msg.sender.id === selectedChatUser.id && msg.recipient?.id === user.id)
    );
    setFilteredMessages(filtered);
  }, [selectedChatUser, allMessages, user]);

  // --- NEU (Phase 1): Ref stets mit dem aktuell ausgewählten Chat synchron halten ---
  useEffect(() => {
    selectedChatUserRef.current = selectedChatUser;
  }, [selectedChatUser]);

  // --- NEU (Phase 1): beim Öffnen eines Gesprächs dessen Nachrichten als gelesen markieren ---
  useEffect(() => {
    if (selectedChatUser) {
      markConversationRead(selectedChatUser.id);
    }
  }, [selectedChatUser, markConversationRead]);

  // --- Phase 1, angepasst in Phase 2: abgeleitete Konversationsliste.
  //     Quelle ist jetzt `contacts` (nur akzeptierte Kontakte) statt `usersList`
  //     (alle Benutzer) — genau das war die Vorgabe von Phase 2 ("nur akzeptierte
  //     Kontakte auf dem Hauptbildschirm"). `usersList`/`fetchUsers` selbst bleiben
  //     unverändert; sie versorgen jetzt stattdessen die globale Suche im
  //     Kontakt-Panel. ---
  const conversations = useMemo(() => {
    if (!user) return [];
    return contacts
      .map((u) => {
        const partnerMessages = allMessages.filter((msg) =>
          (msg.sender.id === u.id && msg.recipient?.id === user.id) ||
          (msg.sender.id === user.id && msg.recipient?.id === u.id)
        );
        // allMessages kommt bereits ASC-sortiert von /api/messages -> letztes Element = neueste Nachricht
        const lastMessage = partnerMessages.length > 0 ? partnerMessages[partnerMessages.length - 1] : null;
        return {
          id: u.id,
          username: u.username,
          isOnline: onlineUserIds.has(u.id),
          lastMessageContent: lastMessage ? lastMessage.content : null,
          lastMessageAt: lastMessage ? lastMessage.createdAt : null,
          unreadCount: unreadCounts[u.id] || 0,
        };
      })
      .sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        }
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return a.username.localeCompare(b.username);
      });
  }, [contacts, allMessages, user, onlineUserIds, unreadCounts]);

  // --- NEU (Phase 4): Gruppe als gelesen markieren, sobald sie geöffnet wird ---
  useEffect(() => {
    if (activeGroupId) {
      markGroupRead(activeGroupId);
    }
  }, [activeGroupId, markGroupRead]);

  // --- NEU (Phase 4): abgeleitete Konversations-Einträge für Gruppen, im selben
  //     Format wie `conversations` oben (damit ConversationList beides mischen kann). ---
  const groupConversationItems = useMemo(() => {
    return groups.map((g) => {
      const messagesForGroup = groupMessages.filter((m) => m.groupId === g.id);
      const lastMessage = messagesForGroup.length > 0 ? messagesForGroup[messagesForGroup.length - 1] : null;
      const lastReadAt = groupReadState[g.id] ? new Date(groupReadState[g.id]) : null;
      const unreadCount = messagesForGroup.filter((m) => (
        m.sender.id !== user?.id && (!lastReadAt || new Date(m.createdAt) > lastReadAt)
      )).length;
      return {
        id: g.id,
        isGroup: true,
        username: g.name, // gleicher Feldname wie bei 1:1, für ConversationList-Kompatibilität
        emoji: g.avatarEmoji,
        lastMessageContent: lastMessage ? lastMessage.content : null,
        lastMessageAt: lastMessage ? lastMessage.createdAt : null,
        unreadCount,
      };
    }).sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.username.localeCompare(b.username);
    });
  }, [groups, groupMessages, groupReadState, user]);

  // --- NEU (Phase 4): 1:1- und Gruppen-Konversationen zu einer einzigen,
  //     nach Aktivität sortierten Liste zusammenführen (für ConversationList). ---
  const allConversationItems = useMemo(() => {
    return [...conversations, ...groupConversationItems].sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.username.localeCompare(b.username);
    });
  }, [conversations, groupConversationItems]);

  // --- NEU (Phase 4): Nachrichten der aktuell geöffneten Gruppe ---
  const activeGroupMessages = useMemo(() => {
    if (!activeGroupId) return [];
    return groupMessages.filter((m) => m.groupId === activeGroupId);
  }, [activeGroupId, groupMessages]);

  // --- NEU (Phase 4): wie viele Mitglieder der aktuell geöffneten Gruppe sind online ---
  const activeGroupOnlineCount = useMemo(() => {
    if (!activeGroupDetail) return 0;
    return activeGroupDetail.members.filter((m) => m.id !== user?.id && onlineUserIds.has(m.id)).length;
  }, [activeGroupDetail, onlineUserIds, user]);

  // --- Manejadores de Interacción ---
  const handleSelectUser = (userToChat) => {
    setActiveGroupId(null); // <<< NEU (Phase 4): 1:1-Chat und Gruppen-Chat schließen sich gegenseitig aus
    if (selectedChatUser?.id !== userToChat.id) {
        setSelectedChatUser(userToChat);
    }
  };
  const handleSendMessage = ({ recipientUsername, content, replyToId }) => {
    const currentSocket = socketRef.current;
    if (currentSocket?.connected && content && recipientUsername) {
       currentSocket.emit('sendMessage', { recipientUsername, content, replyToId });
       // <<< CAMBIO: Estado traducido >>>
       const statusAfterTimeout = currentSocket.connected ? 'Verbunden.' : 'Getrennt.';
       // <<< CAMBIO: Estado traducido >>>
       setSocketStatusMessage('Sende Nachricht...');
       setTimeout(() => setSocketStatusMessage(statusAfterTimeout), 1500);
    } else {
       console.warn("App: Senden nicht möglich.", { isConnected: currentSocket?.connected }); // Log geändert
       // <<< CAMBIO: Estado traducido >>>
       setSocketStatusMessage("Fehler: Nicht verbunden oder Daten fehlen.");
    }
  };

  // --- Manejadores de Autenticación ---
  const handleLoginSuccess = ({ token: newToken, user: loggedInUser }) => {
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setToken(newToken);
    setUser(loggedInUser);
    setAuthError('');
    setIsRegistering(false);
  };
  const handleRegisterSuccess = (message) => {
    setAuthError('');
    setIsRegistering(false);
     // <<< CAMBIO: Alert traducido (teilweise) >>>
     // Der 'message' Teil kommt vom Backend und wird nicht übersetzt
    alert(message + " Bitte melden Sie sich an.");
  };
  const handleAuthFailure = (message) => {
    setAuthError(message); // Zeigt Fehler von LoginForm/RegisterForm an
  };

  // --- NEU (Phase 3): abgeleitete Werte für den aktuell geöffneten Chat-Partner ---
  const isPartnerTyping = typingUserId !== null && typingUserId === selectedChatUser?.id;
  const partnerLastSeenAt = selectedChatUser
    ? contacts.find((c) => c.id === selectedChatUser.id)?.lastSeenAt || null
    : null;

  // --- NEU (Phase 5): Favoriten als Set für schnellen Zugriff (`type:id`) ---
  const favoriteIds = new Set(favorites.map((f) => `${f.messageType}:${f.messageId}`));

  // --- Renderizado Condicional ---

  // 1. Vista de Autenticación
  if (!user || !token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="auth-logo-icon"><FiMessageCircle /></span>
            <span className="auth-logo-text">Pulse</span>
          </div>
          {/* <<< CAMBIO: Título traducido >>> */}
          <h2 className="auth-title">{isRegistering ? 'Registrierung' : 'Anmelden'}</h2>
          <p className="auth-subtitle">
            {isRegistering ? 'Erstelle ein neues Konto' : 'Melde dich an, um fortzufahren'}
          </p>
          {authError && <p className="form-message form-message-error">{authError}</p>}
          {isRegistering ? (
            <RegisterForm onRegisterSuccess={handleRegisterSuccess} onAuthFailure={handleAuthFailure} />
          ) : (
            <LoginForm onLoginSuccess={handleLoginSuccess} onAuthFailure={handleAuthFailure} />
          )}
          {/* <<< CAMBIO: Botón traducido >>> */}
          <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="auth-switch-btn">
            {isRegistering ? 'Schon ein Konto? Anmelden' : 'Kein Konto? Registrieren'}
          </button>
        </div>
      </div>
    );
  }

  // 2. Vista Principal del Chat
  return (
    <div className={`app-container ${(selectedChatUser || activeGroupId) ? 'chat-active' : ''}`}>
      <ConversationList
         conversations={allConversationItems}
         onSelectUser={handleSelectUser}
         selectedUserId={selectedChatUser?.id}
         onOpenContacts={() => setIsContactsPanelOpen(true)}
         pendingRequestCount={incomingRequests.length}
         onSelectGroup={handleSelectGroup}
         activeGroupId={activeGroupId}
         onOpenCreateGroup={() => setIsCreateGroupModalOpen(true)}
         onOpenSearch={() => setIsSearchModalOpen(true)}
         onOpenFavorites={() => setIsFavoritesPanelOpen(true)}
      />
      <ContactsPanel
         isOpen={isContactsPanelOpen}
         onClose={() => setIsContactsPanelOpen(false)}
         allUsers={usersList}
         contacts={contacts}
         incoming={incomingRequests}
         outgoing={outgoingRequests}
         blocked={blockedUsers}
         onSendRequest={sendContactRequest}
         onAccept={acceptContactRequest}
         onReject={rejectContactRequest}
         onCancel={cancelContactRequest}
         onBlock={blockUser}
         onUnblock={unblockUser}
      />
      {/* NEU (Phase 4): Gruppen-Panels */}
      <CreateGroupModal
         isOpen={isCreateGroupModalOpen}
         onClose={() => setIsCreateGroupModalOpen(false)}
         contacts={contacts}
         onCreateGroup={createGroup}
      />
      <GroupInfoPanel
         isOpen={isGroupInfoOpen}
         onClose={() => setIsGroupInfoOpen(false)}
         group={activeGroupDetail}
         contacts={contacts}
         onEditGroup={editGroup}
         onInviteMember={inviteGroupMember}
         onKickMember={kickGroupMember}
         onChangeRole={changeGroupMemberRole}
         onLeaveGroup={leaveGroup}
         onDeleteGroup={deleteGroup}
      />
      {/* NEU (Phase 5) */}
      <ForwardMessageModal
         isOpen={!!forwardingMessage}
         onClose={() => setForwardingMessage(null)}
         conversations={allConversationItems}
         onSelectDestination={forwardMessage}
      />
      <FavoritesPanel
         isOpen={isFavoritesPanelOpen}
         onClose={() => setIsFavoritesPanelOpen(false)}
         favorites={favorites}
         allMessages={allMessages}
         groupMessages={groupMessages}
         onToggleFavorite={toggleFavorite}
      />
      <GlobalSearchModal
         isOpen={isSearchModalOpen}
         onClose={() => setIsSearchModalOpen(false)}
         allMessages={allMessages}
         groupMessages={groupMessages}
         groups={groups}
         usersList={usersList}
         contacts={contacts}
         onJumpToDirectChat={jumpToDirectChatFromSearch}
         onJumpToGroup={jumpToGroupFromSearch}
         onSendContactRequest={sendContactRequest}
      />
      <div className="chat-area">
         <div className="app-topbar">
             <div className="app-topbar-user">
               <Avatar name={user.username} size="sm" />
               <div className="app-topbar-user-info">
                 {/* <<< CAMBIO: Texto traducido >>> */}
                 <span className="app-topbar-username">{user.username}</span>
                 <span className={`app-topbar-status ${isConnected ? 'is-online' : ''}`}>
                   <span className="status-dot" />
                   {isConnected ? 'Verbunden' : 'Getrennt'}
                 </span>
               </div>
             </div>
             {/* NEU (Phase 3): Benachrichtigungs-/Sound-Einstellungen */}
             <SettingsMenu
               notificationsEnabled={notificationsEnabled}
               onToggleNotifications={toggleNotifications}
               soundEnabled={soundEnabled}
               onToggleSound={toggleSound}
             />
             {/* <<< CAMBIO: Botón traducido >>> */}
             <button onClick={handleLogout} className="btn btn-logout">
               <FiLogOut />
               <span>Abmelden</span>
             </button>
         </div>
         {activeGroupId && activeGroupDetail ? (
           <GroupChatWindow
             currentUser={user}
             group={activeGroupDetail}
             messages={activeGroupMessages}
             onSendMessage={handleSendGroupMessage}
             onlineMemberCount={activeGroupOnlineCount}
             onBackToList={() => setActiveGroupId(null)}
             onOpenInfo={() => setIsGroupInfoOpen(true)}
             onEditMessage={editGroupMessage}
             onDeleteMessage={deleteGroupMessage}
             onPinMessage={pinGroupMessage}
             onUnpinMessage={unpinGroupMessage}
             onForwardMessage={setForwardingMessage}
             favoriteIds={favoriteIds}
             onToggleFavorite={toggleFavorite}
           />
         ) : (
           <ChatWindow
             currentUser={user}
             chatPartner={selectedChatUser}
             messages={filteredMessages}
             onSendMessage={handleSendMessage}
             statusMessage={socketStatusMessage} // Übergibt die (ggf. übersetzte) Statusnachricht
             isConnected={isConnected}
             onBackToList={() => setSelectedChatUser(null)}
             isPartnerOnline={selectedChatUser ? onlineUserIds.has(selectedChatUser.id) : false}
             onRemoveContact={removeContact}
             onBlockContact={blockUser}
             onTyping={handleTyping}
             isPartnerTyping={isPartnerTyping}
             partnerLastSeenAt={partnerLastSeenAt}
             onEditMessage={editMessage}
             onDeleteMessage={deleteMessage}
             onPinMessage={pinMessage}
             onUnpinMessage={unpinMessage}
             onForwardMessage={setForwardingMessage}
             favoriteIds={favoriteIds}
             onToggleFavorite={toggleFavorite}
           />
         )}
      </div>
    </div>
  );
}

export default App;
