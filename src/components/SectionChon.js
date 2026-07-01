'use client';

const cards = [
  { image: '/images/000062.jpg', text: '6 năm\nbạn học', targetId: 'section-6' },
  { image: '/images/000042-4.jpg', text: '9 năm\nbạn gái', targetId: 'section-9' },
  { image: '/images/000046-4.jpg', text: '69 năm\nbạn đời', targetId: 'section-13' },
];

export default function SectionChon() {
  const handleClick = (targetId) => {
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="section-chon" id="section-chon">
      <div className="section-chon__grid">
        {cards.map((card, index) => (
          <div
            key={card.targetId}
            className="section-chon__card"
            onClick={() => handleClick(card.targetId)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick(card.targetId);
              }
            }}
          >
            <img src={card.image} alt={card.text.replace('\n', ' ')} className="section-chon__card-image" />
            <div className="section-chon__card-overlay">
              <span className="section-chon__card-text">{card.text}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
