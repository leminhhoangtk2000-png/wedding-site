'use client';

import Image from 'next/image';
import {
  HanddrawnChampagne,
  HanddrawnDove,
  HanddrawnCamera,
  HanddrawnDinner,
  HanddrawnCake,
} from '@/components/icons/HanddrawnIcons';
import styles from '@/app/rsvp/rsvp.module.css';

const TIMELINE_EVENTS = [
  {
    time: '16:00',
    title: 'Đón Khách & Tiệc Trà Nhẹ',
    desc: 'Thưởng thức welcome drink, bánh ngọt và lắng nghe giai điệu violin du dương.',
    icon: HanddrawnChampagne,
  },
  {
    time: '17:30',
    title: 'Nghi Lễ Thành Hôn',
    desc: 'Giây phút thiêng liêng trao nhẫn cưới và lời hẹn ước trăm năm.',
    icon: HanddrawnDove,
  },
  {
    time: '18:00',
    title: 'Hoàng Hôn & Chụp Ảnh Kỷ Niệm',
    desc: 'Lưu giữ những khung hình rạng rỡ và đáng nhớ nhất cùng Hoàng & Duyên.',
    icon: HanddrawnCamera,
  },
  {
    time: '18:30',
    title: 'Khai Tiệc Thân Mật',
    desc: 'Thưởng thức bữa tiệc ẩm thực ấm cúng dưới ánh nến và nâng ly chúc phúc.',
    icon: HanddrawnDinner,
  },
  {
    time: '19:30',
    title: 'Cắt Bánh Cưới & After Party',
    desc: 'Cùng hòa mình vào âm nhạc, các trò chơi vui nhộn và khiêu vũ dưới bầu trời đêm.',
    icon: HanddrawnCake,
  },
];

export default function EventTimeline() {
  return (
    <section
      id="rsvp-timeline-section"
      className={styles.banquetCard}
      aria-label="Lịch trình chương trình tiệc cưới"
    >
      {/* Header */}
      <div className={styles.badgePill}>
        <span className={styles.badgeSparkle}>✦</span>
        <span>CHƯƠNG TRÌNH HÔN LỄ</span>
        <span className={styles.badgeSparkle}>✦</span>
      </div>

      <h2 className={styles.cardTitleScript}>Lịch Trình Tiệc Cưới</h2>

      <p className={styles.cardSubtitle}>
        Thứ Bảy, ngày 03 tháng 10 năm 2026 · Hidden Haven
      </p>

      {/* Gold Filigree Divider */}
      <div className={styles.goldFiligreeDivider} aria-hidden="true">
        <div className={styles.goldFiligreeLine} />
        <span className={styles.goldFiligreeKnot}>✦</span>
        <div className={styles.goldFiligreeLine} />
      </div>

      {/* Banquet Table Artistic Illustration */}
      <div className={styles.timelineBanquetTableArt} aria-hidden="true">
        <Image
          src="/rsvp/banquet_table_transparent.webp"
          alt="Bàn tiệc cưới ấm cúng bên ánh nến"
          width={800}
          height={450}
          priority
          className={styles.timelineTableImage}
        />
      </div>

      {/* Vertical Interactive Timeline Trail */}
      <div className={styles.timelineTrail} role="list">
        {TIMELINE_EVENTS.map((event, idx) => {
          const IconComp = event.icon;
          return (
            <div key={idx} className={styles.timelineItem} role="listitem">
              <div className={styles.timelineNode} aria-hidden="true">
                <IconComp size={22} />
              </div>
              <div className={styles.timelineContent}>
                <div className={styles.timelineTimeHeader}>
                  <span className={styles.timelineTimeGold}>{event.time}</span>
                  <span className={styles.timelineLabel}>{event.title}</span>
                </div>
                <p className={styles.timelineDesc}>{event.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
