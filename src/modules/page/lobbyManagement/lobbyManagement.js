import { LightningElement, track } from 'lwc';

/** Parses the first integer in parentheses, e.g. `Notary (1)` → 1. Missing → +∞ so those sort last. */
function parseBracketCount(label) {
    const m = /\((\d+)\)/.exec(label);
    return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

/** Accordion topic order: descending by count in brackets (highest first), then A→Z by label within the same count. */
function sortLobbyTopicsByCountDesc(topics) {
    return [...topics].sort((a, b) => {
        const ca = parseBracketCount(a.label);
        const cb = parseBracketCount(b.label);
        if (ca !== cb) {
            return cb - ca;
        }
        return a.label.localeCompare(b.label, 'en', { sensitivity: 'base' });
    });
}

/** Formats total minutes as `H hr M min` for queue summary (matches single-slot copy like `0 hr 30 min`). */
function formatDurationFromMinutes(totalMin) {
    const safe = Math.max(0, Math.round(totalMin));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    if (h > 0 && m > 0) {
        return `${h} hr ${m} min`;
    }
    if (h > 0) {
        return `${h} hr 0 min`;
    }
    return `0 hr ${m} min`;
}

/** Figma MCP assets (All-Scheduler-Flows) — same sources as design context */
const ASSET_QUEUE_ICON =
    'https://www.figma.com/api/mcp/asset/5d460ebf-bf8f-4a95-9cef-d6514634cfdb';
export default class LobbyManagement extends LightningElement {
    queueIconUrl = ASSET_QUEUE_ICON;

    @track selectedBranch = 'Market St Branch';

    handleBranchSelect(event) {
        this.selectedBranch = event.detail.value;
    }

    @track selectedWaitlistFilter = 'all'; // matches 'All waitlists'
    @track appointmentsListFilter = 'all';

    get waitlistFilterOptions() {
        return [
            { label: 'All waitlists', value: 'all' },
            { label: 'All active waitlists', value: 'active' },
            { label: 'All inactive waitlists', value: 'inactive' },
        ];
    }

    currentSectionTime = '9:10 AM';
    upcomingSectionTime = '10:11 AM';

    get currentSectionMetaLine() {
        const n = this.currentAppointments?.length ?? 0;
        const word = n === 1 ? 'appointment' : 'appointments';
        return `${this.currentSectionTime} · ${n} ${word}`;
    }

    get upcomingSectionMetaLine() {
        const n = this.upcomingAppointments?.length ?? 0;
        const word = n === 1 ? 'appointment' : 'appointments';
        return `${this.upcomingSectionTime} · ${n} ${word}`;
    }

    metaLineSecondary = 'Filtered by All';

    get metaLinePrimary() {
        const n = (this.currentAppointments?.length ?? 0) + (this.upcomingAppointments?.length ?? 0);
        const w = n === 1 ? 'Item' : 'Items';
        return `${n} ${w} • Updated 8 min ago`;
    }

    investmentQueueMetaLeft = 'Showing 1 of 1 Item • Updated 8 min ago';
    investmentQueueMetaRight = 'Total Appointment Duration: 1 hr 0 min';

    @track showAllTopicsGeneral = false;
    @track showAllTopicsInvestment = false;
    @track showCheckinComposer = false;
    @track showCheckinComposerInvestment = false;

    /** Empty = all General Banking accordion sections closed on load (requires multi-section mode on `lightning-accordion`). */
    @track generalBankingOpenSections = ['general-banking-queue'];
    @track investmentBankingOpenSection = 'investment-planning';

    /** Debounce General Banking `sectiontoggle`: intermediate events can report partial `openSections` and clobber a full open. */
    _generalAccToggleT;
    _lastGeneralAccDetail;

    /**
     * True from "Show all topics" on until the accordion has reported a full set of open sections, or a timeout.
     * While true, we ignore debounced events whose openSections are not yet the full set.
     */
    _applyingShowAll = false;
    _applyShowAllClearT;

    generalBankingTopics = sortLobbyTopicsByCountDesc([
        {
            id: 'personal-banking',
            label: 'Personal Banking (2)',
            participants: [
                {
                    id: 'gb-pb1',
                    ordinal: '1.',
                    workItemId: 'WP-0101',
                    linkLabel: 'Alex Rivera',
                    topic: 'Checking Account • Jamie Lee',
                    checkInTime: '08:45 AM',
                    waitTime: '12 min'
                },
                {
                    id: 'gb-pb2',
                    ordinal: '2.',
                    workItemId: 'WP-0102',
                    linkLabel: 'Sam Patel',
                    topic: 'Savings Account • Jamie Lee',
                    checkInTime: '09:02 AM',
                    waitTime: '22 min'
                }
            ]
        },
        {
            id: 'wealth-management',
            label: 'Wealth Management (2)',
            participants: [
                {
                    id: 'gb-wm1',
                    ordinal: '1.',
                    workItemId: 'WP-0201',
                    linkLabel: 'Jordan Chen',
                    topic: 'Portfolio Review • Morgan Blake',
                    checkInTime: '09:15 AM',
                    waitTime: '35 min'
                },
                {
                    id: 'gb-wm2',
                    ordinal: '2.',
                    workItemId: 'WP-0202',
                    linkLabel: 'Taylor Brooks',
                    topic: 'Trust Services • Morgan Blake',
                    checkInTime: '09:28 AM',
                    waitTime: '48 min'
                }
            ]
        },
        {
            id: 'insurance',
            label: 'Insurance (1)',
            participants: [
                {
                    id: 'gb-in1',
                    ordinal: '1.',
                    workItemId: 'WP-0301',
                    linkLabel: 'Riley Nguyen',
                    topic: 'Life Policy • Casey Frost',
                    checkInTime: '10:05 AM',
                    waitTime: '15 min'
                }
            ]
        },
        {
            id: 'gb-topic-investment',
            label: 'Investment Banking (1)',
            participants: [
                {
                    id: 'gb-ib1',
                    ordinal: '1.',
                    workItemId: 'WP-0401',
                    linkLabel: 'Morgan Ellis',
                    topic: 'Business Loan • Drew Park',
                    checkInTime: '10:40 AM',
                    waitTime: '1 hr 05 min'
                }
            ]
        },
        {
            id: 'wt',
            label: 'WT (0)',
            participants: []
        },
        {
            id: 'notary',
            label: 'Notary (1)',
            participants: [
                {
                    id: 'gb-p1',
                    ordinal: '1.',
                    workItemId: 'WP-0216',
                    linkLabel: 'Acme',
                    topic: 'Notary',
                    checkInTime: '11:34 AM',
                    waitTime: '3 hr 54 min'
                }
            ]
        },
        {
            id: 'general-banking-queue',
            label: 'General Banking (3)',
            participants: [
                {
                    id: 'gb-gb1',
                    ordinal: '1.',
                    workItemId: 'WP-132',
                    linkLabel: 'Julia Green',
                    topic: 'Savings Account • Auto Assigned',
                    checkInTime: '09:15 AM',
                    waitTime: '22 min'
                },
                {
                    id: 'gb-gb2',
                    ordinal: '2.',
                    workItemId: 'WP-134',
                    linkLabel: 'James Won',
                    topic: 'Savings Account • Rachel Adams',
                    checkInTime: '09:20 AM',
                    waitTime: '01 : 25 mins.'
                },
                {
                    id: 'gb-gb3',
                    ordinal: '3.',
                    workItemId: 'WP-134',
                    linkLabel: 'James Won',
                    topic: 'Savings Account • Rachel Adams',
                    checkInTime: '09:20 AM',
                    waitTime: '01 : 25 mins.'
                }
            ]
        }
    ]);

    investmentBankingTopics = sortLobbyTopicsByCountDesc([
        {
            id: 'investment-planning',
            label: 'Investment Planning (1)',
            participants: [
                {
                    id: 'ib-p1',
                    ordinal: '1.',
                    workItemId: 'WP-0215',
                    linkLabel: 'Lead Participant',
                    topic: 'Investment Planning',
                    checkInTime: '11:13 AM',
                    waitTime: '4 hr 14 min'
                }
            ]
        }
    ]);

    get generalBankingParticipantCount() {
        return (this.generalBankingTopics || []).reduce(
            (sum, topic) => sum + (topic.participants?.length ?? 0),
            0
        );
    }

    get generalQueueMetaLeft() {
        const n = this.generalBankingParticipantCount;
        const itemWord = n === 1 ? 'Item' : 'Items';
        return `Showing ${n} of ${n} ${itemWord} ∙ Updated 6 min ago`;
    }

    get generalQueueMetaRight() {
        const n = this.generalBankingParticipantCount;
        const slotMinutesPerItem = 30;
        const totalMin = n * slotMinutesPerItem;
        return `Total Appointment Duration: ${formatDurationFromMinutes(totalMin)}`;
    }

    @track currentAppointments = [
        {
            id: 'a1',
            customerName: 'Arna Sumaiyah',
            subtitle: 'Savings Account • Rachel Adams',
            slot: '9:00 am - 9:30 am',
            showWaitAlert: true,
            waitLabel: 'Customer Wait Time:',
            waitTime: '00 : 10 mins.',
            showCheckin: false,
            checkedIn: true
        },
        {
            id: 'a2',
            customerName: 'James Clain',
            subtitle: 'Savings Account • Rachel Adams',
            slot: '9:30 am - 10:00 am',
            showWaitAlert: false,
            showCheckin: true
        }
    ];

    @track upcomingAppointments = [
        {
            id: 'b1',
            customerName: 'Smith Kim',
            subtitle: 'Savings Account • Rachel Adams',
            slot: '10:00 am - 10:30 am',
            showWaitAlert: false,
            showCheckin: true
        },
        {
            id: 'b2',
            customerName: 'Regina Hem',
            subtitle: 'Savings Account • Rachel Adams',
            slot: '10:00 am - 10:30 am',
            showWaitAlert: false,
            showCheckin: true
        },
        {
            id: 'b3',
            customerName: 'Ken Adams',
            subtitle: 'Savings Account • Rachel Adams',
            slot: '10:00 am - 10:30 am',
            showWaitAlert: false,
            showCheckin: true
        }
    ];

    handleWaitlistFilterChange(event) {
        this.selectedWaitlistFilter = event.detail.value;
    }

    handleAppointmentsFilterSelect(event) {
        const v = event.detail.value;
        if (v) {
            this.appointmentsListFilter = v;
        }
    }

    handleRefresh() {
        // Demo: hook for reload
    }

    @track showParticipantDropdown = false;
    @track showParticipantDropdownInvestment = false;
    @track participantSearch = '';
    @track participantSearchInvestment = '';

    participantRecentItems = [
        { id: 'p1', label: 'Ben Richards', meta: '', icon: 'standard:account' },
        { id: 'p2', label: 'Global Media', meta: '(905) 555-1212', icon: 'standard:account' },
        { id: 'p3', label: 'Julie Morris', meta: '(212) 555-5555', icon: 'standard:account' },
        { id: 'p4', label: 'Julia Green', meta: '6528872581', icon: 'standard:account' },
        { id: 'p5', label: 'Acme', meta: '', icon: 'standard:account' },
    ];

    get filteredParticipants() {
        const q = this.participantSearch.toLowerCase();
        return q
            ? this.participantRecentItems.filter(p => p.label.toLowerCase().includes(q) || p.meta.includes(q))
            : this.participantRecentItems;
    }

    get filteredParticipantsInvestment() {
        const q = this.participantSearchInvestment.toLowerCase();
        return q
            ? this.participantRecentItems.filter(p => p.label.toLowerCase().includes(q) || p.meta.includes(q))
            : this.participantRecentItems;
    }

    handleParticipantFocus() {
        this.showParticipantDropdown = true;
    }

    handleParticipantInput(event) {
        this.participantSearch = event.target.value;
        this.showParticipantDropdown = true;
    }

    handleParticipantSelect(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.participantRecentItems.find(p => p.id === id);
        if (item) {
            this.participantSearch = item.label;
        }
        this.showParticipantDropdown = false;
    }

    handleParticipantBlur() {
        // Delay so click on dropdown item fires first
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.showParticipantDropdown = false; }, 200);
    }

    handleParticipantFocusInvestment() {
        this.showParticipantDropdownInvestment = true;
    }

    handleParticipantInputInvestment(event) {
        this.participantSearchInvestment = event.target.value;
        this.showParticipantDropdownInvestment = true;
    }

    handleParticipantSelectInvestment(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.participantRecentItems.find(p => p.id === id);
        if (item) {
            this.participantSearchInvestment = item.label;
        }
        this.showParticipantDropdownInvestment = false;
    }

    handleParticipantBlurInvestment() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.showParticipantDropdownInvestment = false; }, 200);
    }

    get checkinTopicOptions() {
        return [
            { label: 'Savings Account', value: 'savings-account' },
            { label: 'Business Checking', value: 'business-checking' },
        ];
    }

    get checkinResourceOptions() {
        return [
            { label: 'None', value: '' },
            { label: 'Adam Milne', value: 'adam-milne' },
            { label: 'Tom Chang', value: 'tom-chang' },
        ];
    }

    handleQueueCheckIn() {
        this.showCheckinComposer = !this.showCheckinComposer;
    }

    handleCloseCheckinComposer() {
        this.showCheckinComposer = false;
    }

    handleInvestmentQueueCheckIn() {
        this.showCheckinComposerInvestment = !this.showCheckinComposerInvestment;
    }

    handleCloseInvestmentCheckinComposer() {
        this.showCheckinComposerInvestment = false;
    }

    handleQueueInfo() {
        // Demo: hook for queue details
    }

    handleQueueFilter() {
        // Demo: hook for queue filter or sort
    }

    handleShowAllTopicsGeneral(event) {
        if (this._generalAccToggleT) {
            clearTimeout(this._generalAccToggleT);
            this._generalAccToggleT = null;
        }
        if (this._applyShowAllClearT) {
            clearTimeout(this._applyShowAllClearT);
            this._applyShowAllClearT = null;
        }
        const on = typeof event.detail?.checked === 'boolean' ? event.detail.checked : Boolean(event.target?.checked);
        this.showAllTopicsGeneral = on;
        if (on) {
            this._applyingShowAll = true;
            this.generalBankingOpenSections = [...this.generalBankingTopics.map((t) => t.id)];
            this._applyShowAllClearT = setTimeout(() => {
                this._applyShowAllClearT = null;
                this._applyingShowAll = false;
                if (this.showAllTopicsGeneral) {
                    this.generalBankingOpenSections = [...this.generalBankingTopics.map((t) => t.id)];
                }
            }, 500);
        } else {
            this._applyingShowAll = false;
            this.generalBankingOpenSections = [];
        }
    }

    handleShowAllTopicsInvestment(event) {
        this.showAllTopicsInvestment = event.target.checked;
    }

    handleGeneralAccordionToggle(event) {
        this._lastGeneralAccDetail = event.detail;
        if (this._generalAccToggleT) {
            clearTimeout(this._generalAccToggleT);
        }
        this._generalAccToggleT = setTimeout(() => {
            this._generalAccToggleT = null;
            const d = this._lastGeneralAccDetail;
            const open = d && d.openSections;
            const openArr = Array.isArray(open) ? [...open] : open ? [open] : [];
            const allIds = this.generalBankingTopics.map((t) => t.id);
            const isFullSet =
                allIds.length > 0 &&
                openArr.length === allIds.length &&
                allIds.every((id) => openArr.includes(id));

            if (this._applyingShowAll && !isFullSet) {
                return;
            }
            if (isFullSet) {
                this._applyingShowAll = false;
                if (this._applyShowAllClearT) {
                    clearTimeout(this._applyShowAllClearT);
                    this._applyShowAllClearT = null;
                }
            }

            this.generalBankingOpenSections = openArr;
            this.showAllTopicsGeneral = isFullSet;
        }, 16);
    }

    handleInvestmentAccordionToggle(event) {
        const open = event.detail.openSections;
        this.investmentBankingOpenSection = Array.isArray(open) ? open[0] ?? '' : open ?? '';
    }

    handleQueueParticipantMenu() {
        // Demo: participant row actions
    }

    handleCheckin(event) {
        const id = event.currentTarget?.dataset?.id;
        if (!id) return;

        const now = new Date();
        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        const waitTime = `00 : ${mm} mins.`;

        const updateList = (list) =>
            list.map((appt) =>
                appt.id === id
                    ? {
                          ...appt,
                          checkedIn: true,
                          showCheckin: false,
                          showWaitAlert: true,
                          waitLabel: 'Customer Wait Time:',
                          waitTime
                      }
                    : appt
            );

        this.currentAppointments = updateList(this.currentAppointments);
        this.upcomingAppointments = updateList(this.upcomingAppointments);
    }

    handleApptMenu() {
        // Demo: row actions menu
    }
}
