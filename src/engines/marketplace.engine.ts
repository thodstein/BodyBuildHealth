import { MarketplaceItem, PurchaseOption } from '../core/types';

export function getBestPrice(options: PurchaseOption[], currency='RUB'): PurchaseOption | null {
  const valid = options.filter(o => o.currency === currency);
  return valid.length ? valid.reduce((best, curr) => curr.price < best.price ? curr : best, valid[0]) : null;
}

export function generateAffiliateLink(option: PurchaseOption, partnerId='health-engine'): string {
  try {
    const url = new URL(option.url);
    url.searchParams.set('ref', partnerId);
    url.searchParams.set('offer_id', option.offerId || 'default');
    return url.toString();
  } catch { return option.url; }
}

export function formatCart(cart: {item: MarketplaceItem, option: PurchaseOption}[]): { total: number; currency: string; items: {name:string; price:number; link:string}[] } {
  if(!cart.length) return { total:0, currency:'RUB', items:[] };
  const currency = cart[0].option.currency;
  const total = cart.reduce((s,c) => s + c.option.price, 0);
  const items = cart.map(c => ({ name:c.item.name, price:c.option.price, link:generateAffiliateLink(c.option) }));
  return { total: Math.round(total), currency, items };
}

export function MOCK_MARKETPLACE_DB: MarketplaceItem[] = [
  { id:'telmi', name:'Телмисартан 40 мг', category:'pharma', dailyDose:'1×40 мг утро', mechanisms:['cardio_2','cardio_3','renal_1'], synergy:'+Небилет: АД/ЧСС контроль',
    purchaseOptions:[{platform:'ozon',url:'https://ozon.ru/tel',price:520,currency:'RUB',deliveryDays:1},{platform:'apteka',url:'https://apteka.ru/tel',price:490,currency:'RUB',deliveryDays:2}] },
  { id:'nac', name:'NAC 600 мг', category:'supplement', dailyDose:'2×600 мг с едой', mechanisms:['hepatic_3','hepatic_2'], synergy:'+TUDCA: гепатопротекция',
    purchaseOptions:[{platform:'iherb',url:'https://iherb.com/nac',price:1150,currency:'RUB',deliveryDays:7},{platform:'usmall',url:'https://usmall.ru/nac',price:1290,currency:'RUB',deliveryDays:10}] },
  { id:'magnesium', name:'Магний бисглицинат 400 мг', category:'supplement', dailyDose:'400 мг вечер', mechanisms:['neuro_2','neuro_3'], synergy:'+L-теанин: сон/стресс',
    purchaseOptions:[{platform:'ozon',url:'https://ozon.ru/mg',price:980,currency:'RUB',deliveryDays:2},{platform:'iherb',url:'https://iherb.com/mg',price:1100,currency:'RUB',deliveryDays:6}] }
];