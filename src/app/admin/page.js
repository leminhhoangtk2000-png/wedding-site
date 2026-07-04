'use client';
import { useState, useEffect } from 'react';

import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [wishes, setWishes] = useState([]);
  const [mounted, setMounted] = useState(false);
  
  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editMessage, setEditMessage] = useState('');
  
  // Settings state
  const [gridSize, setGridSize] = useState('50'); // default 50
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchWishes = async () => {
    const { data, error } = await supabase
      .from('wishes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data && !error) {
      setWishes(data);
    }
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'grid_size')
      .single();
      
    if (data && !error && data.value) {
      setGridSize(data.value);
    }
  };

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem('admin_auth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && mounted) {
      fetchWishes();
      fetchSettings();
    }
  }, [isAuthenticated, mounted]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === '696969') {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
    } else {
      alert('Sai mật khẩu!');
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    // Upsert works if there's a primary key or unique constraint on 'key'
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'grid_size', value: gridSize }, { onConflict: 'key' });
      
    setSavingSettings(false);
    if (!error) {
      alert('Đã lưu cài đặt!');
    } else {
      console.error("Lỗi Supabase chi tiết:", error);
      alert('Có lỗi khi lưu cài đặt! Lỗi: ' + error.message);
    }
  };

  const handleApprove = async (id) => {
    const { error } = await supabase
      .from('wishes')
      .update({ status: 'approved' })
      .eq('id', id);
      
    if (!error) {
      setWishes(wishes.map(w => w.id === id ? { ...w, status: 'approved' } : w));
    }
  };

  const handleUnapprove = async (id) => {
    const { error } = await supabase
      .from('wishes')
      .update({ status: 'pending' })
      .eq('id', id);
      
    if (!error) {
      setWishes(wishes.map(w => w.id === id ? { ...w, status: 'pending' } : w));
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Bạn có chắc muốn xóa lời chúc này?')) {
      const { error } = await supabase
        .from('wishes')
        .delete()
        .eq('id', id);
        
      if (!error) {
        setWishes(wishes.filter(w => w.id !== id));
      }
    }
  };

  const handleEditStart = (wish) => {
    setEditingId(wish.id);
    setEditName(wish.guest_name);
    setEditMessage(wish.message);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
    setEditMessage('');
  };

  const handleEditSave = async () => {
    const { error } = await supabase
      .from('wishes')
      .update({ guest_name: editName, message: editMessage })
      .eq('id', editingId);
      
    if (!error) {
      setWishes(wishes.map(w => 
        w.id === editingId ? { ...w, guest_name: editName, message: editMessage } : w
      ));
      setEditingId(null);
    } else {
      alert("Lỗi khi lưu!");
    }
  };

  if (!mounted) return null;

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 100px)', backgroundColor: '#fdfbf7', padding: 20 }}>
        <form onSubmit={handleLogin} style={{ padding: 40, background: 'white', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', textAlign: 'center', maxWidth: 400, width: '100%' }}>
          <h1 style={{ marginBottom: 24, fontSize: 24, color: '#333' }}>Admin Login</h1>
          <input 
            type="password" 
            placeholder="Nhập mật khẩu..." 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid #ddd', width: '100%', marginBottom: 16, fontSize: 16, boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ padding: '12px 24px', borderRadius: 8, border: 'none', background: '#333', color: 'white', fontSize: 16, cursor: 'pointer', width: '100%', fontWeight: 'bold' }}>
            Đăng nhập
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', minHeight: 'calc(100vh - 100px)', backgroundColor: '#fdfbf7' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, color: '#333', margin: 0 }}>Quản Lý Lời Chúc</h1>
        <button onClick={() => { setIsAuthenticated(false); sessionStorage.removeItem('admin_auth'); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}>Đăng xuất</button>
      </div>
      
      {/* Settings Card */}
      <div style={{ padding: 24, background: 'white', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #eee', marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 20, color: '#333' }}>Cài đặt hiển thị (Wishes Board)</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, color: '#555', marginBottom: 8, fontWeight: 'bold' }}>Kích thước ma trận (số lượng ô hiển thị)</label>
            <select 
              value={gridSize} 
              onChange={e => setGridSize(e.target.value)}
              style={{ padding: '10px 16px', fontSize: 16, borderRadius: 8, border: '1px solid #ddd', minWidth: 150 }}
            >
              <option value="25">~25 ô (Nhỏ)</option>
              <option value="50">~50 ô (Vừa)</option>
              <option value="75">~75 ô (Lớn)</option>
              <option value="100">~100 ô (Rất lớn)</option>
              <option value="200">~200 ô (Khổng lồ)</option>
              <option value="300">~300 ô</option>
              <option value="400">~400 ô</option>
              <option value="500">~500 ô</option>
              <option value="600">~600 ô</option>
              <option value="699">~699 ô (Tối đa)</option>
            </select>
          </div>
          <button 
            onClick={handleSaveSettings} 
            disabled={savingSettings}
            style={{ marginTop: 24, padding: '10px 24px', background: '#4285f4', color: 'white', border: 'none', borderRadius: 8, cursor: savingSettings ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            {savingSettings ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
        <p style={{ marginTop: 12, fontSize: 13, color: '#888' }}>* Cài đặt này thay đổi số lượng ô xếp thành hình 69 trên trang chủ. Bạn cần tạo bảng `settings` trong Supabase để tính năng này hoạt động.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {wishes.map((wish, index) => (
          <div key={wish.id} style={{ padding: 20, background: 'white', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: wish.status === 'pending' ? '2px solid #ffcc00' : '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ flex: 1 }}>
                {editingId === wish.id ? (
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ fontSize: 18, color: '#333', fontWeight: 'bold', padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', width: '100%', maxWidth: 300, boxSizing: 'border-box' }}
                  />
                ) : (
                  <strong style={{ fontSize: 18, color: '#333' }}>{wish.guest_name}</strong>
                )}
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  {new Date(wish.created_at).toLocaleString('vi-VN')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexDirection: 'column' }}>
                <span style={{ 
                  padding: '4px 8px',  
                  borderRadius: 4, 
                  fontSize: 12, 
                  fontWeight: 'bold',
                  backgroundColor: wish.status === 'approved' ? '#e6f4ea' : '#fef0d9',
                  color: wish.status === 'approved' ? '#1e8e3e' : '#f57c00',
                  height: 'fit-content'
                }}>
                  {wish.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                </span>
                {wish.is_highlighted && (
                  <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold', backgroundColor: '#fff3cd', color: '#856404', display: 'flex', alignItems: 'center', gap: 4 }}>
                    ⭐ Nổi bật
                  </span>
                )}
              </div>
            </div>
            
            {editingId === wish.id ? (
              <textarea 
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={3}
                style={{ marginBottom: 16, width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            ) : (
              <p style={{ marginBottom: 16, color: '#555', lineHeight: 1.5 }}>{wish.message}</p>
            )}
            
            {wish.media && wish.media.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 8 }}>
                {wish.media.map((m, i) => (
                  m.type === 'image' 
                    ? <img key={i} src={m.dataUrl} alt="" style={{ height: 120, borderRadius: 8, objectFit: 'cover' }} />
                    : <video key={i} src={m.dataUrl} style={{ height: 120, borderRadius: 8 }} controls />
                ))}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid #eee', paddingTop: 16, flexWrap: 'wrap' }}>
              {editingId === wish.id ? (
                <>
                  <button onClick={handleEditSave} style={{ padding: '8px 16px', background: '#333', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: '500' }}>
                    Lưu
                  </button>
                  <button onClick={handleEditCancel} style={{ padding: '8px 16px', background: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontWeight: '500' }}>
                    Hủy
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handleEditStart(wish)} style={{ padding: '8px 16px', background: '#4285f4', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: '500' }}>
                    Sửa
                  </button>
                  {wish.status === 'pending' && (
                    <button onClick={() => handleApprove(wish.id)} style={{ padding: '8px 16px', background: '#1e8e3e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: '500' }}>
                      Duyệt
                    </button>
                  )}
                  {wish.status === 'approved' && (
                    <>
                      <button onClick={() => handleUnapprove(wish.id)} style={{ padding: '8px 16px', background: '#f5a623', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: '500' }}>
                        Hủy duyệt
                      </button>
                      <button 
                        onClick={async () => {
                          const isCurrentlyHighlighted = wish.is_highlighted;
                          if (!isCurrentlyHighlighted) {
                            const highlightedCount = wishes.filter(w => w.is_highlighted).length;
                            if (highlightedCount >= 20) {
                              alert("Chỉ được ghim tối đa 20 lời chúc! Vui lòng bỏ ghim lời chúc khác trước.");
                              return;
                            }
                          }
                          const { error } = await supabase.from('wishes').update({ is_highlighted: !isCurrentlyHighlighted }).eq('id', wish.id);
                          if (!error) {
                            setWishes(wishes.map(w => w.id === wish.id ? { ...w, is_highlighted: !isCurrentlyHighlighted } : w));
                          } else {
                            alert("Có lỗi khi ghim! Đảm bảo bạn đã thêm cột is_highlighted trong db.");
                          }
                        }} 
                        style={{ padding: '8px 16px', background: wish.is_highlighted ? '#6c757d' : '#8e44ad', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: '500' }}
                      >
                        {wish.is_highlighted ? 'Bỏ Ghim' : 'Ghim nổi bật'}
                      </button>
                    </>
                  )}
                  <button onClick={() => handleDelete(wish.id)} style={{ padding: '8px 16px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: '500' }}>
                    Xóa
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {wishes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999', background: 'white', borderRadius: 12 }}>
            Chưa có lời chúc nào.
          </div>
        )}
      </div>
    </div>
  );
}
