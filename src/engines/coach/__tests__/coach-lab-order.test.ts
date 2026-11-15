/**
 * coach-lab-order.test.ts — назначение анализов подопечному.
 *
 * Проверяем обещания:
 *  • назначение требует атлета и хотя бы один маркер;
 *  • открытые идут первыми и по сроку, закрытые — в конце;
 *  • результат закрывает назначение только когда сданы ВСЕ маркеры;
 *  • срок в прошлом даёт «просрочено», а не «ждём»;
 *  • мусор в хранилище не ломает список.
 */
import { describe, expect, it } from 'vitest';
import {
  COACH_LAB_ORDERS_MAX,
  addCoachLabOrder,
  autoCloseLabOrdersFromImport,
  coachLabOrderErrorText,
  countOpenLabOrders,
  emptyCoachLabOrders,
  labOrderState,
  listCoachLabOrders,
  parseCoachLabOrders,
  pendingLabMarkerCodes,
  removeCoachLabOrder,
  serializeCoachLabOrders,
  toggleCoachLabOrderDone,
  updateCoachLabOrder,
} from '../coach-lab-order.engine';

const NOW = '2026-11-15T10:00:00.000Z';

const markers = (...codes: string[]) => codes.map(code => ({ code, name: code }));

function withOrder(codes: string[] = ['ALT'], dueDate = '') {
  return addCoachLabOrder(
    emptyCoachLabOrders(),
    { athleteId: 'a1', markers: markers(...codes), dueDate },
    { now: NOW, id: 'l1' },
  ).store;
}

describe('создание назначения анализов', () => {
  it('без атлета или маркеров не создаётся', () => {
    const noAthlete = addCoachLabOrder(emptyCoachLabOrders(), { athleteId: '', markers: markers('ALT') });
    expect(noAthlete.error).toBe('athlete');
    expect(noAthlete.order).toBeNull();

    const noMarkers = addCoachLabOrder(emptyCoachLabOrders(), { athleteId: 'a1', markers: [] });
    expect(noMarkers.error).toBe('markers');
  });

  it('маркеры чистятся: дубли, регистр кода и пустые имена', () => {
    const res = addCoachLabOrder(
      emptyCoachLabOrders(),
      {
        athleteId: 'a1',
        markers: [
          { code: 'alt', name: 'АЛТ' },
          { code: 'ALT', name: 'дубль' },
          { code: '  ', name: 'пусто' },
          { code: 'ferritin', name: '' },
        ],
      },
      { now: NOW },
    );
    expect(res.error).toBeNull();
    expect(res.order?.markers).toEqual([
      { code: 'ALT', name: 'АЛТ' },
      { code: 'FERRITIN', name: 'FERRITIN' },
    ]);
  });

  it('некорректный срок превращается в «без срока», а не в мусор', () => {
    const res = addCoachLabOrder(
      emptyCoachLabOrders(),
      { athleteId: 'a1', markers: markers('ALT'), dueDate: '15.12.2026' },
      { now: NOW },
    );
    expect(res.order?.dueDate).toBe('');
  });

  it('потолок назначений — технический, с понятным сообщением', () => {
    let store = emptyCoachLabOrders();
    for (let i = 0; i < COACH_LAB_ORDERS_MAX; i++) {
      store = addCoachLabOrder(
        store,
        { athleteId: 'a1', markers: markers('ALT') },
        { now: NOW, id: `l${i}` },
      ).store;
    }
    const over = addCoachLabOrder(store, { athleteId: 'a1', markers: markers('ALT') }, { now: NOW });
    expect(over.error).toBe('limit');
    expect(coachLabOrderErrorText('limit')).toContain(String(COACH_LAB_ORDERS_MAX));
  });
});

