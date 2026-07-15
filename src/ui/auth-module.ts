import { db } from '../core/db';
import type { LocalUserProfile } from '../core/auth-manager';
import { ensureAdmin } from '../core/auth-manager';
import type { UserProfile, UserRole } from '../core/types';

function toAppProfile(p: LocalUserProfile): UserProfile {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    settings: {
      personal: { age: p.settings.age, sex: p.settings.sex, weight: p.settings.weight, height: p.settings.height, bodyFat: 15, bloodType: 'I+' },
      training: { sportType: 'bodybuilding', experience: 3, level: 'intermediate', daysPerWeek: (p.settings as any).workoutsPerWeek ?? 3, minutesPerSession: 60, primaryGoal: ((p.settings as any).goal || 'hypertrophy') as any, weakPoints: [], pmSquat: 120, pmBench: 100, pmDeadlift: 140, workMax: {}, equipment: [], recovery: 7, motivation: 7, doms: 3 },
      pharma: { phase: 'baseline', courseStartDate: new Date().toISOString().slice(0, 10), experience: 'none', totalCycles: 0, yearsOnGear: 0, monthsSinceLastCourse: 0, hcgEnabled: false, aiEnabled: false, trainingCycleType: 'mass', trainingCycleWeeks: 12, previousCycles: 0, timeSinceLastCycle: 'none', currentSubstances: [] },
      health: { chronicConditions: [], contraindications: { diabetes: false, cvd: false, thrombophilia: false, liverDisease: false, kidneyDisease: false, giDisease: false, prostateIssues: false, epilepsy: false, mentalIllness: false }, genetics: {}, injuries: [], bpStage: 'normal', hctElevation: 'none', heartRate: 70, ldlElevation: 'normal', hdlLow: false, previousCVD: false, familyCVD: false, triglycerides: 'normal', bloating: false, heartburn: false, constipation: false, diarrhea: false, diagnosedIBS: false, enzymeSupport: false, probioticUse: false, dopamineScore: 3, serotoninScore: 3, aggressionScore: 3, memoryIssues: false, focusIssues: false, slowThinking: false, headaches: false, weatherDependent: false, fearOfLoss: 3, mirrorObsession: 3, apathyOffCycle: 3, jointPain: false, ligamentIssues: false, backPain: false, bleedingGums: false, looseTeeth: false, cramps: false, pastGyno: false, pastLibidoDrop: false, pastHctSpike: false, pastLiverIssues: false, pastKidneyIssues: false, hazardousWork: false, regularNSAIDs: false, drugAllergies: '', excludedSupplements: [], excludedMeds: [] },
      nutrition: { dietType: 'omnivore', mealsPerDay: 3, cookingSkill: 'basic', foodAllergies: [], foodIntolerances: [], excludedFoods: [], preferredFoods: [], histamineSensitive: false, proteinPerKg: 1.8, fiberG: 25, omega3G: 1.5, sodiumG: 3.5, potassiumG: 3.0, alcoholPerWeek: 0, currentSupplements: [], currentMedications: [] },
      goals: { primaryGoal: 'hypertrophy' as const },
      labs: { status: 'none' as const, summary: {} },
      symptoms: { recent: {} },
      lifestyle: { sleepHours: 7, sleepQuality: 'fair', chronotype: 'mixed', stressLevel: 5, fatigueLevel: 5, baselineHrvRatio: 1.0, dailySteps: 5000, dailyWaterLiters: 2, smoke: false, activityLevel: 5, morningHRV: 60, restingHR: 65, nightAwakenings: 1 },
      system: { mcRuns: 0, forceNoLabsPenalty: false, preferredUnits: 'metric', notificationsEnabled: true, privacyLevel: 'private', nutritionFactor: 0.8, trainingFactor: 0.7, hasHIIT: false, volumeTonnes: 8000, lissMinutesPerWeek: 90 },
    },
  };
}

export async function renderAuthModule(container: HTMLElement, onLogin: (profile: UserProfile) => void) {
  // Try Telegram WebApp auth first
  const tg = (window as any).Telegram?.WebApp;
  if (tg) {
    const tgUser = tg.initDataUnsafe?.user;
    if (tgUser) {
      // Telegram user detected — auto-login
      const userId = 'tg_' + tgUser.id;
      const userName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
      const userNameLower = tgUser.username || userName;

      // Create or find user in local DB
      const users: LocalUserProfile[] = await db.getAll('users') || [];
      let user = users.find(u => u.id === userId);

      if (!user) {
        user = {
          id: userId,
          email: (tgUser.username || userId) + '@telegram',
          name: userName,
          passwordHash: '',
          salt: '',
          role: 'user',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          settings: { age: 25, weight: 80, height: 180, sex: 'male', goal: 'bulk' },
        };
        await db.put('users', user);
      } else {
        user.lastLogin = new Date().toISOString();
        user.name = userName;
        await db.put('users', user);
      }

      localStorage.setItem('he_session_v2', JSON.stringify({ id: user.id, email: user.email, ts: Date.now() }));
      onLogin(toAppProfile(user));
      return;
    }
  }

  // Fallback: auto-login with local profile (no registration form)
  const users: LocalUserProfile[] = await db.getAll('users') || [];
  let user = users.find(u => u.role === 'admin') || users[0];

  if (!user) {
    // Create default user
    // Auto-create without password
    const defaultUser: LocalUserProfile = {
      id: crypto.randomUUID(),
      email: 'user@local',
      name: 'Пользователь',
      passwordHash: '',
      salt: '',
      role: 'user',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      settings: { age: 25, weight: 80, height: 180, sex: 'male', goal: 'bulk' },
    };
    await db.put('users', defaultUser);
    user = defaultUser;
  }

  user.lastLogin = new Date().toISOString();
  await db.put('users', user);
  localStorage.setItem('he_session_v2', JSON.stringify({ id: user.id, email: user.email, ts: Date.now() }));
  onLogin(toAppProfile(user));
}
