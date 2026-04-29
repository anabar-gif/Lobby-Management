import { LightningElement, track } from 'lwc';

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
        rowNum: '1',
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
        rowNum: '2',
        name: 'Wealth Management',
        nameUrl: '#',
        territory: 'Market St Branch',
        territoryUrl: '#',
        active: true,
        allowSelfCheckin: false,
        selfCheckinUrl: null,
    },
];

const RECENT_VIEWS = [
    { label: 'All Waitlists',              value: 'All Waitlists' },
    { label: 'My Waitlists',               value: 'My Waitlists' },
    { label: 'Recently Viewed (Pinned list)', value: 'Recently Viewed (Pinned list)' },
];
const OTHER_VIEWS = [
    { label: 'Recently Viewed Waitlists',  value: 'Recently Viewed Waitlists' },
];

export default class WaitlistManagement extends LightningElement {
    @track currentView       = 'All Waitlists';
    @track viewDropdownOpen  = false;
    @track viewSearch        = '';
    @track searchTerm        = '';
    @track showNewModal      = false;
    @track rows              = [...SEED_ROWS];
    @track newWl = {
        name: '',
        territory: '',
        active: false,
        allowSelfCheckin: false,
    };

    columns = COLUMNS;

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

    connectedCallback() {
        this._docClick = (e) => {
            if (!this.template.querySelector('.wl-view-trigger-wrap')?.contains(e.target)) {
                this.viewDropdownOpen = false;
            }
        };
        document.addEventListener('click', this._docClick);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._docClick);
    }

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

    handleNew() {
        this.newWl = { name: '', territory: '', active: false, allowSelfCheckin: false };
        this.showNewModal = true;
    }

    handleNewCancel() {
        this.showNewModal = false;
    }

    handleNewWlField(event) {
        const field = event.currentTarget.dataset.field;
        this.newWl = { ...this.newWl, [field]: event.target.value };
    }

    handleNewWlCheck(event) {
        const field = event.currentTarget.dataset.field;
        this.newWl = { ...this.newWl, [field]: event.target.checked };
    }

    handleNewSave() {
        if (!this.newWl.name.trim()) return;
        const id = `wl-${Date.now()}`;
        this.rows = [
            ...this.rows,
            {
                id,
                name: this.newWl.name,
                nameUrl: '#',
                territory: this.newWl.territory || '—',
                territoryUrl: '#',
                active: this.newWl.active,
                allowSelfCheckin: this.newWl.allowSelfCheckin,
            },
        ];
        this.showNewModal = false;
        this._toast(`Waitlist "${this.newWl.name}" created.`);
    }

    handleRowAction(event) {
        const { name } = event.detail.action;
        const row      = event.detail.row;
        if (name === 'delete') {
            this.rows = this.rows.filter((r) => r.id !== row.id);
            this._toast(`"${row.name}" deleted.`);
        }
        // edit: expand later
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