describe('список назначений', () => {
  it('открытые первыми и по сроку, «без даты» — после них', () => {
    let store = emptyCoachLabOrders();
    store = addCoachLabOrder(store, { athleteId: 'a1', markers: markers('A') }, { now: NOW, id: 'noDate' }).store;
    store = addCoachLabOrder(
      store,
      { athleteId: 'a1', markers: markers('B'), dueDate: '2026-12-01' },
      { now: NOW, id: 'late' },
    ).store;
    store = addCoachLabOrder(
      store,
      { athleteId: 'a1', markers: markers('C'), dueDate: '2026-11-20' },
      { now: NOW, id: 'soon' },
    ).store;
    store = toggleCoachLabOrderDone(store, 'soon', { now: NOW });

    expect(listCoachLabOrders(store, 'a1').map(o => o.id)).toEqual(['late', 'noDate', 'soon']);
  });

  it('назначения разных атлетов не смешиваются', () => {
    let store = addCoachLabOrder(
      emptyCoachLabOrders(),
      { athleteId: 'a1', markers: markers('ALT') },
      { now: NOW, id: 'l1' },
    ).store;
    store = addCoachLabOrder(store, { athleteId: 'a2', markers: markers('TT') }, { now: NOW, id: 'l2' }).store;

    expect(listCoachLabOrders(store, 'a1').map(o => o.id)).toEqual(['l1']);
    expect(listCoachLabOrders(store, 'a2').map(o => o.id)).toEqual(['l2']);
    expect(countOpenLabOrders(store, 'a1')).toBe(1);
  });

  it('ждущие маркеры собираются без повторов и без закрытых', () => {
    let store = addCoachLabOrder(
      emptyCoachLabOrders(),
      { athleteId: 'a1', markers: markers('ALT', 'AST') },
      { now: NOW, id: 'l1' },
    ).store;
    store = addCoachLabOrder(
      store,
      { athleteId: 'a1', markers: markers('ALT') },
      { now: NOW, id: 'l2' },
    ).store;
    store = toggleCoachLabOrderDone(store, 'l2', { now: NOW });

    expect(pendingLabMarkerCodes(store, 'a1').sort()).toEqual(['ALT', 'AST']);
  });
});

describe('состояние и правки', () => {
  it('просроченное назначение отличается от «ждём»', () => {
    const store = withOrder(['ALT'], '2026-11-10');
    const order = listCoachLabOrders(store, 'a1')[0];
    expect(labOrderState(order, '2026-11-15')).toBe('overdue');
    expect(labOrderState(order, '2026-11-01')).toBe('open');
    const done = listCoachLabOrders(toggleCoachLabOrderDone(store, 'l1', { now: NOW }), 'a1')[0];
    expect(labOrderState(done, '2027-01-01')).toBe('done');
  });

  it('«сдано» ставится и снимается', () => {
    const store = withOrder(['ALT']);
    const done = toggleCoachLabOrderDone(store, 'l1', { now: NOW });
    expect(done.items[0].doneAt).toBe(NOW);
    const undone = toggleCoachLabOrderDone(done, 'l1', { now: NOW });
    expect(undone.items[0].doneAt).toBeNull();
  });

  it('правка не оставляет назначение без маркеров', () => {
    const store = withOrder(['ALT']);
    expect(updateCoachLabOrder(store, 'l1', { markers: [] }).error).toBe('markers');
    const updated = updateCoachLabOrder(store, 'l1', { comment: 'натощак', dueDate: '2026-12-05' });
    expect(updated.order?.comment).toBe('натощак');
    expect(updated.order?.dueDate).toBe('2026-12-05');
  });

  it('удаление идемпотентно', () => {
    const store = withOrder(['ALT']);
    const removed = removeCoachLabOrder(store, 'l1');
    expect(removed.items).toHaveLength(0);
    expect(removeCoachLabOrder(removed, 'l1')).toBe(removed);
  });
});

describe('закрытие по импорту результата', () => {
  it('закрывает только когда сданы ВСЕ маркеры назначения', () => {
    const store = withOrder(['ALT', 'AST']);
    const partial = autoCloseLabOrdersFromImport(store, 'a1', ['ALT'], { now: NOW });
    expect(partial).toBe(store);

    const full = autoCloseLabOrdersFromImport(store, 'a1', ['alt', 'AST'], { now: NOW });
    expect(full.items[0].doneAt).toBe(NOW);
  });

  it('чужие коды, чужой атлет и пустой импорт ничего не меняют', () => {
    const store = withOrder(['ALT']);
    expect(autoCloseLabOrdersFromImport(store, 'a1', ['TT'], { now: NOW })).toBe(store);
    expect(autoCloseLabOrdersFromImport(store, 'a2', ['ALT'], { now: NOW })).toBe(store);
    expect(autoCloseLabOrdersFromImport(store, 'a1', [], { now: NOW })).toBe(store);
  });
});

describe('терпимость хранилища', () => {
  it('мусор и битые строки пропускаются, остальное остаётся', () => {
    const good = JSON.stringify(withOrder(['ALT']).items[0]);
    const parsed = parseCoachLabOrders(
      `{"version":1,"items":[${good},null,{"id":"x"},{"id":"l9","athleteId":"a1","markers":[]},42]}`,
    );
    expect(parsed.items.map(o => o.id)).toEqual(['l1']);
  });

  it('не JSON — пустой список, а не падение', () => {
    expect(parseCoachLabOrders('{{{').items).toEqual([]);
    expect(parseCoachLabOrders(null).items).toEqual([]);
  });

  it('круг сериализации сохраняет назначение', () => {
    const store = withOrder(['ALT', 'AST'], '2026-12-01');
    expect(parseCoachLabOrders(serializeCoachLabOrders(store))).toEqual(store);
  });
});
