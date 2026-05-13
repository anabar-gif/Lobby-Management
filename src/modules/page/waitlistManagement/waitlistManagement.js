import { LightningElement, track } from 'lwc';
import { addWaitlist, getRows, setRows } from 'data/waitlistStore';

const COLUMNS = [
    {
        label: '',
        fieldName: 'rowNum',
        type: 'text',
        initialWidth: 40,
        cellAttributes: { style: 'color: var(--slds-g-color-neutral-base-50, #706e6b); font-size: 0.75rem;' },
    },
    {
        label: 'Name',
        fieldName: 'nameUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'name' }, target: '_self' },
        sortable: true,
    },
    {
        label: 'Service Territory',
        fieldName: 'territoryUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'territory' }, target: '_self' },
        sortable: true,
    },
    {
        label: 'Active',
        fieldName: 'active',
        type: 'boolean',
        sortable: true,
        initialWidth: 120,
    },
    {
        label: 'Allow Self Check In',
        fieldName: 'allowSelfCheckin',
        type: 'boolean',
        sortable: true,
        initialWidth: 180,
    },
    {
        label: 'Link',
        fieldName: 'selfCheckinUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'selfCheckinUrl' }, target: '_blank' },
    },
    {
        type: 'action',
        typeAttributes: {
            rowActions: [
                { label: 'Edit',   name: 'edit' },
                { label: 'Delete', name: 'delete' },
            ],
        },
    },
];

const SEED_ROWS = [
    {
        id: 'wl-1',
        name: 'General Banking',
        nameUrl: '#',
        territory: 'Market St Branch',
        territoryUrl: '#',
        active: true,
        allowSelfCheckin: true,
        selfCheckinUrl: 'https://dundermifflin.sfdctest.test1.my.pc-rnd.site.com/customers/s/self-check-in',
    },
    {
        id: 'wl-2',
        name: 'Wealth Management',
        nameUrl: '#',
        territory: 'Market St Branch',
        territoryUrl: '#',
        active: true,
        allowSelfCheckin: false,
        selfCheckinUrl: null,
    },
];

const ALL_TERRITORIES = [
    { value: 'dc',          label: 'DC',                  meta: 'Working Hours 10 • Open Mon–Fri' },
    { value: 'market-st',   label: 'Market St Branch',    meta: 'Working Hours 10 • Open Mon–Fri' },
    { value: 'mission-st',  label: 'Mission St Branch',   meta: 'Working Hours 10 • Open Mon–Fri' },
    { value: 'q4-01',       label: 'Q4 Branch 01',        meta: 'Working Hours 10 • Open Mon–Fri' },
    { value: 'q4-03',       label: 'Q4 Branch 03',        meta: 'Working Hours 10 • Open Mon–Fri' },
    { value: 'virtual',     label: 'Virtual Retail Banking', meta: 'Working Hours 10 • Virtual' },
];

const ALL_WORK_TYPES = [
    { value: 'general-banking',     label: 'General Banking' },
    { value: 'wealth-mgmt',         label: 'Wealth Management' },
    { value: 'insurance-planning',  label: 'Insurance Planning' },
    { value: 'savings-account',     label: 'Savings Account' },
    { value: 'investment-planning', label: 'Investment Planning' },
    { value: 'retail-loan',         label: 'Retail Loan' },
    { value: 'commercial-loan',     label: 'Commercial Loan' },
    { value: 'industrial-loan',     label: 'Industrial Loan' },
    { value: 'loan-information',    label: 'Loan Information' },
    { value: 'loan-application',    label: 'Loan Application' },
];

const ALL_RESOURCES = [
    { value: 'adam-milne',  label: 'Adam Milne' },
    { value: 'tom-sawyer',  label: 'Tom Sawyer' },
    { value: 'rachel-adams', label: 'Rachel Adams' },
    { value: 'michael-scott', label: 'Michael Scott' },
];

const RECENT_VIEWS = [
    { label: 'All Waitlists',                value: 'All Waitlists' },
    { label: 'My Waitlists',                 value: 'My Waitlists' },
    { label: 'Recently Viewed (Pinned list)', value: 'Recently Viewed (Pinned list)' },
];
const OTHER_VIEWS = [
    { label: 'Recently Viewed Waitlists', value: 'Recently Viewed Waitlists' },
];

