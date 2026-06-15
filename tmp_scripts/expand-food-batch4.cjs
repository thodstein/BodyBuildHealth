// expand-food-batch4.cjs - adds ~70 more to reach 500+
const fs = require("fs");
const path = require("path");
const TARGET = path.resolve(__dirname, "..", "src", "core", "nutrition-database.ts");
let content = fs.readFileSync(TARGET, "utf8");
const catMap = { p:"protein", g:"grain", v:"veg_fruit", d:"dairy", carb:"carb", fat:"fat", o:"other" };
const foods = [];
function F(id,name,cat,kcal,p,f,c,fiber,gi,serv,micros){
  foods.push({id,name,category:catMap[cat]||cat,kcal,protein:p,fat:f,carbs:c,fiber,gi,servingSize:serv,micros});
}

// ===== More Protein (15) =====
F("pork_knuckle","Свиная рулька (варёная)","p",290,20,22,0,0,0,"150 г",{Fe:2,Zn:3.5,P:180,Glycine:3000,Proline:2500});
F("pork_ears","Свиные уши (варёные)","p",230,22,15,0,0,0,"100 г",{Ca:100,Collagen:12000,Glycine:8000,Proline:5000});
F("lamb_tongue","Бараний язык (варёный)","p",210,15,16,0,0,0,"100 г",{Fe:3.2,Zn:3.5,VitB12:3.5,P:170,Cholesterol:85});
F("lamb_kidney","Бараньи почки (варёные)","p",110,17,3.5,1,0,0,"100 г",{Fe:6,Zn:3,Se:130,VitB12:25,VitB2:2.5,P:250});
F("lamb_heart","Баранье сердце (варёное)","p",135,15,7.5,2,0,0,"100 г",{Fe:6.5,Zn:3,VitB12:7,VitB5:2.2,P:210,K:260});
F("frog_legs","Лягушачьи лапки","p",73,16,0.3,0,0,0,"150 г",{P:230,K:280,Mg:25,Zn:1.5,Se:15});
F("escargot","Улитки (эскарго)","p",90,16,1.5,2,0,0,"100 г",{Ca:200,Mg:250,P:150,K:380,Zn:1.5});
F("whitebait","Мальки/белая рыбка (жареные)","p",280,20,22,0,0,0,"100 г",{Ca:200,P:400,VitD:5,Omega3:500,Se:25});
F("tilapia","Тилапия (запечённая)","p",128,26,3,0,0,0,"150 г",{P:200,K:380,Mg:30,Se:40,VitB12:1.9,Omega3:200});
F("swordfish","Меч-рыба (стейк жареный)","p",200,25,10,0,0,0,"150 г",{P:280,K:480,Mg:35,Se:65,VitB12:2,VitD:7,Omega3:800});
F("shark_steak","Акула (стейк варёный)","p",130,21,4.5,0,0,0,"150 г",{P:200,K:160,Mg:50,Se:35,VitB12:1.5});
F("eel_smoked","Угорь копчёный","p",350,18,25,0,0,0,"100 г",{P:200,K:250,VitA:1800,VitD:10,Omega3:1500,Na:1200});
F("cod_roe_canned","Икра трески (консервированная)","p",170,22,8,2,0,0,"30 г",{P:280,K:200,Mg:15,VitD:5,Omega3:1000,Na:700});
F("crab_meat_canned","Краб консервированный","p",85,17,1,0,0,0,"100 г",{P:200,K:250,Zn:4,Se:40,Cu:0.5,Na:800});
F("cockles","Сердцевидки (варёные)","p",54,9,0.5,3,0,0,"100 г",{Fe:8,Zn:2,VitB12:15,Se:20,P:150});

