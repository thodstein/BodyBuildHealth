/**
 * OCR Microservice — Node.js Express + pdf-parse + tesseract.js
 *
 * Standalone server for extracting lab biomarkers from PDFs and images.
 * 100% local, zero paid APIs.
 *
 * Endpoints:
 *   POST /api/v1/extract-labs-local  — multipart file upload
 *   GET  /health                     — liveness probe
 *
 * Usage:
 *   npm install express multer pdf-parse tesseract.js@5
 *   node ocr-microservice.js
 *
 * NOTE: This is a REFERENCE server implementation.
 * For Telegram Mini App (browser), use src/engines/biomarker-regex-engine.ts
 * combined with pdfjs-dist (PDF) and tesseract.js (image) client-side.
 */

// @ts-nocheck — Node.js standalone (not part of Vite build)

const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');

const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════════════════════════════════════
// BIOMARKER DICTIONARY (mirrored from TypeScript version)
// ═══════════════════════════════════════════════════════════════════════════
const BIOMARKER_DICTIONARY = {
  'ALT': ['алт', 'аланинаминотрансфераза', 'alt', 'алат'],
  'AST': ['аст', 'аспартатаминотрансфераза', 'ast', 'асат'],
  'GGT': ['ггт', 'гамма-глутамилтрансфераза', 'ggt'],
  'Creatinine': ['креатинин', 'creatinine'],
  'Cystatin_C': ['цистатин с', 'цистатин c', 'cystatin c'],
  'KIM-1': ['kim-1', 'kim 1', 'молекула повреждения почек'],
  'Testosterone_Total': ['тестостерон общий', 'тестостерон', 'testosterone'],
  'E2': ['эстрадиол', 'estradiol', 'e2'],
  'Prolactin': ['пролактин', 'prolactin', 'prl'],
  'LH': ['лг', 'lh', 'лютеинизирующий гормон'],
  'FSH': ['фсг', 'fsh', 'фолликулостимулирующий гормон'],
  'SHBG': ['shbg', 'гспг', 'глобулин связывающий половые гормоны'],
  'DHT': ['дгт', 'dht', 'дигидротестостерон'],
  'PSA': ['пса', 'psa', 'простат-специфический антиген'],
  'TSH': ['ттг', 'tsh', 'тиреотропный гормон'],
  'Cortisol': ['кортизол', 'cortisol'],
  'Prolactin': ['пролактин', 'prolactin', 'prl'],
  'IGF-1': ['ифр-1', 'igf-1', 'инсулиноподобный фактор роста'],
  'Hematocrit': ['гематокрит', 'hematocrit', 'hct'],
  'Hemoglobin': ['гемоглобин', 'hemoglobin', 'hgb'],
  'Ferritin': ['ферритин', 'ferritin'],
  'Cholesterol_Total': ['холестерин общий', 'total cholesterol', 'холестерин'],
  'HDL': ['лпвп', 'hdl', 'холестерин лпвп'],
  'LDL': ['лпнп', 'ldl', 'холестерин лпнп'],
  'Triglycerides': ['триглицериды', 'triglycerides'],
  'Glucose': ['глюкоза', 'glucose'],
  'HbA1c': ['hba1c', 'гликированный гемоглобин'],
  'Insulin': ['инсулин', 'insulin'],
  'hs-CRP': ['hs-crp', 'вч-срб', 'с-реактивный белок'],
  'Homocysteine': ['гомоцистеин', 'homocysteine'],
  'Vitamin_D': ['витамин d', 'vitamin d', '25-oh d'],
  'Iron': ['железо', 'iron'],
  'Ferritin': ['ферритин', 'ferritin'],
  'Magnesium': ['магний', 'magnesium'],
  'Zinc': ['цинк', 'zinc'],
  'Albumin': ['альбумин', 'albumin'],
  'Total_Protein': ['общий белок', 'total protein'],
  'Bilirubin_Total': ['билирубин общий', 'total bilirubin', 'билирубин'],
  'Urea': ['мочевина', 'urea'],
  'Uric_Acid': ['мочевая кислота', 'uric acid'],
  'eGFR': ['egfr', 'скф', 'gfr'],
  'CK': ['кфк', 'ck', 'креатинкиназа'],
  'LDH': ['лдг', 'ldh', 'лактатдегидрогеназа'],
};

// ═══════════════════════════════════════════════════════════════════════════
// REGEX PARSING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function preprocessLine(line) {
  return line.trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ');
}

