const fs = require("fs");
const path = require("path");

const CSVLoader = {
  loadCSV(filePath) {
    // Определяем путь относительно этого файла (поднимается на уровень выше в data/)
    const absPath = path.resolve(__dirname, "../data", filePath);
    
    try {
      const raw = fs.readFileSync(absPath, "utf8");
      
      // Исправленный сплит и маппинг (убраны пробелы в split и = >)
      const lines = raw.split("\n").map(l => l.trim()).filter(l => l.length > 0);

      if (lines.length === 0) return [];

      // Заголовки (чистим пробелы и кавычки)
      const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1);

      return rows.map(row => {
        // Разделяем по запятой, убираем пробелы и кавычки
        const cols = row.split(",").map(c => c.trim().replace(/^"|"$/g, ''));
        const obj = {};
        header.forEach((h, i) => {
          obj[h] = cols[i] || "";
        });
        return obj;
      });
    } catch (e) {
      console.warn(`⚠️ Не удалось загрузить CSV: ${filePath}`);
      return [];
    }
  }
};

module.exports = CSVLoader;