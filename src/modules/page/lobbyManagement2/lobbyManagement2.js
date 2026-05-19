import { track } from 'lwc';
import LobbyManagement from 'page/lobbyManagement';

/**
 * Lobby Management 2 — SLDS 2 redesign.
 * Inherits all data and logic from LobbyManagement.
 *
 * Reactive overlay flags use dedicated child-class @track fields
 * (names prefixed lm2_) to guarantee template reactivity regardless of
 * LWC's inherited-field tracking behaviour.
 */
export default class LobbyManagement2 extends LobbyManagement {
    // ── General Banking check-in overlay ──────────────────────────────
    @track lm2_gbCheckinOpen = false;

    handleQueueCheckIn() {
        this.lm2_gbCheckinOpen = !this.lm2_gbCheckinOpen;
    }

    handleCloseCheckinComposer() {
        this.lm2_gbCheckinOpen = false;
    }

    handleSubmitCheckinComposer() {
        super.handleSubmitCheckinComposer && super.handleSubmitCheckinComposer();
        this.lm2_gbCheckinOpen = false;
    }

    // ── Investment Banking check-in overlay ───────────────────────────
    @track lm2_ibCheckinOpen = false;

    handleInvestmentQueueCheckIn() {
        this.lm2_ibCheckinOpen = !this.lm2_ibCheckinOpen;
    }

    handleCloseInvestmentCheckinComposer() {
        this.lm2_ibCheckinOpen = false;
    }

    handleSubmitCheckinComposerInvestment() {
        super.handleSubmitCheckinComposerInvestment && super.handleSubmitCheckinComposerInvestment();
        this.lm2_ibCheckinOpen = false;
    }

    // ── Other inherited modals (kept for parity) ──────────────────────
    @track showRepoConfirm = false;
    @track showTransferModal = false;
    @track showDailySummary = false;
    @track showPeakChart = false;
    @track showRescheduleModal = false;
}
