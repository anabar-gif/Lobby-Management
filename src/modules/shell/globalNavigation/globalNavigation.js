import { LightningElement, api, track } from 'lwc';

export default class GlobalNavigation extends LightningElement {
    @api currentPage = 'home';
    @api navItems = [];
    @track isWaffleMenuOpen = false;
    @track openGroupPage = null; // which group dropdown is open

    // ── Waffle ────────────────────────────────────────────────────────
    get waffleDropdownTriggerClass() {
        const base = 'slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click slds-no-hover';
        return this.isWaffleMenuOpen ? `${base} slds-is-open` : base;
    }

    /** Flat list for the waffle menu — expand groups into individual entries */
    get waffleItems() {
        const items = [];
        for (const item of (this.navItems || [])) {
            if (item.isGroup) {
                items.push(...item.children);
            } else {
                items.push(item);
            }
        }
        return items;
    }

    // ── Nav tabs ──────────────────────────────────────────────────────
    get navItemsWithActive() {
        return (this.navItems || []).map((item) => {
            if (item.isGroup) {
                const isActive = item.children.some((c) => c.page === this.currentPage);
                const isOpen = this.openGroupPage === item.page;
                const base = 'slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click';
                return {
                    ...item,
                    isPlain: false,
                    isActive,
                    isOpen,
                    tabClass: [base, isActive ? 'slds-is-active' : '', isOpen ? 'slds-is-open' : ''].filter(Boolean).join(' '),
                    dropdownClass: 'slds-dropdown slds-dropdown_left nav-group__dropdown',
                    children: item.children.map((c) => ({
                        ...c,
                        isActive: c.page === this.currentPage,
                        linkClass: c.page === this.currentPage ? 'nav-group__item-link nav-group__item-link--active' : 'nav-group__item-link',
                    })),
                };
            }
            const isActive = item.page === this.currentPage;
            return {
                ...item,
                isPlain: true,
                isActive,
                tabClass: isActive ? 'slds-context-bar__item slds-is-active' : 'slds-context-bar__item',
            };
        });
    }

    // ── Handlers ──────────────────────────────────────────────────────
    handleNavItemClick(event) {
        event.preventDefault();
        this.openGroupPage = null;
        const page = event.currentTarget.dataset.page;
        this._navigate(page);
    }

    handleGroupTabClick(event) {
        event.preventDefault();
        const page = event.currentTarget.dataset.page;
        this.openGroupPage = this.openGroupPage === page ? null : page;
    }

    handleGroupItemClick(event) {
        event.preventDefault();
        this.openGroupPage = null;
        const page = event.currentTarget.dataset.page;
        this._navigate(page);
    }

    handleWaffleOpen() {
        const wasOpen = this.isWaffleMenuOpen;
        this.isWaffleMenuOpen = !this.isWaffleMenuOpen;
        if (!wasOpen && this.isWaffleMenuOpen) {
            this._focusMenuOnNextRender = true;
        }
    }

    handleWaffleMenuItemClick(event) {
        event.preventDefault();
        this.isWaffleMenuOpen = false;
        const page = event.currentTarget.dataset.value;
        this._navigate(page);
    }

    handleWaffleMenuKeydown(event) {
        const menu = this.template.querySelector('.slds-dropdown');
        if (!menu || !menu.contains(event.target)) return;
        const key = event.key;
        if (key === 'Escape') {
            event.preventDefault();
            this.isWaffleMenuOpen = false;
            setTimeout(() => this._focusWaffle(), 0);
            return;
        }
        if (key === 'Tab') { this.isWaffleMenuOpen = false; return; }
        if (key === 'ArrowDown' || key === 'ArrowUp') {
            event.preventDefault();
            const items = Array.from(this.template.querySelectorAll('[role="menuitem"]'));
            const currentIndex = items.indexOf(event.target);
            if (currentIndex === -1) return;
            const next = key === 'ArrowDown'
                ? (currentIndex < items.length - 1 ? currentIndex + 1 : 0)
                : (currentIndex > 0 ? currentIndex - 1 : items.length - 1);
            items[next].focus();
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────
    connectedCallback() {
        this._boundHandleDocumentClick = this._handleDocumentClick.bind(this);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._boundHandleDocumentClick);
    }

    renderedCallback() {
        if (this.isWaffleMenuOpen || this.openGroupPage) {
            document.addEventListener('click', this._boundHandleDocumentClick);
            if (this._focusMenuOnNextRender) {
                this._focusMenuOnNextRender = false;
                this._focusFirstMenuItem();
            }
        } else {
            document.removeEventListener('click', this._boundHandleDocumentClick);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────
    _navigate(page) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { page }, bubbles: true, composed: true }));
    }

    _focusWaffle() {
        const icon = this.template.querySelector('.slds-context-bar__icon-action lightning-dynamic-icon');
        if (icon?.focus) icon.focus();
    }

    _focusFirstMenuItem() {
        const first = this.template.querySelector('[role="menuitem"]');
        if (first) setTimeout(() => first.focus(), 0);
    }

    _handleDocumentClick(event) {
        const path = event.composedPath ? event.composedPath() : [];
        // Close waffle
        const waffleTrigger = this.template.querySelector('[class*="slds-dropdown-trigger"]');
        if (waffleTrigger && !path.includes(waffleTrigger)) {
            this.isWaffleMenuOpen = false;
        }
        // Close group dropdowns if click is outside the nav
        const nav = this.template.querySelector('nav');
        if (nav && !path.includes(nav)) {
            this.openGroupPage = null;
        }
    }
}
