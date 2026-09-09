/**
 * UserPersonalSection — секция "Основное" вкладки Пользователь.
 * Личные данные + антропометрия + контакты.
 * Использует PopupValueEditor для ввода значений через попап.
 */
import React from 'react';
import { useProfileSection } from '../../../../core/profile-manager';
import { useSectionState } from '../hooks/useSectionState';
import { AccordionSection, FieldRow, PopupValueEditor, colors } from '../ui';
import { NativeIcon } from '../../../native/NativeIcons';

const BLOOD_TYPES: { id: string; label: string }[] = [
  { id: 'I+', label: 'I (резус +)' }, { id: 'I-', label: 'I (резус −)' },
  { id: 'II+', label: 'II (резус +)' }, { id: 'II-', label: 'II (резус −)' },
  { id: 'III+', label: 'III (резус +)' }, { id: 'III-', label: 'III (резус −)' },
  { id: 'IV+', label: 'IV (резус +)' }, { id: 'IV-', label: 'IV (резус −)' },
];
const SEX_OPTIONS = [
  { id: 'male', label: '♂ Мужской' },
  { id: 'female', label: '♀ Женский' },
];

export const UserPersonalSection: React.FC = React.memo(function UserPersonalSection() {
  const [personal, updatePersonal] = useSectionState('personal');
  const [system, setSystem] = useProfileSection('system');

  const filled = [
    personal.age, personal.sex, personal.height, personal.weight, personal.bodyFat,
  ].filter(v => v !== undefined && v !== null && v !== 0).length;

  return (
    <AccordionSection
      id="profile-section-1-1"
      title="1.1 Основное"
      subtitle="Личные данные, антропометрия, контакты"
      icon={<NativeIcon name="user" size={20} />}
      color={colors.primary}
      defaultOpen
      badge={`${filled}/5 заполнено`}
    >
      <FieldRow cols={3}>
        <PopupValueEditor
          label="Возраст"
          value={personal.age}
          unit="лет"
          type="number"
          min={10} max={120}
          onChange={v => updatePersonal({ age: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Пол"
          value={personal.sex}
          type="select"
          options={SEX_OPTIONS}
          onChange={v => updatePersonal({ sex: v as 'male' | 'female' })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Группа крови"
          value={personal.bloodType}
          type="select"
          options={BLOOD_TYPES}
          onChange={v => updatePersonal({ bloodType: v })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Рост"
          value={personal.height}
          unit="см"
          type="number"
          min={100} max={250}
          onChange={v => updatePersonal({ height: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Вес"
          value={personal.weight}
          unit="кг"
          type="number"
          min={30} max={250} step={0.1}
          onChange={v => updatePersonal({ weight: v ?? 0 })}
          placeholder="—"
        />
        <PopupValueEditor
          label="% жира"
          value={personal.bodyFat}
          unit="%"
          type="number"
          min={3} max={60} step={0.1}
          onChange={v => updatePersonal({ bodyFat: v ?? 0 })}
          placeholder="—"
        />
      </FieldRow>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '14px 0' }} />

      <div style={{ borderRadius: 16, padding: 13, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', marginBottom: 3, letterSpacing: '-0.1px' }}>📐 Антропометрия для техники</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 11, lineHeight: 1.45 }}>Размах рук → ширина хвата в жиме, длина бедра → постановка в приседе/тяге. Используется в мастере «Жим — единый инструмент».</div>
      <FieldRow cols={4}>
        <PopupValueEditor
          label="Размах рук"
          value={personal.armSpanCm}
          unit="см"
          type="number"
          min={120} max={230}
          onChange={v => updatePersonal({ armSpanCm: v ?? undefined })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Ширина плеч (биакром.)"
          value={personal.shoulderWidthCm}
          unit="см"
          type="number"
          min={30} max={60}
          onChange={v => updatePersonal({ shoulderWidthCm: v ?? undefined })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Длина бедра"
          value={personal.femurLengthCm}
          unit="см"
          type="number"
          min={30} max={70}
          onChange={v => updatePersonal({ femurLengthCm: v ?? undefined })}
          placeholder="—"
        />
        <PopupValueEditor
          label="Длина торса"
          value={personal.torsoLengthCm}
          unit="см"
          type="number"
          min={30} max={80}
          onChange={v => updatePersonal({ torsoLengthCm: v ?? undefined })}
          placeholder="—"
        />
      </FieldRow>
      <FieldRow cols={3}>
        <PopupValueEditor
          label="Хват жима"
          value={personal.benchGeometryPrefs?.gripWidth ?? 'auto'}
          type="select"
          options={[{id:'auto',label:'Авто (по антропометрии)'},{id:'narrow',label:'Узкий 1.0×'},{id:'medium',label:'Средний 1.3×'},{id:'wide',label:'Широкий 1.5×/81см'}]}
          onChange={v => updatePersonal({ benchGeometryPrefs: { ...(personal.benchGeometryPrefs||{}), gripWidth: v as any }})}
          placeholder="—"
        />
        <PopupValueEditor
          label="Локти жима"
          value={personal.benchGeometryPrefs?.elbowFlare ?? 'auto'}
          type="select"
          options={[{id:'auto',label:'Авто'},{id:'tucked',label:'Прижаты 30-45°'},{id:'moderate',label:'Умеренно 45-60°'},{id:'flared',label:'Разведены 70-80°'}]}
          onChange={v => updatePersonal({ benchGeometryPrefs: { ...(personal.benchGeometryPrefs||{}), elbowFlare: v as any }})}
          placeholder="—"
        />
        <PopupValueEditor
          label="Мост жима"
          value={personal.benchGeometryPrefs?.archLevel ?? 'auto'}
          type="select"
          options={[{id:'auto',label:'Авто'},{id:'flat',label:'Плоская'},{id:'moderate',label:'Средняя'},{id:'high',label:'Высокая арка'}]}
          onChange={v => updatePersonal({ benchGeometryPrefs: { ...(personal.benchGeometryPrefs||{}), archLevel: v as any }})}
          placeholder="—"
        />
      </FieldRow>
      {typeof personal.armSpanCm === 'number' && typeof personal.height === 'number' && personal.height>0 && (
        <div style={{ marginTop:10, padding:'10px 12px', borderRadius:12, background:'rgba(167,139,250,0.10)', border:'1px solid rgba(167,139,250,0.25)', fontSize:11.5, color:'#c4b5fd', lineHeight:1.45 }}>
          {personal.armSpanCm - personal.height > 5 ? `🦴 Длинные руки +${Math.round(personal.armSpanCm-personal.height)} см → рекомендуем узкий хват (1.0×) + прижатые локти` : personal.armSpanCm - personal.height < -5 ? `🦴 Короткие руки ${Math.round(personal.armSpanCm-personal.height)} см → шире хват + разведённые локти` : '🦴 Пропорциональное сложение — баланс 45–60°'}
        </div>
      )}
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '14px 0' }} />

      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', marginBottom: 10, letterSpacing: '-0.1px' }}>📇 Контакты</div>
      <FieldRow cols={3}>
        <PopupValueEditor
          label="Электронная почта"
          value={system.email}
          type="text"
          onChange={v => setSystem({ email: v })}
          placeholder="example@mail.com"
        />
        <PopupValueEditor
          label="Экстренный контакт (имя)"
          value={personal.emergencyName}
          type="text"
          onChange={v => updatePersonal({ emergencyName: v })}
          placeholder="Имя"
        />
        <PopupValueEditor
          label="Экстренный контакт (телефон)"
          value={personal.emergencyPhone}
          type="text"
          onChange={v => updatePersonal({ emergencyPhone: v })}
          placeholder="+7..."
        />
      </FieldRow>

      {personal.weight && personal.height && personal.weight > 0 && personal.height > 0 && (
        <div style={{
          marginTop: 14, padding: 15, borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(52,211,153,0.14), rgba(34,197,94,0.05))',
          border: '1px solid rgba(52,211,153,0.25)',
          boxShadow: '0 8px 24px rgba(52,211,153,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          <div style={{
            fontSize: 12.5, fontWeight: 800, color: '#fff', marginBottom: 10, letterSpacing: '-0.1px',
          }}>📊 Композиция тела</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ flex:'1 1 90px', textAlign:'center', padding:'10px 8px', borderRadius:13, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ display:'block', fontSize:9, fontWeight:800, letterSpacing:'0.8px', color:'rgba(255,255,255,0.55)', marginBottom:3 }}>ИМТ</span>
              <b style={{ color: '#34d399', fontSize: 17, fontVariantNumeric:'tabular-nums' }}>{((personal.weight / Math.pow(personal.height / 100, 2))).toFixed(1)}</b>
            </span>
            {(() => {
              // Тощая масса = LBM — формула Mattila et al. 2001
              const bodyFat = personal.bodyFat ?? 0;
              if (bodyFat <= 0) return null;
              const lbm = personal.weight * (1 - bodyFat / 100);
              const ffmi = lbm / Math.pow(personal.height / 100, 2);
              return (
                <>
                  <span style={{ flex:'1 1 90px', textAlign:'center', padding:'10px 8px', borderRadius:13, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ display:'block', fontSize:9, fontWeight:800, letterSpacing:'0.8px', color:'rgba(255,255,255,0.55)', marginBottom:3 }}>ТОЩАЯ МАССА</span>
                    <b style={{ color: '#34d399', fontSize: 17, fontVariantNumeric:'tabular-nums' }}>{lbm.toFixed(1)} кг</b>
                  </span>
                  <span style={{ flex:'1 1 90px', textAlign:'center', padding:'10px 8px', borderRadius:13, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ display:'block', fontSize:9, fontWeight:800, letterSpacing:'0.8px', color:'rgba(255,255,255,0.55)', marginBottom:3 }}>FFMI</span>
                    <b style={{ color: '#34d399', fontSize: 17, fontVariantNumeric:'tabular-nums' }}>{ffmi.toFixed(1)}</b>
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </AccordionSection>
  );
});
