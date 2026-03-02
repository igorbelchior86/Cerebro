import router, {
  backfillPendingEmailTickets,
  ingestSupportMailboxOnce,
} from '../../services/application/route-handlers/email-ingestion-route-handlers.js';

export { backfillPendingEmailTickets, ingestSupportMailboxOnce };

export default router;
