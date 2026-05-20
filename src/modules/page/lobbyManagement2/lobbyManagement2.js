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

                // ── Queue participant inline links (GB name | number) ─────────────
                handleQueueNameClick(event) {
                    event.preventDefault();
                }

                handleQueueBadgeClick(event) {
                    event.preventDefault();
                }

                // ── Appointment badge link ────────────────────────────────────────
                handleApptBadgeClick(event) {
                    event.preventDefault();
                    const id = event.currentTarget.dataset.id;
                    // In production this would navigate to the Service Appointment record.
                    // For the prototype we fire the same appt-menu so reviewers can see it's interactive.
                    this.dispatchEvent(new CustomEvent('apptbadgeclick', { detail: { id }, bubbles: true, composed: true }));
                }

    // ── Appointment accordion (SLDS lightning-accordion) ─────────────
    get apptOpenSections() {
        const open = [];
        if (this.sectionCurrentOpen)  open.push('current');
        if (this.sectionUpcomingOpen) open.push('upcoming');
        if (this.sectionPastOpen)     open.push('past');
        return open;
    }

    handleApptAccordionToggle(event) {
        const open = event.detail.openSections || [];
        this.sectionCurrentOpen  = open.includes('current');
        this.sectionUpcomingOpen = open.includes('upcoming');
        this.sectionPastOpen     = open.includes('past');
    }

    get currentSectionLabel()  { return `Current \u2022 ${this.currentSectionMetaLine}`; }
    get upcomingSectionLabel() { return `Upcoming \u2022 ${this.upcomingSectionMetaLine}`; }
    get pastSectionLabel()     { return `Past \u2022 ${this.pastSectionMetaLine}`; }

                // ── Other inherited modals (kept for parity) ──────────────────────
    @track showRepoConfirm = false;
    @track showTransferModal = false;
    @track showDailySummary = false;
    @track showPeakChart = false;
    @track showRescheduleModal = false;
}
