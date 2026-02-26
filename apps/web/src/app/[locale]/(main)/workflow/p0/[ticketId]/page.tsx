import P0WorkflowTicketPage from '@/components/p0/P0WorkflowTicketPage';

export default function WorkflowP0TicketRoute({ params }: { params: { ticketId: string } }) {
  return <P0WorkflowTicketPage ticketId={params.ticketId} />;
}
