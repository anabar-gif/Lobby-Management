import { LightningElement, track } from 'lwc';

/** Parses the first integer in parentheses, e.g. `Notary (1)` → 1. Missing → +∞ so those sort last. */
function parseBracketCount(label) {
    const m = /\((\d+)\)/.exec(label);
    return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

/** Accordion topic order: descending by count in brackets (highest first), then A→Z by label within the same count. */
function sortLobbyTopicsByCountDesc(topics) {
    return [...topics].sort((a, b) => {
        const ca = parseBracketCount(a.label);
        const cb = parseBracketCount(b.label);
        if (ca !== cb) {
            return cb - ca;
        }
        return a.label.localeCompare(b.label, 'en', { sensitivity: 'base' });
    });
}

/** Formats total minutes as `H hr M min` for queue summary (matches single-slot copy like `0 hr 30 min`). */
function formatDurationFromMinutes(totalMin) {
    const safe = Math.max(0, Math.round(totalMin));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    if (h > 0 && m > 0) {
        return `${h} hr ${m} min`;
    }
    if (h > 0) {
        return `${h} hr 0 min`;
    }
    return `0 hr ${m} min`;
}

/** Figma MCP assets (All-Scheduler-Flows) — same sources as design context */
const ASSET_QUEUE_ICON =
    'https://www.figma.com/api/mcp/asset/5d460ebf-bf8f-4a95-9cef-d6514634cfdb';
export default class LobbyManagement extends LightningElement {
    queueIconUrl = ASSET_QUEUE_ICON;

    @track selectedWaitlistFilter = 'all';

    get waitlistFilterOptions() {
        return [{ label: 'All', value: 'all' }];
    }

    currentSectionTime = '9:10 AM';
    upcomingSectionTime = '10:11 AM';

    get currentSectionMetaLine() {
        const n = this.currentAppointments?.length ?? 0;
        const word = n === 1 ? 'appointment' : 'appointments';
        return `${this.currentSectionTime} · ${n} ${word}`;
    }

    get upcomingSectionMetaLine() {
        const n = this.upcomingAppointments?.length ?? 0;
        const word = n === 1 ? 'appointment' : 'appointments';
        return `${this.upcomingSectionTime} · ${n} ${word}`;
    }

    metaLinePrimary = '24 Items ∙ Updated 25 seconds ago';
    metaLineSecondary = 'Filtered by All';

    investmentQueueMetaLeft = 'Showing 1 of 1 Item • Updated 8 min ago';
    investmentQueueMetaRight = 'Total Appointment Duration: 1 hr 0 min';

    @track showAllTopicsGeneral = false;
    @track showAllTopicsInvestment = false;

    /** Empty = all General Banking accordion sections closed on load (requires multi-section mode on `lightning-accordion`). */
    @track generalBankingOpenSections = [];
    @track investmentBankingOpenSection = 'investment-planning';

    generalBankingTopics = sortLobbyTopicsByCountDesc([
        {
            id: 'personal-banking',
            label: 'Personal Banking (2)',
            participants: [
                {
                    id: 'gb-pb1',
                    ordinal: '1.',
                    workItemId: 'WP-0101',
                    linkLabel: 'Alex Rivera',
                    topic: 'Checking Account • Jamie Lee',
                    checkInTime: '08:45 AM',
                    waitTime: '12 min'
                },
                {
                    id: 'gb-pb2',
                    ordinal: '2.',
                    workItemId: 'WP-0102',
                    linkLabel: 'Sam Patel',
                    topic: 'Savings Account • Jamie Lee',
                    checkInTime: '09:02 AM',
                    waitTime: '22 min'
                }
            ]
        },
        {
            id: 'wealth-management',
            label: 'Wealth Management (2)',
            participants: [
                {
                    id: 'gb-wm1',
                    ordinal: '1.',
                    workItemId: 'WP-0201',
                    linkLabel: 'Jordan Chen',
                    topic: 'Portfolio Review • Morgan Blake',
                    checkInTime: '09:15 AM',
                    waitTime: '35 min'
                },
                {
                    id: 'gb-wm2',
                    ordinal: '2.',
                    workItemId: 'WP-0202',
                    linkLabel: 'Taylor Brooks',
                    topic: 'Trust Services • Morgan Blake',
                    checkInTime: '09:28 AM',
                    waitTime: '48 min'
                }
            ]
        },
        {
            id: 'insurance',
            label: 'Insurance (1)',
            participants: [
                {
                    id: 'gb-in1',
                    ordinal: '1.',
                    workItemId: 'WP-0301',
                    linkLabel: 'Riley Nguyen',
                    topic: 'Life Policy • Casey Frost',
                    checkInTime: '10:05 AM',
                    waitTime: '15 min'
                }
            ]
        },
        {
            id: 'gb-topic-investment',
            label: 'Investment Banking (1)',
            participants: [
                {
                    id: 'gb-ib1',
                    ordinal: '1.',
                    workItemId: 'WP-0401',
                    linkLabel: 'Morgan Ellis',
                    topic: 'Business Loan • Drew Park',
                    checkInTime: '10:40 AM',
                    waitTime: '1 hr 05 min'
                }
            ]
        },
        {
            id: 'wt',
            label: 'WT (0)',
            participants: []
        },
        {
            id: 'notary',
            label: 'Notary (1)',
            participants: [
                {
                    id: 'gb-p1',
                    ordinal: '1.',
                    workItemId: 'WP-0216',
                    linkLabel: 'Acme',
                    topic: 'Notary',
                    checkInTime: '11:34 AM',
                    waitTime: '3 hr 54 min'
                }
            ]
        },
        {
            id: 'general-banking-queue',
            label: 'General Banking (3)',
            participants: [
                {
                    id: 'gb-gb1',
                    ordinal: '1.',
                    workItemId: 'WP-132',
                    linkLabel: 'Julia Green',
                    topic: 'Savings Account • Auto Assigned',
                    checkInTime: '09:15 AM',
                    waitTime: '22 min'
                },
                {
                    id: 'gb-gb2',
                    ordinal: '2.',
                    workItemId: 'WP-134',
                    linkLabel: 'James Won',
                    topic: 'Savings Account • Rachel Adams',
                    checkInTime: '09:20 AM',
                    waitTime: '01 : 25 mins.'
                },
                {
                    id: 'gb-gb3',
                    ordinal: '3.',
                    workItemId: 'WP-134',
                    linkLabel: 'James Won',
                    topic: 'Savings Account • Rachel Adams',
                    checkInTime: '09:20 AM',
                    waitTime: '01 : 25 mins.'
                }
            ]
        }
    ]);

    investmentBankingTopics = sortLobbyTopicsByCountDesc([
        {
            id: 'investment-planning',
            label: 'Investment Planning (1)',
            participants: [
                {
                    id: 'ib-p1',
                    ordinal: '1.',
                    workItemId: 'WP-0215',
                    linkLabel: 'Lead Participant',
                    topic: 'Investment Planning',
                    checkInTime: '11:13 AM',
                    waitTime: '4 hr 14 min'
                }
            ]
        }
    ]);

    get generalBankingParticipantCount() {
        return (this.generalBankingTopics || []).reduce(
            (sum, topic) => sum + (topic.participants?.length ?? 0),
            0
        );
    }

    get generalQueueMetaLeft() {
        const n = this.generalBankingParticipantCount;
        const itemWord = n === 1 ? 'Item' : 'Items';
        return `Showing ${n} of ${n} ${itemWord} ∙ Updated 6 min ago`;
    }

    get generalQueueMetaRight() {
        const n = this.generalBankingParticipantCount;
        const slotMinutesPerItem = 30;
        const totalMin = n * slotMinutesPerItem;
        return `Total Appointment Duration: ${formatDurationFromMinutes(totalMin)}`;
    }

    currentAppointments = [
        {
            id: 'a1',
            customerName: 'Arna Sumaiyah',
            subtitle: 'Savings Account • Rachel Adams',
            slot: '9:00 am - 9:30 am',
            showWaitAlert: true,
            waitLabel: 'Customer Wait…',
            showCheckin: false
        },
        {
            id: 'a2',
            customerName: 'James Clain',
            subtitle: 'Savings Account • Rachel Adams',
            slot: '9:30 am - 10:00 am',
            showWaitAlert: false,
            showCheckin: true
        }
    ];

    upcomingAppointments = [
        {
            id: 'b1',
            customerName: 'Smith Kim',
            subtitle: 'Savings Account • Rachel Adams',
            slot: '10:00 am - 10:30 am',
            showWaitAlert: false,
            showCheckin: true
        },
        {
            id: 'b2',
            customerName: 'Regina Hem',
            subtitle: 'Savings Account • Rachel Adams',
            slot: '10:00 am - 10:30 am',
            showWaitAlert: false,
            showCheckin: true
        },
        {
            id: 'b3',
            customerName: 'Ken Adams',
            subtitle: 'Savings Account • Rachel Adams',
            slot: '10:00 am - 10:30 am',
            showWaitAlert: false,
            showCheckin: true
        }
    ];

    handleWaitlistFilterChange(event) {
        this.selectedWaitlistFilter = event.detail.value;
    }

    handleRefresh() {
        // Demo: hook for reload
    }

    handleQueueCheckIn() {
        // Demo: hook for queue check-in
    }

    handleQueueInfo() {
        // Demo: hook for queue details
    }

    handleQueueOpenExternal() {
        // Demo: open queue in external context
    }

    handleShowAllTopicsGeneral(event) {
        this.showAllTopicsGeneral = event.target.checked;
    }

    handleShowAllTopicsInvestment(event) {
        this.showAllTopicsInvestment = event.target.checked;
    }

    handleGeneralAccordionToggle(event) {
        const open = event.detail.openSections;
        this.generalBankingOpenSections = Array.isArray(open) ? [...open] : open ? [open] : [];
    }

    handleInvestmentAccordionToggle(event) {
        const open = event.detail.openSections;
        this.investmentBankingOpenSection = Array.isArray(open) ? open[0] ?? '' : open ?? '';
    }

    handleQueueParticipantMenu() {
        // Demo: participant row actions
    }

    handleCheckin(event) {
        const id = event.currentTarget?.dataset?.id;
        if (id) {
            // Demo only
        }
    }

    handleApptMenu() {
        // Demo: row actions menu
    }
}
