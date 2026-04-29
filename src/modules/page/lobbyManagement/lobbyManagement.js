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

    connectedCallback() {
        this._handleDocClick = (e) => {
            const insideRowMenu  = e.target.closest?.('.lobby-row-menu-wrap') || e.target.closest?.('.lobby-row-menu__dropdown');
            const insideApptMenu = e.target.closest?.('.lobby-appt__menu-btn') || e.target.closest?.('.lobby-row-menu__dropdown');
            if (this.activeMenuRowId  && !insideRowMenu)  this.activeMenuRowId  = null;
            if (this.activeApptMenuId && !insideApptMenu) this.activeApptMenuId = null;
        };
        document.addEventListener('click', this._handleDocClick, true);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._handleDocClick, true);
    }

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

    get metaLineSecondary() {
        const allAppts = [...(this.currentAppointments ?? []), ...(this.upcomingAppointments ?? [])];
        let totalMins = 0;
        allAppts.forEach(a => {
            if (!a.slot) return;
            // Parse "9:00 am - 9:30 am" → start and end in minutes from midnight
            const parts = a.slot.split('-').map(s => s.trim());
            if (parts.length !== 2) return;
            const toMins = str => {
                const m = str.match(/(\d+):(\d+)\s*(am|pm)/i);
                if (!m) return 0;
                let h = parseInt(m[1], 10);
                const min = parseInt(m[2], 10);
                const period = m[3].toLowerCase();
                if (period === 'pm' && h !== 12) h += 12;
                if (period === 'am' && h === 12) h = 0;
                return h * 60 + min;
            };
            const diff = toMins(parts[1]) - toMins(parts[0]);
            if (diff > 0) totalMins += diff;
        });
        const hrs  = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const label = hrs > 0
            ? (mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`)
            : `${mins} min`;
        return `Total Appointment Duration: ${label}`;
    }

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
                    slot: '8:30 am - 9:00 am',
                    checkInTime: '08:45 AM',
                    waitTime: '00 : 12 mins.'
                },
                {
                    id: 'gb-pb2',
                    ordinal: '2.',
                    workItemId: 'WP-0102',
                    linkLabel: 'Sam Patel',
                    topic: 'Savings Account • Jamie Lee',
                    slot: '9:00 am - 9:30 am',
                    checkInTime: '09:02 AM',
                    waitTime: '00 : 22 mins.'
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
                    slot: '9:00 am - 9:30 am',
                    checkInTime: '09:15 AM',
                    waitTime: '00 : 35 mins.'
                },
                {
                    id: 'gb-wm2',
                    ordinal: '2.',
                    workItemId: 'WP-0202',
                    linkLabel: 'Taylor Brooks',
                    topic: 'Trust Services • Morgan Blake',
                    slot: '9:00 am - 9:30 am',
                    checkInTime: '09:28 AM',
                    waitTime: '00 : 48 mins.'
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
                    topic: 'General Banking',
                    slot: '9:00 am - 9:30 am',
                    checkInTime: '09:15 AM',
                    waitTime: '00 : 22 mins.'
                },
                {
                    id: 'gb-gb2',
                    ordinal: '2.',
                    workItemId: 'WP-134',
                    linkLabel: 'James Won',
                    topic: 'General Banking • Rachel Adams',
                    slot: '9:00 am - 9:30 am',
                    checkInTime: '09:20 AM',
                    waitTime: '01 : 25 mins.'
                },
                {
                    id: 'gb-gb3',
                    ordinal: '3.',
                    workItemId: 'WP-134',
                    linkLabel: 'James Won',
                    topic: 'General Banking • Rachel Adams',
                    slot: '9:00 am - 9:30 am',
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
                    linkLabel: 'Julia Green',
                    topic: 'Investment Planning',
                    slot: '11:00 am - 11:30 am',
                    checkInTime: '11:13 AM',
                    waitTime: '04 : 14 mins.'
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
            waitLabel: 'Wait Time:',
            waitTime: '00 : 10 mins.',
            showCheckin: false,
            checkedIn: true,
            checkedInLabel: 'Checked In at 9:00 am'
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

    // ── Participant grouped combobox ──
    @track participantSearch = '';
    @track participantSearchInvestment = '';
    @track showParticipantDropdown = false;
    @track showParticipantDropdownInvestment = false;
    @track showParticipantTypeDropdown = false;
    @track showParticipantTypeDropdownInvestment = false;
    @track selectedParticipantType = 'Account';
    @track selectedParticipantTypeInvestment = 'Account';

    participantTypeOptions = [
        { id: 'pt-account', label: 'Account', icon: 'standard:account' },
        { id: 'pt-contact', label: 'Contact', icon: 'standard:contact' },
        { id: 'pt-lead',    label: 'Lead',    icon: 'standard:lead' },
    ];

    participantRecentItems = [
        { id: 'p1', label: 'Ben Richards',  meta: '',              icon: 'standard:account' },
        { id: 'p2', label: 'Global Media',  meta: '(905) 555-1212', icon: 'standard:account' },
        { id: 'p3', label: 'Julie Morris',  meta: '(212) 555-5555', icon: 'standard:account' },
        { id: 'p4', label: 'Julia Green',   meta: '6528872581',     icon: 'standard:account' },
        { id: 'p5', label: 'Acme',          meta: '',              icon: 'standard:account' },
    ];

    get filteredParticipants() {
        const q = this.participantSearch.toLowerCase();
        return q ? this.participantRecentItems.filter(p => p.label.toLowerCase().includes(q) || p.meta.includes(q)) : this.participantRecentItems;
    }

    get filteredParticipantsInvestment() {
        const q = this.participantSearchInvestment.toLowerCase();
        return q ? this.participantRecentItems.filter(p => p.label.toLowerCase().includes(q) || p.meta.includes(q)) : this.participantRecentItems;
    }

    // Type dropdown — General Banking
    handleParticipantTypeToggle() {
        this.showParticipantTypeDropdown = !this.showParticipantTypeDropdown;
        this.showParticipantDropdown = false;
    }

    handleParticipantTypeSelect(event) {
        const id = event.currentTarget.dataset.id;
        const opt = this.participantTypeOptions.find(o => o.id === id);
        if (opt) this.selectedParticipantType = opt.label;
        this.showParticipantTypeDropdown = false;
    }

    handleParticipantTypeBlur() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.showParticipantTypeDropdown = false; }, 200);
    }

    // Search dropdown — General Banking
    handleParticipantFocus() {
        this.showParticipantDropdown = true;
        this.showParticipantTypeDropdown = false;
    }

    handleParticipantInput(event) {
        this.participantSearch = event.target.value;
        this.showParticipantDropdown = true;
    }

    handleParticipantSelect(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.participantRecentItems.find(p => p.id === id);
        if (item) this.participantSearch = item.label;
        this.showParticipantDropdown = false;
    }

    handleParticipantBlur() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.showParticipantDropdown = false; }, 200);
    }

    // Type dropdown — Investment Banking
    handleParticipantTypeToggleInvestment() {
        this.showParticipantTypeDropdownInvestment = !this.showParticipantTypeDropdownInvestment;
        this.showParticipantDropdownInvestment = false;
    }

    handleParticipantTypeSelectInvestment(event) {
        const id = event.currentTarget.dataset.id;
        const opt = this.participantTypeOptions.find(o => o.id === id);
        if (opt) this.selectedParticipantTypeInvestment = opt.label;
        this.showParticipantTypeDropdownInvestment = false;
    }

    handleParticipantTypeBlurInvestment() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.showParticipantTypeDropdownInvestment = false; }, 200);
    }

    // Search dropdown — Investment Banking
    handleParticipantFocusInvestment() {
        this.showParticipantDropdownInvestment = true;
        this.showParticipantTypeDropdownInvestment = false;
    }

    handleParticipantInputInvestment(event) {
        this.participantSearchInvestment = event.target.value;
        this.showParticipantDropdownInvestment = true;
    }

    handleParticipantSelectInvestment(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.participantRecentItems.find(p => p.id === id);
        if (item) this.participantSearchInvestment = item.label;
        this.showParticipantDropdownInvestment = false;
    }

    handleParticipantBlurInvestment() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.showParticipantDropdownInvestment = false; }, 200);
    }

    get checkinTopicOptions() {
        return [
            { label: 'General Banking',   value: 'general-banking' },
            { label: 'Savings Account',   value: 'savings-account' },
            { label: 'Business Checking', value: 'business-checking' },
            { label: 'Personal Banking',  value: 'personal-banking' },
            { label: 'Wealth Management', value: 'wealth-management' },
        ];
    }

    get ibCheckinTopicOptions() {
        return [
            { label: 'Investment Banking',  value: 'investment-banking' },
            { label: 'Investment Planning', value: 'investment-planning' },
            { label: 'Savings Account',     value: 'savings-account' },
            { label: 'Business Checking',   value: 'business-checking' },
        ];
    }

    get checkinResourceOptions() {
        return [
            { label: 'None',       value: '' },
            { label: 'Adam Milne', value: 'adam-milne' },
            { label: 'Tom Chang',  value: 'tom-chang' },
        ];
    }

    // ── General Banking composer form state ──
    @track ciGuestType  = 'existing';
    @track ciTopic      = 'general-banking';
    @track ciResource   = 'adam-milne';
    @track ciDesc       = '';
    @track ciFirstName  = '';
    @track ciLastName   = '';
    @track ciContact    = '';
    @track ciCompany    = '';
    @track ciEmail      = '';

    get ciIsNewParticipant() { return this.ciGuestType === 'new'; }
    get ciIsExisting()       { return this.ciGuestType === 'existing'; }

    handleCiGuestTypeChange(event) { this.ciGuestType = event.target.value; }
    handleCiTopicChange(event)     { this.ciTopic     = event.detail.value; }
    handleCiResourceChange(event)  { this.ciResource  = event.detail.value; }
    handleCiDescChange(event)      { this.ciDesc      = event.target.value; }
    handleCiFirstNameChange(event) { this.ciFirstName = event.target.value; }
    handleCiLastNameChange(event)  { this.ciLastName  = event.target.value; }
    handleCiContactChange(event)   { this.ciContact   = event.target.value; }
    handleCiCompanyChange(event)   { this.ciCompany   = event.target.value; }
    handleCiEmailChange(event)     { this.ciEmail     = event.target.value; }

    // ── Investment Banking composer form state ──
    @track ibCiGuestType  = 'existing';
    @track ibCiTopic      = 'investment-banking';
    @track ibCiResource   = 'adam-milne';
    @track ibCiDesc       = '';
    @track ibCiFirstName  = '';
    @track ibCiLastName   = '';
    @track ibCiContact    = '';
    @track ibCiCompany    = '';
    @track ibCiEmail      = '';

    get ibCiIsNewParticipant() { return this.ibCiGuestType === 'new'; }
    get ibCiIsExisting()       { return this.ibCiGuestType === 'existing'; }

    handleIbCiGuestTypeChange(event) { this.ibCiGuestType = event.target.value; }
    handleIbCiTopicChange(event)     { this.ibCiTopic     = event.detail.value; }
    handleIbCiResourceChange(event)  { this.ibCiResource  = event.detail.value; }
    handleIbCiDescChange(event)      { this.ibCiDesc      = event.target.value; }
    handleIbCiFirstNameChange(event) { this.ibCiFirstName = event.target.value; }
    handleIbCiLastNameChange(event)  { this.ibCiLastName  = event.target.value; }
    handleIbCiContactChange(event)   { this.ibCiContact   = event.target.value; }
    handleIbCiCompanyChange(event)   { this.ibCiCompany   = event.target.value; }
    handleIbCiEmailChange(event)     { this.ibCiEmail     = event.target.value; }

    // ── Shared work-item counter ──
    _wpCounter = 500;
    _nextWpId() { return `WP-${++this._wpCounter}`; }

    _showToast(message) {
        this.dispatchEvent(new CustomEvent('showtoast', {
            bubbles: true,
            composed: true,
            detail: { message }
        }));
    }

    _nowTime() {
        const now = new Date();
        const hh = now.getHours();
        const mm = now.getMinutes().toString().padStart(2, '0');
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const h12 = ((hh % 12) || 12).toString().padStart(2, '0');
        return `${h12}:${mm} ${ampm}`;
    }

    _nowSlot() {
        const now = new Date();
        const startMin = now.getMinutes() < 30 ? 0 : 30;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), startMin);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        const fmt = (d) => {
            const h = d.getHours();
            const m = d.getMinutes().toString().padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            return `${(h % 12) || 12}:${m} ${ampm}`;
        };
        return `${fmt(start)} - ${fmt(end)}`;
    }

    /** Map a topic value from the combobox to the accordion section id it belongs to (General Banking card). */
    _topicValueToSectionId(topicValue) {
        const map = {
            'general-banking':   'general-banking-queue',
            'savings-account':   'general-banking-queue',
            'business-checking': 'general-banking-queue',
            'personal-banking':  'personal-banking',
            'wealth-management': 'wealth-management',
        };
        return map[topicValue] || 'general-banking-queue';
    }

    /** Map a topic value to its human-readable topic string for the participant row. */
    _topicValueToLabel(topicValue) {
        const opt = this.checkinTopicOptions.find(o => o.value === topicValue);
        return opt ? opt.label : topicValue;
    }

    /** Map a resource value to its display name. */
    _resourceValueToLabel(resourceValue) {
        const opt = this.checkinResourceOptions.find(o => o.value === resourceValue);
        return opt ? opt.label : '';
    }

    handleQueueCheckIn() {
        this.showCheckinComposer = !this.showCheckinComposer;
    }

    handleCloseCheckinComposer() {
        this.showCheckinComposer = false;
    }

    handleSubmitCheckinComposer() {
        const participantName = this.ciIsNewParticipant
            ? `${this.ciFirstName.trim()} ${this.ciLastName.trim()}`.trim() || 'New Participant'
            : this.participantSearch.trim() || 'New Participant';
        const resourceLabel   = this._resourceValueToLabel(this.ciResource);
        const topicLabel      = this._topicValueToLabel(this.ciTopic);
        const sectionId       = this._topicValueToSectionId(this.ciTopic);
        const checkInTime     = this._nowTime();

        const newRow = {
            id:          `gb-new-${Date.now()}`,
            ordinal:     '1.',
            workItemId:  this._nextWpId(),
            linkLabel:   participantName,
            topic:       `${topicLabel}${resourceLabel ? ' • ' + resourceLabel : ''}`,
            slot:        this._nowSlot(),
            checkInTime,
            waitTime:    '00 : 00 mins.',
        };

        // Deep-copy topics, prepend new row into the matching section, re-number ordinals
        const updated = this.generalBankingTopics.map(t => {
            if (t.id !== sectionId) return t;
            const rows = [newRow, ...t.participants].map((r, i) => ({ ...r, ordinal: `${i + 1}.` }));
            const count = rows.length;
            const labelBase = t.label.replace(/\s*\(\d+\)$/, '');
            return { ...t, participants: rows, label: `${labelBase} (${count})` };
        });

        this.generalBankingTopics = sortLobbyTopicsByCountDesc(updated);

        // Ensure the section is open so the new card is visible
        if (!this.generalBankingOpenSections.includes(sectionId)) {
            this.generalBankingOpenSections = [...this.generalBankingOpenSections, sectionId];
        }

        // Reset form
        this.participantSearch = '';
        this.ciGuestType = 'existing';
        this.ciFirstName = ''; this.ciLastName = ''; this.ciContact = '';
        this.ciCompany = ''; this.ciEmail = '';
        this.ciTopic    = 'general-banking';
        this.ciResource = 'adam-milne';
        this.ciDesc     = '';
        this.showCheckinComposer = false;
        this._showToast(`${participantName} was added to the waitlist General Banking.`);
    }

    handleInvestmentQueueCheckIn() {
        this.showCheckinComposerInvestment = !this.showCheckinComposerInvestment;
    }

    handleCloseInvestmentCheckinComposer() {
        this.showCheckinComposerInvestment = false;
    }

    handleSubmitCheckinComposerInvestment() {
        const participantName = this.ibCiIsNewParticipant
            ? `${this.ibCiFirstName.trim()} ${this.ibCiLastName.trim()}`.trim() || 'New Participant'
            : this.participantSearchInvestment.trim() || 'New Participant';
        const resourceLabel   = this._resourceValueToLabel(this.ibCiResource);
        const topicLabel      = this._topicValueToLabel(this.ibCiTopic);
        const checkInTime     = this._nowTime();

        const newRow = {
            id:          `ib-new-${Date.now()}`,
            ordinal:     '1.',
            workItemId:  this._nextWpId(),
            linkLabel:   participantName,
            topic:       `${topicLabel}${resourceLabel ? ' • ' + resourceLabel : ''}`,
            slot:        this._nowSlot(),
            checkInTime,
            waitTime:    '00 : 00 mins.',
        };

        const updated = this.investmentBankingTopics.map(t => {
            if (t.id !== 'investment-planning') return t;
            const rows = [newRow, ...t.participants].map((r, i) => ({ ...r, ordinal: `${i + 1}.` }));
            const count = rows.length;
            const labelBase = t.label.replace(/\s*\(\d+\)$/, '');
            return { ...t, participants: rows, label: `${labelBase} (${count})` };
        });

        this.investmentBankingTopics = sortLobbyTopicsByCountDesc(updated);

        if (!this.investmentBankingOpenSection.includes('investment-planning')) {
            this.investmentBankingOpenSection = 'investment-planning';
        }

        // Reset form
        this.participantSearchInvestment = '';
        this.ibCiGuestType = 'existing';
        this.ibCiFirstName = ''; this.ibCiLastName = ''; this.ibCiContact = '';
        this.ibCiCompany = ''; this.ibCiEmail = '';
        this.ibCiTopic    = 'investment-banking';
        this.ibCiResource = 'adam-milne';
        this.ibCiDesc     = '';
        this.showCheckinComposerInvestment = false;
        this._showToast(`${participantName} was added to the waitlist Investment Banking.`);
    }

    handleQueueInfo() {
        // Demo: hook for queue details
    }

    handleQueueFilter() {
        // Demo: hook for queue filter or sort
    }

    get expandLabelGeneral() {
        return this.showAllTopicsGeneral ? 'Collapse all Waitlist' : 'Expand all Waitlist';
    }

    get expandLabelInvestment() {
        return this.showAllTopicsInvestment ? 'Collapse all Waitlist' : 'Expand all Waitlist';
    }

    handleShowAllTopicsGeneral(event) {
        event.preventDefault();
        if (this._generalAccToggleT) {
            clearTimeout(this._generalAccToggleT);
            this._generalAccToggleT = null;
        }
        if (this._applyShowAllClearT) {
            clearTimeout(this._applyShowAllClearT);
            this._applyShowAllClearT = null;
        }
        const on = !this.showAllTopicsGeneral;
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
        event.preventDefault();
        this.showAllTopicsInvestment = !this.showAllTopicsInvestment;
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

    // ── Participant row action dropdown ──

    _closeActiveMenu() {
        this.activeMenuRowId = null;
    }

    @track activeMenuRowId = null;
    @track menuDropdownStyle = '';

    handleQueueParticipantMenu(event) {
        const id = event.currentTarget.dataset.id;
        if (this.activeMenuRowId === id) {
            this.activeMenuRowId = null;
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        this.menuDropdownStyle = `top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;`;
        this.activeMenuRowId = id;
    }

    handleParticipantMenuClose() {
        this._closeActiveMenu();
    }

    _updateTopics(topics, rowId, updaterFn) {
        return topics.map(t => {
            const idx = t.participants.findIndex(p => p.id === rowId);
            if (idx === -1) return t;
            const rows = updaterFn([...t.participants], idx);
            const reNumbered = rows.map((r, i) => ({ ...r, ordinal: `${i + 1}.` }));
            const labelBase = t.label.replace(/\s*\(\d+\)$/, '');
            return { ...t, participants: reNumbered, label: `${labelBase} (${reNumbered.length})` };
        });
    }

    // ── Waitlist repositioning confirmation ──

    @track showRepoConfirm   = false;
    @track repoConfirmMessage = '';
    _repoPendingId     = null;
    _repoPendingAction = null; // 'first' | 'last'

    /** Finds which section (General Banking / Investment Banking) a participant belongs to. */
    // Infer possessive pronoun from first name using a curated female-name list.
    // Falls back to "their" when the name is ambiguous or unrecognised.
    _genderPronoun(fullName) {
        const femaleNames = new Set([
            'julia','emma','olivia','ava','isabella','sophia','mia','charlotte','amelia','harper',
            'evelyn','abigail','emily','elizabeth','mila','ella','avery','sofia','camila','aria',
            'scarlett','victoria','madison','luna','grace','chloe','penelope','layla','riley','zoey',
            'nora','lily','eleanor','hannah','lillian','addison','aubrey','ellie','stella','natalie',
            'zoe','leah','hazel','violet','aurora','savannah','audrey','brooklyn','bella','claire',
            'skylar','lucy','paisley','everly','anna','caroline','nova','genesis','emilia','kennedy',
            'samantha','maya','willow','kinsley','naomi','aaliyah','elena','sarah','ariana','allison',
            'gabriella','alice','hailey','eva','autumn','quinn','nevaeh','piper','ruby','serenity',
            'delilah','paige','camille','maria','lydia','alexa','kate','brianna','diana','jessica',
            'morgan','melanie','gianna','rachel','jasmine','isabel','jocelyn','andrea','alexis',
            'lola','daisy','grace','sophie','natasha','lisa','donna','sandra','patricia','jennifer',
            'arna','sumaiyah','lakshmi','priya','ananya','divya','pooja','kavya','deepa','meera',
        ]);
        const first = (fullName || '').split(' ')[0].toLowerCase();
        if (femaleNames.has(first)) return 'her';
        // a short list of common male names to confirm 'his'
        const maleNames = new Set([
            'james','john','robert','michael','william','david','richard','joseph','thomas','charles',
            'christopher','daniel','matthew','anthony','mark','donald','steven','paul','andrew','joshua',
            'kenneth','kevin','brian','george','timothy','ronald','edward','jason','jeffrey','ryan',
            'jacob','gary','nicholas','eric','jonathan','stephen','larry','justin','scott','brandon',
            'benjamin','samuel','raymond','frank','gregory','alexander','patrick','jack','dennis','jerry',
            'tyler','aaron','jose','adam','henry','nathan','douglas','zachary','peter','kyle','noah',
            'ethan','liam','mason','logan','oliver','lucas','aiden','elijah','jayden','sebastian',
            'won','clain','raj','arjun','vikram','rohit','aditya','suresh','ramesh','kumar',
        ]);
        if (maleNames.has(first)) return 'his';
        return 'their';
    }

    _findParticipantSection(id) {
        if (this.generalBankingTopics.some(t => t.participants.some(p => p.id === id))) {
            return 'General Banking';
        }
        if (this.investmentBankingTopics.some(t => t.participants.some(p => p.id === id))) {
            return 'Investment Banking';
        }
        return 'the';
    }

    handleParticipantActionRequest(event) {
        // Read dataset values synchronously before any state mutation destroys the element
        const id     = event.currentTarget.dataset.id;
        const action = event.currentTarget.dataset.action; // 'first' | 'last'
        if (!id || !action) return;
        const section  = this._findParticipantSection(id);
        const position = action === 'first' ? 'first' : 'last';
        const allParticipants = [
            ...this.generalBankingTopics.flatMap(t => t.participants),
            ...this.investmentBankingTopics.flatMap(t => t.participants),
        ];
        const name = allParticipants.find(p => p.id === id)?.linkLabel || 'this Participant';
        this._repoPendingId     = id;
        this._repoPendingAction = action;
        const pronoun = this._genderPronoun(name);
        const directionPhrase = action === 'last'
            ? `Moving ${name} to the end of the waitlist will delay ${pronoun} appointment by 55 minutes. Are you sure you want to continue?`
            : `Moving ${name} to the beginning of the waitlist will move up ${pronoun} appointment by 55 minutes. Are you sure you want to continue?`;
        this.repoConfirmMessage = directionPhrase;
        this.activeMenuRowId    = null; // close menu
        this.showRepoConfirm    = true;
    }

    handleRepoConfirmNo() {
        this.showRepoConfirm    = false;
        this._repoPendingId     = null;
        this._repoPendingAction = null;
    }

    handleRepoConfirmYes() {
        const id       = this._repoPendingId;
        const action   = this._repoPendingAction;
        // Capture section and name before the move mutates the topics arrays
        const section  = this._findParticipantSection(id);
        const position = action === 'first' ? 'first' : 'last';
        const allParticipants = [
            ...this.generalBankingTopics.flatMap(t => t.participants),
            ...this.investmentBankingTopics.flatMap(t => t.participants),
        ];
        const participantName = allParticipants.find(p => p.id === id)?.linkLabel || 'Participant';

        this.showRepoConfirm    = false;
        this._repoPendingId     = null;
        this._repoPendingAction = null;

        if (action === 'first') {
            const mover = (rows, idx) => { const [row] = rows.splice(idx, 1); return [row, ...rows]; };
            this.generalBankingTopics    = sortLobbyTopicsByCountDesc(this._updateTopics(this.generalBankingTopics, id, mover));
            this.investmentBankingTopics = sortLobbyTopicsByCountDesc(this._updateTopics(this.investmentBankingTopics, id, mover));
        } else {
            const mover = (rows, idx) => { const [row] = rows.splice(idx, 1); return [...rows, row]; };
            this.generalBankingTopics    = sortLobbyTopicsByCountDesc(this._updateTopics(this.generalBankingTopics, id, mover));
            this.investmentBankingTopics = sortLobbyTopicsByCountDesc(this._updateTopics(this.investmentBankingTopics, id, mover));
        }

        this._showToast(`${participantName} successfully moved to ${position} in the ${section} waitlist.`);
    }

    handleParticipantNoShow(event) {
        const id = event.currentTarget.dataset.id;
        // Capture name before any state mutation
        const allParticipants = [
            ...this.generalBankingTopics.flatMap(t => t.participants),
            ...this.investmentBankingTopics.flatMap(t => t.participants),
        ];
        const participantName = allParticipants.find(p => p.id === id)?.linkLabel || 'Participant';
        this.activeMenuRowId = null; // close menu
        // Remove the card entirely
        const remover = (rows, idx) => rows.filter((_, i) => i !== idx);
        this.generalBankingTopics    = sortLobbyTopicsByCountDesc(this._updateTopics(this.generalBankingTopics, id, remover));
        this.investmentBankingTopics = sortLobbyTopicsByCountDesc(this._updateTopics(this.investmentBankingTopics, id, remover));
        this._showToast(`${participantName}'s Service Appointment was marked as No Show.`);
    }

    handleParticipantRemoveResource(event) {
        const id = event.currentTarget.dataset.id;
        // Capture resource name before any state mutation
        const allParticipants = [
            ...this.generalBankingTopics.flatMap(t => t.participants),
            ...this.investmentBankingTopics.flatMap(t => t.participants),
        ];
        const participant = allParticipants.find(p => p.id === id);
        const resourceMatch = participant?.topic?.match(/•\s*(.+)$/);
        const resourceName  = resourceMatch ? resourceMatch[1].trim() : null;
        this.activeMenuRowId = null; // close menu
        const remover = (rows, idx) => rows.map((r, i) => {
            if (i !== idx) return r;
            const topic = r.topic.replace(/\s*•\s*[^•]+$/, '');
            return { ...r, topic };
        });
        this.generalBankingTopics    = sortLobbyTopicsByCountDesc(this._updateTopics(this.generalBankingTopics, id, remover));
        this.investmentBankingTopics = sortLobbyTopicsByCountDesc(this._updateTopics(this.investmentBankingTopics, id, remover));
        if (resourceName) {
            this._showToast(`Preferred service resource ${resourceName} is removed.`);
        }
    }

    handleCheckin(event) {
        const id = event.currentTarget?.dataset?.id;
        if (!id) return;

        const now = new Date();
        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        const waitTime = `00 : ${mm} mins.`;

        const updateList = (list) =>
            list.map((appt) => {
                if (appt.id !== id) return appt;
                // Extract start time from slot string e.g. "9:30 am - 10:00 am" → "9:30 am"
                const startTime = appt.slot ? appt.slot.split(' - ')[0].trim() : '';
                return {
                    ...appt,
                    checkedIn: true,
                    checkedInLabel: `Checked In at ${startTime}`,
                    showCheckin: false,
                    showWaitAlert: true,
                    waitLabel: 'Wait Time:',
                    waitTime
                };
            });

        this.currentAppointments = updateList(this.currentAppointments);
        this.upcomingAppointments = updateList(this.upcomingAppointments);
    }

    // ── Scheduled Service Appointment row menu ──

    @track activeApptMenuId      = null;
    @track apptMenuDropdownStyle = '';

    handleApptMenu(event) {
        const id = event.currentTarget.dataset.id;
        if (this.activeApptMenuId === id) {
            this.activeApptMenuId = null;
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        this.apptMenuDropdownStyle = `top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;`;
        this.activeApptMenuId = id;
    }

    _findAppt(id) {
        return [
            ...this.currentAppointments,
            ...this.upcomingAppointments,
        ].find(a => a.id === id);
    }

    // ── Reschedule Appointment modal ──

    @track showRescheduleModal  = false;
    @track rschedApptId         = null;
    @track rschedActiveTab      = 'available'; // 'available' | 'resource'
    @track _calYear             = new Date().getFullYear();
    @track _calMonth            = new Date().getMonth(); // 0-based
    @track _calSelectedDate     = new Date(); // today
    @track _calSelectedSlotId   = null;

    get rschedTabAvailableClass() {
        return `rsched-sidebar__item${this.rschedActiveTab === 'available' ? ' rsched-sidebar__item--active' : ''}`;
    }
    get rschedTabResourceClass() {
        return `rsched-sidebar__item${this.rschedActiveTab === 'resource' ? ' rsched-sidebar__item--active' : ''}`;
    }

    get calMonthLabel() {
        return new Date(this._calYear, this._calMonth, 1)
            .toLocaleString('en-US', { month: 'long' });
    }

    get calYearOptions() {
        const current = new Date().getFullYear();
        return [current - 1, current, current + 1, current + 2].map(y => ({
            value: y, label: String(y), selected: y === this._calYear
        }));
    }

    get calSelectedDateLabel() {
        return this._calSelectedDate.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    get calWeeks() {
        const year  = this._calYear;
        const month = this._calMonth;
        const first = new Date(year, month, 1).getDay();
        const days  = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const sel   = this._calSelectedDate;

        const cells = [];
        // Leading blanks from prev month
        const prevDays = new Date(year, month, 0).getDate();
        for (let i = 0; i < first; i++) {
            const d = prevDays - first + 1 + i;
            cells.push({ label: d, dateStr: '', cls: 'rsched-cal__day rsched-cal__day--other rsched-cal__day--past', key: `p${i}` });
        }
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        for (let d = 1; d <= days; d++) {
            const dateObj    = new Date(year, month, d);
            const isPast     = dateObj < todayMidnight;
            const isToday    = dateObj.toDateString() === today.toDateString();
            const isSel      = sel && dateObj.toDateString() === sel.toDateString() && !isToday;
            const isBlue     = !isPast && !isToday && [3, 9, 12, 17, 19, 22, 24, 26, 28].includes(d);
            const dateStr    = isPast ? '' : `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            let cls = 'rsched-cal__day';
            if (isPast)       cls += ' rsched-cal__day--past';
            else if (isSel)   cls += ' rsched-cal__day--selected';
            else if (isToday) cls += ' rsched-cal__day--today';
            else if (isBlue)  cls += ' rsched-cal__day--blue';
            cells.push({ label: d, dateStr, cls, key: `d${d}` });
        }
        // Trailing blanks
        let trail = 1;
        while (cells.length % 7 !== 0) {
            cells.push({ label: trail++, dateStr: '', cls: 'rsched-cal__day rsched-cal__day--other', key: `t${trail}` });
        }
        const weeks = [];
        for (let i = 0; i < cells.length; i += 7) {
            weeks.push({ key: `w${i}`, days: cells.slice(i, i + 7) });
        }
        return weeks;
    }

    get calTimeSlots() {
        const slots = [
            { id: 's1', time: '08:00', capacity: '98/100', level: 'green' },
            { id: 's2', time: '09:00', capacity: '96/100', level: 'green' },
            { id: 's3', time: '10:00', capacity: '97/100', level: 'orange' },
            { id: 's4', time: '10:30', capacity: '81/100', level: 'orange' },
            { id: 's5', time: '11:00', capacity: '50/100', level: 'orange' },
        ];
        return slots.map(s => ({
            ...s,
            cls: `rsched-slot${this._calSelectedSlotId === s.id ? ' rsched-slot--selected' : ''}`,
            badgeCls: `rsched-slot__badge rsched-slot__badge--${s.level}`
        }));
    }

    handleRschedTabAvailable()    { this.rschedActiveTab = 'available'; }
    handleRschedTabResource()     { this.rschedActiveTab = 'resource'; }

    handleCalPrev() {
        if (this._calMonth === 0) { this._calMonth = 11; this._calYear--; }
        else this._calMonth--;
    }
    handleCalNext() {
        if (this._calMonth === 11) { this._calMonth = 0; this._calYear++; }
        else this._calMonth++;
    }
    handleCalToday() {
        const t = new Date();
        this._calYear  = t.getFullYear();
        this._calMonth = t.getMonth();
        this._calSelectedDate = null; // just navigate to today, don't select it
    }
    handleCalYearChange(event) {
        this._calYear = parseInt(event.target.value, 10);
    }
    handleCalDayClick(event) {
        const dateStr = event.currentTarget.dataset.date;
        if (!dateStr) return;
        const [y, m, d] = dateStr.split('-').map(Number);
        this._calSelectedDate  = new Date(y, m - 1, d);
        this._calSelectedSlotId = null;
    }
    handleSlotSelect(event) {
        this._calSelectedSlotId = event.currentTarget.dataset.id;
    }

    handleRescheduleClose() {
        this.showRescheduleModal = false;
        this.rschedApptId       = null;
        this._calSelectedSlotId = null;
    }

    handleRescheduleConfirm() {
        const appt = this._findAppt(this.rschedApptId);
        this.showRescheduleModal = false;
        this._showToast(`Service Appointment for ${appt?.customerName || 'customer'} has been rescheduled.`);
    }

    handleApptReschedule(event) {
        const id = event.currentTarget.dataset.id;
        this.activeApptMenuId = null;
        this.rschedApptId     = id;
        const t = new Date();
        this._calYear         = t.getFullYear();
        this._calMonth        = t.getMonth();
        this._calSelectedDate = t;
        this._calSelectedSlotId = null;
        this.showRescheduleModal = true;
    }

    handleApptReassign(event) {
        const id   = event.currentTarget.dataset.id;
        const appt = this._findAppt(id);
        this.activeApptMenuId = null;
        this._showToast(`Service Resource for ${appt?.customerName || 'customer'} has been reassigned.`);
    }

    handleApptNoShow(event) {
        const id   = event.currentTarget.dataset.id;
        const appt = this._findAppt(id);
        const name = appt?.customerName || 'customer';
        this.activeApptMenuId = null;
        // Remove from both appointment lists
        this.currentAppointments  = this.currentAppointments.filter(a => a.id !== id);
        this.upcomingAppointments = this.upcomingAppointments.filter(a => a.id !== id);
        this._showToast(`${name}'s Service Appointment was marked as No Show.`);
    }
}
