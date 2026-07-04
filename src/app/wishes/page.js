'use client';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

import { supabase } from '@/lib/supabase';

// Define shape matrices for different grid sizes
const MATRICES = {
  '25': {
    matrix6: [
      [0,1,1,1,0],
      [1,0,0,0,0],
      [1,1,1,0,0],
      [1,0,0,1,0],
      [0,1,1,0,0]
    ],
    matrix9: [
      [0,1,1,0,0],
      [1,0,0,1,0],
      [0,1,1,1,0],
      [0,0,0,1,0],
      [0,1,1,1,0]
    ]
  },
  '50': {
    matrix6: [
      [0,0,1,1,1,1,1],
      [0,1,1,0,0,0,0],
      [1,1,0,0,0,0,0],
      [1,1,1,1,1,1,0],
      [1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1],
      [0,1,1,1,1,1,0],
    ],
    matrix9: [
      [0,1,1,1,1,1,0],
      [1,1,0,0,0,1,1],
      [1,1,0,0,0,1,1],
      [0,1,1,1,1,1,1],
      [0,0,0,0,0,1,1],
      [0,0,0,0,1,1,0],
      [1,1,1,1,1,0,0],
    ]
  },
  '75': {
    matrix6: [
      [0,0,0,1,1,1,1,1,0],
      [0,0,1,1,1,0,0,0,0],
      [0,1,1,0,0,0,0,0,0],
      [1,1,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,1,0,0],
      [1,1,0,0,0,0,1,1,0],
      [1,1,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,1,1],
      [0,1,1,0,0,0,1,1,0],
      [0,0,1,1,1,1,1,0,0]
    ],
    matrix9: [
      [0,0,1,1,1,1,1,0,0],
      [0,1,1,0,0,0,1,1,0],
      [1,1,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,1,1],
      [0,1,1,0,0,0,0,1,1],
      [0,0,1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,1,1],
      [0,0,0,0,0,0,1,1,0],
      [0,0,0,0,1,1,1,0,0],
      [0,1,1,1,1,0,0,0,0]
    ]
  },
  '100': {
    matrix6: [
      [0,0,0,1,1,1,1,1,1,0],
      [0,0,1,1,0,0,0,0,0,0],
      [0,1,1,0,0,0,0,0,0,0],
      [1,1,0,0,0,0,0,0,0,0],
      [1,1,0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,1,1,0,0],
      [1,1,0,0,0,0,0,1,1,0],
      [1,1,0,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,1,1],
      [0,1,1,0,0,0,0,1,1,0],
      [0,0,1,1,1,1,1,1,0,0]
    ],
    matrix9: [
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,0,0,0,0,1,1,0],
      [1,1,0,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,1,1],
      [0,1,1,0,0,0,0,0,1,1],
      [0,0,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,1,1],
      [0,0,0,0,0,0,0,1,1,0],
      [0,0,0,0,0,0,1,1,0,0],
      [0,0,0,0,1,1,1,0,0,0],
      [0,1,1,1,1,0,0,0,0,0]
    ]
  },
  '200': {
    matrix6: [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [1,1,1,1,0,0,0,0,0,0,1,1,1,0,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,1,0,0,0,0,0,0,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0]
    ],
    matrix9: [
      [0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [1,1,1,1,0,0,0,0,0,0,1,1,1,0,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,1,0,0,0,0,0,0,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,1,1,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,1,1,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,1,1,1,0],
      [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0],
      [0,0,0,0,0,0,0,1,1,1,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,1,1,1,1,1,1,0,0,0,0,0,0,0]
    ]
  }
};

const scaleMatrix = (baseMatrix, scale) => {
  const result = [];
  for (let r = 0; r < baseMatrix.length; r++) {
    for (let sr = 0; sr < scale; sr++) {
      const newRow = [];
      for (let c = 0; c < baseMatrix[0].length; c++) {
        for (let sc = 0; sc < scale; sc++) {
          newRow.push(baseMatrix[r][c]);
        }
      }
      result.push(newRow);
    }
  }
  return result;
};

MATRICES['300'] = {
  matrix6: scaleMatrix(MATRICES['75'].matrix6, 2),
  matrix9: scaleMatrix(MATRICES['75'].matrix9, 2)
};
MATRICES['400'] = {
  matrix6: scaleMatrix(MATRICES['100'].matrix6, 2),
  matrix9: scaleMatrix(MATRICES['100'].matrix9, 2)
};
MATRICES['500'] = {
  matrix6: scaleMatrix(MATRICES['50'].matrix6, 3),
  matrix9: scaleMatrix(MATRICES['50'].matrix9, 3)
};
MATRICES['600'] = {
  matrix6: scaleMatrix(MATRICES['25'].matrix6, 5),
  matrix9: scaleMatrix(MATRICES['25'].matrix9, 5)
};
MATRICES['699'] = {
  matrix6: scaleMatrix(MATRICES['200'].matrix6, 2),
  matrix9: scaleMatrix(MATRICES['200'].matrix9, 2)
};


