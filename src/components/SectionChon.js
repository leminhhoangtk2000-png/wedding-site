'use client';

const cards = [
  { image: '/images/000062.jpg', text: '6 năm\nbạn học', phaseKey: '6' },
  { image: '/images/000042-4.jpg', text: '9 năm\nbạn gái', phaseKey: '9' },
  { image: '/images/000046-4.jpg', text: '69 năm\nbạn đời', phaseKey: '69' },
];

export default function SectionChon({ onPhaseChange, activePhase }) {
  const handleClick = (phaseKey) => {
    if (onPhaseChange) {
      onPhaseChange(phaseKey);
    }
  };

  return (
    <section className="section-chon" id="section-chon">
      <div className="section-chon__grid">
        {cards.map((card) => (
          <div
            key={card.phaseKey}
            className={`section-chon__card ${activePhase === card.phaseKey ? 'section-chon__card--active' : ''}`}
            onClick={() => handleClick(card.phaseKey)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick(card.phaseKey);
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
