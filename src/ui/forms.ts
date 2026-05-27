import { db } from '../core/db';

interface FormField {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

export interface FormConfig {
  title: string;
  fields: FormField[];
  store: string;
}

export function renderForm(config: FormConfig, initialData: Record<string, any> = {}, onSubmit?: (data: any) => void): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'card';
  container.innerHTML = `<h3>${config.title}</h3><form id="form-${config.store}"></form>`;
  const form = container.querySelector('form')!;

  config.fields.forEach(f => {
    const wrap = document.createElement('div');
    wrap.style.display = 'block';
    wrap.style.marginBottom = '12px';

    const lbl = document.createElement('label');
    lbl.textContent = f.label;
    lbl.style.display = 'block';
    lbl.style.marginBottom = '4px';
    lbl.style.fontSize = '13px';
    lbl.style.color = '#8e8e93';

    const input = document.createElement('input');
    input.type = f.type === 'select' ? 'text' : f.type;
    input.name = f.key;
    input.value = initialData[f.key] ?? '';
    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.borderRadius = '8px';
    input.style.border = '1px solid #3a3a3c';
    input.style.background = '#252527';
    input.style.color = '#fff';
    if (f.required) input.required = true;

    if (f.type === 'number') {
      if (f.min !== undefined) input.min = f.min.toString();
      if (f.max !== undefined) input.max = f.max.toString();
      input.step = f.step?.toString() || '0.1';
    }

    if (f.type === 'select' && f.options?.length) {
      input.setAttribute('list', `opt-${f.key}`);
      const datalist = document.createElement('datalist');
      datalist.id = `opt-${f.key}`;
      f.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        datalist.appendChild(o);
      });
      form.appendChild(datalist);
    }

    wrap.append(lbl, input);
    form.append(wrap);
  });

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = '💾 Сохранить';
  btn.style.marginTop = '16px';
  form.append(btn);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data: Record<string, any> = {};
    
    config.fields.forEach(f => {
      let v = fd.get(f.key);
      if (f.type === 'number') {
        const numVal = v ? parseFloat(v as string) : 0;
        data[f.key] = numVal;
      } else {
        data[f.key] = v as string;
      }
    });

    try {
      await db.put(config.store as any, { id: config.store, ...data, updatedAt: new Date().toISOString() });
      onSubmit?.(data);
    } catch (err) {
      console.error('Form save error:', err);
      alert('❌ Ошибка сохранения');
    }
  };

  return container;
}