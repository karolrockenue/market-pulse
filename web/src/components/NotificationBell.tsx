import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
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

  // [NEW] Delete Handler
  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent triggering the "markAsRead" click
    // Optimistic UI removal
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`/api/sentinel/notifications/${id}`, { method: 'DELETE' });
    } catch (e) { console.error(e); }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button 
            className="relative p-2 rounded-lg transition-colors focus:outline-none"
            style={{ backgroundColor: isOpen ? '#262626' : 'transparent' }}
        >
          <div className="relative inline-block">
            <Bell className="w-5 h-5" style={{ color: '#9ca3af' }} />
            
            {unreadCount > 0 && (
              <span 
                  className="absolute -top-1 -right-1 flex items-center justify-center rounded-full"
                  style={{ 
                    backgroundColor: '#ef4444', 
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 4px',
                    border: '2px solid #1a1a1a'
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
        // [FIX] Width increased to 420px (280px * 1.5)
        className="p-0 shadow-2xl mr-2 mt-2"
        style={{ 
            width: '420px', 
            backgroundColor: '#1a1a1a', 
            borderColor: '#2a2a2a',
            borderWidth: '1px',
            borderStyle: 'solid',
            zIndex: 100 
        }}
      >
        {/* Header */}
        <div 
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: '#2a2a2a' }}
        >
          <h3 style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs hover:underline"
              style={{ color: '#39BDF8' }}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List Container */}
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: '#262626' }}>
                <Bell className="w-5 h-5" style={{ color: '#6b7280' }} />
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>No new notifications</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#2a2a2a' }}>
              {notifications.map((notification) => {
                const isRead = notification.read;
                const isError = notification.type === 'error';
                const isSuccess = notification.type === 'success';
                
                const iconBg = isError 
                  ? 'rgba(239,68,68,0.15)' 
                  : isSuccess && !isRead
                    ? 'rgba(16,185,129,0.15)' 
                    : 'rgba(38, 38, 38, 1)'; 

                const iconColor = isError
                  ? '#ef4444' 
                  : isSuccess && !isRead
                    ? '#10b981' 
                    : '#6b7280'; 

                return (
                  <button
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className="w-full px-4 py-4 transition-colors text-left flex gap-4 items-start group relative hover:bg-[#202020]"
                    style={{ backgroundColor: 'transparent' }}
                  >
                      {/* Large Icon Box */}
                      <div 
                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mt-0.5"
                        style={{ backgroundColor: iconBg }}
                      >
                        {isError ? (
                          <AlertCircle className="w-5 h-5" style={{ color: iconColor }} />
                        ) : (
                          <CheckCircle2 className="w-5 h-5" style={{ color: iconColor }} />
                        )}
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 min-w-0 pr-6"> {/* Added padding-right for the X button */}
                        <div className="flex flex-col mb-1">
                          <p style={{ 
                              fontSize: '0.925rem', 
                              color: isRead ? '#9ca3af' : 'white',
                              fontWeight: isRead ? 400 : 500,
                              lineHeight: '1.2',
                              wordBreak: 'break-word', 
                              marginBottom: '2px'
                          }}>
                            {notification.title}
                          </p>
                          
                          <span style={{ 
                              fontSize: '0.75rem', 
                              color: '#6b7280'
                          }}>
                            {notification.time}
                          </span>
                        </div>
                        
                        <p style={{ 
                            fontSize: '0.8rem', 
                            color: '#6b7280',
                            lineHeight: '1.4',
                            wordBreak: 'break-word' 
                        }}>
                          {notification.subtitle}
                        </p>
                      </div>

                      {/* [NEW] Delete Button (Visible on Hover) */}
                      <div 
                        onClick={(e) => deleteNotification(e, notification.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-[#333333] transition-all"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4 text-[#6b7280] hover:text-white" />
                      </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}