const GRADIENTS = [
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
];

export default function WishesPage() {
  const [wishes, setWishes] = useState([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [gridSize, setGridSize] = useState('50'); // default 50
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWish, setSelectedWish] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const fileInputRef = useRef(null);

  // Load wishes on mount
  useEffect(() => {
    async function fetchData() {
      // Fetch wishes
      const { data: wishesData, error: wishesError } = await supabase
        .from('wishes')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      
      if (wishesData && !wishesError) {
        setWishes(wishesData);
      }
      
      // Fetch grid size settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'grid_size')
        .single();
        
      if (settingsData && !settingsError && settingsData.value) {
        setGridSize(settingsData.value);
      }
      
      setLoaded(true);
    }
    fetchData();
  }, []);

  const handleFileSelect = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 1) {
      alert('Chỉ được chọn tối đa 1 ảnh!');
      return;
    }
    
    setFiles(selectedFiles);
    const newPreviews = selectedFiles.map(f => ({
      url: URL.createObjectURL(f),
      type: f.type.startsWith('video') ? 'video' : 'image',
      name: f.name,
    }));
    setPreviews(newPreviews);
  }, []);

  const removeFile = useCallback(() => {
    setFiles([]);
    if (previews[0]?.url) URL.revokeObjectURL(previews[0].url);
    setPreviews([]);
  }, [previews]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    
    // Validate video size before submitting
    for (const f of files) {
      if (f.type.startsWith('video') && f.size > 50 * 1024 * 1024) {
        alert('Video quá lớn! Vui lòng chọn video dưới 50MB để đảm bảo tốc độ tải trang.');
        return;
      }
    }
    
    setSubmitting(true);
    
    const media = [];
    
    // Upload files to Supabase Storage
    for (const f of files) {
      const fileExt = f.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('wishes_media')
        .upload(filePath, f);
        
      if (uploadError) {
        console.error("Error uploading file:", uploadError);
        alert("Có lỗi khi tải file lên! Vui lòng kiểm tra lại cấu hình Storage.");
        setSubmitting(false);
        return;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('wishes_media')
        .getPublicUrl(filePath);
        
      media.push({
        dataUrl: publicUrl,
        type: f.type.startsWith('video') ? 'video' : 'image',
        name: f.name,
      });
    }
    
    const { error } = await supabase.from('wishes').insert({
      guest_name: name.trim(),
      message: message.trim(),
      media: media,
      status: 'pending'
    });
    
    if (error) {
      console.error("Error saving wish:", error);
      alert("Có lỗi xảy ra khi gửi lời chúc! Vui lòng thử lại.");
      setSubmitting(false);
      return;
    }
    
    setName('');
    setMessage('');
    setFiles([]);
    setPreviews([]);
    setSubmitting(false);
    setSubmitted(true);
    setIsModalOpen(false);
    
    setTimeout(() => setSubmitted(false), 3000);
  }, [name, message, files]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const droppedFiles = Array.from(e.dataTransfer.files).slice(0, 1);
    setFiles(droppedFiles);
    const newPreviews = droppedFiles.map(f => ({
      url: URL.createObjectURL(f),
      type: f.type.startsWith('video') ? 'video' : 'image',
      name: f.name,
    }));
    setPreviews(newPreviews);
  }, []);

  // Tracks which wish to map to which cell globally across matrices
  let cellCounter = 0; 

  // IntersectionObserver for shape reveal
  const shapeBoardRef = useRef(null);
  const [isShapeVisible, setIsShapeVisible] = useState(false);
  const particlesCanvasRef = useRef(null);

  useEffect(() => {
    const el = shapeBoardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsShapeVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Particles (floating hearts) effect
  useEffect(() => {
    if (!isShapeVisible) return;
    const canvas = particlesCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.offsetWidth * dpr;
      canvas.height = parent.offsetHeight * dpr;
      canvas.style.width = parent.offsetWidth + 'px';
      canvas.style.height = parent.offsetHeight + 'px';
      ctx.scale(dpr, dpr);
    };
    resize();

    const hearts = [];
    const HEART_COUNT = 18;
    const W = () => canvas.width / dpr;
    const H = () => canvas.height / dpr;
    for (let i = 0; i < HEART_COUNT; i++) {
      hearts.push({
        x: Math.random() * W(),
        y: Math.random() * H(),
        size: 6 + Math.random() * 10,
        speedY: -(0.15 + Math.random() * 0.3),
        speedX: (Math.random() - 0.5) * 0.3,
        opacity: 0.15 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const drawHeart = (x, y, size, opacity) => {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#d4a574';
      ctx.beginPath();
      const s = size / 2;
      ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x, y - s * 0.5, x - s, y - s * 0.5, x - s, y + s * 0.1);
      ctx.bezierCurveTo(x - s, y + s * 0.6, x, y + s, x, y + s * 1.2);
      ctx.bezierCurveTo(x, y + s, x + s, y + s * 0.6, x + s, y + s * 0.1);
      ctx.bezierCurveTo(x + s, y - s * 0.5, x, y - s * 0.5, x, y + s * 0.3);
      ctx.fill();
      ctx.restore();
    };

    let t = 0;
    const animate = () => {
      ctx.clearRect(0, 0, W(), H());
      t += 0.02;
      hearts.forEach(h => {
        h.x += h.speedX + Math.sin(t + h.phase) * 0.2;
        h.y += h.speedY;
        if (h.y < -20) { h.y = H() + 10; h.x = Math.random() * W(); }
        if (h.x < -20) h.x = W() + 10;
        if (h.x > W() + 20) h.x = -10;
        drawHeart(h.x, h.y, h.size, h.opacity);
      });
      animId = requestAnimationFrame(animate);
    };
    animate();

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [isShapeVisible]);

  // Helper to render a shape matrix
  const renderMatrix = (matrix, matrixOffset = 0) => {
    const rows = matrix.length;
    const cols = matrix[0].length;
    return (
      <div 
        className="shape-grid" 
        style={{ 
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`
        }}
      >
        {matrix.flatMap((row, r) => 
          row.map((val, c) => {
            if (val === 0) {
              return <div key={`${r}-${c}`} className="grid-cell empty" />;
            }
            
            // Pop the next wish from the list if available
            const wishIndex = cellCounter++;
            const wish = wishes[wishIndex];
            
            if (!wish) {
              // Empty placeholder for cell
              return (
                <div 
                  key={`${r}-${c}`} 
                  className={`grid-cell ${isShapeVisible ? 'shape-revealed' : ''}`}
                  style={{ 
                    background: 'var(--color-border)',
                    animationDelay: `${(matrixOffset + r) * 0.08 + c * 0.04}s`
                  }} 
                />
              );
            }
            
            const hasMedia = wish.media && wish.media.length > 0;
            const initial = wish.guest_name ? wish.guest_name.charAt(0).toUpperCase() : '♥';
            const gradient = GRADIENTS[wishIndex % GRADIENTS.length];
            
            return (
              <div 
                key={`${r}-${c}`} 
                className={`grid-cell ${isShapeVisible ? 'shape-revealed' : ''}`}
                style={{ 
                  background: hasMedia ? '#000' : gradient, 
                  animationDelay: `${(matrixOffset + r) * 0.08 + c * 0.04}s`
                }}
                onClick={() => setSelectedWish(wish)}
              >
                <div className="grid-cell-content">
                  {hasMedia ? (
                    wish.media[0].type === 'image' ? (
                      <img src={wish.media[0].dataUrl || wish.media[0]} alt="" />
                    ) : (
                      <video src={wish.media[0].dataUrl || wish.media[0]} />
                    )
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="wishes-page" style={{ '--zoom': zoomLevel }}>
      
      {/* Zoom Controls */}
      <div className="zoom-controls">
        <button onClick={() => setZoomLevel(z => Math.min(z + 0.2, 3))} title="Phóng to">+</button>
        <button onClick={() => setZoomLevel(1)} style={{ fontSize: 14, fontWeight: 'bold' }} title="Mặc định">1x</button>
        <button onClick={() => setZoomLevel(z => Math.max(z - 0.2, 0.4))} title="Thu nhỏ">-</button>
      </div>

      <div className="wishes-hero">
        <h1>Wishes Board</h1>
        <p>Gửi lời chúc và lưu giữ khoảnh khắc đáng nhớ cùng Hoàng & Duyên</p>
        <button className="fab-button" onClick={() => setIsModalOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Gửi lời chúc
        </button>
      </div>

      {/* Centered Form Modal */}
      <div className={`modal-overlay ${isModalOpen ? 'open' : ''}`} onClick={(e) => {
        if(e.target === e.currentTarget) setIsModalOpen(false);
      }}>
        <div className="wishes-modal">
          <div className="modal-header">
            <h2>Gửi Lời Chúc</h2>
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
          </div>

          <form className="wishes-form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Tên của bạn"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
            <textarea
              placeholder="Lời chúc của bạn..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
            />
            
            <div
              className="upload-zone"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
              onDragLeave={e => e.currentTarget.classList.remove('dragover')}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p style={{ marginTop: 12, color: '#999', fontSize: 14 }}>
                Kéo thả hoặc bấm để chọn ảnh/video (tối đa 1 ảnh)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            {previews.length > 0 && (
              <div className="upload-previews">
                {previews.map((p, i) => (
                  <div key={i} className="upload-preview">
                    {p.type === 'image' ? (
                      <img src={p.url} alt={p.name} />
                    ) : (
                      <video src={p.url} />
                    )}
                    <button
                      type="button"
                      className="upload-preview-remove"
                      onClick={removeFile}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={submitting || !name.trim() || !message.trim()}>
              {submitting ? 'Đang gửi...' : submitted ? '✓ Đã gửi, chờ duyệt!' : 'Gửi lời chúc'}
            </button>
          </form>
        </div>
      </div>

      {/* 69 Shape Board */}
      <div className="shape-board-wrapper" ref={shapeBoardRef}>
        <canvas ref={particlesCanvasRef} className="particles-canvas" />
        <div className="shape-board-container">
          {MATRICES[gridSize] && renderMatrix(MATRICES[gridSize].matrix6, 0)}
          {MATRICES[gridSize] && renderMatrix(MATRICES[gridSize].matrix9, MATRICES[gridSize].matrix6.length)}
        </div>
      </div>

      {/* Highlighted Wishes */}
      {wishes.filter(w => w.is_highlighted).length > 0 && (
        <div className="highlight-section">

          <div className="highlight-grid">
            {wishes.filter(w => w.is_highlighted).map((wish, idx) => (
              <div className="highlight-card" key={wish.id || idx} onClick={() => setSelectedWish(wish)}>
                {wish.media && wish.media.length > 0 ? (
                  wish.media[0].type === 'image' ? (
                    <img src={wish.media[0].dataUrl || wish.media[0]} className="highlight-media" alt="" />
                  ) : (
                    <video src={wish.media[0].dataUrl || wish.media[0]} className="highlight-media" controls />
                  )
                ) : (
                  <div className="highlight-media" style={{ background: GRADIENTS[idx % GRADIENTS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, color: 'white' }}>
                    {wish.guest_name ? wish.guest_name.charAt(0).toUpperCase() : '♥'}
                  </div>
                )}
                <div className="highlight-content">
                  <div className="highlight-message">"{wish.message}"</div>
                  <div className="highlight-author">- {wish.guest_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Fallback for extra wishes */}
      {wishes.length > (MATRICES[gridSize] ? MATRICES[gridSize].matrix6.flat().filter(v=>v===1).length + MATRICES[gridSize].matrix9.flat().filter(v=>v===1).length : 56) && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          <p>Và {wishes.length - (MATRICES[gridSize] ? MATRICES[gridSize].matrix6.flat().filter(v=>v===1).length + MATRICES[gridSize].matrix9.flat().filter(v=>v===1).length : 56)} lời chúc khác...</p>
        </div>
      )}

      {wishes.length === 0 && loaded && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999', width: '100%' }}>
          <p style={{ fontSize: 18 }}>Chưa có lời chúc nào. Hãy là người đầu tiên! 💕</p>
        </div>
      )}

      {/* Polaroid Popup */}
      {selectedWish && (
        <div className="polaroid-overlay" onClick={() => setSelectedWish(null)}>
          <div className="polaroid-card" onClick={e => e.stopPropagation()}>
            <button className="polaroid-close" onClick={() => setSelectedWish(null)}>&times;</button>
            <div className="polaroid-media">
              {selectedWish.media && selectedWish.media.length > 0 ? (
                selectedWish.media[0].type === 'image' ? (
                  <img src={selectedWish.media[0].dataUrl || selectedWish.media[0]} alt="" />
                ) : (
                  <video src={selectedWish.media[0].dataUrl || selectedWish.media[0]} controls />
                )
              ) : (
                <div 
                  className="polaroid-media-placeholder"
                  style={{ background: GRADIENTS[wishes.findIndex(w => w.id === selectedWish.id) % GRADIENTS.length] }}
                >
                  {selectedWish.guest_name ? selectedWish.guest_name.charAt(0).toUpperCase() : '♥'}
                </div>
              )}
            </div>
            <div className="polaroid-text">
              <div className="polaroid-message">{selectedWish.message}</div>
              <div className="polaroid-author">- {selectedWish.guest_name} -</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
