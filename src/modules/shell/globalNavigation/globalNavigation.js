import { LightningElement, api, track } from 'lwc';

export default class GlobalNavigation extends LightningElement {
    @api currentPage = 'home';
    @api navItems = [];
    @track isWaffleMenuOpen = false;

    get waffleDropdownTriggerClass() {
        const base = 'slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click slds-no-hover';
        return this.isWaffleMenuOpen ? `${base} slds-is-open` : base;
    }

    /** Nav items with isActive and tabClass derived from currentPage (for template) */
    get navItemsWithActive() {
        return (this.navItems || []).map((item) => {
            const isActive = item.page === this.currentPage;
            const base = 'slds-context-bar__item';
            return {
                ...item,
                isActive,
                tabClass: isActive ? `${base} slds-is-active` : base,
            };
        });
    }

    handleNavItemClick(event) {
        event.preventDefault();
        const page = event.currentTarget.dataset.page;
        this.dispatchEvent(
            new CustomEvent('navigate', {
                detail: { page },
                bubbles: true,
                composed: true,
            })
        );
    }

    handleMenuNavigate(event) {
        const page = event.detail.value;
        this.dispatchEvent(
            new CustomEvent('navigate', {
                detail: { page },
                bubbles: true,
                composed: true,
            })
        );
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
        this.dispatchEvent(
            new CustomEvent('navigate', {
                detail: { page },
                bubbles: true,
                composed: true,
            })
        );
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
        if (key === 'Tab') {
            this.isWaffleMenuOpen = false;
            return;
        }
        if (key === 'ArrowDown' || key === 'ArrowUp') {
            event.preventDefault();
            const items = Array.from(this.template.querySelectorAll('[role="menuitem"]'));
            const currentIndex = items.indexOf(event.target);
            if (currentIndex === -1) return;
            let nextIndex;
            if (key === 'ArrowDown') {
                nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
            } else {
                nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
            }
            items[nextIndex].focus();
        }
    }

    _focusWaffle() {
        const waffleIcon = this.template.querySelector('.slds-context-bar__icon-action lightning-dynamic-icon');
        if (waffleIcon && typeof waffleIcon.focus === 'function') {
            waffleIcon.focus();
        }
    }

    connectedCallback() {
        this._boundHandleDocumentClick = this._handleDocumentClick.bind(this);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._boundHandleDocumentClick);
    }

    renderedCallback() {
        if (this.isWaffleMenuOpen) {
            document.addEventListener('click', this._boundHandleDocumentClick);
            if (this._focusMenuOnNextRender) {
                this._focusMenuOnNextRender = false;
                this._focusFirstMenuItem();
            }
        } else {
            document.removeEventListener('click', this._boundHandleDocumentClick);
        }
    }

    _focusFirstMenuItem() {
        const first = this.template.querySelector('[role="menuitem"]');
        if (first) {
            setTimeout(() => first.focus(), 0);
        }
    }

    _handleDocumentClick(event) {
        const trigger = this.template.querySelector('[class*="slds-dropdown-trigger"]');
        const path = event.composedPath ? event.composedPath() : [];
        const clickInsideTrigger = trigger && path.includes(trigger);
        if (trigger && !clickInsideTrigger) {
            this.isWaffleMenuOpen = false;
        }
    }
}
