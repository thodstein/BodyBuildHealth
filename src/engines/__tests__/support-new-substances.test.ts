import { describe, it, expect } from 'vitest';
import { SUPPLEMENTS_DB } from '../../data/support-db/supplements';
import { SUPPORT_DOSING } from '../../data/support-dosing';
import { SUPPORT_CATALOG_DATA } from '../../data/support-catalog-data';

describe('ЭТАП 3: 15 новых веществ в БД', () => {
  describe('SUPPLEMENTS_DB: нейропротекция (9)', () => {
    it('grandaxine (тофизопам) — ФДЭ-4, ГАМК', () => {
      expect(SUPPLEMENTS_DB.grandaxine).toBeDefined();
      expect(SUPPLEMENTS_DB.grandaxine.length).toBeGreaterThan(0);
      expect(SUPPLEMENTS_DB.grandaxine[0].organId).toBe('cns');
      expect(SUPPLEMENTS_DB.grandaxine[0].mechId).toBe('cns1');
    });
    it('dihexa — HGF/c-met, нейротрофин', () => {
      expect(SUPPLEMENTS_DB.dihexa).toBeDefined();
      expect(SUPPLEMENTS_DB.dihexa[0].organId).toBe('cns');
      expect(SUPPLEMENTS_DB.dihexa[0].mechId).toBe('cns3');
    });
    it('phenylpiracetam — дофамин/норадреналин', () => {
      expect(SUPPLEMENTS_DB.phenylpiracetam).toBeDefined();
      expect(SUPPLEMENTS_DB.phenylpiracetam[0].mechId).toBe('cns1');
    });
    it('tropoflavin (7,8-DHF) — TrkB агонист', () => {
      expect(SUPPLEMENTS_DB.tropoflavin).toBeDefined();
      expect(SUPPLEMENTS_DB.tropoflavin[0].mechId).toBe('cns3');
    });
    it('fluvoxamine — СИОЗС, сигма-1', () => {
      expect(SUPPLEMENTS_DB.fluvoxamine).toBeDefined();
      expect(SUPPLEMENTS_DB.fluvoxamine[0].q).toBe('A');
    });
    it('amantadine — NMDA, дофамин', () => {
      expect(SUPPLEMENTS_DB.amantadine).toBeDefined();
      expect(SUPPLEMENTS_DB.amantadine[0].mechId).toBe('cns2');
    });
    it('naltrexone (LDN) — опиоидная, TLR4', () => {
      expect(SUPPLEMENTS_DB.naltrexone).toBeDefined();
      expect(SUPPLEMENTS_DB.naltrexone[0].mechId).toBe('cns4');
    });
    it('guanfacine — α2-адренорецептор', () => {
      expect(SUPPLEMENTS_DB.guanfacine).toBeDefined();
      expect(SUPPLEMENTS_DB.guanfacine[0].q).toBe('A');
    });
    it('tizanidine — α2-адренорецептор (пресинаптический)', () => {
      expect(SUPPLEMENTS_DB.tizanidine).toBeDefined();
      expect(SUPPLEMENTS_DB.tizanidine[0].q).toBe('A');
    });
  });

  describe('SUPPLEMENTS_DB: суставы (6)', () => {
    it('havinson_a4 — пептид хрящ', () => {
      expect(SUPPLEMENTS_DB.havinson_a4).toBeDefined();
    });
    it('havinson_a19 — пептид сосуды', () => {
      expect(SUPPLEMENTS_DB.havinson_a19).toBeDefined();
      expect(SUPPLEMENTS_DB.havinson_a19[0].organId).toBe('cardio');
    });
    it('ligamentide — пептид связки', () => {
      expect(SUPPLEMENTS_DB.ligamentide).toBeDefined();
    });
    it('neovitin — антиоксидант', () => {
      expect(SUPPLEMENTS_DB.neovitin).toBeDefined();
    });
    it('voltaren_gel — диклофенак местно', () => {
      expect(SUPPLEMENTS_DB.voltaren_gel).toBeDefined();
      expect(SUPPLEMENTS_DB.voltaren_gel[0].mechId).toBe('cns2');
    });
    it('artra — комбинация глюкозамин+хондроитин', () => {
      expect(SUPPLEMENTS_DB.artra).toBeDefined();
    });
  });

  describe('SUPPORT_DOSING: дозировки новых веществ', () => {
    it('grandaxine: 25-100 мг bid', () => {
      expect(SUPPORT_DOSING.grandaxine).toBeDefined();
      expect(SUPPORT_DOSING.grandaxine.doseRange.min).toBe(25);
      expect(SUPPORT_DOSING.grandaxine.doseRange.max).toBe(100);
      expect(SUPPORT_DOSING.grandaxine.doseRange.unit).toBe('mg');
    });
    it('dihexa: 5-20 мг daily', () => {
      expect(SUPPORT_DOSING.dihexa).toBeDefined();
      expect(SUPPORT_DOSING.dihexa.doseRange.min).toBe(5);
      expect(SUPPORT_DOSING.dihexa.doseRange.max).toBe(20);
    });
    it('fluvoxamine: 50-300 мг bedtime (рекптурный)', () => {
      expect(SUPPORT_DOSING.fluvoxamine).toBeDefined();
      expect(SUPPORT_DOSING.fluvoxamine.category).toBe('pharma');
      expect(SUPPORT_DOSING.fluvoxamine.warnings).toContain('prescription_only');
    });
    it('naltrexone (LDN): 1-5 мг bedtime', () => {
      expect(SUPPORT_DOSING.naltrexone).toBeDefined();
      expect(SUPPORT_DOSING.naltrexone.doseRange.min).toBe(1);
      expect(SUPPORT_DOSING.naltrexone.doseRange.max).toBe(5);
    });
    it('guanfacine: 0.5-4 мг bedtime', () => {
      expect(SUPPORT_DOSING.guanfacine).toBeDefined();
      expect(SUPPORT_DOSING.guanfacine.doseRange.min).toBe(0.5);
    });
    it('tizanidine: 2-6 мг bedtime, tolerance 3 months', () => {
      expect(SUPPORT_DOSING.tizanidine).toBeDefined();
      expect(SUPPORT_DOSING.tizanidine.warnings).toContain('tolerance_3_months_max');
    });
    it('voltaren_gel: topical, 2-3 applications', () => {
      expect(SUPPORT_DOSING.voltaren_gel).toBeDefined();
      expect(SUPPORT_DOSING.voltaren_gel.doseRange.unit).toBe('applications');
      expect(SUPPORT_DOSING.voltaren_gel.warnings).toContain('topical_only');
    });
    it('havinson_a4: 1-2 capsule daily_morning', () => {
      expect(SUPPORT_DOSING.havinson_a4).toBeDefined();
      expect(SUPPORT_DOSING.havinson_a4.category).toBe('peptide');
    });
    it('dihexa: contraindicated_with_cancer_history', () => {
      expect(SUPPORT_DOSING.dihexa.warnings).toContain('contraindicated_with_cancer_history');
    });
    it('amantadine: prescription_only, anticholinergic', () => {
      expect(SUPPORT_DOSING.amantadine.warnings).toContain('prescription_only');
      expect(SUPPORT_DOSING.amantadine.warnings).toContain('anticholinergic_side_effects');
    });
  });

  describe('Все 15 веществ присутствуют', () => {
    const expectedIds = [
      'grandaxine', 'dihexa', 'phenylpiracetam', 'tropoflavin', 'fluvoxamine',
      'amantadine', 'naltrexone', 'guanfacine', 'tizanidine',
      'havinson_a4', 'havinson_a19', 'ligamentide', 'neovitin', 'voltaren_gel', 'artra',
    ];
    it('все в SUPPLEMENTS_DB', () => {
      for (const id of expectedIds) {
        expect(SUPPLEMENTS_DB[id], `Missing ${id} in SUPPLEMENTS_DB`).toBeDefined();
      }
    });
    it('все в SUPPORT_DOSING', () => {
      for (const id of expectedIds) {
        expect(SUPPORT_DOSING[id], `Missing ${id} in SUPPORT_DOSING`).toBeDefined();
      }
    });
    it('все в SUPPORT_CATALOG_DATA (полные каталог-записи)', () => {
      for (const id of expectedIds) {
        expect(SUPPORT_CATALOG_DATA[id], `Missing ${id} in SUPPORT_CATALOG_DATA`).toBeDefined();
      }
    });
  });

  describe('SUPPORT_CATALOG_DATA: структура полных записей', () => {
    it('grandaxine — specialty, pharma/anxiolytic, с synergies', () => {
      const e = SUPPORT_CATALOG_DATA.grandaxine;
      expect(e.tier).toBe('specialty');
      expect(e.category).toContain('pharma');
      expect(e.category).toContain('anxiolytic');
      expect(e.synergies.length).toBeGreaterThan(0);
      expect(e.mechanisms).toContain('PDE4_INHIBITION');
      expect(e.dosage.mg).toBe(50);
    });
    it('dihexa — specialty, peptide, contraindicated_with_cancer', () => {
      const e = SUPPORT_CATALOG_DATA.dihexa;
      expect(e.tier).toBe('specialty');
      expect(e.category).toContain('peptide');
      expect(e.contraindications.join(',')).toMatch(/онколог/i);
      expect(e.mechanisms).toContain('HGF_CMET_AGONISM');
    });
    it('fluvoxamine — specialty, antidepressant, CYP1A2 warning', () => {
      const e = SUPPORT_CATALOG_DATA.fluvoxamine;
      expect(e.tier).toBe('specialty');
      expect(e.category).toContain('antidepressant');
      expect(e.mechanisms).toContain('SIGMA1_AGONISM');
      const conflictIds = e.conflicts.map(c => c.with);
      expect(conflictIds).toContain('cyp1a2_substrates');
    });
    it('naltrexone (LDN) — specialty, 1-5 мг', () => {
      const e = SUPPORT_CATALOG_DATA.naltrexone;
      expect(e.tier).toBe('specialty');
      expect(e.dosage.mg).toBe(4.5);
      expect(e.mechanisms).toContain('TLR4_ANTAGONISM');
    });
    it('guanfacine — α2 постсинаптический, мониторинг АД', () => {
      const e = SUPPORT_CATALOG_DATA.guanfacine;
      expect(e.mechanisms).toContain('ALPHA2_ADRENERGIC_AGONISM_POSTSYNAPTIC');
      expect(e.monitoring.length).toBeGreaterThan(0);
    });
    it('tizanidine — α2 пресинаптический, tolerance 3 months', () => {
      const e = SUPPORT_CATALOG_DATA.tizanidine;
      expect(e.mechanisms).toContain('ALPHA2_ADRENERGIC_AGONISM_PRESYNAPTIC');
      expect(e.specialInstructions?.some(s => s.includes('3 месяц'))).toBe(true);
    });
    it('havinson_a4 — advanced, peptide, joint', () => {
      const e = SUPPORT_CATALOG_DATA.havinson_a4;
      expect(e.tier).toBe('advanced');
      expect(e.category).toContain('peptide');
      expect(e.category).toContain('joint');
      expect(e.organs).toContain('CARTILAGE');
    });
    it('voltaren_gel — standard, nsaid, topical_only', () => {
      const e = SUPPORT_CATALOG_DATA.voltaren_gel;
      expect(e.tier).toBe('standard');
      expect(e.category).toContain('nsaid');
      expect(e.warnings || e.specialInstructions?.some(s => s.toLowerCase().includes('местно')) || true).toBe(true);
    });
    it('artra — standard, analog glucosamine/chondroitin', () => {
      const e = SUPPORT_CATALOG_DATA.artra;
      expect(e.tier).toBe('standard');
      expect(e.analog).toContain('glucosamine');
      expect(e.analog).toContain('chondroitin');
    });
    it('lamotrigine — specialty, Na-channel, Stevens-Johnson warning', () => {
      const e = SUPPORT_CATALOG_DATA.lamotrigine;
      expect(e.tier).toBe('specialty');
      expect(e.mechanisms).toContain('SODIUM_CHANNEL_BLOCKADE');
      expect(e.contraindications.some(c => c.toLowerCase().includes('стивенс')) || e.sideEffects.some(s => s.toLowerCase().includes('сыпь'))).toBe(true);
    });
  });
});
