const DataIndex = require("./data_index");

async function runAnalysis() {
  console.log("\n🧬 ЗАПУСК СИСТЕМЫ АНАЛИЗА v1.0\n");

  // 1. Загружаем всё
  const db = await DataIndex.loadAll();

  // 2. Тестовый сценарий: Пользователь принимает этот стек
  const userStack = ["CAFFEINE", "L_THEANINE", "RHODIOLA", "VITAMIN_D", "MELATONIN"];
  console.log(`\n👤 Анализ стека пользователя: [${userStack.join(", ")}]`);

  // 3. Проверка взаимодействий
  const foundInteractions = db.interactions.filter(int => {
    return (userStack.includes(int.substanceA) && userStack.includes(int.substanceB));
  });

  if (foundInteractions.length > 0) {
    console.log(`\n⚠️ Найдено взаимодействий: ${foundInteractions.length}`);
    foundInteractions.forEach(int => {
      const severityColor = int.severity === "HIGH" ? "🔴" : (int.severity === "MEDIUM" ? "🟠" : "🟢");
      const typeName = int.type === "CONFLICT" ? "КОНФЛИКТ" : (int.type === "SYNERGY" ? "СИНЕРГИЯ" : "ОСТОРОЖНО");
      console.log(`   ${severityColor} ${int.substanceA} + ${int.substanceB}: [${typeName} / ${int.severity}]`);
      console.log(`      Эффект: ${int.effect}`);
      if (int.mechanisms.length > 0) {
        console.log(`      Механизм: ${int.mechanisms.join(" + ")}`);
      }
    });
  } else {
    console.log("✅ Взаимодействий не выявлено.");
  }

  // 4. Категоризация веществ
  console.log("\n📂 Распределение по категориям:");
  userStack.forEach(subId => {
    const sub = db.substances.find(s => s.id === subId);
    if (sub) {
      const cat = db.categories.find(c => c.ID === sub.category);
      console.log(`   • ${sub.name} (${cat ? cat.NAME : sub.category})`);
    } else {
      console.log(`   • ${subId} (Неизвестное вещество)`);
    }
  });

  console.log("\n✅ Анализ завершен успешно.");
}

runAnalysis().catch(console.error);