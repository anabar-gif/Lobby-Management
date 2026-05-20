import LobbyManagement2 from 'page/lobbyManagement2';

/**
 * Lobby Management 3 — identical to Lobby Management 2.
 * Extends LobbyManagement2 so all data, logic, and handlers are inherited.
 */
export default class LobbyManagement3 extends LobbyManagement2 {
    get todayLabel() {
        return 'Appointments for Today';
    }
}
