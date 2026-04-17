import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { R } from '../styles/tokens';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  subtitle: string;
  time: string;
  read: boolean;
}

const TEAL = R.warmTeal;   // #38C6BA
const GREEN = '#10b981';
const RED = '#ef4444';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/sentinel/notifications');
      if (res.ok) {
        const json = await res.json();
        let rawList: any[] = [];
        if (Array.isArray(json)) {
          rawList = json;
        } else if (json.data && Array.isArray(json.data)) {
          rawList = json.data;
        } else if (json.rows && Array.isArray(json.rows)) {
          rawList = json.rows;
        }

        const mapped = rawList.map((n: any) => ({
          id: n.id,
          type: (n.type === 'ERROR' || n.type === 'error') ? 'error'
              : (n.type === 'SUCCESS' || n.type === 'success') ? 'success'
              : 'info',
          title: n.title || 'Notification',
          subtitle: n.message || '',
          read: n.is_read === true,
          time: n.created_at
            ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Just now'
        }));

        setNotifications(mapped);
      }
    } catch (error) {
      console.error('[NotificationBell] Fetch Error:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await fetch('/api/sentinel/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds })
      });
    } catch (e) { console.error(e); }
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await fetch('/api/sentinel/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
    } catch (e) { console.error(e); }
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`/api/sentinel/notifications/${id}`, { method: 'DELETE' });
    } catch (e) { console.error(e); }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  function typeColors(type: 'success' | 'error' | 'info', isRead: boolean) {
    if (isRead) return { color: R.textDim, bg: `${R.border}80` };
    if (type === 'error') return { color: RED, bg: `${RED}18` };
    if (type === 'success') return { color: GREEN, bg: `${GREEN}18` };
    return { color: TEAL, bg: `${TEAL}18` };
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 rounded-md transition-colors focus:outline-none"
          style={{ backgroundColor: isOpen ? R.card : 'transparent' }}
        >
          <div className="relative inline-block">
            <Bell size={18} style={{ color: isOpen ? R.accent : R.textMid }} />
            {unreadCount > 0 && (
              <span
                className="absolute flex items-center justify-center rounded-full"
                style={{
                  top: -4,
                  right: -4,
                  backgroundColor: TEAL,
                  color: R.sidebar,
                  fontSize: 9,
                  fontWeight: 700,
                  minWidth: 15,
                  height: 15,
                  padding: '0 4px',
                  border: `2px solid ${R.darkBand}`,
                  lineHeight: 1,
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="p-0 mr-2 mt-2"
        style={{
          width: 380,
          backgroundColor: R.card,
          borderColor: R.border,
          borderWidth: 1,
          borderStyle: 'solid',
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          zIndex: 100,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${R.border}`,
            background: R.darkBand,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: R.accent, fontWeight: 600, fontSize: 13 }}>Notifications</span>
            {unreadCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: TEAL,
                padding: '1px 7px', borderRadius: 10,
                background: `${TEAL}18`, border: `1px solid ${TEAL}40`,
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 500,
                color: R.textMid,
                padding: 0,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = TEAL)}
              onMouseLeave={(e) => (e.currentTarget.style.color = R.textMid)}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List Container */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '48px 20px',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 20,
                background: R.border, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Bell size={16} style={{ color: R.textDim }} />
              </div>
              <div style={{ color: R.textMid, fontSize: 12, marginBottom: 2 }}>No notifications</div>
              <div style={{ color: R.textDim, fontSize: 10 }}>You're all caught up</div>
            </div>
          ) : (
            <div>
              {notifications.map((notification, i) => {
                const isRead = notification.read;
                const { color, bg } = typeColors(notification.type, isRead);
                const Icon = notification.type === 'error'
                  ? AlertCircle
                  : notification.type === 'success'
                    ? CheckCircle2
                    : Info;

                return (
                  <div
                    key={notification.id}
                    role="button"
                    onClick={() => markAsRead(notification.id)}
                    className="group"
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '12px 14px',
                      borderTop: i === 0 ? 'none' : `1px solid ${R.sep}`,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = `${TEAL}08`)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Icon */}
                    <div style={{
                      flexShrink: 0,
                      width: 30, height: 30, borderRadius: 8,
                      background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 1,
                    }}>
                      <Icon size={14} style={{ color }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                        <span style={{
                          fontSize: 13,
                          color: isRead ? R.textMid : R.accent,
                          fontWeight: isRead ? 400 : 500,
                          lineHeight: 1.3,
                          wordBreak: 'break-word',
                        }}>
                          {notification.title}
                        </span>
                        <span style={{ fontSize: 10, color: R.textDim, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {notification.time}
                        </span>
                      </div>
                      {notification.subtitle && (
                        <div style={{
                          fontSize: 11,
                          color: R.textMid,
                          lineHeight: 1.5,
                          wordBreak: 'break-word',
                        }}>
                          {notification.subtitle}
                        </div>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!isRead && (
                      <div style={{
                        position: 'absolute',
                        top: 16, right: 12,
                        width: 6, height: 6, borderRadius: 3,
                        background: TEAL,
                      }} />
                    )}

                    {/* Dismiss (hover) */}
                    <button
                      onClick={(e) => deleteNotification(e, notification.id)}
                      className="opacity-0 group-hover:opacity-100"
                      style={{
                        position: 'absolute',
                        top: 8, right: 8,
                        width: 20, height: 20,
                        borderRadius: 4, border: 'none',
                        background: R.card,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      title="Dismiss"
                      onMouseEnter={(e) => { e.currentTarget.style.background = R.border; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = R.card; }}
                    >
                      <X size={11} style={{ color: R.textDim }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
