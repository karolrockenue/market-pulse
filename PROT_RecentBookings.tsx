import { CSSProperties, useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';

export function RecentBookings() {
  // Generate mock data for the last 7 days
  const bookingData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const baseBookings = Math.floor(Math.random() * 15) + (isWeekend ? 20 : 12);
      const baseRoomNights = baseBookings + Math.floor(Math.random() * 8);
      const baseADR = 120 + Math.random() * 40 + (isWeekend ? 15 : 0);
      const revenue = baseRoomNights * baseADR;
      
      data.push({
        date: date,
        dateStr: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        bookings: baseBookings,
        roomNights: baseRoomNights,
        adr: baseADR,
        revenue: revenue,
        isToday: i === 0
      });
    }
    
    return data;
  }, []);

  const totals = useMemo(() => {
    return {
      bookings: bookingData.reduce((sum, day) => sum + day.bookings, 0),
      roomNights: bookingData.reduce((sum, day) => sum + day.roomNights, 0),
      revenue: bookingData.reduce((sum, day) => sum + day.revenue, 0),
      avgADR: bookingData.reduce((sum, day) => sum + day.adr, 0) / bookingData.length
    };
  }, [bookingData]);

  const styles: Record<string, CSSProperties> = {
    container: {
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      border: '1px solid #2a2a2a',
      padding: '20px',
      height: '460px',
      display: 'flex',
      flexDirection: 'column' as const
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid #2a2a2a'
    },
    iconBadge: {
      width: '32px',
      height: '32px',
      borderRadius: '6px',
      backgroundColor: 'rgba(57, 189, 248, 0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    title: {
      color: '#e5e5e5',
      fontSize: '14px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em'
    },
    subtitle: {
      color: '#6b7280',
      fontSize: '11px',
      marginTop: '2px'
    },
    tableHeader: {
      display: 'grid',
      gridTemplateColumns: '1fr 45px 40px 50px 60px',
      gap: '12px',
      padding: '6px 10px',
      backgroundColor: '#141414',
      borderRadius: '4px',
      marginBottom: '6px'
    },
    headerCell: {
      color: '#6b7280',
      fontSize: '9px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em'
    },
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 45px 40px 50px 60px',
      gap: '12px',
      padding: '10px 10px',
      backgroundColor: '#1D1D1C',
      borderRadius: '4px',
      marginBottom: '6px',
      transition: 'background-color 0.2s',
      cursor: 'default'
    },
    todayRow: {
      backgroundColor: 'rgba(57, 189, 248, 0.08)',
      border: '1px solid rgba(57, 189, 248, 0.2)'
    },
    dateCell: {
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'center'
    },
    dateText: {
      color: '#e5e5e5',
      fontSize: '11px'
    },
    dayText: {
      color: '#6b7280',
      fontSize: '10px'
    },
    valueCell: {
      color: '#9ca3af',
      fontSize: '11px',
      textAlign: 'right' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'center'
    },
    mainValue: {
      color: '#e5e5e5',
      fontSize: '12px'
    },
    subValue: {
      color: '#6b7280',
      fontSize: '9px',
      marginTop: '2px'
    },
    totalsSection: {
      marginTop: '12px',
      paddingTop: '12px',
      borderTop: '1px solid #2a2a2a'
    },
    totalsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '12px',
      marginTop: '12px'
    },
    totalCard: {
      backgroundColor: '#141414',
      borderRadius: '4px',
      padding: '10px 12px',
      border: '1px solid #2a2a2a'
    },
    totalLabel: {
      color: '#6b7280',
      fontSize: '9px',
      textTransform: 'uppercase' as const,
      letterSpacing: '-0.025em',
      marginBottom: '4px'
    },
    totalValue: {
      color: '#39BDF8',
      fontSize: '16px'
    },
    totalSubtext: {
      color: '#6b7280',
      fontSize: '9px',
      marginTop: '2px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBadge}>
          <Calendar style={{ width: '16px', height: '16px', color: '#39BDF8' }} />
        </div>
        <div>
          <div style={styles.title}>Recent Bookings</div>
          <div style={styles.subtitle}>Last 7 days activity</div>
        </div>
      </div>

      <div style={styles.tableHeader}>
        <div style={styles.headerCell}>Date</div>
        <div style={{ ...styles.headerCell, textAlign: 'right' }}>Bkgs</div>
        <div style={{ ...styles.headerCell, textAlign: 'right' }}>RN</div>
        <div style={{ ...styles.headerCell, textAlign: 'right' }}>ADR</div>
        <div style={{ ...styles.headerCell, textAlign: 'right' }}>Rev</div>
      </div>

      <div>
        {bookingData.map((day, index) => (
          <div
            key={index}
            style={{
              ...styles.row,
              ...(day.isToday ? styles.todayRow : {})
            }}
            onMouseEnter={(e) => {
              if (!day.isToday) {
                e.currentTarget.style.backgroundColor = '#141414';
              }
            }}
            onMouseLeave={(e) => {
              if (!day.isToday) {
                e.currentTarget.style.backgroundColor = '#1D1D1C';
              }
            }}
          >
            <div style={styles.dateCell}>
              <div style={{ ...styles.dateText, color: day.isToday ? '#39BDF8' : '#e5e5e5' }}>
                {day.dateStr}
              </div>
            </div>
            
            <div style={styles.valueCell}>
              <div style={styles.mainValue}>{day.bookings}</div>
            </div>
            
            <div style={styles.valueCell}>
              <div style={styles.mainValue}>{day.roomNights}</div>
            </div>
            
            <div style={styles.valueCell}>
              <div style={styles.mainValue}>£{Math.round(day.adr)}</div>
            </div>
            
            <div style={styles.valueCell}>
              <div style={{ ...styles.mainValue, color: '#39BDF8', fontSize: '11px' }}>
                £{Math.round(day.revenue).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}