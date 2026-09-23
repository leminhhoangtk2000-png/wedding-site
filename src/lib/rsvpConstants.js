// Wedding RSVP Constants and Helpers
export const WEDDING_EVENT = {
  groom: 'Hoàng',
  bride: 'Duyên',
  couple: 'Hoàng & Duyên',
  dateFormatted: '03 · 10 · 2026',
  dateDisplay: 'Saturday, October 3rd, 2026',
  timeDisplay: '4:00 PM Welcome · 5:30 PM Ceremony',
  venueName: 'Hidden Haven',
  venueAddress: '393/21 Binh Quoi Street, Ward 28, Binh Thanh District, Ho Chi Minh City',
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Hidden+Haven+393%2F21+B%C3%ACnh+Qu%E1%BB%9Bi+Ph%C6%B0%E1%BB%9Dng+28+B%C3%ACnh+Th%E1%BA%A1nh+TP+HCM',
  // Cutoff deadline: 16:00 30/09/2026 GMT+7
  cutoffIso: '2026-09-30T16:00:00+07:00',
  cutoffDisplay: '4:00 PM, September 30, 2026',
};

export const ATTENDANCE_VALUES = {
  ATTENDING: 'attending',
  DECLINED: 'declined',
};

export const DIETARY_PRESETS = [
  'Vegetarian',
  'Seafood Allergy',
  'Peanut Allergy',
  'Not Spicy',
  'No Alcohol',
];

export const DRESSCODE_PALETTE = [
  { id: 'olive', name: 'Olive', hex: '#4B5136', border: 'rgba(0, 0, 0, 0.12)' },
  { id: 'sage', name: 'Sage', hex: '#8A8F73', border: 'rgba(0, 0, 0, 0.12)' },
  { id: 'walnut', name: 'Walnut', hex: '#6B4426', border: 'rgba(0, 0, 0, 0.12)' },
  { id: 'warm-taupe', name: 'Warm Taupe', hex: '#CBB9A3', border: 'rgba(0, 0, 0, 0.12)' },
  { id: 'cream', name: 'Cream', hex: '#E8DCC5', border: 'rgba(0, 0, 0, 0.15)' },
  { id: 'golden-ochre', name: 'Golden Ochre', hex: '#C19A68', border: 'rgba(0, 0, 0, 0.12)' },
  { id: 'burnt-sienna', name: 'Burnt Sienna', hex: '#B44E26', border: 'rgba(0, 0, 0, 0.12)' },
  { id: 'olive-green', name: 'Olive Green', hex: '#3E5352', border: 'rgba(0, 0, 0, 0.12)' },
  { id: 'blue-grey', name: 'Blue-Grey', hex: '#6C7A89', border: 'rgba(0, 0, 0, 0.12)' },
  { id: 'cream-white', name: 'Cream White', hex: '#F5F5DC', border: 'rgba(0, 0, 0, 0.18)' },
];


export const ARRIVAL_TIME_OPTIONS = [
  {
    id: 'welcome',
    value: '16:00 (Welcome & Afternoon Tea)',
    time: '16:00',
    title: 'Welcome & Afternoon Tea',
    desc: 'Arrive early to take photos & enjoy tea with the couple',
  },
  {
    id: 'ceremony',
    value: '17:00 - 17:30 (Wedding Ceremony)',
    time: '17:00 - 17:30',
    title: 'Wedding Ceremony',
    desc: 'Arrive before the sacred exchange of vows',
  },
  {
    id: 'banquet',
    value: '18:00 - 18:30 (Dinner Banquet)',
    time: '18:00 - 18:30',
    title: 'Dinner Banquet',
    desc: 'Join our intimate dinner & raise a toast',
  },
];

export function isDeadlinePassed() {
  return false;
}

export function generateGoogleCalendarUrl() {
  const title = encodeURIComponent(`Wedding Celebration - ${WEDDING_EVENT.couple}`);
  const details = encodeURIComponent(
    `Join the intimate wedding celebration of ${WEDDING_EVENT.couple}.\nVenue: ${WEDDING_EVENT.venueName} - ${WEDDING_EVENT.venueAddress}.\nTime: ${WEDDING_EVENT.timeDisplay}.\nWe look forward to celebrating with you!`
  );
  const location = encodeURIComponent(`${WEDDING_EVENT.venueName}, ${WEDDING_EVENT.venueAddress}`);
  // 16:00 GMT+7 is 09:00 UTC. 21:30 GMT+7 is 14:30 UTC
  const dates = '20261003T090000Z/20261003T143000Z';
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

export function generateIcsContent() {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hoang & Duyen Wedding//RSVP Calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:hoang-duyen-wedding-20261003@hiddenhaven',
    'DTSTAMP:20260916T000000Z',
    'DTSTART:20261003T090000Z',
    'DTEND:20261003T143000Z',
    `SUMMARY:Wedding Celebration - ${WEDDING_EVENT.couple}`,
    `DESCRIPTION:Intimate wedding celebration of ${WEDDING_EVENT.couple} at ${WEDDING_EVENT.venueName}.`,
    `LOCATION:${WEDDING_EVENT.venueName}, ${WEDDING_EVENT.venueAddress}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcsFile() {
  if (typeof window === 'undefined') return;
  const ics = generateIcsContent();
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'wedding-invitation-hoang-duyen.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
