'use client';

import { useState, useCallback } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'status' | 'evidence' | 'diagnosis' | 'validation';
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  playbookContent: string | null;
  playbookStatus: 'loading' | 'ready' | 'error';
  playbookError: string | null;
}

export function useChatState(sessionId: string) {
  const [state, setState] = useState<ChatState>({
    messages: [
      {
        id: '0',
        role: 'assistant',
        content: `Welcome to Playbook Brain! I've started the analysis for your session. Let me collect evidence and diagnose the issue...`,
        timestamp: new Date(),
        type: 'text',
      },
    ],
    isLoading: false,
    playbookContent: null,
    playbookStatus: 'ready',
    playbookError: null,
  });

  const addMessage = useCallback(
    (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            ...message,
            id: Date.now().toString(),
            timestamp: new Date(),
          },
        ],
      }));
    },
    []
  );

  const updatePlaybook = useCallback(
    (content: string | null, status: 'loading' | 'ready' | 'error' = 'ready') => {
      setState((prev) => ({
        ...prev,
        playbookContent: content,
        playbookStatus: status,
      }));
    },
    []
  );

  const setPlaybookError = useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      playbookError: error,
      playbookStatus: error ? 'error' : 'ready',
    }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({
      ...prev,
      isLoading: loading,
    }));
  }, []);

  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.slice(0, 1), // Keep only the welcome message
    }));
  }, []);

  return {
    ...state,
    addMessage,
    updatePlaybook,
    setPlaybookError,
    setLoading,
    clearMessages,
  };
}
