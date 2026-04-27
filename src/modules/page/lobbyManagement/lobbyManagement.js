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
                    topic: 'General Banking • Auto Assigned',
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
                    linkLabel: 'Lead Participant',
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

    handleParticipantMoveFirst(event) {
        const id = event.currentTarget.dataset.id;
        this._closeActiveMenu();
        const mover = (rows, idx) => { const [row] = rows.splice(idx, 1); return [row, ...rows]; };
        this.generalBankingTopics    = sortLobbyTopicsByCountDesc(this._updateTopics(this.generalBankingTopics, id, mover));
        this.investmentBankingTopics = sortLobbyTopicsByCountDesc(this._updateTopics(this.investmentBankingTopics, id, mover));
    }

    handleParticipantMoveLast(event) {
        const id = event.currentTarget.dataset.id;
        this._closeActiveMenu();
        const mover = (rows, idx) => { const [row] = rows.splice(idx, 1); return [...rows, row]; };
        this.generalBankingTopics    = sortLobbyTopicsByCountDesc(this._updateTopics(this.generalBankingTopics, id, mover));
        this.investmentBankingTopics = sortLobbyTopicsByCountDesc(this._updateTopics(this.investmentBankingTopics, id, mover));
    }

    handleParticipantNoShow(event) {
        const id = event.currentTarget.dataset.id;
        this._closeActiveMenu();
        const marker = (rows, idx) => rows.map((r, i) => i === idx ? { ...r, noShow: true } : r);
        this.generalBankingTopics    = sortLobbyTopicsByCountDesc(this._updateTopics(this.generalBankingTopics, id, marker));
        this.investmentBankingTopics = sortLobbyTopicsByCountDesc(this._updateTopics(this.investmentBankingTopics, id, marker));
    }

    handleParticipantRemoveResource(event) {
        const id = event.currentTarget.dataset.id;
        this._closeActiveMenu();
        const remover = (rows, idx) => rows.map((r, i) => {
            if (i !== idx) return r;
            const topic = r.topic.replace(/\s*•\s*[^•]+$/, '');
            return { ...r, topic };
        });
        this.generalBankingTopics    = sortLobbyTopicsByCountDesc(this._updateTopics(this.generalBankingTopics, id, remover));
        this.investmentBankingTopics = sortLobbyTopicsByCountDesc(this._updateTopics(this.investmentBankingTopics, id, remover));
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

    handleApptMenu() {
        // Demo: row actions menu
    }
}
