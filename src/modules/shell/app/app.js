import { LightningElement, track } from 'lwc';
import { subscribe, navigate } from '../../../router';
import { routes } from '../../../routes.config';
import { toggleSLDS, activeSLDSVersion } from '../../../build/slds-loader';
import Home from 'page/home';
import IconTest from 'page/iconTest';
import Settings from 'page/settings';
import User from 'page/user';
import Contacts from 'page/contacts';
import ContactDetail from 'page/contactDetail';
import LobbyManagement from 'page/lobbyManagement';
import LobbyManagement2 from 'page/lobbyManagement2';
import LobbyManagement3 from 'page/lobbyManagement3';
import WaitlistManagement from 'page/waitlistManagement';

/** Option A: explicit registration – add one import + one entry here when adding a route */
const ROUTE_COMPONENTS = {
    'page-home': Home,
    'page-lobby-management': LobbyManagement,
    'page-lobby-management-2': LobbyManagement2,
    'page-lobby-management-3': LobbyManagement3,
    'page-waitlist-management': WaitlistManagement,
    'page-icon-test': IconTest,
    'page-settings': Settings,
    'page-user': User,
    'page-contacts': Contacts,
    'page-contact-detail': ContactDetail,
};

/** Derived from routes.config: component name → specific nav page id for active-tab highlighting */
const ROUTE_TO_NAV_PAGE = Object.fromEntries(
    routes
        .filter((r) => r.navPage || r.navHighlight)
        .map((r) => [r.component, r.navPage ?? r.navHighlight])
);

/** Nav items for global navigation (tabs + waffle).
 *  Routes that share a navGroup are collapsed into one dropdown entry.
 */
const NAV_ITEMS = (() => {
    const items = [];
    const groupSeen = new Set();
    for (const r of routes.filter((r) => r.navPage && !r.hidden)) {
        if (r.navGroup) {
            if (!groupSeen.has(r.navGroup)) {
                groupSeen.add(r.navGroup);
                const children = routes
                    .filter((c) => c.navGroup === r.navGroup && c.navPage && !c.hidden)
                    .map((c) => ({ page: c.navPage, label: c.navLabel, path: c.navPath ?? c.path }));
                items.push({
                    page: r.navGroup,
                    label: r.navGroupLabel,
                    path: r.navPath ?? r.path,
                    isGroup: true,
                    children,
                });
            }
        } else {
            items.push({ page: r.navPage, label: r.navLabel, path: r.navPath ?? r.path });
        }
    }
    return items;
})();

/** Derived from routes.config: nav page id → path for navigate() */
const NAV_PAGE_TO_PATH = (() => {
    const map = Object.fromEntries(
        routes.filter((r) => r.navPage).map((r) => [r.navPage, r.navPath ?? r.path])
    );
    // Map group id → first child's path
    for (const item of NAV_ITEMS) {
        if (item.isGroup && item.children.length) {
            map[item.page] = item.children[0].path;
        }
    }
    return map;
})();

const STORAGE_KEY_SLDS_VERSION = 'slds-ui-slds-version';
const STORAGE_KEY_DARK_MODE = 'slds-ui-dark-mode';

export default class App extends LightningElement {
    @track route;
    @track _sldsVersion = 2;
    @track _darkMode = false;
    @track selectedPanel = 'agentforce_panel';
    @track isPanelOpen = false;
    @track showToast = false;
    @track toastMessage = '';
    _toastTimer = null;

    get componentCtor() {
        const name = this.route?.component;
        return name ? ROUTE_COMPONENTS[name] ?? null : null;
    }

    get currentNavPage() {
        const name = this.route?.component;
        return name ? (ROUTE_TO_NAV_PAGE[name] ?? 'home') : 'home';
    }

    get navItems() {
        return NAV_ITEMS;
    }

    connectedCallback() {
        this._restorePreferences();
        this._sldsVersion = activeSLDSVersion();
        this.unsubscribe = subscribe((route) => {
            this.route = route;
        });
    }

    _restorePreferences() {
        const savedVersion = localStorage.getItem(STORAGE_KEY_SLDS_VERSION);
        const savedDarkMode = localStorage.getItem(STORAGE_KEY_DARK_MODE);
        const version = savedVersion === '1' ? 1 : 2;
        if (savedDarkMode === 'true' && version === 2) {
            this._darkMode = true;
            document.body.classList.add('slds-color-scheme_dark');
        } else if (savedDarkMode === 'false') {
            this._darkMode = false;
            document.body.classList.remove('slds-color-scheme_dark');
        }
    }

    disconnectedCallback() {
        this.unsubscribe?.();
    }

    async handleToggleSLDS() {
        await toggleSLDS();
        this._sldsVersion = activeSLDSVersion();
        localStorage.setItem(STORAGE_KEY_SLDS_VERSION, String(this._sldsVersion));
        if (this._sldsVersion !== 2 && this._darkMode) {
            this._darkMode = false;
            document.body.classList.remove('slds-color-scheme_dark');
            localStorage.setItem(STORAGE_KEY_DARK_MODE, 'false');
        }
    }

    handleToggleDarkMode() {
        this._darkMode = !this._darkMode;
        document.body.classList.toggle('slds-color-scheme_dark', this._darkMode);
        localStorage.setItem(STORAGE_KEY_DARK_MODE, String(this._darkMode));
    }

    handleNavNavigate(event) {
        const page = event.detail?.page;
        const path = page ? NAV_PAGE_TO_PATH[page] : '/';
        navigate(path);
    }

    handlePanelSelect(event) {
        this.selectedPanel = event.detail?.name ?? this.selectedPanel;
        this.isPanelOpen = true;
    }

    handlePanelClose() {
        this.isPanelOpen = false;
    }

    get panelClasses() {
        return `slds-panel slds-size_medium slds-panel_docked slds-panel_docked-right ${this.isPanelOpen ? 'slds-is-open' : ''}`;
    }

    handleNavigateBack() {
        history.back();
    }

    handleShowToast(event) {
        const message = event.detail?.message;
        if (!message) return;
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this.toastMessage = message;
        this.showToast = true;
        this._toastTimer = setTimeout(() => {
            this.showToast = false;
        }, 4000);
    }

    handleToastClose() {
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this.showToast = false;
    }
}