const EMPTY_CREATOR = () => ({
    name: '',
    territorySearch: '',
    territoryValue: '',
    territoryLabel: '',
    description: '',
    workTypes: [],
    resources: [],
    active: true,
    selfCheckin: false,
});

export default class WaitlistManagement extends LightningElement {
    @track currentView          = 'All Waitlists';
    @track viewDropdownOpen     = false;
    @track viewSearch           = '';
    @track searchTerm           = '';
    @track rows                 = getRows() ?? [...SEED_ROWS];

    // Creator panel
    @track showCreator          = false;
    @track creatorVisible       = false; // drives slide-in animation
    @track creator              = EMPTY_CREATOR();
    @track showTerritoryDropdown = false;
    @track showWorkTypeDropdown  = false;
    @track showResourceDropdown  = false;
    @track wtSearch              = '';
    @track resSearch             = '';
    @track nameError            = false;
    @track territoryError       = false;
    @track workTypeError        = false;
    @track resourceError        = false;

    columns = COLUMNS;

    // ── View switcher ──────────────────────────────────────────
    _buildViewList(list) {
        const term = (this.viewSearch || '').toLowerCase();
        return list
            .filter((v) => !term || v.label.toLowerCase().includes(term))
            .map((v) => ({
                ...v,
                selected: v.value === this.currentView,
                itemClass: `wl-view-dropdown__item${v.value === this.currentView ? ' wl-view-dropdown__item--selected' : ''}`,
            }));
    }

    get recentListViews() { return this._buildViewList(RECENT_VIEWS); }
    get otherListViews()  { return this._buildViewList(OTHER_VIEWS);  }

    // ── Table data ─────────────────────────────────────────────
    get metaLine() {
        const n = this.filteredRows.length;
        return `${n} item${n !== 1 ? 's' : ''} • Sorted by Name • Updated a few seconds ago`;
    }

    get filteredRows() {
        const term = (this.searchTerm || '').toLowerCase().trim();
        const base = term
            ? this.rows.filter(
                  (r) =>
                      r.name.toLowerCase().includes(term) ||
                      r.territory.toLowerCase().includes(term)
              )
            : this.rows;
        return base.map((r, i) => ({ ...r, rowNum: String(i + 1) }));
    }

    // ── Creator computed ───────────────────────────────────────
    get creatorPanelClass() {
        return `wl-creator${this.creatorVisible ? ' wl-creator--open' : ''}`;
    }

    get nameInputClass() {
        return `wl-creator__input${this.nameError ? ' wl-creator__input--error' : ''}`;
    }

    get territoryInputClass() {
        return `wl-creator__input wl-creator__input--territory${this.territoryError ? ' wl-creator__input--error' : ''}`;
    }

    get filteredTerritories() {
        const term = (this.creator.territorySearch || '').toLowerCase();
        return ALL_TERRITORIES.filter(
            (t) => !term || t.label.toLowerCase().includes(term)
        );
    }

    get noTerritoryResults() {
        return this.filteredTerritories.length === 0;
    }

    // Work Types — grouped & searchable
    get recentWorkTypes() {
        const selected = new Set(this.creator.workTypes.map((w) => w.value));
        return ALL_WORK_TYPES.slice(0, 3).filter((w) => !selected.has(w.value));
    }
    get hasRecentWorkTypes() { return this.recentWorkTypes.length > 0; }

    get filteredWorkTypes() {
        const selected = new Set(this.creator.workTypes.map((w) => w.value));
        const recent   = new Set(this.recentWorkTypes.map((w) => w.value));
        const term     = (this.wtSearch || '').toLowerCase();
        return ALL_WORK_TYPES
            .filter((w) => !selected.has(w.value) && !recent.has(w.value))
            .filter((w) => !term || w.label.toLowerCase().includes(term));
    }
    get noFilteredWorkTypes() {
        return this.filteredWorkTypes.length === 0 && !this.hasRecentWorkTypes;
    }
    get noWorkTypes() { return this.creator.workTypes.length === 0; }
    get wtSearchWrapClass() { return `wl-creator__search-wrap${this.workTypeError ? ' wl-creator__search-wrap--error' : ''}`; }

