const CSVLoader = require("./utils/csv_loader"); // Путь исправлен под структуру
const path = require("path");

const DataIndex = {
  async loadAll() {
    console.log("📦 Загрузка базы данных...");

    // 1. Загрузка CSV
    const categories = CSVLoader.loadCSV("categories.csv");
    const effects = CSVLoader.loadCSV("effects.csv");
    const brands = CSVLoader.loadCSV("brands.csv");
    const axes = CSVLoader.loadCSV("axes.csv");
    
    // 2. Загрузка JSON (Substances & Interactions)
    let substances = [];
    let interactions = [];

    try {
      substances = require("./substances.json");
      console.log(`✅ Substances loaded: ${substances.length}`);
    } catch (e) {
      console.warn("⚠️ substances.json не найден!");
    }

    try {
      interactions = require("./interactions.json");
      console.log(`✅ Interactions loaded: ${interactions.length}`);
    } catch (e) {
      console.warn("⚠️ interactions.json не найден!");
    }

    return {
      categories,
      effects,
      brands,
      axes,
      substances,
      interactions
    };
  }
};

module.exports = DataIndex;