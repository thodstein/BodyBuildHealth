import React, { useEffect, useState, useMemo } from 'react';
import { MOCK_MARKETPLACE_DB, getBestPrice, generateAffiliateLink } from '../../engines/marketplace.engine';
import type { MarketplaceItem, PurchaseOption } from '../../core/types';

type CategoryFilter = 'all' | 'pharma' | 'supplement' | 'vitamin';
type SortMode = 'price' | 'category' | 'name';
type ShopTab = 'catalog' | 'cart';

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'Все', pharma: 'Фарма', supplement: 'Добавки', vitamin: 'Витамины'
};

const CATEGORY_GRAD: Record<string, string> = {
  pharma: 'linear-gradient(135deg, #ef4444, #dc2626)',
  supplement: 'linear-gradient(135deg, #00e68a, #059669)',
  vitamin: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
  all: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
};

const MECHANISM_COLORS: Record<string, string> = {
  cardio: '#e74c3c', hepatic: '#f39c12', renal: '#3498db',
  neuro: '#9b59b6', endocrine: '#2ecc71', hematologic: '#e67e22',
  reproductive: '#1abc9c', glucose: '#e91e63'
};

function getMechanismColor(mechanism: string): string {
  const prefix = mechanism.split('_')[0];
  return MECHANISM_COLORS[prefix] || '#95a5a6';
}

function getMechanismLabel(mechanism: string): string {
  const labels: Record<string, string> = {
    cardio: 'Сердце', hepatic: 'Печень', renal: 'Почки',
    neuro: 'Нейро', endocrine: 'Эндокринная', hematologic: 'Кровь',
    reproductive: 'Репродуктивная', glucose: 'Глюкоза'
  };
  const prefix = mechanism.split('_')[0];
  return `${labels[prefix] || prefix}`;
}

