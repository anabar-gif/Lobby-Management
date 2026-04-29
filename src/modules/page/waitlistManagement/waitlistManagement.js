import { LightningElement, track } from 'lwc';

const COLUMNS = [
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
    },
    {
        label: 'Allow Self Check In',
        fieldName: 'allowSelfCheckin',
        type: 'boolean',
        sortable: true,
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
    },
    {
        id: 'wl-2',
        name: 'Wealth Management',
        nameUrl: '#',
        territory: 'Market St Branch',
        territoryUrl: '#',
        active: true,
        allowSelfCheckin: false,
    },
];

export default class WaitlistManagement extends LightningElement {
    @track currentView    = 'All Waitlists';
    @track searchTerm     = '';
    @track showNewModal   = false;
    @track rows           = [...SEED_ROWS];
    @track newWl = {
        name: '',
        territory: '',
        active: false,
        allowSelfCheckin: false,
    };

    columns = COLUMNS;

    get metaLine() {
        const n = this.filteredRows.length;
        return `${n} item${n !== 1 ? 's' : ''} • Sorted by Name • Updated a few seconds ago`;
    }

    get filteredRows() {
        const term = (this.searchTerm || '').toLowerCase().trim();
        if (!term) return this.rows;
        return this.rows.filter(
            (r) =>
                r.name.toLowerCase().includes(term) ||
                r.territory.toLowerCase().includes(term)
        );
    }

    handleViewSelect(event) {
        this.currentView = event.detail.value;
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
