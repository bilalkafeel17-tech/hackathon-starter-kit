import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Clock, ExternalLink } from 'lucide-react';
import { apiFetch } from '../api/client';
import { InAppNotification } from '../types';

interface NotificationDropdownProps {
  onNavigate?: (path: string) => void;
}

export default function NotificationDropdown({ onNavigate }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchNotifications() {
    try {
      const res = await apiFetch<InAppNotification[]>('/notifications?limit=15');
      if (res.data) {
        setNotifications(res.data);
        const count = res.meta?.unreadCount !== undefined ? Number(res.meta.unreadCount) : res.data.filter((n) => !n.isRead).length;
        setUnreadCount(count);
      }
    } catch {
      // Keep silent for poll
    }
  }

  async function handleMarkRead(id: string, link?: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      fetchNotifications();
    }

    if (link && onNavigate) {
      setIsOpen(false);
      onNavigate(link);
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
    } catch {
      fetchNotifications();
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn-ghost"
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-control)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
        aria-label="View notifications"
      >
        <Bell size={18} strokeWidth={1.75} color="var(--color-text)" />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'var(--color-accent)',
            }}
          />
        )}
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 360,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-overlay)',
              zIndex: 50,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, padding: '2px 6px', color: 'var(--color-accent)' }}
                >
                  <CheckCheck size={14} strokeWidth={1.75} style={{ marginRight: 4 }} />
                  Mark all read
                </button>
              )}
            </div>

            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n._id}
                    onClick={() => handleMarkRead(n._id, n.link)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: n.isRead ? 'transparent' : 'var(--color-surface-2)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      transition: 'background-color var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: n.isRead ? 500 : 600, fontSize: 13, color: 'var(--color-text)' }}>
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-accent)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                      {n.message}
                    </p>
                    <div style={{ fontSize: 11, color: 'var(--color-text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} strokeWidth={1.75} />
                      {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