// ===== More Grains (10) =====
F("bread_protein","Хлеб белковый (фитнес-хлеб)","g",220,18,4,28,10,40,"50 г",{Fe:2.5,Ca:60,Mg:50,P:180,Zn:1.5});
F("bread_crispbread","Хрустящие хлебцы (ржаные)","g",350,10,2,65,16,45,"30 г",{Fe:3,Mg:80,P:250,Zn:2.5,Se:10});
F("cereal_amaranth_popped","Амарант воздушный (поп-амарант)","g",385,14,6,66,9,35,"30 г (сухой)",{Fe:7,Mg:260,P:520,Zn:3.5,Ca:150});
F("cereal_brown_rice_porridge","Каша рисовая бурая","g",115,2.5,0.9,23,1.8,50,"200 г",{Fe:0.5,Mg:43,P:83,Zn:0.6,Se:11});
F("cereal_corn_grits","Каша кукурузная (мамалыга)","g",100,2.5,1.5,19,2,55,"200 г",{Fe:0.5,Mg:15,P:50,Zn:0.4,VitB3:1.5});
F("cereal_lentil_red_porridge","Каша из красной чечевицы","g",110,8,0.5,19,4,30,"200 г",{Fe:2.5,Zn:1.5,P:120,Mg:40,VitB9:150});
F("cereal_chickpea_porridge","Каша нутовая","g",130,7.5,2.5,20,5,30,"200 г",{Fe:2.5,Zn:1.5,P:170,Mg:50,VitB9:170});
F("pasta_conchiglie","Конкилье (ракушки варёные)","g",145,5,1,28,1.5,50,"200 г",{Fe:1.2,Zn:0.8,P:100});
F("pasta_fusilli_tricolore","Фузилли триколоре (варёные)","g",155,6,2,28,3,50,"200 г",{Fe:1.5,Zn:1,P:120,VitA:300});
F("pasta_tortellini_cheese","Тортеллини с сыром (варёные)","g",230,10,7,32,2,55,"200 г",{Ca:120,Fe:1,Zn:1,P:120});

// ===== More Vegetables (10) =====
F("veg_artichoke","Артишок (варёный)","v",47,3.5,0.2,10,5.5,20,"150 г (1 шт)",{Ca:21,Fe:1.3,Mg:60,P:90,K:370,VitC:12,VitB9:68,Inulin:4000});
F("veg_asparagus_green","Спаржа зелёная (на гриле)","v",25,2.5,0.2,4,2,15,"150 г",{Ca:24,Fe:2,Mg:14,P:52,K:202,VitC:8,VitA:750,VitK:41,VitB9:52});
F("veg_fennel_bulb","Фенхель (луковица свежая)","v",31,1.2,0.2,7,3,15,"100 г",{Ca:49,Fe:0.7,Mg:17,P:50,K:414,VitC:12,VitA:48,VitB9:27});
F("veg_bean_sprouts","Ростки сои (свежие)","v",122,13,6.7,10,2,25,"100 г",{Ca:67,Fe:2.1,Mg:72,P:164,K:484,VitC:15,VitB9:172});
F("veg_bamboo_shoots","Побеги бамбука (варёные)","v",12,1.5,0.3,2.5,1.5,15,"150 г",{Ca:13,Fe:0.3,Mg:5,P:20,K:533,VitB6:0.1});
F("veg_capers","Каперсы (консервированные)","v",23,2.4,0.9,4.9,3,15,"15 г",{Ca:40,Fe:1.7,Mg:33,P:10,K:40,Na:1200,Quercetin:50});
F("veg_hearts_of_palm","Сердцевина пальмы (консервированная)","v",28,2.5,0.5,4.5,1.5,15,"100 г",{Ca:18,Fe:3,Mg:10,P:65,K:180,VitB9:25,Zn:1});
F("veg_water_chestnut","Водяной орех (чилим)","v",97,1.4,0.1,24,3,55,"100 г",{Ca:11,Fe:0.1,Mg:22,P:63,K:584,VitB6:0.3,Cu:0.3});
F("veg_celery_root","Корень сельдерея (варёный)","v",42,1.3,0.3,9,2,35,"150 г",{Ca:40,Fe:0.8,Mg:17,P:100,K:300,VitC:8,VitK:30});
F("veg_jicama","Хикама (свежая)","v",38,0.7,0.1,9,5,15,"150 г",{Ca:12,Fe:0.6,Mg:12,P:18,K:150,VitC:20,VitB9:12,Inulin:3000});

