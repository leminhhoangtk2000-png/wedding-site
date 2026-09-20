// Wedding RSVP Constants and Helpers
export const WEDDING_EVENT = {
  groom: 'Hoàng',
  bride: 'Duyên',
  couple: 'Hoàng & Duyên',
  dateFormatted: '03 · 10 · 2026',
  dateDisplay: 'Saturday, October 3rd, 2026',
  timeDisplay: '4:00 PM Welcome · 5:30 PM Ceremony',
  venueName: 'Hidden Haven',
  venueAddress: '393/21 Binh Quoi, Ward 28, Binh Thanh District, Ho Chi Minh City',
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

export function isDeadlinePassed() {
  try {
    return new Date().getTime() > new Date(WEDDING_EVENT.cutoffIso).getTime();
  } catch {
    return false;
  }
}

export function generateGoogleCalendarUrl() {
  const title = encodeURIComponent(`Wedding Celebration - ${WEDDING_EVENT.couple}`);
  const details = encodeURIComponent(
    `Intimate wedding celebration of ${WEDDING_EVENT.couple}.\nVenue: ${WEDDING_EVENT.venueName} - ${WEDDING_EVENT.venueAddress}.\nSchedule: ${WEDDING_EVENT.timeDisplay}.\nWe look forward to celebrating with you!`
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
  link.setAttribute('download', 'wedding-hoang-duyen.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
