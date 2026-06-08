const fs = require('fs');
const p = 'D:\\BodyBuildHealth\\src\\engines\\risk.engine.ts';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  `const MECHANISM_NAMES: Record<number, string> = {
   1: 'direct_toxicity',
   2: 'metabolic',
   3: 'oxidative',
   4: 'immune',
   5: 'hormonal',
   6: 'hemodynamic',
   7: 'proliferative',
};`,
  `const MECHANISM_NAMES: Record<number, string> = {
   1: '\u041F\u0440\u044F\u043C\u043E\u0439 \u0442\u043E\u043A\u0441\u0438\u0447\u0435\u0441\u043A\u0438\u0439',
   2: '\u041C\u0435\u0442\u0430\u0431\u043E\u043B\u0438\u0447\u0435\u0441\u043A\u0438\u0439',
   3: '\u041E\u043A\u0438\u0441\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439',
   4: '\u0418\u043C\u043C\u0443\u043D\u043D\u044B\u0439',
   5: '\u0413\u043E\u0440\u043C\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439',
   6: '\u0413\u0435\u043C\u043E\u0434\u0438\u043D\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0439',
   7: '\u041F\u0440\u043E\u043B\u0438\u0444\u0435\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u0439',
};`
);

fs.writeFileSync(p, c, 'utf8');
console.log('Fixed mechanism names. Length:', c.length);
