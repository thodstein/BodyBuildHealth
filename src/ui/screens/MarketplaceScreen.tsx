import React, { useEffect, useState, useMemo } from 'react';
import { MOCK_MARKETPLACE_DB, getBestPrice, generateAffiliateLink } from '../../engines/marketplace.engine';
import type { MarketplaceItem, PurchaseOption } from '../../core/types';

type CategoryFilter = 'all' | 'pharma' | 'supplement' | 'vitamin';
type SortMode = 'price' | 'category' | 'name';
type ShopTab = 'catalog' | 'cart';

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'Все', pharma: 'Фарма', supplement: 'Добавки', vitamin: 'Витамины'
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
    return <div className="screen marketplace">Загрузка Маркетплейс...</div>;
  }

  const appleShop = {
    bg: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', cardRadius: 14,
    accent: '#00e68a', accentDim: 'rgba(0,230,138,0.15)', accentBorder: '1px solid rgba(0,230,138,0.3)',
    textPrimary: 'rgba(255,255,255,0.95)', textSecondary: 'rgba(255,255,255,0.9)', textDim: 'rgba(255,255,255,0.85)',
    gradientGreen: 'linear-gradient(135deg, #00e68a, #00b864)',
    gradientRed: 'linear-gradient(135deg, #ef4444, #dc2626)',
  };

  return (
    <div className="screen marketplace" style={{ paddingBottom: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 12px 4px' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: appleShop.textPrimary }}>🛍️ Магазин</h2>
      </div>

      {/* Tab pills */}
      <div style={{ padding: '8px 12px', display:'flex', gap:6 }}>
        <button onClick={() => setShopTab('catalog')} style={{
          flex:1, padding:'10px', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer',
          background: shopTab === 'catalog' ? appleShop.accentDim : appleShop.bg,
          border: shopTab === 'catalog' ? appleShop.accentBorder : appleShop.border,
          color: shopTab === 'catalog' ? appleShop.accent : appleShop.textSecondary,
        }}>📋 Каталог</button>
        <button onClick={() => setShopTab('cart')} style={{
          flex:1, padding:'10px', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer',
          background: shopTab === 'cart' ? appleShop.accentDim : appleShop.bg,
          border: shopTab === 'cart' ? appleShop.accentBorder : appleShop.border,
          color: shopTab === 'cart' ? appleShop.accent : appleShop.textSecondary,
        }}>🛒 Корзина {cart.length > 0 && <span style={{ marginLeft:4, padding:'2px 6px', borderRadius:8, background:appleShop.accent, color:'#000', fontSize:9 }}>{cart.length}</span>}</button>
      </div>

      {shopTab === 'catalog' && (
        <div style={{ padding:'0 12px 70px', overflowY:'auto' }}>
          {/* Filters */}
          <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
            {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(key => (
              <button key={key} onClick={() => setFilter(key)} style={{
                padding:'5px 12px', borderRadius:16, fontSize:9, cursor:'pointer', fontWeight:600,
                background: filter === key ? appleShop.accentDim : appleShop.bg,
                border: filter === key ? appleShop.accentBorder : appleShop.border,
                color: filter === key ? appleShop.accent : appleShop.textDim,
              }}>{CATEGORY_LABELS[key]}</button>
            ))}
          </div>
          {/* Sort + count */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:9, color: appleShop.textDim }}>Найдено: {filtered.length}</span>
            <div style={{ display:'flex', gap:4 }}>
              {([['price','Цена'],['category','Категория'],['name','Название']] as [SortMode,string][]).map(([mode,label]) => (
                <button key={mode} onClick={() => setSort(mode)} style={{
                  padding:'3px 10px', borderRadius:12, fontSize:8, cursor:'pointer', fontWeight:600,
                  background: sort === mode ? appleShop.accentDim : 'transparent',
                  border: sort === mode ? appleShop.accentBorder : appleShop.border,
                  color: sort === mode ? appleShop.accent : appleShop.textDim,
                }}>{label}</button>
              ))}
            </div>
          </div>
          {/* Product list */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(item => {
              const best = getBestPrice(item.purchaseOptions);
              const isExpanded = expandedId === item.id;
              const inCart = cart.some((c: any) => c.id === item.id);
              return (
                <div key={item.id} style={{
                  background: appleShop.bg, borderRadius: appleShop.cardRadius, padding:12,
                  border: isExpanded ? appleShop.accentBorder : appleShop.border,
                }}>
                  <div onClick={() => setExpandedId(isExpanded ? null : item.id)} style={{ cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color: appleShop.textPrimary }}>{item.name}</div>
                        <div style={{ display:'flex', gap:4, marginTop:3, flexWrap:'wrap' }}>
                          <span style={{ padding:'2px 8px', borderRadius:10, fontSize:8, fontWeight:600,
                            background: item.category === 'pharma' ? 'rgba(239,68,68,0.15)' : item.category === 'supplement' ? 'rgba(0,230,138,0.15)' : 'rgba(96,165,250,0.15)',
                            color: item.category === 'pharma' ? '#ef4444' : item.category === 'supplement' ? '#00e68a' : '#60a5fa',
                          }}>{CATEGORY_LABELS[item.category as CategoryFilter]}</span>
                          {best && <span style={{ fontSize:8, color: appleShop.textDim, padding:'2px 0' }}>от {best.price} {best.currency}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize:9, color: appleShop.textDim, transform: isExpanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                    </div>
                    {item.dailyDose && <div style={{ fontSize:9, color: appleShop.textDim, marginTop:4 }}>💊 {item.dailyDose}</div>}
                    {item.mechanisms && item.mechanisms.length > 0 && (
                      <div style={{ display:'flex', gap:3, marginTop:4, flexWrap:'wrap' }}>
                        {item.mechanisms.map(m => (
                          <span key={m} style={{ fontSize:8, padding:'1px 6px', borderRadius:8, background: getMechanismColor(m)+'22', color: getMechanismColor(m), fontWeight:500 }}>{getMechanismLabel(m)}</span>
                        ))}
                      </div>
                    )}
                    {item.synergy && <div style={{ fontSize:9, color:'#8b5cf6', marginTop:3 }}>⚡ {item.synergy}</div>}
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop:8, paddingTop:8, borderTop: appleShop.border }}>
                      {item.purchaseOptions.map((opt, idx) => {
                        const isBest = best && opt.platform === best.platform && opt.price === best.price;
                        return (
                          <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', fontSize:9, borderBottom: idx < item.purchaseOptions.length - 1 ? appleShop.border : 'none' }}>
                            <div>
                              <span style={{ fontWeight:600, color: appleShop.textPrimary }}>{opt.platform}</span>
                              <span style={{ color: appleShop.textDim, marginLeft:4 }}>{opt.price} {opt.currency}</span>
                              {isBest && <span style={{ marginLeft:4, padding:'1px 5px', borderRadius:4, background: appleShop.accentDim, color: appleShop.accent, fontSize:7, fontWeight:700 }}>✓ Лучшая</span>}
                            </div>
                            <a href={generateAffiliateLink(opt)} target="_blank" rel="noopener noreferrer" style={{
                              padding:'4px 12px', borderRadius:8, background: appleShop.accent,
                              color:'#000', fontSize:8, fontWeight:700, textDecoration:'none',
                            }}>Купить</a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Add to cart button */}
                  <div style={{ marginTop:6 }}>
                    <button onClick={e => { e.stopPropagation(); if (inCart) { const c = cart.filter((c: any) => c.id !== item.id); updateCart(c); } else { updateCart([...cart, { id: item.id, name: item.name, dose: item.dailyDose, timing: '' }]); } }} style={{
                      width:'100%', padding:'8px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer',
                      background: inCart ? 'rgba(239,68,68,0.08)' : appleShop.accentDim,
                      border: inCart ? '1px solid rgba(239,68,68,0.3)' : appleShop.accentBorder,
                      color: inCart ? '#ef4444' : appleShop.accent,
                    }}>{inCart ? '✕ Убрать из корзины' : '+ В корзину'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {shopTab === 'cart' && (
        <div style={{ padding:'0 12px 70px' }}>
          {/* Cart header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:11, color: appleShop.textDim }}>{cart.length} позиций</span>
            {cart.length > 0 && (
              <button onClick={() => updateCart([])} style={{
                padding:'6px 12px', borderRadius:10, fontSize:9, cursor:'pointer', fontWeight:600,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
              }}>🗑 Очистить корзину</button>
            )}
          </div>
          {cart.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🛒</div>
              <div style={{ fontSize:14, fontWeight:700, color: appleShop.textPrimary, marginBottom:4 }}>Корзина пуста</div>
              <div style={{ fontSize:10, color: appleShop.textDim, lineHeight:1.5 }}>
                Добавьте препараты из каталога магазина<br/>или из плана поддержки
              </div>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {cart.map((item: any, idx: number) => (
                  <div key={idx} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                    background: appleShop.bg, borderRadius: appleShop.cardRadius,
                    border: appleShop.border,
                  }}>
                    <div style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background: appleShop.accentDim, fontSize:16 }}>💊</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color: appleShop.textPrimary }}>{item.name}</div>
                      <div style={{ fontSize:9, color: appleShop.textDim }}>{item.dose || '—'}{item.timing ? ` · ${item.timing}` : ''}</div>
                    </div>
                    <button onClick={() => removeFromCart(idx)} style={{
                      padding:'6px 10px', borderRadius:8, fontSize:9, cursor:'pointer',
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontWeight:600,
                    }}>✕ Удалить</button>
                  </div>
                ))}
              </div>
              {/* Cart total */}
              <div style={{ marginTop:12, padding:12, background: appleShop.bg, borderRadius: appleShop.cardRadius, border: appleShop.accentBorder }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:10, color: appleShop.textDim }}>Всего препаратов</span>
                  <span style={{ fontSize:14, fontWeight:700, color: appleShop.accent }}>{cart.length}</span>
                </div>
                <div style={{ display:'flex', gap:6, marginTop:8 }}>
                  <button onClick={() => {
                    const itemsStr = cart.map((c: any) => `• ${c.name}${c.dose ? ` (${c.dose})` : ''}`).join('\n');
                    const tg = (window as any).Telegram?.WebApp;
                    const text = `📋 Мой список покупок:\n${itemsStr}`;
                    if (tg?.openTelegramLink) tg.openTelegramLink(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`);
                    else { navigator.clipboard.writeText(text); alert('Список скопирован в буфер'); }
                  }} style={{
                    flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:10,
                    background: appleShop.accent, color:'#000',
                  }}>📤 Поделиться списком</button>
                  <button onClick={() => updateCart([])} style={{
                    padding:'10px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:10,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
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