// ===== More Fruits (10) =====
F("fruit_kumquat","Кумкват (свежий)","v",71,1.9,0.9,16,6.5,35,"80 г (5 шт)",{Ca:62,Fe:0.9,Mg:20,P:19,K:186,VitC:44,VitA:290});
F("fruit_ugli_fruit","Углифрут (танжело)","v",47,0.6,0.1,12,2,35,"150 г",{Ca:15,Fe:0.2,Mg:10,P:15,K:180,VitC:50,VitA:100});
F("fruit_loquat","Мушмула японская (локва)","v",47,0.4,0.2,12,1.7,35,"100 г",{Ca:16,Fe:0.3,Mg:13,P:27,K:266,VitA:150,VitC:1});
F("fruit_soursop","Гуанабана (саусеп)","v",66,1,0.3,17,3.3,35,"150 г",{Ca:14,Fe:0.6,Mg:21,P:27,K:278,VitC:20,VitB6:0.1});
F("fruit_cactus_pear","Плод кактуса (опунция)","v",41,0.7,0.5,10,3.6,25,"100 г",{Ca:56,Fe:0.3,Mg:85,P:24,K:220,VitC:14,VitB6:0.1});
F("fruit_rosehip","Шиповник (свежий)","v",162,1.6,0.3,38,24,25,"30 г (сухой)",{Ca:169,Fe:3,Mg:41,P:77,K:600,VitC:800,VitA:4200,VitE:5});
F("fruit_sea_buckthorn","Облепиха (свежая)","v",82,1.2,7,5,2,25,"50 г",{Ca:30,Fe:0.8,Mg:15,P:15,K:200,VitC:200,VitA:250,VitE:5,Omega3:800});
F("fruit_barberry","Барбарис (сушёный)","v",200,2,0.5,45,10,30,"30 г",{Ca:30,Fe:0.5,VitC:30,Berberine:100});
F("fruit_irga","Ирга (свежая)","v",45,0.8,0.3,10,2.5,25,"100 г",{Ca:15,Fe:0.5,P:20,K:150,VitC:15,VitA:50,Anthocyanins:150});
F("fruit_cornelian_cherry_dogwood","Кизил (свежий)","v",44,1,0.3,10,2,25,"100 г",{Ca:30,Fe:0.5,P:30,K:350,VitC:50,VitA:300});

// ===== More Dairy (8) =====
F("cheese_mozzarella_buffalo","Моцарелла буффало","d",280,20,22,2,0,0,"50 г",{Ca:200,P:140,Zn:2,VitA:200,VitB12:1,Na:300});
F("cheese_cheddar","Сыр чеддер","d",403,25,33,1.5,0,0,"30 г",{Ca:220,P:160,Zn:3.5,VitA:250,VitB12:0.9,Na:400});
F("cheese_feta","Фета (овечья)","d",264,14,21,4,0,0,"50 г",{Ca:280,P:170,Zn:2.5,VitA:250,VitB12:1.5,Na:1100});
F("milk_almond_unsweet","Молоко миндальное (без сахара)","d",15,0.5,1.2,0.3,0.3,0,"250 мл",{Ca:180,VitE:7,VitD:2});
F("milk_oat","Молоко овсяное","d",45,1,1.5,7,0.8,35,"250 мл",{Ca:120,VitD:1.5,VitB12:1,Fe:0.5});
F("milk_coconut_canned","Кокосовое молоко (консервированное)","d",230,2.5,24,5,2,0,"100 мл",{Ca:15,Fe:1.5,Mg:40,K:260,MCT:8000});
F("yogurt_skyr","Скир (исландский йогурт 0%)","d",66,12,0.2,4,0,0,"150 г",{Ca:150,P:120,Zn:0.8,VitB12:0.5});
F("tvorog_0_percent","Творог обезжиренный (0%)","d",85,18,0.5,3,0,0,"150 г",{Ca:120,P:130,Zn:1,Se:15,VitB2:0.25});

