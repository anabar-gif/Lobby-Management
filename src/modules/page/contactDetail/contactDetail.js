import { LightningElement, track } from 'lwc';
import { getCurrentRoute, navigate } from '../../../router';
import { getContactById } from 'data/contacts';

const ACTIVITY_ITEMS = [
    { id: 'a1', type: 'call', iconName: 'standard:log_a_call', subject: 'Follow-up call', date: 'Mar 10, 2026', description: 'Discussed renewal timeline and next steps.' },
    { id: 'a2', type: 'email', iconName: 'standard:email', subject: 'Proposal sent', date: 'Mar 7, 2026', description: 'Sent updated pricing proposal via email.' },
    { id: 'a3', type: 'event', iconName: 'standard:event', subject: 'Quarterly review meeting', date: 'Feb 28, 2026', description: 'Reviewed Q4 results and Q1 goals.' },
    { id: 'a4', type: 'call', iconName: 'standard:log_a_call', subject: 'Introductory call', date: 'Feb 15, 2026', description: 'Initial discovery call to understand requirements.' }
];

export default class ContactDetail extends LightningElement {
    @track contact = null;
    @track isFollowing = false;
    activityItems = ACTIVITY_ITEMS;

    connectedCallback() {
        const route = getCurrentRoute();
        const id = route?.params?.id;
        if (id) {
            this.contact = getContactById(id);
        }
    }

    get hasContact() {
        return this.contact !== null;
    }

    get contactName() {
        return this.contact?.name || 'Unknown Contact';
    }

    get mailingAddress() {
        if (!this.contact) return '';
        const c = this.contact;
        return `${c.mailingStreet}, ${c.mailingCity}, ${c.mailingState} ${c.mailingZip}`;
    }

    get followVariant() {
        return this.isFollowing ? 'success' : 'neutral';
    }

    get followLabel() {
        return this.isFollowing ? 'Following' : 'Follow';
    }

    get followIconName() {
        return this.isFollowing ? 'utility:check' : 'utility:add';
    }

    handleFollow() {
        this.isFollowing = !this.isFollowing;
    }

    handleBackToList() {
        navigate('/contacts');
    }
}
