import router, {
  backfillPendingEmailTickets,
  ingestSupportMailboxOnce,
} from '../../services/application/route-handlers/ticket-intake-route-handlers.js';

export { backfillPendingEmailTickets, ingestSupportMailboxOnce };

export default router;
