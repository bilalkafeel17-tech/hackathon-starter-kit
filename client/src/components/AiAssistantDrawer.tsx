import { useState, useRef, useEffect, FormEvent } from 'react';
import { X, Send, Bot, User, CornerDownLeft } from 'lucide-react';
import { apiFetch } from '../api/client';
import { Role } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  timestamp: string;
}

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: Role;
}

export default function AiAssistantDrawer({ isOpen, onClose, userRole }: AiAssistantDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello. I am your HCM Lite assistant. Ask me questions about company policies, leave balances, working hours, or attendance rules.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  async function handleSend(e?: FormEvent) {
    if (e) e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await apiFetch<{ message: string; toolsUsed?: string[] }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: query, history }),
      });

      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: res.data?.message || 'I could not process that request.',
        toolsUsed: res.data?.toolsUsed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: err.message || 'Error communicating with assistant. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickPrompt(promptText: string) {
    setInput(promptText);
  }

  return (
    <>
      <div
        className="overlay-backdrop"
        onClick={onClose}
        style={{ zIndex: 60 }}
      />
      <aside className="drawer" style={{ zIndex: 70 }} aria-label="AI Assistant Drawer">
        <header className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={18} strokeWidth={1.75} color="var(--color-accent)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>Assistant</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>Policy Q&A and organizational tools</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
            style={{ width: 32, height: 32, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close assistant"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>

        <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--color-text-faint)',
                }}
              >
                {m.role === 'user' ? (
                  <>
                    <span>You</span>
                    <span>{m.timestamp}</span>
                  </>
                ) : (
                  <>
                    <span>HCM Lite AI</span>
                    <span>{m.timestamp}</span>
                  </>
                )}
              </div>

              <div
                style={{
                  maxWidth: '88%',
                  backgroundColor: m.role === 'user' ? 'var(--color-surface-2)' : 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-control)',
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.content}
              </div>

              {m.toolsUsed && m.toolsUsed.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {m.toolsUsed.map((t, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        padding: '1px 6px',
                        borderRadius: 3,
                      }}
                    >
                      {t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {m.role === 'assistant' && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: 'var(--color-text-faint)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  AI-generated
                </span>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
              <div className="typing-dot" />
              <div className="typing-dot" style={{ animationDelay: '200ms' }} />
              <div className="typing-dot" style={{ animationDelay: '400ms' }} />
              <style>{`
                .typing-dot {
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  background-color: var(--color-text-muted);
                  animation: typingOpacity 1s infinite alternate;
                }
                @keyframes typingOpacity {
                  from { opacity: 0.2; }
                  to { opacity: 0.9; }
                }
              `}</style>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt pills */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => handleQuickPrompt('What are the company working hours and late policy?')}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11.5 }}
          >
            Working hours
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt('What is my leave balance?')}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11.5 }}
          >
            Leave balance
          </button>
          {userRole !== 'employee' && (
            <button
              type="button"
              onClick={() => handleQuickPrompt('What is current employee headcount and attendance rate?')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11.5 }}
            >
              Headcount & stats
            </button>
          )}
        </div>

        <form
          onSubmit={handleSend}
          style={{
            padding: 16,
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            gap: 8,
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <input
            type="text"
            className="form-control"
            placeholder="Type your question in English or Roman Urdu..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !input.trim()}
            style={{ padding: '0 12px' }}
            aria-label="Send message"
          >
            <Send size={16} strokeWidth={1.75} />
          </button>
        </form>
      </aside>
    </>
  );
}