    // Service Resources — grouped & searchable
    get recentResources() {
        const selected = new Set(this.creator.resources.map((r) => r.value));
        return ALL_RESOURCES.slice(0, 2).filter((r) => !selected.has(r.value));
    }
    get hasRecentResources() { return this.recentResources.length > 0; }

    get filteredResources() {
        const selected = new Set(this.creator.resources.map((r) => r.value));
        const recent   = new Set(this.recentResources.map((r) => r.value));
        const term     = (this.resSearch || '').toLowerCase();
        return ALL_RESOURCES
            .filter((r) => !selected.has(r.value) && !recent.has(r.value))
            .filter((r) => !term || r.label.toLowerCase().includes(term));
    }
    get noFilteredResources() {
        return this.filteredResources.length === 0 && !this.hasRecentResources;
    }
    get noResources() { return this.creator.resources.length === 0; }
    get resSearchWrapClass() { return `wl-creator__search-wrap${this.resourceError ? ' wl-creator__search-wrap--error' : ''}`; }

    get activeToggleClass() {
        return `wl-creator__toggle${this.creator.active ? ' wl-creator__toggle--on' : ''}`;
    }

    get selfCheckinToggleClass() {
        return `wl-creator__toggle${this.creator.selfCheckin ? ' wl-creator__toggle--on' : ''}`;
    }

