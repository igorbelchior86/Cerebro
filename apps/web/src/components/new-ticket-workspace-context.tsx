'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface NewTicketWorkspaceBridgeValue {
  isActive?: boolean;
  onDismissDraft?: () => void;
  onSelectTicket?: (ticketId: string) => void;
  onDraftCreated?: (ticketId: string) => void;
}

const NewTicketWorkspaceBridgeContext = createContext<NewTicketWorkspaceBridgeValue | null>(null);

export function NewTicketWorkspaceBridgeProvider({
  value,
  children,
}: {
  value: NewTicketWorkspaceBridgeValue;
  children: ReactNode;
}) {
  return (
    <NewTicketWorkspaceBridgeContext.Provider value={value}>
      {children}
    </NewTicketWorkspaceBridgeContext.Provider>
  );
}

export function useNewTicketWorkspaceBridge() {
  return useContext(NewTicketWorkspaceBridgeContext);
}