export const MarketplaceScreen: React.FC = () => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortMode>('category');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shopTab, setShopTab] = useState<ShopTab>('catalog');
  const [cart, setCart] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('supportCart') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    setLoading(false);
    setItems(MOCK_MARKETPLACE_DB);
  }, []);

  const updateCart = (newCart: any[]) => {
    setCart(newCart);
    localStorage.setItem('supportCart', JSON.stringify(newCart));
  };

  const removeFromCart = (idx: number) => {
    const c = [...cart];
    c.splice(idx, 1);
    updateCart(c);
  };

  const filtered = useMemo(() => {
    let list = filter === 'all' ? items : items.filter(i => i.category === filter);
    return list.sort((a, b) => {
      if (sort === 'price') {
        const pa = getBestPrice(a.purchaseOptions)?.price ?? Infinity;
        const pb = getBestPrice(b.purchaseOptions)?.price ?? Infinity;
        return pa - pb;
      }
      if (sort === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [items, filter, sort]);

  if (loading) {
    return <div className="screen marketplace" style={{ padding: 24, color:'#fff', fontFamily: FONT }}>Загрузка Маркетплейс…</div>;
  }

  return (
    <div className="screen marketplace" style={{ paddingBottom: 0, fontFamily: FONT, background:'transparent' }}>
      {/* premium header */}
      <div style={{ padding:'10px 12px 8px', display:'flex', alignItems:'center', gap:10, position:'sticky', top:0, zIndex:2, background:'rgba(10,10,15,0.58)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', margin:'-6px -6px 0', paddingLeft:12, paddingRight:12, borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width:34, height:34, borderRadius:11, background:'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(0,230,138,0.06))', border:'1px solid rgba(0,230,138,0.20)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, boxShadow:'0 4px 16px rgba(0,230,138,0.18)' }}>🛍️</div>
        <div style={{ flex:1, minWidth:0 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', lineHeight:1 }}>Магазин</h2>
          <div style={{ fontSize:10, color:'#fff', fontWeight:600, letterSpacing:'0.02em' }}>{items.length} товаров · лучшие цены · партнёрские ссылки</div>
        </div>
        <span style={{ padding:'5px 10px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', fontSize:10, fontWeight:800, color:'#fff' }}>{filtered.length} найдено</span>
      </div>

      {/* Tab pills — premium */}
      <div style={{ padding:'10px 12px 8px', display:'flex', gap:8 }}>
        <button onClick={() => setShopTab('catalog')} style={{
          flex:1, padding:'11px 12px', borderRadius:12, fontSize:12, fontWeight:800, cursor:'pointer', fontFamily: FONT, letterSpacing:'-0.01em',
          background: shopTab === 'catalog' ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(0,230,138,0.08))' : 'rgba(255,255,255,0.05)',
          border: shopTab === 'catalog' ? '1px solid rgba(0,230,138,0.32)' : '1px solid rgba(255,255,255,0.07)',
          color: shopTab === 'catalog' ? '#00e68a' : '#fff',
          backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
          boxShadow: shopTab === 'catalog' ? '0 6px 18px rgba(0,230,138,0.18), inset 0 1px 0 rgba(255,255,255,0.07)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
          transition:'all 0.18s',
        }}>📋 Каталог</button>
        <button onClick={() => setShopTab('cart')} style={{
          flex:1, padding:'11px 12px', borderRadius:12, fontSize:12, fontWeight:800, cursor:'pointer', fontFamily: FONT, letterSpacing:'-0.01em',
          background: shopTab === 'cart' ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(0,230,138,0.08))' : 'rgba(255,255,255,0.05)',
          border: shopTab === 'cart' ? '1px solid rgba(0,230,138,0.32)' : '1px solid rgba(255,255,255,0.07)',
          color: shopTab === 'cart' ? '#00e68a' : '#fff',
          backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
          boxShadow: shopTab === 'cart' ? '0 6px 18px rgba(0,230,138,0.18), inset 0 1px 0 rgba(255,255,255,0.07)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
          transition:'all 0.18s',
        }}>🛒 Корзина {cart.length > 0 && <span style={{ marginLeft:6, padding:'2px 7px', borderRadius:999, background:'#00e68a', color:'#000', fontSize:10, fontWeight:900, boxShadow:'0 2px 10px rgba(0,230,138,0.32)' }}>{cart.length}</span>}</button>
      </div>

      {shopTab === 'catalog' && (
        <div style={{ padding:'0 12px 84px', overflowY:'auto' }}>
          {/* Filters — premium chips */}
          <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
            {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(key => {
              const active = filter === key;
              const grad = CATEGORY_GRAD[key] || CATEGORY_GRAD.all;
              return (
                <button key={key} onClick={() => setFilter(key)} style={{
                  padding:'7px 13px', borderRadius:999, fontSize:11, cursor:'pointer', fontWeight: active ? 800 : 600, fontFamily: FONT,
                  background: active ? `${grad}` : 'rgba(255,255,255,0.05)',
                  border: active ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.07)',
                  color: '#fff',
                  boxShadow: active ? '0 6px 16px rgba(0,0,0,0.22)' : 'none',
                  backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
                  transition:'all 0.18s',
                }}>{CATEGORY_LABELS[key]}</button>
              );
            })}
          </div>
          {/* Sort + count — glass bar */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, padding:'7px 8px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', backdropFilter:'blur(10px)' }}>
            <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>Найдено <b style={{ color:'#fff' }}>{filtered.length}</b></span>
            <div style={{ display:'flex', gap:5 }}>
              {([['price','Цена'],['category','Категория'],['name','Название']] as [SortMode,string][]).map(([mode,label]) => (
                <button key={mode} onClick={() => setSort(mode)} style={{
                  padding:'5px 10px', borderRadius:999, fontSize:10, cursor:'pointer', fontWeight:700, fontFamily: FONT,
                  background: sort === mode ? 'rgba(0,230,138,0.14)' : 'transparent',
                  border: sort === mode ? '1px solid rgba(0,230,138,0.26)' : '1px solid rgba(255,255,255,0.07)',
                  color: sort === mode ? '#00e68a' : '#fff',
                }}>{label}</button>
              ))}
            </div>
          </div>
          {/* Product list — premium cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(item => {
              const best = getBestPrice(item.purchaseOptions);
              const isExpanded = expandedId === item.id;
              const inCart = cart.some((c: any) => c.id === item.id);
              const catGrad = CATEGORY_GRAD[item.category] || CATEGORY_GRAD.all;
              return (
                <div key={item.id} style={{
                  background:'rgba(255,255,255,0.04)', borderRadius:16, padding:0, overflow:'hidden',
                  border: isExpanded ? '1px solid rgba(0,230,138,0.24)' : '1px solid rgba(255,255,255,0.07)',
                  backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
                  boxShadow: isExpanded ? '0 12px 32px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,230,138,0.10) inset' : '0 8px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
                  transition:'all 0.22s cubic-bezier(0.2,0.9,0.4,1)',
                  position:'relative',
                }}
                onMouseEnter={e=>{ (e.currentTarget as HTMLDivElement).style.transform='translateY(-1px)'; }}
                onMouseLeave={e=>{ (e.currentTarget as HTMLDivElement).style.transform='translateY(0)'; }}
                >
                  <div aria-hidden="true" style={{ position:'absolute', inset:0, background:`radial-gradient(600px 120px at 14% 0%, ${item.category==='pharma'?'rgba(239,68,68,0.10)':item.category==='supplement'?'rgba(0,230,138,0.10)':'rgba(56,189,248,0.10)'}, transparent 62%)`, pointerEvents:'none' }} />
                  <div style={{ height:3, background: catGrad, opacity:0.95 }} />
                  <div onClick={() => setExpandedId(isExpanded ? null : item.id)} style={{ cursor:'pointer', padding:'12px 12px 10px', position:'relative' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13.5, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', lineHeight:1.25, display:'flex', alignItems:'center', gap:7 }}>
                          <span style={{ width:28, height:28, borderRadius:9, background: item.category==='pharma' ? 'rgba(239,68,68,0.14)' : item.category==='supplement' ? 'rgba(0,230,138,0.14)' : 'rgba(56,189,248,0.14)', border:`1px solid ${item.category==='pharma'?'rgba(239,68,68,0.22)':item.category==='supplement'?'rgba(0,230,138,0.22)':'rgba(56,189,248,0.22)'}`, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{
                            item.category==='pharma'?'💊':item.category==='supplement'?'🧪':'💎'
                          }</span>
                          <span style={{ minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</span>
                        </div>
                        <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap', alignItems:'center' }}>
                          <span style={{ padding:'3px 9px', borderRadius:999, fontSize:10, fontWeight:800,
                            background: catGrad, color:'#fff', boxShadow:'0 2px 10px rgba(0,0,0,0.18)', letterSpacing:'0.02em'
                          }}>{CATEGORY_LABELS[item.category as CategoryFilter]}</span>
                          {best && <span style={{ fontSize:11, fontWeight:800, color:'#fff', background:'rgba(0,230,138,0.14)', border:'1px solid rgba(0,230,138,0.22)', padding:'3px 9px', borderRadius:999 }}>от {best.price} {best.currency}</span>}
                        </div>
                      </div>
                      <span style={{ width:28, height:28, borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', transform: isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.22s', flexShrink:0 }}>▼</span>
                    </div>
                    {item.dailyDose && <div style={{ fontSize:11, color:'#fff', marginTop:7, display:'flex', alignItems:'center', gap:6, position:'relative' }}><span style={{ width:6, height:6, borderRadius:'50%', background:'rgba(0,230,138,0.9)', boxShadow:'0 0 8px rgba(0,230,138,0.5)', display:'inline-block' }} /> {item.dailyDose}</div>}
                    {item.mechanisms && item.mechanisms.length > 0 && (
                      <div style={{ display:'flex', gap:5, marginTop:7, flexWrap:'wrap', position:'relative' }}>
                        {item.mechanisms.map(m => (
                          <span key={m} style={{ fontSize:10, padding:'3px 8px', borderRadius:999, background: getMechanismColor(m)+'16', color: getMechanismColor(m), fontWeight:700, border:`1px solid ${getMechanismColor(m)}22`, backdropFilter:'blur(6px)' }}>{getMechanismLabel(m)}</span>
                        ))}
                      </div>
                    )}
                    {item.synergy && <div style={{ fontSize:11, color:'#a78bfa', marginTop:6, background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.14)', padding:'6px 8px', borderRadius:10, display:'flex', gap:6, position:'relative' }}><span>⚡</span> <span style={{ lineHeight:1.35 }}>{item.synergy}</span></div>}
                  </div>
                  {isExpanded && (
                    <div style={{ margin:'0 12px 12px', padding:'10px 10px 8px', borderRadius:12, background:'rgba(0,0,0,0.22)', border:'1px solid rgba(255,255,255,0.06)', position:'relative' }}>
                      <div style={{ fontSize:10, fontWeight:800, color:'#fff', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>Где купить</div>
                      {item.purchaseOptions.map((opt, idx) => {
                        const isBest = best && opt.platform === best.platform && opt.price === best.price;
                        return (
                          <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom: idx < item.purchaseOptions.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                              <span style={{ fontWeight:800, color:'#fff', fontSize:12 }}>{opt.platform}</span>
                              <span style={{ color:'#fff', fontSize:12, fontWeight:700 }}>{opt.price} {opt.currency}</span>
                              {isBest && <span style={{ marginLeft:2, padding:'2px 7px', borderRadius:999, background:'rgba(0,230,138,0.14)', color:'#00e68a', fontSize:9, fontWeight:800, border:'1px solid rgba(0,230,138,0.22)' }}>✓ Лучшая</span>}
                            </div>
                            <a href={generateAffiliateLink(opt)} target="_blank" rel="noopener noreferrer" style={{
                              padding:'6px 13px', borderRadius:999, background:'#00e68a',
                              color:'#000', fontSize:11, fontWeight:800, textDecoration:'none', boxShadow:'0 4px 14px rgba(0,230,138,0.28)',
                            }}>Купить →</a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ padding:'0 12px 12px', position:'relative' }}>
                    <button onClick={e => { e.stopPropagation(); if (inCart) { const c = cart.filter((c: any) => c.id !== item.id); updateCart(c); } else { updateCart([...cart, { id: item.id, name: item.name, dose: item.dailyDose, timing: '' }]); } }} style={{
                      width:'100%', padding:'10px 12px', borderRadius:12, fontSize:12, fontWeight:800, cursor:'pointer', fontFamily: FONT,
                      background: inCart ? 'rgba(239,68,68,0.08)' : 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(0,230,138,0.08))',
                      border: inCart ? '1px solid rgba(239,68,68,0.24)' : '1px solid rgba(0,230,138,0.24)',
                      color: inCart ? '#f87171' : '#00e68a',
                      backdropFilter:'blur(8px)', boxShadow: inCart ? 'none' : '0 4px 16px rgba(0,230,138,0.16)', transition:'all 0.18s',
                    }}>{inCart ? '✕ Убрать из корзины' : '+ В корзину'}</button>
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length===0 && (
            <div style={{ marginTop:14, padding:'30px 16px', borderRadius:16, background:'rgba(255,255,255,0.03)', border:'1px dashed rgba(255,255,255,0.10)', textAlign:'center' }}>
              <div style={{ fontSize:28, marginBottom:6 }}>🔍</div>
              <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Ничего не найдено</div>
              <div style={{ fontSize:11, color:'#fff', marginTop:4 }}>Попробуйте сменить фильтр или сортировку</div>
            </div>
          )}
        </div>
      )}

      {shopTab === 'cart' && (
        <div style={{ padding:'0 12px 84px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'10px 0 10px', padding:'8px 10px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>{cart.length} позиций в корзине</span>
            {cart.length > 0 && (
              <button onClick={() => updateCart([])} style={{
                padding:'7px 12px', borderRadius:999, fontSize:11, cursor:'pointer', fontWeight:700, fontFamily: FONT,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#f87171',
              }}>🗑 Очистить</button>
            )}
          </div>
          {cart.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 20px', borderRadius:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', backdropFilter:'blur(12px)' }}>
              <div style={{ width:64, height:64, borderRadius:18, margin:'0 auto 12px', background:'radial-gradient(120% 120% at 30% 20%, rgba(0,230,138,0.16), transparent 65%)', border:'1px solid rgba(0,230,138,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 12px 32px rgba(0,230,138,0.12)' }}>🛒</div>
              <div style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>Корзина пуста</div>
              <div style={{ fontSize:11, color:'#fff', lineHeight:1.5, marginTop:6 }}>
                Добавьте препараты из каталога<br/>или из плана поддержки — соберём список покупок
              </div>
              <button onClick={()=>setShopTab('catalog')} style={{ marginTop:14, padding:'9px 16px', borderRadius:999, background:'#fff', color:'#000', border:'none', fontWeight:800, fontSize:12, cursor:'pointer', fontFamily: FONT }}>Перейти в каталог →</button>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {cart.map((item: any, idx: number) => (
                  <div key={idx} style={{
                    display:'flex', alignItems:'center', gap:11, padding:'11px 12px',
                    background:'rgba(255,255,255,0.04)', borderRadius:14,
                    border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)',
                    boxShadow:'0 6px 18px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}>
                    <div style={{ width:38, height:38, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(0,230,138,0.06))', border:'1px solid rgba(0,230,138,0.18)', fontSize:17, flexShrink:0 }}>💊</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#fff', letterSpacing:'-0.01em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize:10, color:'#fff', marginTop:2 }}>{item.dose || '—'}{item.timing ? ` · ${item.timing}` : ''}</div>
                    </div>
                    <button onClick={() => removeFromCart(idx)} style={{
                      padding:'7px 11px', borderRadius:999, fontSize:10, cursor:'pointer', fontFamily: FONT, fontWeight:700,
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#f87171',
                    }}>✕ Удалить</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:14, padding:14, background:'rgba(255,255,255,0.04)', borderRadius:16, border:'1px solid rgba(0,230,138,0.18)', backdropFilter:'blur(14px)', boxShadow:'0 10px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontSize:11, color:'#fff', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase' }}>Итого</span>
                  <span style={{ fontSize:18, fontWeight:900, color:'#00e68a', letterSpacing:'-0.03em' }}>{cart.length} <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>шт</span></span>
                </div>
                <div style={{ height:1, background:'rgba(255,255,255,0.06)', marginBottom:12 }} />
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => {
                    const itemsStr = cart.map((c: any) => `• ${c.name}${c.dose ? ` (${c.dose})` : ''}`).join('\n');
                    const tg = (window as any).Telegram?.WebApp;
                    const text = `📋 Мой список покупок:\n${itemsStr}`;
                    if (tg?.openTelegramLink) tg.openTelegramLink(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`);
                    else { navigator.clipboard.writeText(text); alert('Список скопирован в буфер'); }
                  }} style={{
                    flex:1, padding:'11px 12px', borderRadius:12, border:'none', cursor:'pointer', fontWeight:800, fontSize:12, fontFamily: FONT,
                    background:'linear-gradient(135deg, #00e68a, #00c97a)', color:'#000', boxShadow:'0 6px 18px rgba(0,230,138,0.28)',
                  }}>📤 Поделиться списком</button>
                  <button onClick={() => updateCart([])} style={{
                    padding:'11px 14px', borderRadius:12, cursor:'pointer', fontWeight:700, fontSize:12, fontFamily: FONT,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#f87171',
                  }}>🗑</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