// ===== More Fats & Seeds (8) =====
F("oil_black_cumin","Масло чёрного тмина","fat",884,0,100,0,0,0,"10 мл",{VitE:5,Omega6:60000,Thymoquinone:200,Nigellone:100});
F("oil_cedar","Кедровое масло","fat",884,0,100,0,0,0,"15 мл",{VitE:10,Omega3:15000,Omega6:45000,OleicAcid:25000,PinolenicAcid:12000});
F("seed_mustard_yellow","Семена горчицы жёлтой","fat",508,26,36,28,12,0,"10 г",{Ca:26,Fe:9,Mg:37,P:84,K:138,Zn:6,Se:20,Sinigrin:500});
F("seed_coriander","Семена кориандра","fat",298,12,17,55,42,0,"10 г",{Ca:70,Fe:16,Mg:33,P:41,K:126,Zn:4.8,Cu:0.9,Mn:1.9});
F("seed_cardamom","Семена кардамона","fat",311,11,7,68,28,0,"5 г",{Ca:38,Fe:14,Mg:23,P:18,K:112,Zn:7,Cu:0.4,Mn:28});
F("nut_pecan","Орех пекан","fat",691,9,72,14,10,0,"30 г",{Ca:20,Fe:0.8,Mg:35,P:95,K:120,Zn:1.3,VitE:1.5,Mn:1.3});
F("nut_brazil","Бразильский орех","fat",659,14,67,12,7,0,"15 г (2-3 шт)",{Ca:24,Fe:0.4,Mg:56,P:109,K:93,Zn:0.6,Se:287,VitE:0.9,Mn:0.2,Cu:0.1});
F("seed_sunflower","Семечки подсолнечника (очищенные)","fat",584,21,51,20,8,0,"30 г",{Fe:3.8,Mg:100,P:450,Zn:5,Se:15,VitE:10,VitB1:0.4,VitB3:2.4,Cu:0.5});

// ===== More Prepared (8) =====
F("ru_cheburek","Чебурек (с мясом жареный)","o",300,12,18,24,1.5,60,"1 шт (180 г)",{Ca:30,Fe:1.8,Zn:1.5,P:100,Na:500});
F("ru_coulibiac","Кулебяка (с рыбой)","o",250,12,10,28,2,55,"200 г",{Ca:40,Fe:1.2,P:120,Omega3:300,Na:500});
F("ru_schi","Щи (из свежей капусты с мясом)","o",60,4,2.5,6,2,35,"300 мл",{Ca:30,Fe:1,P:60,K:280,VitC:15,VitA:300,VitK:40});
F("int_ramen_pork","Рамен (со свининой)","o",200,8,8,25,1.5,55,"400 мл",{Ca:30,Fe:1.5,P:80,K:300,Na:900});
F("int_ceviche","Севиче (из белой рыбы)","o",110,18,2,5,1,15,"200 г",{Ca:20,Fe:0.5,P:180,K:400,VitC:25,Omega3:300});
F("int_poke_salmon","Поке (с лососем)","o",180,12,8,18,2,50,"250 г",{Ca:30,Fe:0.8,Zn:1,P:120,Omega3:800,VitD:3,VitC:10});
F("int_satay_chicken","Сатай куриный (с арахисовым соусом)","o",230,20,12,10,2,45,"200 г (4 шт)",{Fe:1.5,Zn:2,P:180,VitB3:6,Na:500});
F("int_quesadilla_cheese","Кесадилья с сыром","o",330,14,18,28,2,60,"200 г",{Ca:250,Fe:1,Zn:1.5,P:150});

// ===== INSERTION LOGIC =====
function microsToTS(m) {
  if (!m || Object.keys(m).length === 0) return "{}";
  const pairs = [];
  for (const [k, v] of Object.entries(m)) {
    if (v === 0) continue;
    pairs.push(k + ":" + v);
  }
  return "{" + pairs.join(",") + "}";
}
function foodToLine(f) {
  const parts = [
    "{id:\"" + f.id + "\"", "name:\"" + f.name + "\"", "category:\"" + f.category + "\"",
    "kcal:" + f.kcal, "protein:" + f.protein, "fat:" + f.fat, "carbs:" + f.carbs,
    "fiber:" + f.fiber, "gi:" + f.gi, "servingSize:\"" + f.servingSize + "\"",
    "micros:" + microsToTS(f.micros)
  ];
  return "  " + parts.join(",") + "}";
}

console.log("Adding " + foods.length + " more foods");

// Find ]; before FOOD_ALLERGEN_DIET
const markerIdx = content.indexOf("\nexport const FOOD_ALLERGEN_DIET");
const before = content.substring(0, markerIdx);
const bracketIdx = before.lastIndexOf("];");
const newItems = foods.map(f => foodToLine(f)).join(",\n");
const newContent = content.substring(0, bracketIdx) + ",\n" + newItems + "\n];" + content.substring(bracketIdx + 2);

fs.writeFileSync(TARGET, newContent, "utf8");
console.log("Done! Added " + foods.length + " items.");