function extractNumbers(text) {
  const matches = text.match(/\d+(?:\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}

function matchBiomarker(line) {
  for (const [code, synonyms] of Object.entries(BIOMARKER_DICTIONARY)) {
    for (const syn of synonyms) {
      if (line.includes(syn)) return code;
    }
  }
  return null;
}

function extractValueAndEc50(line, numbers) {
  if (numbers.length === 0) return { value: 0, ec50: 0, refText: '' };

  // "< 41" pattern
  const ltMatch = line.match(/<\s*(\d+(?:\.\d+)?)/);
  if (ltMatch) {
    const ec50 = parseFloat(ltMatch[1]);
    const val = numbers.find(n => n !== ec50) || numbers[0];
    return { value: val, ec50, refText: `< ${ec50}` };
  }

  // Reference range "62 - 106"
  const refMatch = line.match(/(\d+(?:\.\d+)?)\s*[-\u2013\u2014]+\s*(\d+(?:\.\d+)?)/);
  if (numbers.length >= 2) {
    let value = numbers[0];
    let ec50 = numbers[numbers.length - 1];
    if (refMatch) {
      ec50 = parseFloat(refMatch[2]);
      const nonRef = numbers.filter(n => n !== parseFloat(refMatch[1]) && n !== parseFloat(refMatch[2]));
      if (nonRef.length > 0) value = nonRef[0];
    }
    return { value, ec50, refText: refMatch ? refMatch[0] : '' };
  }

  return { value: numbers[0], ec50: numbers[0] * 1.5, refText: '' };
}

function parseLabResults(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const markers = [];
  const seenCodes = new Set();
  const warnings = [];

  for (const rawLine of lines) {
    const line = preprocessLine(rawLine);
    if (line.length < 3) continue;

    // Skip headers
    if (/^(наименование|показатель|аналит|test|parameter|результат|референс|единицы)/i.test(line)) continue;

    const code = matchBiomarker(line);
    if (!code) continue;
    if (seenCodes.has(code)) continue;

    const numbers = extractNumbers(line);
    if (numbers.length === 0) continue;

    const { value, ec50, refText } = extractValueAndEc50(line, numbers);
    if (value <= 0) continue;

    seenCodes.add(code);
    markers.push({ name: code, value, ec50, source_line: rawLine, ref_range: refText });
  }

  if (markers.length === 0) {
    warnings.push('No biomarkers found. Check text quality or try a different file format.');
  }

  return { markers, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════
// Express Setup
// ═══════════════════════════════════════════════════════════════════════════

const app = express();
app.use(express.json());

// Multer: in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/extract-labs-local
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/v1/extract-labs-local', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded.' });
    }

    const { buffer, mimetype, originalname } = req.file;
    let rawText = '';
    let extractionMethod = 'unknown';

    // ── Route by file type ──
    if (mimetype === 'application/pdf') {
      extractionMethod = 'pdf-parse';
      try {
        const data = await pdfParse(buffer);
        rawText = data.text || '';
      } catch (err) {
        return res.status(422).json({
          status: 'error',
          message: 'Failed to parse PDF. Ensure the file has a text layer.',
          detail: err.message,
        });
      }
    } else if (mimetype.startsWith('image/')) {
      extractionMethod = 'tesseract.js';
      try {
        // First try rus+eng, fallback to eng
        let worker;
        try {
          worker = await createWorker('rus+eng');
        } catch {
          worker = await createWorker('eng');
        }

        const { data } = await worker.recognize(buffer);
        rawText = data.text || '';
        await worker.terminate();
      } catch (err) {
        return res.status(422).json({
          status: 'error',
          message: 'OCR failed. Ensure tesseract language packs are installed.',
          detail: err.message,
        });
      }
    } else if (mimetype === 'text/plain') {
      extractionMethod = 'text';
      rawText = buffer.toString('utf-8');
    } else {
      return res.status(400).json({ status: 'error', message: `Unsupported MIME: ${mimetype}` });
    }

    // ── Parse biomarkers ──
    const { markers, warnings } = parseLabResults(rawText);

    // ── Count unrecognized lines with numbers ──
    const allLines = rawText.split('\n').filter(l => l.trim().length > 2);
    const linesWithNumbers = allLines.filter(l => /\d+(?:\.\d+)?/.test(l)).length;
    const unrecognizedLines = linesWithNumbers - markers.length;

    return res.json({
      status: 'success',
      extraction_method: extractionMethod,
      filename: originalname,
      extracted_markers: markers,
      unrecognized_lines_with_numbers: Math.max(0, unrecognizedLines),
      total_lines: allLines.length,
      warnings,
    });
  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error.',
      detail: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Health + Root
// ═══════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'OCR Microservice v1.0.0' });
});

app.get('/', (req, res) => {
  res.json({ message: 'OCR Microservice API', endpoint: '/api/v1/extract-labs-local', health: '/health' });
});

app.listen(PORT, () => {
  console.log(`OCR Microservice running on http://localhost:${PORT}`);
  console.log(`Endpoint: POST http://localhost:${PORT}/api/v1/extract-labs-local`);
});
