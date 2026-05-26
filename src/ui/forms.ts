import { db } from '../core/db';

interface FormField { key: string; label: string; type: 'number'|'text'|'select'; options?: string[]; min?: number; max?: number; step?: number; required?: boolean; }
export interface FormConfig { title: string; fields: FormField[]; store: string; }

export function renderForm(config: FormConfig, initialData: Record<string, any> = {}, onSubmit: (data:any)=>void): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'card';
  container.innerHTML = `<h3>${config.title}</h3><form id="form-${config.store}"></form>`;
  const form = container.querySelector('form')!;

  config.fields.forEach(f => {
    const wrap = document.createElement('div'); wrap.className = 'row'; wrap.style.display='block'; wrap.style.marginBottom='12px';
    const lbl = document.createElement('label'); lbl.className = 'label'; lbl.textContent = f.label; lbl.style.display='block'; lbl.style.marginBottom='4px';
    const input = document.createElement('input');
    input.type = f.type==='select' ? 'text' : f.type;
    if(f.type==='number') { input.min=f.min?.toString(); input.max=f.max?.toString(); input.step=f.step?.toString()||'0.1'; }
    input.name = f.key; input.value = initialData[f.key] ?? '';
    input.style.width='100%'; input.style.padding='8px'; input.style.borderRadius='8px'; input.style.border='1px solid #3a3a3c';
    if(f.required) input.required = true;
    wrap.append(lbl, input); form.append(wrap);
  });

  const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '💾 Сохранить';
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data: Record<string, any> = {};
    config.fields.forEach(f => {
      let v = fd.get(f.key);
      if(f.type==='number') v = v ? parseFloat(v as string) : 0;
      data[f.key] = v;
    });
    await db.put(config.store as any, { id: config.store, ...data, updatedAt: new Date().toISOString() });
    onSubmit(data);
  };
  form.append(btn);
  return container;
}