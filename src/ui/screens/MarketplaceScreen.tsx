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

  return (
    <div className="screen marketplace" style={{ paddingBottom: 80 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>🛍️ Магазин</h2>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button onClick={() => setShopTab('catalog')} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: shopTab === 'catalog' ? 'var(--accent)' : 'var(--bg-secondary)', color: shopTab === 'catalog' ? '#000' : 'var(--text-dim)', border: `1px solid ${shopTab === 'catalog' ? 'var(--accent)' : 'var(--border)'}` }}>📋 Каталог</button>
        <button onClick={() => setShopTab('cart')} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: shopTab === 'cart' ? 'var(--accent)' : 'var(--bg-secondary)', color: shopTab === 'cart' ? '#000' : 'var(--text-dim)', border: `1px solid ${shopTab === 'cart' ? 'var(--accent)' : 'var(--border)'}` }}>🛒 Корзина ({cart.length})</button>
      </div>

      {shopTab === 'catalog' && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
            {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(key => (
              <button key={key} onClick={() => setFilter(key)} style={{ padding: '4px 12px', borderRadius: 16, fontSize: 9, cursor: 'pointer', background: filter === key ? 'var(--accent)' : 'var(--bg-secondary)', color: filter === key ? '#000' : 'var(--text-dim)', border: `1px solid ${filter === key ? 'var(--accent)' : 'var(--border)'}`, fontWeight: 600 }}>{CATEGORY_LABELS[key]}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', padding: '4px 0' }}>Сортировка:</span>
            {([['price', 'Цена'], ['category', 'Категория'], ['name', 'Название']] as [SortMode, string][]).map(([mode, label]) => (
              <button key={mode} onClick={() => setSort(mode)} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 8, cursor: 'pointer', background: sort === mode ? 'var(--accent)' : 'var(--bg-secondary)', color: sort === mode ? '#000' : 'var(--text-dim)', border: `1px solid ${sort === mode ? 'var(--accent)' : 'var(--border)'}` }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(item => {
              const best = getBestPrice(item.purchaseOptions);
              const isExpanded = expandedId === item.id;
              return (
                <div key={item.id} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 12, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-light)' }}>{item.name}</div>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 8, fontWeight: 600, background: item.category === 'pharma' ? 'rgba(239,68,68,0.15)' : item.category === 'supplement' ? 'rgba(0,230,138,0.15)' : 'rgba(96,165,250,0.15)', color: item.category === 'pharma' ? '#ef4444' : item.category === 'supplement' ? '#00e68a' : '#60a5fa' }}>{CATEGORY_LABELS[item.category as CategoryFilter]}</span>
                  </div>
                  {item.dailyDose && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>💊 {item.dailyDose}</div>}
                  {item.mechanisms && item.mechanisms.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                      {item.mechanisms.map(m => (
                        <span key={m} style={{ fontSize: 8, padding: '1px 6px', borderRadius: 8, background: getMechanismColor(m) + '22', color: getMechanismColor(m), fontWeight: 500 }}>{getMechanismLabel(m)}</span>
                      ))}
                    </div>
                  )}
                  {item.synergy && <div style={{ fontSize: 9, color: '#8b5cf6', marginTop: 3 }}>⚡ {item.synergy}</div>}
                  {isExpanded && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      {item.purchaseOptions.map((opt, idx) => {
                        const isBest = best && opt.platform === best.platform && opt.price === best.price;
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 9 }}>
                            <span><strong>{opt.platform}</strong> — {opt.price} {opt.currency}</span>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {isBest && <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 8 }}>✓ Лучшая</span>}
                              <a href={generateAffiliateLink(opt)} target="_blank" rel="noopener noreferrer" style={{ padding: '3px 10px', borderRadius: 6, background: 'var(--accent)', color: '#000', fontSize: 8, fontWeight: 700, textDecoration: 'none' }}>Купить</a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 4 }}>Доставка от {best?.deliveryDays ?? '?'} дн.</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {shopTab === 'cart' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{cart.length} позиций</span>
            {cart.length > 0 && <button onClick={() => updateCart([])} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>🗑 Очистить</button>}
          </div>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 11 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
              <div>Корзина пуста</div>
              <div style={{ fontSize: 9, marginTop: 4 }}>Добавьте препараты из плана поддержки или из каталога магазина</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)' }}>{item.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>{item.dose ? `${item.dose >= 1000 ? `${(item.dose/1000).toFixed(0)}г` : `${item.dose}мг`}` : ''}{item.timing ? ` · ${item.timing}` : ''}</div>
                  </div>
                  <button onClick={() => removeFromCart(idx)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
