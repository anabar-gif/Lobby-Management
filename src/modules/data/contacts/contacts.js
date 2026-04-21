const CONTACTS = [
    {
        id: '1',
        name: 'Carole White',
        title: 'VP Sales',
        company: 'Global Media',
        email: 'cwhite@globalmedia.com',
        phone: '(415) 555-1212',
        mobile: '(415) 555-1300',
        department: 'Sales',
        mailingStreet: '123 Market St',
        mailingCity: 'San Francisco',
        mailingState: 'CA',
        mailingZip: '94105',
        description: 'Key contact for the Global Media west coast accounts.'
    },
    {
        id: '2',
        name: 'Edward Stamos',
        title: 'President and CEO',
        company: 'Acme',
        email: 'estamos@acme.com',
        phone: '(212) 555-5555',
        mobile: '(212) 555-5600',
        department: 'Executive',
        mailingStreet: '456 Broadway',
        mailingCity: 'New York',
        mailingState: 'NY',
        mailingZip: '10013',
        description: 'Primary executive sponsor for the Acme partnership.'
    },
    {
        id: '3',
        name: 'Geoff Minor',
        title: 'President',
        company: 'Global Media',
        email: 'gminor@globalmedia.com',
        phone: '(415) 555-1212',
        mobile: '(415) 555-1400',
        department: 'Executive',
        mailingStreet: '123 Market St',
        mailingCity: 'San Francisco',
        mailingState: 'CA',
        mailingZip: '94105',
        description: 'Oversees all Global Media operations on the west coast.'
    },
    {
        id: '4',
        name: 'Howard Jones',
        title: 'Buyer',
        company: 'Acme',
        email: 'hjones@acme.com',
        phone: '(212) 555-5555',
        mobile: '(212) 555-5700',
        department: 'Procurement',
        mailingStreet: '456 Broadway',
        mailingCity: 'New York',
        mailingState: 'NY',
        mailingZip: '10013',
        description: 'Handles procurement for office supplies and software licenses.'
    },
    {
        id: '5',
        name: 'Jon Amos',
        title: 'Sales Manager',
        company: 'Global Media',
        email: 'jamos@globalmedia.com',
        phone: '(905) 555-1212',
        mobile: '(905) 555-1300',
        department: 'Sales',
        mailingStreet: '789 King St W',
        mailingCity: 'Toronto',
        mailingState: 'ON',
        mailingZip: 'M5V 1N4',
        description: 'Manages the Canadian sales region for Global Media.'
    },
    {
        id: '6',
        name: 'Leanne Tomlin',
        title: 'VP Customer Support',
        company: 'Acme',
        email: 'ltomlin@acme.com',
        phone: '(212) 555-5555',
        mobile: '(212) 555-5800',
        department: 'Customer Support',
        mailingStreet: '456 Broadway',
        mailingCity: 'New York',
        mailingState: 'NY',
        mailingZip: '10013',
        description: 'Leads the customer support organization at Acme.'
    },
    {
        id: '7',
        name: 'Marc Benioff',
        title: 'Executive Officer',
        company: 'salesforce.com',
        email: 'mbenioff@salesforce.com',
        phone: '(415) 901-7000',
        mobile: '(415) 901-7100',
        department: 'Executive',
        mailingStreet: '415 Mission St',
        mailingCity: 'San Francisco',
        mailingState: 'CA',
        mailingZip: '94105',
        description: 'Executive contact at salesforce.com for strategic initiatives.'
    }
];

export function getAllContacts() {
    return [...CONTACTS];
}

export function getContactById(id) {
    return CONTACTS.find(c => c.id === id) || null;
}
