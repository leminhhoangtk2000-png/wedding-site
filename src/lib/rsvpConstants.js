// Wedding RSVP Constants and Helpers
export const WEDDING_EVENT = {
  groom: 'Hoàng',
  bride: 'Duyên',
  couple: 'Hoàng & Duyên',
  dateFormatted: '03 · 10 · 2026',
  dateDisplay: 'Thứ Bảy, ngày 03 tháng 10 năm 2026',
  timeDisplay: '16:00 đón khách · 17:30 bắt đầu lễ cưới',
  venueName: 'Hidden Haven',
  venueAddress: '393/21 đường Bình Quới, Phường 28, Quận Bình Thạnh, TP. Hồ Chí Minh',
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Hidden+Haven+393%2F21+B%C3%ACnh+Qu%E1%BB%9Bi+Ph%C6%B0%E1%BB%9Dng+28+B%C3%ACnh+Th%E1%BA%A1nh+TP+HCM',
  // Cutoff deadline: 16:00 30/09/2026 GMT+7
  cutoffIso: '2026-09-30T16:00:00+07:00',
  cutoffDisplay: '16:00 ngày 30/09/2026',
};

export const ATTENDANCE_VALUES = {
  ATTENDING: 'attending',
  DECLINED: 'declined',
};

export const DIETARY_PRESETS = [
  'Ăn chay',
  'Dị ứng hải sản',
];

export function isDeadlinePassed() {
  try {
    return new Date().getTime() > new Date(WEDDING_EVENT.cutoffIso).getTime();
  } catch {
    return false;
  }
}

export function generateGoogleCalendarUrl() {
  const title = encodeURIComponent(`Lễ Thành Hôn - ${WEDDING_EVENT.couple}`);
  const details = encodeURIComponent(
    `Hôn lễ ấm cúng của ${WEDDING_EVENT.couple}.\nĐịa điểm: ${WEDDING_EVENT.venueName} - ${WEDDING_EVENT.venueAddress}.\nThời gian: ${WEDDING_EVENT.timeDisplay}.\nRất hân hạnh được đón tiếp bạn!`
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
    'PRODID:-//Hoang & Duyen Wedding//RSVP Calendar//VI',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:hoang-duyen-wedding-20261003@hiddenhaven',
    'DTSTAMP:20260916T000000Z',
    'DTSTART:20261003T090000Z',
    'DTEND:20261003T143000Z',
    `SUMMARY:Lễ Thành Hôn - ${WEDDING_EVENT.couple}`,
    `DESCRIPTION:Hôn lễ ấm cúng của ${WEDDING_EVENT.couple} tại ${WEDDING_EVENT.venueName}.`,
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
  link.setAttribute('download', 'le-thanh-hon-hoang-duyen.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