    // ── Lifecycle ──────────────────────────────────────────────
    connectedCallback() {
        this._docClick = (e) => {
            // composedPath() traverses shadow DOM boundaries correctly
            const path = e.composedPath ? e.composedPath() : [];
            const inEl = (sel) => {
                const el = this.template.querySelector(sel);
                return el && (el.contains(e.target) || path.includes(el));
            };
            // close view dropdown
            if (!inEl('.wl-view-trigger-wrap')) {
                this.viewDropdownOpen = false;
            }
            // close territory dropdown if clicking outside it
            if (!inEl('.wl-creator__territory-wrap')) {
                this.showTerritoryDropdown = false;
            }
            // close work-type dropdown
            const wtWrap = this.template.querySelector('.wl-creator__search-wrap[data-field="worktype"]');
            if (wtWrap && !wtWrap.contains(e.target) && !path.includes(wtWrap)) {
                this.showWorkTypeDropdown = false;
            }
            // close resource dropdown
            const resWrap = this.template.querySelector('.wl-creator__search-wrap[data-field="resource"]');
            if (resWrap && !resWrap.contains(e.target) && !path.includes(resWrap)) {
                this.showResourceDropdown = false;
            }
        };
        document.addEventListener('click', this._docClick);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._docClick);
    }

    // ── View switcher handlers ─────────────────────────────────
    handleViewTrigger(event) {
        event.stopPropagation();
        this.viewDropdownOpen = !this.viewDropdownOpen;
        this.viewSearch = '';
    }

    handleViewSearch(event) {
        this.viewSearch = event.target.value;
    }

    handleViewSelect(event) {
        this.currentView = event.currentTarget.dataset.value;
        this.viewDropdownOpen = false;
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    // ── Creator open/close ─────────────────────────────────────
    handleNew() {
        this.creator = EMPTY_CREATOR();
        this.nameError = false;
        this.territoryError = false;
        this.showCreator = true;
        // next tick: trigger slide-in animation
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.creatorVisible = true; }, 16);
    }

    handleCreatorCancel() {
        this.creatorVisible = false;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.showCreator = false; }, 300);
    }

    // ── Creator field handlers ─────────────────────────────────
    handleCreatorName(event) {
        this.creator = { ...this.creator, name: event.target.value };
        if (event.target.value.trim()) this.nameError = false;
    }

    handleCreatorDesc(event) {
        this.creator = { ...this.creator, description: event.target.value };
    }

    handleTerritoryFocus() {
        this.showTerritoryDropdown = true;
    }

    handleTerritoryBlur() {
        // Delay so click on an item fires before the dropdown closes
        setTimeout(() => { this.showTerritoryDropdown = false; }, 200);
    }

    handleTerritorySearch(event) {
        this.creator = { ...this.creator, territorySearch: event.target.value, territoryValue: '', territoryLabel: '' };
        this.showTerritoryDropdown = true;
        if (event.target.value.trim()) this.territoryError = false;
    }

    handleTerritorySelect(event) {
        event.stopPropagation();
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        this.creator = { ...this.creator, territoryValue: value, territoryLabel: label, territorySearch: label };
        this.showTerritoryDropdown = false;
        this.territoryError = false;
    }

    // ── Work Types ─────────────────────────────────────────────
    handleSearchWrapClick(event) { event.stopPropagation(); }

    handleWtFocus(event) {
        event.stopPropagation();
        this.showWorkTypeDropdown = true;
        this.showResourceDropdown = false;
    }
    handleWtSearch(event) {
        this.wtSearch = event.target.value;
        this.showWorkTypeDropdown = true;
    }

    handleAddWorkType(event) {
        event.stopPropagation();
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        this.creator       = { ...this.creator, workTypes: [...this.creator.workTypes, { value, label }] };
        this.wtSearch      = '';
        this.workTypeError = false;
        this.showWorkTypeDropdown = false;
    }

    handleRemoveWorkType(event) {
        const value = event.currentTarget.dataset.value;
        this.creator = { ...this.creator, workTypes: this.creator.workTypes.filter((w) => w.value !== value) };
    }

    // ── Service Resources ──────────────────────────────────────
    handleResFocus(event) {
        event.stopPropagation();
        this.showResourceDropdown = true;
        this.showWorkTypeDropdown = false;
    }
    handleResSearch(event) {
        this.resSearch = event.target.value;
        this.showResourceDropdown = true;
    }

    handleAddResource(event) {
        event.stopPropagation();
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        this.creator       = { ...this.creator, resources: [...this.creator.resources, { value, label }] };
        this.resSearch     = '';
        this.resourceError = false;
        this.showResourceDropdown = false;
    }

    handleRemoveResource(event) {
        const value = event.currentTarget.dataset.value;
        this.creator = { ...this.creator, resources: this.creator.resources.filter((r) => r.value !== value) };
    }

    // ── Toggles ────────────────────────────────────────────────
    handleToggleActive() {
        this.creator = { ...this.creator, active: !this.creator.active };
    }

    handleToggleSelfCheckin() {
        this.creator = { ...this.creator, selfCheckin: !this.creator.selfCheckin };
    }

    // ── Save ───────────────────────────────────────────────────
    handleCreatorSave() {
        this.nameError      = !this.creator.name.trim();
        this.territoryError = !this.creator.territoryValue;
        this.workTypeError  = this.creator.workTypes.length === 0;
        this.resourceError  = this.creator.resources.length === 0;
        if (this.nameError || this.territoryError || this.workTypeError || this.resourceError) return;

        const id   = `wl-${Date.now()}`;
        const name = this.creator.name.trim();

        // Add to the datatable
        this.rows = [
            ...this.rows,
            {
                id,
                name,
                nameUrl: '#',
                territory: this.creator.territoryLabel,
                territoryUrl: '#',
                active: this.creator.active,
                allowSelfCheckin: this.creator.selfCheckin,
                selfCheckinUrl: null,
            },
        ];

        // Persist rows so they survive tab navigation
        setRows(this.rows);

        // Push to the shared in-memory store so Lobby Management picks it up instantly
        addWaitlist({
            id,
            name,
            territory: this.creator.territoryLabel,
            workTypes: this.creator.workTypes,
            resources: this.creator.resources,
            active: this.creator.active,
        });

        this.handleCreatorCancel();
        this._toast(`Waitlist "${name}" created successfully.`);
    }

    // ── Row actions ────────────────────────────────────────────
    handleRowAction(event) {
        const { name } = event.detail.action;
        const row      = event.detail.row;
        if (name === 'delete') {
            this.rows = this.rows.filter((r) => r.id !== row.id);
            setRows(this.rows);
            this._toast(`"${row.name}" deleted.`);
        }
    }

    _toast(message) {
        this.dispatchEvent(
            new CustomEvent('showtoast', {
                detail: { message },
                bubbles: true,
                composed: true,
            })
        );
    }
}
