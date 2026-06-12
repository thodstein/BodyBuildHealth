import React, { useEffect, useState, useMemo } from 'react';
import { MOCK_MARKETPLACE_DB, getBestPrice, generateAffiliateLink } from '../../engines/marketplace.engine';
import type { MarketplaceItem, PurchaseOption } from '../../core/types';

type CategoryFilter = 'all' | 'pharma' | 'supplement' | 'vitamin';
type SortMode = 'price' | 'category' | 'name';

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: '',
  pharma: '',
  supplement: '',
  vitamin: ''
};

const MECHANISM_COLORS: Record<string, string> = {
  cardio: '#e74c3c',
  hepatic: '#f39c12',
  renal: '#3498db',
  neuro: '#9b59b6',
  endocrine: '#2ecc71',
  hematologic: '#e67e22',
  reproductive: '#1abc9c',
  glucose: '#e91e63'
};

function getMechanismColor(mechanism: string): string {
  const prefix = mechanism.split('_')[0];
  return MECHANISM_COLORS[prefix] || '#95a5a6';
}

function getMechanismLabel(mechanism: string): string {
  const [prefix, num] = mechanism.split('_');
  const labels: Record<string, string> = {
    cardio: '',
    hepatic: '',
    renal: '',
    neuro: '',
    endocrine: '',
    hematologic: '',
    reproductive: '',
    glucose: ''
  };
  return `${labels[prefix] || prefix}_${num}`;
}

export const MarketplaceScreen: React.FC = () => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortMode>('category');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(false);
    setItems(MOCK_MARKETPLACE_DB);
  }, []);

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
    <div className="screen marketplace">
      <h2>Маркетплейс</h2>

      <div className="marketplace-controls">
        <div className="filter-tabs">
          {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(key => (
            <button
              key={key}
              className={`filter-tab ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="sort-controls">
          <span>Сортировка:</span>
          {([['price', ''], ['category', ''], ['name', '']] as [SortMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              className={`sort-btn ${sort === mode ? 'active' : ''}`}
              onClick={() => setSort(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="marketplace-grid">
        {filtered.map(item => {
          const best = getBestPrice(item.purchaseOptions);
          const isExpanded = expandedId === item.id;
          return (
            <div key={item.id} className="marketplace-card">
              <div className="card-header" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                <h3>{item.name}</h3>
                <span className={`category-badge ${item.category}`}>
                  {CATEGORY_LABELS[item.category as CategoryFilter] || item.category}
                </span>
              </div>

              {item.dailyDose && <p className="dose">Суточная доза: {item.dailyDose}</p>}

              {item.mechanisms && item.mechanisms.length > 0 && (
                <div className="mechanism-tags">
                  {item.mechanisms.map(m => (
                    <span
                      key={m}
                      className="mechanism-tag"
                      style={{ backgroundColor: getMechanismColor(m) }}
                    >
                      {getMechanismLabel(m)}
                    </span>
                  ))}
                </div>
              )}

              {item.synergy && <p className="synergy">⚡ {item.synergy}</p>}

              <div className="purchase-options">
                <h4>Варианты покупки:</h4>
                <ul>
                  {item.purchaseOptions.map((opt, idx) => {
                    const isBest = best && opt.platform === best.platform && opt.price === best.price;
                    return (
                      <li key={idx} className={isBest ? 'best-option' : ''}>
                        <strong>{opt.platform}:</strong> {opt.price} {opt.currency}, доставка {opt.deliveryDays} дн.
                        {isBest && <span className="best-price-badge">Лучшая цена</span>}
                        <a href={generateAffiliateLink(opt)} target="_blank" rel="noopener noreferrer" className="btn-link">Купить</a>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {best && (
                <div className="best-price">
                  <span className="best-price-value">
                    Лучшая цена: {best.price} {best.currency} ({best.platform})
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};