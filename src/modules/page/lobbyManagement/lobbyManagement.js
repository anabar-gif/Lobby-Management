import { LightningElement, track } from 'lwc';
import { getWaitlists, subscribe as subscribeWaitlists } from 'data/waitlistStore';

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

    /** Dynamic waitlists created from the Waitlist Management page */
    @track dynamicWaitlists = [];

    connectedCallback() {
        this._handleDocClick = (e) => {
            const insideRowMenu  = e.target.closest?.('.lobby-row-menu-wrap') || e.target.closest?.('.lobby-row-menu__dropdown');
            const insideApptMenu = e.target.closest?.('.lobby-appt__menu-btn') || e.target.closest?.('.lobby-row-menu__dropdown');
            const closing = (this.activeMenuRowId && !insideRowMenu) || (this.activeApptMenuId && !insideApptMenu);
            if (this.activeMenuRowId  && !insideRowMenu)  this.activeMenuRowId  = null;
            if (this.activeApptMenuId && !insideApptMenu) this.activeApptMenuId = null;
            if (closing) this._stopMenuTracking();
        };
        document.addEventListener('click', this._handleDocClick, true);

        // Close any open menu when anything on the page scrolls.
        // capture:true catches scroll from ALL descendants (including .app-main) without needing a direct ref.
        this._handleScroll = () => {
            if (this.activeMenuRowId)  this.activeMenuRowId  = null;
            if (this.activeApptMenuId) this.activeApptMenuId = null;
        };
        document.addEventListener('scroll', this._handleScroll, { passive: true, capture: true });

        // Live wait time ticker — increments every 60 seconds
        this._waitTimerInterval = setInterval(() => this._tickWaitTimes(), 60000);
        // Auto-refresh label updater
        this._startAutoRefresh();

        // Seed from waitlists already created before navigating here
        this._mergeFromStore(getWaitlists());
        // Subscribe for live updates — only appends new entries, never replaces existing ones
        this._unsubscribeStore = subscribeWaitlists(all => this._mergeFromStore(all));
    }

    _mergeFromStore(all) {
        const existingIds = new Set(this.dynamicWaitlists.map(w => w.id));
        const newEntries = all
            .filter(w => !existingIds.has(w.id))
            .map(w => ({
                id: w.id,
                name: w.name,
                territory: w.territory,
                workTypes: w.workTypes || [],
                resources: w.resources || [],
                participants: [],
                openSections: [],
                topics: null,
                showCheckinComposer: false,
            }));
        if (newEntries.length) {
            this.dynamicWaitlists = [...this.dynamicWaitlists, ...newEntries];
        }
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._handleDocClick, true);
        if (this._handleScroll) {
            document.removeEventListener('scroll', this._handleScroll, { capture: true });
        }
        this._stopMenuTracking();
        if (this._unsubscribeStore) this._unsubscribeStore();
        if (this._waitTimerInterval) clearInterval(this._waitTimerInterval);
        if (this._autoRefreshInterval) clearInterval(this._autoRefreshInterval);
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

    // ── Metric card helpers ──────────────────────────────────────────────────

    _allWaitlistParticipants() {
        const gbParts = (this.generalBankingTopics || []).flatMap(t => t.participants || []);
        const ibParts = (this.investmentBankingTopics || []).flatMap(t => t.participants || []);
        const dynParts = (this.dynamicWaitlists || []).flatMap(w =>
            (w.topics || []).flatMap(t => t.participants || [])
        );
        return [...gbParts, ...ibParts, ...dynParts];
    }

    _parseWaitMins(waitTime) {
        if (!waitTime) return 0;
        const m = waitTime.match(/(\d+)\s*:\s*(\d+)/);
        if (!m) return 0;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    }

    get metricTotalCheckedIn() {
        return this._allWaitlistParticipants().length;
    }

    get metricAvgWait() {
        const parts = this._allWaitlistParticipants();
        if (!parts.length) return '—';
        const total = parts.reduce((s, p) => s + this._parseWaitMins(p.waitTime), 0);
        const avg = Math.round(total / parts.length);
        const h = Math.floor(avg / 60).toString().padStart(2, '0');
        const m = (avg % 60).toString().padStart(2, '0');
        return `${h} : ${m} mins`;
    }

    get metricLongestWait() {
        const parts = this._allWaitlistParticipants();
        if (!parts.length) return '—';
        const max = Math.max(...parts.map(p => this._parseWaitMins(p.waitTime)));
        const h = Math.floor(max / 60).toString().padStart(2, '0');
        const m = (max % 60).toString().padStart(2, '0');
        return `${h} : ${m} mins`;
    }

    get metricLongestWaitIsHigh() {
        const parts = this._allWaitlistParticipants();
        if (!parts.length) return false;
        const max = Math.max(...parts.map(p => this._parseWaitMins(p.waitTime)));
        return max >= 30;
    }

    get metricLongestWaitIconClass() {
        return this.metricLongestWaitIsHigh
            ? 'lobby-metric-card__icon-wrap lobby-metric-card__icon-wrap--red'
            : 'lobby-metric-card__icon-wrap lobby-metric-card__icon-wrap--orange';
    }

    get metricLongestWaitValueClass() {
        return this.metricLongestWaitIsHigh
            ? 'lobby-metric-card__value lobby-metric-card__value--small lobby-metric-card__value--red'
            : 'lobby-metric-card__value lobby-metric-card__value--small';
    }

    get metricUpcoming() {
        return (this.upcomingAppointments || []).length;
    }

    get metricActiveWaitlists() {
        const gbActive = (this.generalBankingTopics || []).some(t => (t.participants || []).length > 0) ? 1 : 0;
        const ibActive = (this.investmentBankingTopics || []).some(t => (t.participants || []).length > 0) ? 1 : 0;
        const dynActive = (this.dynamicWaitlists || []).filter(w =>
            (w.topics || []).some(t => (t.participants || []).length > 0)
        ).length;
        return gbActive + ibActive + dynActive;
    }

    get metricCurrentlyServed() {
        return (this.currentAppointments || []).filter(a => a.checkedIn).length;
    }

    // ── New metric cards ─────────────────────────────────────────────────────

    @track _noShowCount = 2;
    @track _transferredCount = 0;

    get metricVipCount() {
        return this._allWaitlistParticipants().filter(p => p.isVip).length;
    }

    get metricOverdueCount() {
        return this._allWaitlistParticipants().filter(p => this._parseWaitMins(p.waitTime) > 45).length;
    }

    get metricNoShowsToday() {
        return this._noShowCount;
    }

    get metricQueuesAtCapacity() {
        const allTopics = (topics) => (topics || []);
        const gbRed = this._queueHealth(allTopics(this.generalBankingTopics)) === 'red' ? 1 : 0;
        const ibRed = this._queueHealth(allTopics(this.investmentBankingTopics)) === 'red' ? 1 : 0;
        const dynRed = (this.dynamicWaitlists || []).filter(w => this._queueHealth(w.topics) === 'red').length;
        return gbRed + ibRed + dynRed;
    }

    get metricTransferred() {
        return this._transferredCount;
    }

    get metricAvgServiceTime() {
        const mins = this._allWaitlistParticipants().map(p => this._parseWaitMins(p.waitTime));
        if (!mins.length) return '—';
        const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
        return `${avg} min`;
    }

    get metricQueuesAtCapacityClass() {
        return this.metricQueuesAtCapacity > 0
            ? 'lobby-metric-card__icon-wrap lobby-metric-card__icon-wrap--red'
            : 'lobby-metric-card__icon-wrap lobby-metric-card__icon-wrap--green';
    }

    get metricOverdueClass() {
        return this.metricOverdueCount > 0
            ? 'lobby-metric-card__icon-wrap lobby-metric-card__icon-wrap--red'
            : 'lobby-metric-card__icon-wrap lobby-metric-card__icon-wrap--teal';
    }

    get metricOverdueValueClass() {
        return this.metricOverdueCount > 0
            ? 'lobby-metric-card__value lobby-metric-card__value--red'
            : 'lobby-metric-card__value';
    }

    // ── Batch 1: Live ticker, overdue, health, search ───────────────────────

    /** Adds 1 minute to every participant's waitTime across all waitlists. */
    _tickWaitTimes() {
        const addMin = (waitTime) => {
            const m = (waitTime || '').match(/(\d+)\s*:\s*(\d+)/);
            if (!m) return waitTime;
            let total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + 1;
            const h = Math.floor(total / 60).toString().padStart(2, '0');
            const min = (total % 60).toString().padStart(2, '0');
            return `${h} : ${min} mins.`;
        };
        const tickParticipants = parts => parts.map(p => ({ ...p, waitTime: addMin(p.waitTime) }));
        const tickTopics = topics => topics.map(t => ({ ...t, participants: tickParticipants(t.participants || []) }));

        this.generalBankingTopics    = tickTopics(this.generalBankingTopics);
        this.investmentBankingTopics = tickTopics(this.investmentBankingTopics);
        this.dynamicWaitlists = this.dynamicWaitlists.map(w => ({
            ...w,
            topics: tickTopics(w.topics || []),
        }));
    }

    /** Returns true if wait time exceeds 45 minutes. */
    _isOverdue(waitTime) {
        return this._parseWaitMins(waitTime) > 45;
    }

    /** Returns CSS class for a waitlist participant row — adds overdue style if wait > 45 min. */
    _participantCardClass(waitTime) {
        return this._isOverdue(waitTime)
            ? 'lobby-queue-participant slds-m-top_small lobby-queue-participant--overdue'
            : 'lobby-queue-participant slds-m-top_small';
    }

    /** Returns health status string — 'green', 'yellow', or 'red' — for a set of topics. */
    _queueHealth(topics) {
        const parts = (topics || []).flatMap(t => t.participants || []);
        if (!parts.length) return 'green';
        const maxMins = Math.max(...parts.map(p => this._parseWaitMins(p.waitTime)));
        if (maxMins >= 45) return 'red';
        if (maxMins >= 20) return 'yellow';
        return 'green';
    }

    get generalBankingHealth()    { return this._queueHealth(this.generalBankingTopics); }
    get investmentBankingHealth() { return this._queueHealth(this.investmentBankingTopics); }

    get generalBankingDotClass() {
        return `lobby-queue-dot lobby-queue-dot--${this.generalBankingHealth}`;
    }
    get investmentBankingDotClass() {
        return `lobby-queue-dot lobby-queue-dot--${this.investmentBankingHealth}`;
    }

    /** Computed GB topics with per-row enrichment (avatar, VIP, overdue). */
    get generalBankingTopicsView() {
        return this._filterTopicsByResource(
            (this.generalBankingTopics || []).map(t => ({
                ...t,
                participants: (t.participants || []).map(p => this._enrichParticipant(p)),
            }))
        );
    }

    /** Computed IB topics with per-row enrichment. */
    get investmentBankingTopicsView() {
        return this._filterTopicsByResource(
            (this.investmentBankingTopics || []).map(t => ({
                ...t,
                participants: (t.participants || []).map(p => this._enrichParticipant(p)),
            }))
        );
    }

    /** Computed dynamic waitlists with health dot class and overdue per row. */
    get dynamicWaitlistsView() {
        return (this.dynamicWaitlists || []).map(w => ({
            ...w,
            dotClass: `lobby-queue-dot lobby-queue-dot--${this._queueHealth(w.topics)}`,
            topics: (w.topics || []).map(t => ({
                ...t,
                participants: (t.participants || []).map(p => {
                    const dragOver = this.dragOverId === p.id ? ' lobby-queue-participant--drag-over' : '';
                    return {
                        ...p,
                        cardClass: this._participantCardClass(p.waitTime) + dragOver,
                        waitTimeClass: this._isOverdue(p.waitTime)
                            ? 'lobby-appt__wait-time lobby-appt__wait-time--overdue slds-m-left_xx-small'
                            : 'lobby-appt__wait-time slds-m-left_xx-small',
                    };
                }),
            })),
        }));
    }

    // ── Global search ────────────────────────────────────────────────────────

    @track globalSearch = '';

    handleGlobalSearchChange(event) {
        this.globalSearch = event.target.value || '';
    }

    handleGlobalSearchClear() {
        this.globalSearch = '';
    }

    get hasGlobalSearch() { return this.globalSearch.trim().length > 0; }

    _filterTopicsBySearch(topics, q) {
        if (!q) return topics;
        const lower = q.toLowerCase();
        return topics.map(t => ({
            ...t,
            participants: (t.participants || []).filter(p =>
                (p.linkLabel || '').toLowerCase().includes(lower) ||
                (p.topic || '').toLowerCase().includes(lower)
            ),
        })).filter(t => t.participants.length > 0);
    }

    // ── Tile filter ──────────────────────────────────────────────────────────

    @track activeTileFilter = '';

    get activeTileFilterLabel() {
        const labels = {
            checkedin:   'Total Checked In',
            served:      'Currently Served',
            upcoming:    'Upcoming Appointments',
            avgwait:     'Avg Wait Time (above average)',
            longest:     'Longest Wait',
            waitlists:   'Active Waitlists',
            vip:         'VIP Participants',
            overdue:     'Overdue (>45 min)',
            noshows:     'No-Shows Today',
            capacity:    'Queues at Capacity',
            transferred: 'Transferred Today',
            avgservice:  'Avg Service Time',
        };
        return labels[this.activeTileFilter] || '';
    }

    get hasTileFilter() { return !!this.activeTileFilter; }

    handleTileClick(event) {
        const filter = event.currentTarget.dataset.filter;
        if (!filter || filter === 'none') return;
        this.activeTileFilter = this.activeTileFilter === filter ? '' : filter;
    }

    handleClearTileFilter() {
        this.activeTileFilter = '';
    }

    _tileFilterPredicate(p) {
        switch (this.activeTileFilter) {
            case 'checkedin':   return true;
            case 'served':      return false;
            case 'upcoming':    return false;
            case 'avgwait': {
                const parts = this._allWaitlistParticipants();
                if (!parts.length) return true;
                const avg = parts.reduce((s, x) => s + this._parseWaitMins(x.waitTime), 0) / parts.length;
                return this._parseWaitMins(p.waitTime) >= Math.round(avg);
            }
            case 'longest': {
                const parts = this._allWaitlistParticipants();
                if (!parts.length) return false;
                const max = Math.max(...parts.map(x => this._parseWaitMins(x.waitTime)));
                return this._parseWaitMins(p.waitTime) >= max - 5;
            }
            case 'waitlists':   return true;
            case 'vip':         return !!p.isVip;
            case 'overdue':     return this._parseWaitMins(p.waitTime) > 45;
            case 'noshows':     return false;
            case 'transferred': return false;
            case 'avgservice':  return true;
            default:            return true;
        }
    }

    _applyTileFilter(topics) {
        if (!this.activeTileFilter || this.activeTileFilter === 'capacity' || this.activeTileFilter === 'waitlists') return topics;
        return topics.map(t => ({
            ...t,
            participants: (t.participants || []).filter(p => this._tileFilterPredicate(p)),
        })).filter(t => t.participants.length > 0);
    }

    _isTileFilterActive(filterKey) {
        return this.activeTileFilter === filterKey;
    }

    get tileFilterClassCheckedIn()   { return this._tileFilterActive('checkedin') ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassServed()      { return this._tileFilterActive('served') ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassUpcoming()    { return this._tileFilterActive('upcoming') ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassAvgWait()     { return this._tileFilterActive('avgwait')     ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassLongest()     { return this._tileFilterActive('longest')     ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassWaitlists()   { return this._tileFilterActive('waitlists')   ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassVip()         { return this._tileFilterActive('vip')         ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassOverdue()     { return this._tileFilterActive('overdue')     ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassNoShows()     { return this._tileFilterActive('noshows')     ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassCapacity()    { return this._tileFilterActive('capacity')    ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassTransferred() { return this._tileFilterActive('transferred') ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }
    get tileFilterClassAvgService()  { return this._tileFilterActive('avgservice')  ? 'lobby-metric-card lobby-metric-card--active' : 'lobby-metric-card'; }

    _tileFilterActive(key) { return this.activeTileFilter === key; }

    // Whether a queue should be shown when "capacity" filter is on
    _queuePassesCapacityFilter(health) {
        if (this.activeTileFilter !== 'capacity') return true;
        return health === 'red';
    }

    get generalBankingTopicsFiltered() {
        if (this.activeTileFilter === 'capacity' && this.generalBankingHealth !== 'red') return [];
        return this._applyTileFilter(
            this._filterTopicsBySearch(this.generalBankingTopicsView, this.globalSearch.trim())
        );
    }

    get investmentBankingTopicsFiltered() {
        if (this.activeTileFilter === 'capacity' && this.investmentBankingHealth !== 'red') return [];
        return this._applyTileFilter(
            this._filterTopicsBySearch(this.investmentBankingTopicsView, this.globalSearch.trim())
        );
    }

    get dynamicWaitlistsFiltered() {
        const q = this.globalSearch.trim().toLowerCase();
        let result = this.dynamicWaitlistsView;
        if (q) {
            result = result.map(w => ({
                ...w,
                topics: this._filterTopicsBySearch(w.topics, q),
            })).filter(w => w.topics.some(t => t.participants.length > 0));
        }
        if (this.activeTileFilter && this.activeTileFilter !== 'capacity' && this.activeTileFilter !== 'waitlists') {
            result = result.map(w => ({
                ...w,
                topics: this._applyTileFilter(w.topics),
            })).filter(w => w.topics.some(t => (t.participants || []).length > 0));
        } else if (this.activeTileFilter === 'capacity') {
            result = result.filter(w => this._queueHealth(w.topics) === 'red');
        }
        return result;
    }

    get currentAppointmentsFiltered() {
        if (this.activeTileFilter === 'served') {
            return this.currentAppointmentsView.filter(a => a.checkedIn);
        }
        if (this.activeTileFilter === 'upcoming') return [];
        return this.currentAppointmentsView;
    }

    get upcomingAppointmentsFiltered() {
        if (this.activeTileFilter === 'upcoming') return this.upcomingAppointmentsView;
        if (this.activeTileFilter === 'served') return [];
        return this.upcomingAppointmentsView;
    }

    // ── Batch 2: Avatars, VIP, Notes, Auto-refresh, Resource filter ─────────

    /** Returns 1-2 letter initials from a name string. */
    _initials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /** Returns a stable background color for initials avatar based on name. */
    _avatarColor(name) {
        const colors = ['#1a56db','#0d9488','#7c3aed','#c05621','#2e844a','#c23934','#dd7a01'];
        let hash = 0;
        for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    }

    // Auto-refresh
    @track _lastRefreshedLabel = 'Updated just now';
    _autoRefreshInterval = null;
    _lastRefreshTime = Date.now();

    _startAutoRefresh() {
        this._autoRefreshInterval = setInterval(() => {
            const diffMin = Math.round((Date.now() - this._lastRefreshTime) / 60000);
            this._lastRefreshedLabel = diffMin < 1 ? 'Updated just now' : `Updated ${diffMin} min ago`;
        }, 30000);
    }

    _doRefresh() {
        this._lastRefreshTime = Date.now();
        this._lastRefreshedLabel = 'Updated just now';
    }

    get lastRefreshedLabel() { return this._lastRefreshedLabel; }

    // VIP toggle
    handleToggleVip(event) {
        const id = event.currentTarget.dataset.id;
        this._toggleParticipantFlag(id, 'isVip');
        this.activeMenuRowId = null;
    }

    // Notes toggle
    handleToggleNotes(event) {
        const id = event.currentTarget.dataset.id;
        this._toggleParticipantFlag(id, 'showNotes');
        this.activeMenuRowId = null;
    }

    handleNotesInput(event) {
        const id = event.currentTarget.dataset.id;
        const val = event.target.value;
        this._setParticipantField(id, 'notes', val);
    }

    _toggleParticipantFlag(id, flag) {
        const toggle = (parts) => parts.map(p => p.id === id ? { ...p, [flag]: !p[flag] } : p);
        const topicToggle = (topics) => topics.map(t => ({ ...t, participants: toggle(t.participants || []) }));
        this.generalBankingTopics    = topicToggle(this.generalBankingTopics);
        this.investmentBankingTopics = topicToggle(this.investmentBankingTopics);
        this.dynamicWaitlists = this.dynamicWaitlists.map(w => ({ ...w, topics: topicToggle(w.topics || []) }));
    }

    _setParticipantField(id, field, value) {
        const setter = (parts) => parts.map(p => p.id === id ? { ...p, [field]: value } : p);
        const topicSetter = (topics) => topics.map(t => ({ ...t, participants: setter(t.participants || []) }));
        this.generalBankingTopics    = topicSetter(this.generalBankingTopics);
        this.investmentBankingTopics = topicSetter(this.investmentBankingTopics);
        this.dynamicWaitlists = this.dynamicWaitlists.map(w => ({ ...w, topics: topicSetter(w.topics || []) }));
    }

    // Resource filter
    @track filterByResource = '';

    get resourceFilterOptions() {
        return [
            { label: 'All Resources', value: '' },
            ...this.checkinResourceOptions.filter(o => o.value !== ''),
        ];
    }

    handleResourceFilterChange(event) {
        this.filterByResource = event.detail.value;
    }

    _filterTopicsByResource(topics) {
        const r = this.filterByResource;
        if (!r) return topics;
        return topics.map(t => ({
            ...t,
            participants: (t.participants || []).filter(p => (p.topic || '').toLowerCase().includes(
                (this.checkinResourceOptions.find(o => o.value === r)?.label || '').toLowerCase()
            )),
        })).filter(t => t.participants.length > 0);
    }

    /** Enriches a participant with avatar initials, color, VIP class, and notes. */
    _enrichParticipant(p) {
        const color = this._avatarColor(p.linkLabel);
        const dragOver = this.dragOverId === p.id ? ' lobby-queue-participant--drag-over' : '';
        return {
            ...p,
            initials: this._initials(p.linkLabel),
            avatarStyle: `background-color:${color};`,
            cardClass: this._participantCardClass(p.waitTime) + (p.isVip ? ' lobby-queue-participant--vip' : '') + dragOver,
            waitTimeClass: this._isOverdue(p.waitTime)
                ? 'lobby-appt__wait-time lobby-appt__wait-time--overdue slds-m-left_xx-small'
                : 'lobby-appt__wait-time slds-m-left_xx-small',
        };
    }

    // ─────────────────────────────────────────────────────────────────────────

    // ────────────────────────────────────────────────────────────────────────

    _apptWithWaitClasses(appt) {
        const red = !!appt.waitAlertRed;
        return {
            ...appt,
            waitClockClass: `${red ? 'lobby-appt__wait-clock--red' : 'lobby-appt__wait-clock'} slds-m-right_xx-small`,
            waitLabelClass: red ? 'lobby-appt__wait-label--red' : 'lobby-appt__wait-label',
            waitTimeClass:  `${red ? 'lobby-appt__wait-time--red' : 'lobby-appt__wait-time'} slds-m-left_xx-small`,
        };
    }

    get currentAppointmentsView() {
        return (this.currentAppointments || []).map(a => this._apptWithWaitClasses(a));
    }

    get upcomingAppointmentsView() {
        return (this.upcomingAppointments || []).map(a => this._apptWithWaitClasses(a));
    }

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
            serviceApptLabel: 'Service Appointment',
            slot: '9:00 am - 9:30 am',
            showWaitAlert: true,
            waitAlertRed: true,
            waitLabel: 'Wait Time:',
            waitTime: '00 : 10 mins.',
            showCheckin: false,
            checkedIn: true,
            checkedInLabel: 'Checked In'
        },
        {
            id: 'a2',
            customerName: 'James Clain',
            subtitle: 'Savings Account • Rachel Adams',
            serviceApptLabel: 'Interaction',
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
            serviceApptLabel: 'Interaction',
            slot: '10:00 am - 10:30 am',
            showWaitAlert: false,
            showCheckin: true
        },
        {
            id: 'b2',
            customerName: 'Regina Hem',
            subtitle: 'Savings Account • Rachel Adams',
            serviceApptLabel: 'Service Appointment',
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
        this._doRefresh();
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
    @track ciResource   = '';
    @track ciDesc       = '';
    @track ciFirstName  = '';
    @track ciLastName   = '';
    @track ciContact    = '';
    @track ciCompany    = '';
    @track ciEmail      = '';
    @track ciIsVip      = false;

    get ciIsNewParticipant() { return this.ciGuestType === 'new'; }
    get ciPersonLabel()      { return this.ciGuestType === 'new' ? "guest's" : "participant's"; }
    get ciDescPh()           { return `Enter a description for the ${this.ciGuestType === 'new' ? 'guest' : 'user'}'s interaction...`; }
    get ciFNamePh()    { return `Enter ${this.ciPersonLabel} first name`; }
    get ciLNamePh()    { return `Enter ${this.ciPersonLabel} last name`; }
    get ciContactPh()  { return `Enter ${this.ciPersonLabel} contact number`; }
    get ciCompanyPh()  { return `Enter ${this.ciPersonLabel} company`; }
    get ciEmailPh()    { return `Enter ${this.ciPersonLabel} email address...`; }
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
    handleCiVipChange(event)       { this.ciIsVip     = event.target.checked; }

    // ── Investment Banking composer form state ──
    @track ibCiGuestType  = 'existing';
    @track ibCiTopic      = 'investment-banking';
    @track ibCiResource   = '';
    @track ibCiDesc       = '';
    @track ibCiFirstName  = '';
    @track ibCiLastName   = '';
    @track ibCiContact    = '';
    @track ibCiCompany    = '';
    @track ibCiEmail      = '';
    @track ibCiIsVip      = false;

    get ibCiIsNewParticipant() { return this.ibCiGuestType === 'new'; }
    get ibCiPersonLabel()      { return this.ibCiGuestType === 'new' ? "guest's" : "participant's"; }
    get ibCiDescPh()           { return `Enter a description for the ${this.ibCiGuestType === 'new' ? 'guest' : 'user'}'s interaction...`; }
    get ibCiFNamePh()    { return `Enter ${this.ibCiPersonLabel} first name`; }
    get ibCiLNamePh()    { return `Enter ${this.ibCiPersonLabel} last name`; }
    get ibCiContactPh()  { return `Enter ${this.ibCiPersonLabel} contact number`; }
    get ibCiCompanyPh()  { return `Enter ${this.ibCiPersonLabel} company`; }
    get ibCiEmailPh()    { return `Enter ${this.ibCiPersonLabel} email address...`; }
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
    handleIbCiVipChange(event)       { this.ibCiIsVip     = event.target.checked; }

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

    /** Returns a formatted wait time string based on position (0-based) in the queue.
     *  Assumes ~15 minutes per person ahead. */
    _calcWaitTime(peopleAhead) {
        const totalMins = peopleAhead * 15;
        const hrs = Math.floor(totalMins / 60).toString().padStart(2, '0');
        const mins = (totalMins % 60).toString().padStart(2, '0');
        return `${hrs} : ${mins} mins.`;
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

        const matchingSection = this.generalBankingTopics.find(t => t.id === sectionId);
        const peopleAhead = matchingSection ? matchingSection.participants.length : 0;

        const newRow = {
            id:          `gb-new-${Date.now()}`,
            ordinal:     '1.',
            workItemId:  this._nextWpId(),
            linkLabel:   participantName,
            topic:       `${topicLabel}${resourceLabel ? ' • ' + resourceLabel : ''}`,
            slot:        this._nowSlot(),
            checkInTime,
            waitTime:    this._calcWaitTime(peopleAhead),
        };

        // Deep-copy topics, append new row into the matching section, re-number ordinals
        const updated = this.generalBankingTopics.map(t => {
            if (t.id !== sectionId) return t;
            const rows = [...t.participants, newRow].map((r, i) => ({ ...r, ordinal: `${i + 1}.` }));
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
        this.ciResource = '';
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

        const ibSection = this.investmentBankingTopics.find(t => t.id === 'investment-planning');
        const ibPeopleAhead = ibSection ? ibSection.participants.length : 0;

        const newRow = {
            id:          `ib-new-${Date.now()}`,
            ordinal:     '1.',
            workItemId:  this._nextWpId(),
            linkLabel:   participantName,
            topic:       `${topicLabel}${resourceLabel ? ' • ' + resourceLabel : ''}`,
            slot:        this._nowSlot(),
            checkInTime,
            waitTime:    this._calcWaitTime(ibPeopleAhead),
        };

        const updated = this.investmentBankingTopics.map(t => {
            if (t.id !== 'investment-planning') return t;
            const rows = [...t.participants, newRow].map((r, i) => ({ ...r, ordinal: `${i + 1}.` }));
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
        this.ibCiResource = '';
        this.ibCiDesc     = '';
        this.showCheckinComposerInvestment = false;
        this._showToast(`${participantName} was added to the waitlist Investment Banking.`);
    }

    // ── Dynamic waitlist check-in (shared state; only one open at a time) ──
    @track activeDynWlId = null;   // id of the waitlist whose composer is open

    @track dynCiGuestType  = 'existing';
    @track dynCiTopic      = '';
    @track dynCiResource   = '';
    @track dynCiDesc       = '';
    @track dynCiFirstName  = '';
    @track dynCiLastName   = '';
    @track dynCiContact    = '';
    @track dynCiCompany    = '';
    @track dynCiEmail      = '';
    @track dynCiIsVip      = false;
    @track dynParticipantSearch = '';
    @track showDynParticipantDropdown = false;
    @track showDynParticipantTypeDropdown = false;
    @track selectedDynParticipantType = 'Account';

    get dynCiIsNewParticipant() { return this.dynCiGuestType === 'new'; }
    get dynCiPersonLabel()      { return this.dynCiGuestType === 'new' ? "guest's" : "participant's"; }
    get dynCiDescPh()           { return `Enter a description for the ${this.dynCiGuestType === 'new' ? 'guest' : 'user'}'s interaction...`; }
    get dynCiFNamePh()    { return `Enter ${this.dynCiPersonLabel} first name`; }
    get dynCiLNamePh()    { return `Enter ${this.dynCiPersonLabel} last name`; }
    get dynCiContactPh()  { return `Enter ${this.dynCiPersonLabel} contact number`; }
    get dynCiCompanyPh()  { return `Enter ${this.dynCiPersonLabel} company`; }
    get dynCiEmailPh()    { return `Enter ${this.dynCiPersonLabel} email address...`; }
    get dynCiIsExisting()       { return this.dynCiGuestType === 'existing'; }

    get filteredParticipantsDyn() {
        const q = this.dynParticipantSearch.toLowerCase();
        return q
            ? this.participantRecentItems.filter(p => p.label.toLowerCase().includes(q) || (p.meta && p.meta.includes(q)))
            : this.participantRecentItems;
    }

    get activeDynWl() {
        return this.dynamicWaitlists.find(w => w.id === this.activeDynWlId) || null;
    }

    /** Returns dynamicWaitlists enriched with flat participant list */
    get enrichedDynamicWaitlists() {
        const q = this.globalSearch.trim().toLowerCase();
        return this.dynamicWaitlists.map(w => {
            const health = this._queueHealth(w.topics);
            // Capacity filter: skip queues not at capacity
            if (this.activeTileFilter === 'capacity' && health !== 'red') {
                return { ...w, topics: [], allParticipants: [], hasParticipants: false, dotClass: `lobby-queue-dot lobby-queue-dot--${health}`, metaLeft: '', metaRight: '' };
            }
            let topics = (w.topics && w.topics.length ? w.topics : []).filter(t => t.participants.length > 0);
            if (q) {
                topics = topics.map(t => ({
                    ...t,
                    participants: t.participants.filter(p =>
                        (p.linkLabel || '').toLowerCase().includes(q) ||
                        (p.topic || '').toLowerCase().includes(q)
                    ),
                })).filter(t => t.participants.length > 0);
            }
            // Enrich participants (avatar, VIP, overdue)
            topics = this._filterTopicsByResource(topics.map(t => ({
                ...t,
                participants: t.participants.map(p => this._enrichParticipant(p)),
            })));
            // Apply tile filter (VIP / overdue)
            topics = this._applyTileFilter(topics);
            const allParticipants = topics.flatMap(t => t.participants);
            const total = allParticipants.length;
            return {
                ...w,
                topics,
                allParticipants,
                hasParticipants: total > 0,
                dotClass: `lobby-queue-dot lobby-queue-dot--${health}`,
                metaLeft: `Showing ${total} of ${total} Items • Updated just now`,
                metaRight: 'Total Appointment Duration: 0 hr 0 min',
            };
        });
    }

    get dynCheckinTopicOptions() {
        const wl = this.activeDynWl;
        if (!wl || !wl.workTypes || !wl.workTypes.length) {
            return [{ label: wl ? wl.name : 'General', value: 'general' }];
        }
        // workTypes are stored as { value, label } objects from the creator panel
        return wl.workTypes.map(t =>
            (typeof t === 'object' && t.label)
                ? { label: t.label, value: t.value }
                : { label: t, value: String(t).toLowerCase().replace(/\s+/g, '-') }
        );
    }

    handleDynQueueCheckIn(event) {
        const id = event.currentTarget.dataset.id;
        this.dynamicWaitlists = this.dynamicWaitlists.map(w => {
            const opening = w.id === id && !w.showCheckinComposer;
            return { ...w, showCheckinComposer: w.id === id ? !w.showCheckinComposer : false };
        });
        // Sync activeDynWlId for dynCheckinTopicOptions
        const opened = this.dynamicWaitlists.find(w => w.showCheckinComposer);
        this.activeDynWlId = opened ? opened.id : null;
        if (opened) {
            const opts = this.dynCheckinTopicOptions;
            this.dynCiTopic = opts.length ? opts[0].value : '';
        }
    }

    handleCloseDynCheckinComposer() {
        this.dynamicWaitlists = this.dynamicWaitlists.map(w => ({ ...w, showCheckinComposer: false }));
        this.activeDynWlId = null;
    }

    handleDynCiGuestTypeChange(event) { this.dynCiGuestType = event.target.value; }
    handleDynCiTopicChange(event)     { this.dynCiTopic     = event.detail.value; }
    handleDynCiResourceChange(event)  { this.dynCiResource  = event.detail.value; }
    handleDynCiDescChange(event)      { this.dynCiDesc      = event.target.value; }
    handleDynCiFirstNameChange(event) { this.dynCiFirstName = event.target.value; }
    handleDynCiLastNameChange(event)  { this.dynCiLastName  = event.target.value; }
    handleDynCiContactChange(event)   { this.dynCiContact   = event.target.value; }
    handleDynCiCompanyChange(event)   { this.dynCiCompany   = event.target.value; }
    handleDynCiEmailChange(event)     { this.dynCiEmail     = event.target.value; }
    handleDynCiVipChange(event)       { this.dynCiIsVip     = event.target.checked; }

    handleDynParticipantTypeToggle() {
        this.showDynParticipantTypeDropdown = !this.showDynParticipantTypeDropdown;
        this.showDynParticipantDropdown = false;
    }
    handleDynParticipantTypeBlur() {
        setTimeout(() => { this.showDynParticipantTypeDropdown = false; }, 200);
    }
    handleDynParticipantTypeSelect(event) {
        const opt = this.participantTypeOptions.find(o => o.id === event.currentTarget.dataset.id);
        if (opt) this.selectedDynParticipantType = opt.label;
        this.showDynParticipantTypeDropdown = false;
    }
    handleDynParticipantFocus() {
        this.showDynParticipantDropdown = true;
        this.showDynParticipantTypeDropdown = false;
    }
    handleDynParticipantInput(event) {
        this.dynParticipantSearch = event.target.value;
        this.showDynParticipantDropdown = true;
    }
    handleDynParticipantSelect(event) {
        const id = event.currentTarget.dataset.id;
        const item = this.participantRecentItems.find(p => p.id === id);
        if (item) this.dynParticipantSearch = item.label;
        this.showDynParticipantDropdown = false;
    }
    handleDynParticipantBlur() {
        setTimeout(() => { this.showDynParticipantDropdown = false; }, 200);
    }

    handleSubmitCheckinComposerDyn() {
        const wl = this.activeDynWl;
        if (!wl) return;
        const participantName = this.dynCiIsNewParticipant
            ? `${this.dynCiFirstName.trim()} ${this.dynCiLastName.trim()}`.trim() || 'New Participant'
            : this.dynParticipantSearch.trim() || 'New Participant';
        const resourceLabel = this._resourceValueToLabel(this.dynCiResource);
        const topicLabel    = this.dynCheckinTopicOptions.find(o => o.value === this.dynCiTopic)?.label || this.dynCiTopic;

        // Add participant and close the composer in a single @track mutation
        this.dynamicWaitlists = this.dynamicWaitlists.map(w => {
            if (w.id !== wl.id) return w;

            // Build initial topic sections from workTypes if not yet created
            const seedTopics = (w.workTypes && w.workTypes.length)
                ? w.workTypes.map(t => ({
                    id: `${w.id}-${typeof t === 'object' ? t.value : t}`,
                    label: `${typeof t === 'object' ? t.label : t} (0)`,
                    participants: [],
                }))
                : [{ id: `${w.id}-default`, label: `${w.name} (0)`, participants: [] }];

            const existingTopics = (w.topics && w.topics.length) ? w.topics : seedTopics;

            // Find or create the section matching the selected topic
            const targetId = `${w.id}-${this.dynCiTopic}`;
            const dynSection = existingTopics.find(t => t.id === targetId) || existingTopics[0];
            const dynPeopleAhead = dynSection ? dynSection.participants.length : 0;

            const newRow = {
                id:         `dyn-new-${Date.now()}`,
                ordinal:    '1.',
                workItemId: this._nextWpId(),
                linkLabel:  participantName,
                topic:      `${topicLabel}${resourceLabel ? ' • ' + resourceLabel : ''}`,
                slot:       this._nowSlot(),
                checkInTime: this._nowTime(),
                waitTime:   this._calcWaitTime(dynPeopleAhead),
            };

            let matched = false;
            const updated = existingTopics.map(t => {
                if (t.id !== targetId) return t;
                matched = true;
                const rows = [...t.participants, newRow].map((r, i) => ({ ...r, ordinal: `${i + 1}.` }));
                const labelBase = t.label.replace(/\s*\(\d+\)$/, '');
                return { ...t, participants: rows, label: `${labelBase} (${rows.length})` };
            });

            // If no matching section found, add to the first one
            if (!matched && updated.length) {
                const rows = [...updated[0].participants, newRow].map((r, i) => ({ ...r, ordinal: `${i + 1}.` }));
                const labelBase = updated[0].label.replace(/\s*\(\d+\)$/, '');
                updated[0] = { ...updated[0], participants: rows, label: `${labelBase} (${rows.length})` };
            }

            const openSection = updated.find(t => t.participants.length > 0)?.id || updated[0]?.id;
            return { ...w, topics: updated, openSections: [openSection], showCheckinComposer: false };
        });

        // Reset
        this.dynParticipantSearch = '';
        this.dynCiGuestType = 'existing';
        this.dynCiFirstName = ''; this.dynCiLastName = ''; this.dynCiContact = '';
        this.dynCiCompany = ''; this.dynCiEmail = '';
        this.dynCiResource = '';
        this.dynCiDesc = '';
        this.activeDynWlId = null;
        this._showToast(`${participantName} was added to the waitlist ${wl.name}.`);
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

    // ── Drag and drop reordering ──────────────────────────────────────────────

    _dragState = null; // { id, topicId, section, wlId }

    @track dragOverId = null; // participant id being hovered over

    // Finds the nearest participant card element (data-id) from an event target,
    // piercing LWC's shadow retargeting by walking composedPath().
    _cardFromEvent(event) {
        const path = event.composedPath ? event.composedPath() : [event.target];
        for (const el of path) {
            if (el && el.dataset && el.dataset.id && el.dataset.section) return el;
        }
        return null;
    }

    handleDragStart(event) {
        const el = this._cardFromEvent(event) || event.currentTarget;
        if (!el || !el.dataset.id) return;
        this._dragState = {
            id:      el.dataset.id,
            topicId: el.dataset.topicId,
            section: el.dataset.section,
            wlId:    el.dataset.wlId || null,
        };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', el.dataset.id);
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const el = this._cardFromEvent(event) || event.currentTarget;
        const targetId = el && el.dataset ? el.dataset.id : null;
        if (targetId && this.dragOverId !== targetId) this.dragOverId = targetId;
    }

    handleDragLeave(event) {
        const el = this._cardFromEvent(event) || event.currentTarget;
        const id = el && el.dataset ? el.dataset.id : null;
        if (!id || this.dragOverId !== id) return;
        // Check if still within the card's bounding box to avoid flickering when
        // moving over child elements (composedPath may not include shadow children)
        if (el.getBoundingClientRect) {
            const r = el.getBoundingClientRect();
            const x = event.clientX, y = event.clientY;
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return;
        }
        this.dragOverId = null;
    }

    handleDrop(event) {
        event.preventDefault();
        const el = this._cardFromEvent(event) || event.currentTarget;
        const targetId      = el && el.dataset ? el.dataset.id : null;
        const targetTopic   = el && el.dataset ? el.dataset.topicId : null;
        const targetSection = el && el.dataset ? el.dataset.section : null;
        const targetWlId    = el && el.dataset ? (el.dataset.wlId || null) : null;
        this.dragOverId = null;
        if (!this._dragState || !targetId || this._dragState.id === targetId) {
            this._dragState = null;
            return;
        }
        this._reorderParticipants(this._dragState, { id: targetId, topicId: targetTopic, section: targetSection, wlId: targetWlId });
        this._dragState = null;
    }

    handleDragEnd() {
        this.dragOverId = null;
        this._dragState = null;
    }

    _reorderParticipants(from, to) {
        // Reorder within same topic
        const reorder = (topics) => topics.map(t => {
            const isFromTopic = t.id === from.topicId;
            const isToTopic   = t.id === to.topicId;
            if (!isFromTopic && !isToTopic) return t;

            let parts = [...(t.participants || [])];
            // Remove dragged item if it's in this topic
            let dragged = null;
            if (isFromTopic) {
                dragged = parts.find(p => p.id === from.id);
                parts = parts.filter(p => p.id !== from.id);
            }
            // Insert before target if it's in this topic
            if (isToTopic && dragged) {
                const toIdx = parts.findIndex(p => p.id === to.id);
                if (toIdx === -1) {
                    parts.push(dragged);
                } else {
                    parts.splice(toIdx, 0, dragged);
                }
            } else if (isToTopic && !dragged) {
                // cross-topic: dragged was removed from another topic, we need to get it
                // handled below
            }
            return { ...t, participants: parts };
        });

        // Cross-topic: find dragged participant first from the source topic
        const getDragged = (topics) => {
            for (const t of topics) {
                if (t.id === from.topicId) {
                    return t.participants.find(p => p.id === from.id);
                }
            }
            return null;
        };

        const reorderCross = (topics) => {
            const dragged = getDragged(topics);
            if (!dragged) return topics;
            return topics.map(t => {
                if (t.id === from.topicId) {
                    return { ...t, participants: t.participants.filter(p => p.id !== from.id) };
                }
                if (t.id === to.topicId) {
                    const parts = [...(t.participants || [])];
                    const toIdx = parts.findIndex(p => p.id === to.id);
                    if (toIdx === -1) parts.push(dragged);
                    else parts.splice(toIdx, 0, dragged);
                    return { ...t, participants: parts };
                }
                return t;
            });
        };

        const isCross = from.topicId !== to.topicId;
        const fn = isCross ? reorderCross : reorder;

        if (from.section === 'gb') {
            this.generalBankingTopics = fn(this.generalBankingTopics);
        } else if (from.section === 'ib') {
            this.investmentBankingTopics = fn(this.investmentBankingTopics);
        } else if (from.section === 'dyn' && from.wlId) {
            this.dynamicWaitlists = this.dynamicWaitlists.map(w =>
                w.id === from.wlId ? { ...w, topics: fn(w.topics || []) } : w
            );
        }
    }

    // ── Participant row action dropdown ──

    _closeActiveMenu() {
        this.activeMenuRowId = null;
        this.activeApptMenuId = null;
        this._stopMenuTracking();
    }

    @track activeMenuRowId = null;
    @track menuDropdownStyle = '';
    _menuAnchorEl = null;
    _menuRafId = null;

    _startMenuTracking(anchorEl, styleKey) {
        this._menuAnchorEl = anchorEl;
        this._menuStyleKey = styleKey;
        const update = () => {
            if (!this._menuAnchorEl) return;
            const rect = this._menuAnchorEl.getBoundingClientRect();
            const style = `top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;`;
            if (styleKey === 'row') this.menuDropdownStyle = style;
            else this.apptMenuDropdownStyle = style;
            this._menuRafId = requestAnimationFrame(update);
        };
        this._menuRafId = requestAnimationFrame(update);
    }

    _stopMenuTracking() {
        if (this._menuRafId) {
            cancelAnimationFrame(this._menuRafId);
            this._menuRafId = null;
        }
        this._menuAnchorEl = null;
    }

    handleQueueParticipantMenu(event) {
        const id = event.currentTarget.dataset.id;
        if (this.activeMenuRowId === id) {
            this.activeMenuRowId = null;
            this._stopMenuTracking();
            return;
        }
        this.activeMenuRowId = id;
        this._startMenuTracking(event.currentTarget, 'row');
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

    // ── Batch 3: Transfer, Daily Summary, Compact view, Peak hours, Export ──

    // Transfer between queues
    @track showTransferModal = false;
    @track transferParticipantId = null;
    @track transferTargetQueue = '';

    get transferQueueOptions() {
        const opts = [
            { label: 'General Banking', value: 'gb' },
            { label: 'Investment Banking', value: 'ib' },
        ];
        (this.dynamicWaitlists || []).forEach(w => opts.push({ label: w.name, value: w.id }));
        return opts;
    }

    handleTransferRequest(event) {
        this.transferParticipantId = event.currentTarget.dataset.id;
        this.transferTargetQueue = '';
        this.showTransferModal = true;
        this.activeMenuRowId = null;
    }

    handleTransferTargetChange(event) {
        this.transferTargetQueue = event.detail.value;
    }

    handleTransferConfirm() {
        const id = this.transferParticipantId;
        const target = this.transferTargetQueue;
        if (!id || !target) return;

        // Find and remove participant from all topics
        let participant = null;
        const remover = (rows) => rows.filter(p => { if (p.id === id) { participant = p; return false; } return true; });
        const topicRemover = (topics) => topics.map(t => ({ ...t, participants: remover(t.participants || []) }));

        this.generalBankingTopics    = sortLobbyTopicsByCountDesc(topicRemover(this.generalBankingTopics));
        this.investmentBankingTopics = sortLobbyTopicsByCountDesc(topicRemover(this.investmentBankingTopics));
        this.dynamicWaitlists = this.dynamicWaitlists.map(w => ({ ...w, topics: topicRemover(w.topics || []) }));

        if (!participant) { this.showTransferModal = false; return; }

        // Add to target
        const newParticipant = { ...participant, id: `${participant.id}-t${Date.now()}` };
        if (target === 'gb') {
            const topics = this.generalBankingTopics.length ? this.generalBankingTopics : [];
            if (topics.length) {
                this.generalBankingTopics = sortLobbyTopicsByCountDesc(topics.map((t, i) => i === 0 ? { ...t, participants: [...t.participants, newParticipant] } : t));
            }
        } else if (target === 'ib') {
            const topics = this.investmentBankingTopics;
            if (topics.length) {
                this.investmentBankingTopics = sortLobbyTopicsByCountDesc(topics.map((t, i) => i === 0 ? { ...t, participants: [...t.participants, newParticipant] } : t));
            }
        } else {
            this.dynamicWaitlists = this.dynamicWaitlists.map(w => {
                if (w.id !== target) return w;
                const topics = w.topics && w.topics.length ? w.topics : [{ id: `${w.id}-default`, label: w.name + ' (0)', participants: [] }];
                return { ...w, topics: topics.map((t, i) => i === 0 ? { ...t, participants: [...t.participants, newParticipant] } : t) };
            });
        }

        this._transferredCount += 1;
        this.showTransferModal = false;
        this._showToast(`${participant.linkLabel} transferred successfully.`);
    }

    handleTransferCancel() {
        this.showTransferModal = false;
    }

    // Daily summary
    @track showDailySummary = false;

    get dailySummaryTotalServed() {
        return (this.currentAppointments || []).filter(a => a.checkedIn).length + this._allWaitlistParticipants().length;
    }

    get dailySummaryNoShows() { return 2; } // demo static value

    get dailySummaryAvgWait() { return this.metricAvgWait; }

    handleToggleDailySummary() {
        this.showDailySummary = !this.showDailySummary;
    }

    // Compact view toggle
    @track compactView = false;

    handleToggleCompactView() {
        this.compactView = !this.compactView;
    }

    get compactViewLabel() { return this.compactView ? 'Full View' : 'Compact View'; }

    get rootClass() {
        return this.compactView ? 'lobby-root lobby-root--compact' : 'lobby-root';
    }

    // Peak hours chart — period filter
    @track peakPeriod = 'daily';

    get peakPeriodIsDaily()   { return this.peakPeriod === 'daily'; }
    get peakPeriodIsWeekly()  { return this.peakPeriod === 'weekly'; }
    get peakPeriodIsMonthly() { return this.peakPeriod === 'monthly'; }

    get peakPeriodDailyClass()   { return 'lobby-chart-tab' + (this.peakPeriodIsDaily   ? ' lobby-chart-tab--active' : ''); }
    get peakPeriodWeeklyClass()  { return 'lobby-chart-tab' + (this.peakPeriodIsWeekly  ? ' lobby-chart-tab--active' : ''); }
    get peakPeriodMonthlyClass() { return 'lobby-chart-tab' + (this.peakPeriodIsMonthly ? ' lobby-chart-tab--active' : ''); }

    get peakChartCaption() {
        if (this.peakPeriod === 'weekly')  return 'Check-ins per day — last 7 days';
        if (this.peakPeriod === 'monthly') return 'Check-ins per week — last 4 weeks';
        return 'Check-ins per hour for today';
    }

    handlePeakPeriodDaily()   { this.peakPeriod = 'daily'; }
    handlePeakPeriodWeekly()  { this.peakPeriod = 'weekly'; }
    handlePeakPeriodMonthly() { this.peakPeriod = 'monthly'; }

    // Simulated datasets per period
    _peakDataByPeriod() {
        if (this.peakPeriod === 'weekly') {
            return [
                { hour: 'Mon', count: 28 },
                { hour: 'Tue', count: 35 },
                { hour: 'Wed', count: 42 },
                { hour: 'Thu', count: 54 },
                { hour: 'Fri', count: 61 },
                { hour: 'Sat', count: 19 },
                { hour: 'Sun', count: 11 },
            ];
        }
        if (this.peakPeriod === 'monthly') {
            return [
                { hour: 'Wk 1', count: 187 },
                { hour: 'Wk 2', count: 214 },
                { hour: 'Wk 3', count: 198 },
                { hour: 'Wk 4', count: 231 },
            ];
        }
        // daily (hourly)
        return [
            { hour: '8AM',  count: 3  },
            { hour: '9AM',  count: 8  },
            { hour: '10AM', count: 12 },
            { hour: '11AM', count: 7  },
            { hour: '12PM', count: 5  },
            { hour: '1PM',  count: 9  },
            { hour: '2PM',  count: 6  },
            { hour: '3PM',  count: 4  },
        ];
    }

    get peakHoursBars() {
        const data = this._peakDataByPeriod();
        const max = Math.max(...data.map(d => d.count));
        const chartH = 80;
        return data.map(d => {
            const h = Math.max(4, Math.round((d.count / max) * chartH));
            const isPeak = d.count === max;
            return {
                ...d,
                label: String(d.count),
                barStyle: `height:${h}px;`,
                barClass: isPeak
                    ? 'lobby-peak-chart__bar lobby-peak-chart__bar--peak'
                    : 'lobby-peak-chart__bar',
            };
        });
    }

    @track showPeakChart = false;

    handleTogglePeakChart() {
        this.showPeakChart = !this.showPeakChart;
    }

    // Export / Print
    handleExport() {
        const parts = this._allWaitlistParticipants();
        const rows = [['Name', 'Topic', 'Check-In Time', 'Wait Time']];
        parts.forEach(p => rows.push([p.linkLabel || '', p.topic || '', p.checkInTime || '', p.waitTime || '']));
        const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lobby-queue-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ─────────────────────────────────────────────────────────────────────────

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
                    checkedInLabel: 'Checked In',
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
            this._stopMenuTracking();
            return;
        }
        this.activeApptMenuId = id;
        this._startMenuTracking(event.currentTarget, 'appt');
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
