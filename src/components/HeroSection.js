'use client';

export default function HeroSection() {
  return (
    <section className="hero" id="hero">
      <div className="hero__image-wrapper">
        <img
          src="/images/000064-3.jpg"
          alt="Hoàng & Duyên"
          className="hero__image"
        />
      </div>
      <div className="hero__overlay" />
      <div className="hero__content">
        <div className="hero__text">
          <p className="hero__text-small">Câu chuyện  của</p>
          <h1 className="hero__text-name">
            Hoàng<br />& Duyên
          </h1>
        </div>
        <div className="hero__badge">
          <div className="hero__badge-title">69 Project</div>
          <div className="hero__badge-list">
            <div className="hero__badge-item">6 năm bạn học...</div>
            <div className="hero__badge-item">9 năm bạn gái...</div>
            <div className="hero__badge-item">69 năm bạn đời, bạn nhậu, bạn làm ăn, bạn chung nhà, bạn già...</div>
          </div>
        </div>
      </div>
    </section>
  );
}
