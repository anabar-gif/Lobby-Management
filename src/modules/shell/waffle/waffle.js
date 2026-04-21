import { LightningElement, api } from 'lwc';

/**
 * SLDS App Launcher waffle icon (9-dot grid). Use in context bar to open app launcher or navigation menu.
 * Fires `open` when the waffle is activated; parent can open a dropdown or navigate.
 */
export default class Waffle extends LightningElement {
    /** Button title (tooltip). */
    @api title = 'Open App Launcher';

    /** Accessible label for screen readers. */
    @api assistiveText = 'Open App Launcher';

    /**
     * Puts focus on the waffle button. Use when closing the menu via Escape so focus returns here.
     */
    @api
    focus() {
        const btn = this.template.querySelector('button');
        if (btn) {
            btn.focus();
        }
    }

    handleClick() {
        this.dispatchEvent(new CustomEvent('open', {
            bubbles: true,
            composed: true
        }));
    }
}
