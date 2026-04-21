import { LightningElement } from 'lwc';
import { getCurrentRoute } from '../../../router';

export default class User extends LightningElement {
    get route() {
        return getCurrentRoute();
    }

    get userId() {
        return this.route?.params?.id ?? '—';
    }
}
