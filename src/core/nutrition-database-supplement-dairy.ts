// ─── Dairy, Fats, Oils, Nuts, Seeds — Supplement for FOOD_DB ───
import { FoodItem } from './nutrition-database';

export const SUPPLEMENT_DAIRY: FoodItem[] = [
  // ═══════════════════════════════════════════════════════════════
  // CHEESE (30)
  // ═══════════════════════════════════════════════════════════════
  {id:"cheese_ricotta",name:"Рикотта",category:"dairy",kcal:174,protein:11,fat:13,carbs:3,fiber:0,gi:0,servingSize:"100 г",tier:"basic",bestFor:["mass","maintenance"],micros:{Ca:207,P:158,Zn:1.5,Se:8,VitA:120,VitB2:0.2,VitB12:0.3}},
  {id:"cheese_quark",name:"Кварк (творожный сыр)",category:"dairy",kcal:95,protein:12,fat:5,carbs:3.5,fiber:0,gi:20,servingSize:"100 г",tier:"mid",bestFor:["cutting","maintenance"],micros:{Ca:110,P:140,Zn:0.6,Mg:10,VitB2:0.2,VitB12:0.5}},
  {id:"cheese_cream_cheese",name:"Сливочный сыр",category:"dairy",kcal:342,protein:6,fat:34,carbs:4,fiber:0,gi:0,servingSize:"30 г",tier:"basic",bestFor:["mass"],micros:{Ca:80,P:90,Zn:0.5,VitA:260,VitB2:0.2}},
  {id:"cheese_chechil",name:"Сыр чечил",category:"dairy",kcal:290,protein:20,fat:23,carbs:2,fiber:0,gi:0,servingSize:"50 г",tier:"basic",bestFor:["mass","maintenance"],micros:{Ca:280,P:180,Zn:2,Na:500,VitA:180,VitB12:0.8}},
  {id:"cheese_chevre",name:"Шевр (козий сыр мягкий)",category:"dairy",kcal:275,protein:18,fat:22,carbs:1.5,fiber:0,gi:0,servingSize:"50 г",tier:"mid",bestFor:["maintenance"],micros:{Ca:230,P:190,Zn:1.8,Se:12,VitA:200,VitB2:0.3,VitB12:0.9}},
  {id:"cheese_manchego",name:"Манчего",category:"dairy",kcal:396,protein:25,fat:32,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Ca:600,P:420,Zn:4,Se:12,VitA:280,VitB12:2,VitB2:0.3}},
  {id:"cheese_pecorino",name:"Пекорино Романо",category:"dairy",kcal:420,protein:28,fat:33,carbs:2,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Ca:950,P:630,Zn:4.5,Se:18,VitA:210,VitB12:1.8,VitB2:0.4,Na:600}},
  {id:"cheese_provolone",name:"Проволоне",category:"dairy",kcal:350,protein:26,fat:27,carbs:2,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","maintenance"],micros:{Ca:610,P:420,Zn:3.5,Se:14,VitA:250,VitB12:1.5,VitB2:0.3}},
  {id:"cheese_monterey_jack",name:"Монтерей Джек",category:"dairy",kcal:373,protein:24,fat:30,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass"],micros:{Ca:520,P:350,Zn:3,Se:10,VitA:200,VitB12:1.2}},
  {id:"cheese_colby",name:"Колби",category:"dairy",kcal:394,protein:24,fat:32,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","maintenance"],micros:{Ca:580,P:390,Zn:3.2,Se:12,VitA:220,VitB12:1.3}},
  {id:"cheese_munster",name:"Мюнстер",category:"dairy",kcal:368,protein:23,fat:30,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass"],micros:{Ca:480,P:320,Zn:3.5,Se:14,VitA:260,VitB12:1.5}},
  {id:"cheese_havarti",name:"Хаварти",category:"dairy",kcal:360,protein:23,fat:30,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","maintenance"],micros:{Ca:480,P:310,Zn:3,Se:12,VitA:200,VitB12:1.4}},
  {id:"cheese_asiago",name:"Азиаго",category:"dairy",kcal:386,protein:25,fat:31,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Ca:620,P:440,Zn:4,Se:16,VitA:240,VitB12:1.7}},
  {id:"cheese_fontina",name:"Фонтина",category:"dairy",kcal:389,protein:25,fat:31,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass"],micros:{Ca:550,P:360,Zn:3.5,Se:13,VitA:230,VitB12:1.6}},
  {id:"cheese_taleggio",name:"Таледжио",category:"dairy",kcal:340,protein:19,fat:28,carbs:1,fiber:0,gi:0,servingSize:"50 г",tier:"mid",bestFor:["mass","maintenance"],micros:{Ca:420,P:270,Zn:2.5,Se:10,VitA:210,VitB12:1.3}},
  {id:"cheese_stilton",name:"Стилтон (голубой)",category:"dairy",kcal:410,protein:24,fat:35,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Ca:580,P:380,Zn:3.8,Se:14,VitA:290,VitB12:1.8,Na:550}},
  {id:"cheese_red_leicester",name:"Ред Лестер",category:"dairy",kcal:395,protein:25,fat:33,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","maintenance"],micros:{Ca:610,P:400,Zn:3.5,Se:12,VitA:250,VitB12:1.5}},
  {id:"cheese_double_gloucester",name:"Дабл Глостер",category:"dairy",kcal:390,protein:24,fat:33,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass"],micros:{Ca:580,P:370,Zn:3.2,Se:11,VitA:240,VitB12:1.4}},
  {id:"cheese_wensleydale",name:"Уэнслидейл",category:"dairy",kcal:370,protein:23,fat:30,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","maintenance"],micros:{Ca:550,P:360,Zn:3,Se:10,VitA:220,VitB12:1.3}},
  {id:"cheese_goat_aged",name:"Козий сыр выдержанный",category:"dairy",kcal:360,protein:22,fat:29,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass","maintenance"],micros:{Ca:480,P:330,Zn:3,Se:14,VitA:280,VitB12:1.6}},
  {id:"cheese_sheep_aged",name:"Овечий сыр выдержанный",category:"dairy",kcal:400,protein:26,fat:33,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Ca:640,P:450,Zn:4,Se:16,VitA:300,VitB12:2.2,VitB2:0.4}},
  {id:"cheese_vegan_cashew",name:"Веганский сыр (кешью)",category:"dairy",kcal:280,protein:5,fat:22,carbs:15,fiber:2,gi:15,servingSize:"50 г",tier:"basic",bestFor:["maintenance"],isVegan:true,isDairyFree:true,micros:{Ca:30,Fe:2,Mg:50,P:80,Zn:1.5,Cu:0.3}},
  {id:"cheese_blue_roquefort",name:"Рокфор (голубой)",category:"dairy",kcal:369,protein:22,fat:31,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Ca:520,P:340,Zn:3.5,Se:14,VitA:250,VitB12:1.7,Na:800}},
  {id:"cheese_blue_gorgonzola",name:"Горгонзола (голубой)",category:"dairy",kcal:350,protein:19,fat:29,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Ca:480,P:310,Zn:3,Se:12,VitA:230,VitB12:1.5,Na:700}},
  {id:"cheese_aged_swiss",name:"Швейцарский выдержанный",category:"dairy",kcal:380,protein:28,fat:29,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Ca:580,P:400,Zn:4,Se:13,VitA:260,VitB12:2,VitB2:0.3}},
  {id:"cheese_spread_herb",name:"Сырная паста с травами",category:"dairy",kcal:280,protein:12,fat:24,carbs:5,fiber:0,gi:0,servingSize:"30 г",tier:"basic",bestFor:["mass","maintenance"],micros:{Ca:160,P:120,Zn:1.2,VitA:180,VitB2:0.2}},
  {id:"cheese_mozzarella_light",name:"Моцарелла лайт (45%)",category:"dairy",kcal:180,protein:28,fat:8,carbs:1.5,fiber:0,gi:0,servingSize:"50 г",tier:"mid",bestFor:["cutting","mass"],micros:{Ca:350,P:240,Zn:2.5,Se:12,VitB12:0.8,VitB2:0.2}},
  {id:"cheese_cottage_2",name:"Творог 2%",category:"dairy",kcal:95,protein:16,fat:2,carbs:3.5,fiber:0,gi:25,servingSize:"150 г",tier:"basic",bestFor:["cutting","mass"],micros:{Ca:90,P:160,Zn:0.8,Mg:15,VitB2:0.3,VitB12:0.5,Se:10}},
  {id:"cheese_parmesan_aged_36",name:"Пармиджано Реджано 36 мес",category:"dairy",kcal:431,protein:40,fat:29,carbs:3,fiber:0,gi:0,servingSize:"20 г",tier:"max",bestFor:["mass"],micros:{Ca:1200,P:720,Zn:5,Se:20,VitA:220,VitB12:2.5,VitB2:0.4,Na:480}},
  {id:"cheese_cheddar_extra",name:"Чеддер экстра-выдержанный",category:"dairy",kcal:420,protein:26,fat:35,carbs:0.5,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Ca:740,P:520,Zn:4.2,Se:20,VitA:280,VitB12:1.4,VitK:3}},

  // ═══════════════════════════════════════════════════════════════
  // YOGURT / FERMENTED (15)
  // ═══════════════════════════════════════════════════════════════
  {id:"kefir_0",name:"Кефир 0%",category:"dairy",kcal:30,protein:3,fat:0,carbs:4,fiber:0,gi:15,servingSize:"200 мл",tier:"basic",bestFor:["cutting"],micros:{Ca:120,P:90,Mg:12,Zn:0.4,VitB2:0.16,VitB12:0.4,K:150}},
  {id:"prostokvasha",name:"Простокваша",category:"dairy",kcal:53,protein:2.8,fat:2.5,carbs:4,fiber:0,gi:15,servingSize:"200 мл",bestFor:["maintenance"],micros:{Ca:115,P:88,Mg:13,Zn:0.4,VitB2:0.17,VitB12:0.4,K:140}},
  {id:"varenets",name:"Варенец 2.5%",category:"dairy",kcal:54,protein:3,fat:2.5,carbs:4.5,fiber:0,gi:15,servingSize:"200 мл",bestFor:["maintenance"],micros:{Ca:120,P:90,Mg:14,K:160,VitB2:0.18,VitB12:0.4,VitA:50}},
  {id:"bifidok",name:"Бифидок",category:"dairy",kcal:38,protein:2.8,fat:0.5,carbs:4.5,fiber:0,gi:15,servingSize:"200 мл",tier:"basic",bestFor:["cutting"],micros:{Ca:110,P:80,Mg:12,Zn:0.3,VitB2:0.15,VitB12:0.35,K:140}},
  {id:"acidophilus",name:"Ацидофилин",category:"dairy",kcal:49,protein:3,fat:1.5,carbs:4,fiber:0,gi:15,servingSize:"200 мл",bestFor:["maintenance","cutting"],micros:{Ca:115,P:85,Mg:13,Zn:0.4,VitB2:0.16,VitB12:0.4,K:145}},
  {id:"yogurt_15",name:"Йогурт 1.5%",category:"dairy",kcal:47,protein:4.5,fat:1.5,carbs:4.5,fiber:0,gi:20,servingSize:"200 г",tier:"basic",bestFor:["cutting"],micros:{Ca:140,P:100,Zn:0.5,VitB2:0.2,VitB12:0.5,K:180}},
  {id:"yogurt_32",name:"Йогурт 3.2%",category:"dairy",kcal:66,protein:4,fat:3.2,carbs:4,fiber:0,gi:20,servingSize:"200 г",bestFor:["mass","maintenance"],micros:{Ca:140,P:100,Zn:0.5,VitB2:0.2,VitB12:0.5,VitA:60,K:180}},
  {id:"yogurt_drinkable",name:"Йогурт питьевой",category:"dairy",kcal:60,protein:3.5,fat:2,carbs:7,fiber:0,gi:25,servingSize:"200 мл",bestFor:["maintenance"],micros:{Ca:130,P:90,Zn:0.4,VitB2:0.15,VitB12:0.4,K:170}},
  {id:"sour_cream_10",name:"Сметана 10%",category:"dairy",kcal:118,protein:3,fat:10,carbs:3.5,fiber:0,gi:15,servingSize:"50 г",tier:"basic",bestFor:["cutting"],micros:{Ca:85,P:60,VitA:120,VitB2:0.1,Zn:0.3}},
  {id:"sour_cream_30",name:"Сметана 30%",category:"dairy",kcal:290,protein:2.5,fat:30,carbs:3,fiber:0,gi:15,servingSize:"30 г",bestFor:["mass"],micros:{Ca:70,P:55,VitA:200,VitB2:0.1,Zn:0.3,VitD:0.3}},
  {id:"sour_cream_35",name:"Сметана 35%",category:"dairy",kcal:345,protein:2,fat:35,carbs:3,fiber:0,gi:15,servingSize:"30 г",bestFor:["mass"],micros:{Ca:65,P:50,VitA:220,VitB2:0.1,Zn:0.2,VitD:0.4}},
  {id:"ryazhenka_25",name:"Ряженка 2.5%",category:"dairy",kcal:54,protein:3,fat:2.5,carbs:4.2,fiber:0,gi:15,servingSize:"250 мл",bestFor:["maintenance"],micros:{Ca:120,P:90,Mg:14,K:160,VitB2:0.18,VitB12:0.4,VitA:50}},
  {id:"ryazhenka_4",name:"Ряженка 4%",category:"dairy",kcal:67,protein:3,fat:4,carbs:4,fiber:0,gi:15,servingSize:"250 мл",bestFor:["mass"],micros:{Ca:120,P:90,Mg:14,K:160,VitB2:0.18,VitB12:0.4,VitA:70}},
  {id:"biokefir",name:"Биокефир 1%",category:"dairy",kcal:45,protein:3.2,fat:1,carbs:4,fiber:0,gi:15,servingSize:"200 мл",tier:"basic",bestFor:["cutting"],micros:{Ca:125,P:92,Mg:13,Zn:0.4,VitB2:0.17,VitB12:0.4,K:150}},
  {id:"tan_classic",name:"Тан классический",category:"dairy",kcal:25,protein:1.5,fat:1,carbs:2.5,fiber:0,gi:10,servingSize:"250 мл",bestFor:["cutting"],micros:{Ca:80,P:60,Mg:10,Na:650,Zn:0.3,K:120}},

  // ═══════════════════════════════════════════════════════════════
  // MILK / CREAM (15)
  // ═══════════════════════════════════════════════════════════════
  {id:"milk_32",name:"Молоко 3.2%",category:"dairy",kcal:60,protein:3,fat:3.2,carbs:4.7,fiber:0,gi:30,servingSize:"200 мл",bestFor:["mass","maintenance"],micros:{Ca:120,P:90,VitB2:0.2,VitB12:0.4,VitA:30,K:150}},
  {id:"milk_6",name:"Молоко 6%",category:"dairy",kcal:85,protein:3,fat:6,carbs:4.5,fiber:0,gi:30,servingSize:"200 мл",bestFor:["mass"],micros:{Ca:120,P:90,VitB2:0.2,VitB12:0.4,VitA:60,VitD:0.5,K:150}},
  {id:"cream_10",name:"Сливки 10%",category:"dairy",kcal:119,protein:3,fat:10,carbs:4.2,fiber:0,gi:15,servingSize:"50 г",tier:"basic",bestFor:["mass"],micros:{Ca:80,VitA:140,VitD:0.3,VitE:0.4,VitB2:0.15}},
  {id:"cream_33_heavy",name:"Сливки 33%",category:"dairy",kcal:333,protein:2.5,fat:33,carbs:3,fiber:0,gi:15,servingSize:"30 г",bestFor:["mass"],micros:{Ca:75,VitA:280,VitD:0.6,VitE:0.8,VitB2:0.1}},
  {id:"cream_35",name:"Сливки 35%",category:"dairy",kcal:350,protein:2.2,fat:35,carbs:3,fiber:0,gi:15,servingSize:"30 г",bestFor:["mass"],micros:{Ca:70,VitA:300,VitD:0.7,VitE:0.9,VitB2:0.1}},
  {id:"condensed_milk",name:"Сгущённое молоко",category:"dairy",kcal:328,protein:7,fat:9,carbs:56,fiber:0,gi:65,servingSize:"30 г",bestFor:["mass"],micros:{Ca:240,P:190,Zn:0.7,VitB2:0.3,VitB12:0.3,VitA:80}},
  {id:"evaporated_milk",name:"Молоко концентрированное (7.5%)",category:"dairy",kcal:135,protein:7,fat:7.5,carbs:10,fiber:0,gi:35,servingSize:"50 г",bestFor:["mass"],micros:{Ca:240,P:190,Zn:0.8,VitB2:0.3,VitB12:0.3,VitA:80,K:300}},
  {id:"goat_milk",name:"Козье молоко 3.5%",category:"dairy",kcal:68,protein:3.3,fat:3.5,carbs:4.5,fiber:0,gi:25,servingSize:"200 мл",bestFor:["maintenance"],micros:{Ca:130,P:100,Mg:14,VitA:40,VitB2:0.14,VitB12:0.1,K:180}},
  {id:"sheep_milk",name:"Овечье молоко 6%",category:"dairy",kcal:95,protein:5.4,fat:6,carbs:5,fiber:0,gi:25,servingSize:"200 мл",bestFor:["mass"],micros:{Ca:190,P:150,Zn:0.7,Mg:18,VitA:60,VitB2:0.3,VitB12:0.7,VitB9:5,K:200}},
  {id:"coconut_milk_drink",name:"Кокосовое молоко (питьевое)",category:"dairy",kcal:30,protein:0.3,fat:2,carbs:2.5,fiber:0,gi:10,servingSize:"200 мл",tier:"basic",isVegan:true,isDairyFree:true,isGlutenFree:true,micros:{Ca:120,VitD:1,VitB12:0.5,Mg:10,K:150}},
  {id:"coconut_cream_tinned",name:"Кокосовые сливки (конс.)",category:"dairy",kcal:250,protein:2,fat:25,carbs:4,fiber:0.5,gi:10,servingSize:"50 мл",tier:"mid",isVegan:true,isDairyFree:true,micros:{Fe:2,Mg:25,P:40,K:150,Mn:0.6,Se:4}},
  {id:"milk_baked",name:"Молоко топлёное 4%",category:"dairy",kcal:67,protein:3,fat:4,carbs:4.5,fiber:0,gi:30,servingSize:"200 мл",bestFor:["mass","maintenance"],micros:{Ca:120,P:90,VitB2:0.2,VitB12:0.4,VitA:60,VitD:0.3,K:150}},
  {id:"lactose_free_milk",name:"Молоко безлактозное 1.5%",category:"dairy",kcal:38,protein:3,fat:1.5,carbs:4.7,fiber:0,gi:30,servingSize:"200 мл",tier:"mid",isGlutenFree:true,micros:{Ca:120,P:90,VitB2:0.2,VitB12:0.5,VitD:1,K:150}},
  {id:"milk_powder_full",name:"Сухое молоко (цельное 25%)",category:"dairy",kcal:490,protein:26,fat:25,carbs:38,fiber:0,gi:35,servingSize:"30 г",tier:"basic",bestFor:["mass"],micros:{Ca:900,P:700,Zn:3.5,Se:15,VitA:250,VitB2:1.3,VitB12:2.5,K:1300}},
  {id:"milk_powder_skim",name:"Сухое молоко (обезжиренное)",category:"dairy",kcal:360,protein:36,fat:0.7,carbs:52,fiber:0,gi:35,servingSize:"30 г",tier:"basic",bestFor:["cutting","mass"],micros:{Ca:1250,P:970,Zn:4,Se:12,VitB2:1.5,VitB12:2.5,K:1500}},

  // ═══════════════════════════════════════════════════════════════
  // OILS & ANIMAL FATS (15)
  // ═══════════════════════════════════════════════════════════════
  {id:"oil_walnut",name:"Масло грецкого ореха",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"max",bestFor:["mass"],micros:{Omega3:10400,VitE:4.1,VitK:2.7,OleicAcid:22}},
  {id:"oil_grapeseed_cold",name:"Масло виноградной косточки",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"basic",micros:{VitE:29,VitK:7.6,Omega3:100,Omega6:69500}},
  {id:"oil_hemp_organic",name:"Конопляное масло",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"mid",bestFor:["maintenance"],micros:{Omega3:22000,Omega6:55000,VitE:5.5,VitK:10}},
  {id:"oil_palm",name:"Пальмовое масло",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"basic",micros:{VitE:15.9,VitK:8,VitA:80,OleicAcid:37}},
  {id:"lard",name:"Сало свиное (топлёный жир)",category:"fat",kcal:897,protein:0,fat:99.5,carbs:0,fiber:0,gi:0,servingSize:"15 г",tier:"basic",bestFor:["mass"],micros:{VitD:2.5,VitE:1.5,VitB1:0.2,VitB2:0.1,Cholesterol:95,Se:5}},
  {id:"tallow",name:"Говяжий жир топлёный",category:"fat",kcal:902,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 г",tier:"basic",bestFor:["mass"],micros:{VitE:2.7,VitK:5,VitA:50,Cholesterol:110,Se:3}},
  {id:"duck_fat",name:"Утиный жир",category:"fat",kcal:890,protein:0,fat:99,carbs:0,fiber:0,gi:0,servingSize:"15 г",tier:"mid",bestFor:["mass"],micros:{VitE:4.5,OleicAcid:52,VitK:3,Cholesterol:100}},
  {id:"goose_fat",name:"Гусиный жир",category:"fat",kcal:896,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 г",tier:"mid",bestFor:["mass"],micros:{VitE:5.2,VitK:4,OleicAcid:55,Cholesterol:95}},
  {id:"oil_macadamia",name:"Масло макадамии",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"max",bestFor:["mass"],micros:{OleicAcid:82,VitE:4.5,VitK:6.5,Omega3:2200}},
  {id:"oil_almond",name:"Миндальное масло",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"mid",micros:{VitE:39,VitK:7,Omega3:1700,Omega6:17500,OleicAcid:70}},
  {id:"oil_mustard_pressed",name:"Горчичное масло",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"mid",micros:{Omega3:6000,Omega6:15000,VitE:13,VitK:5,OleicAcid:30}},
  {id:"oil_pumpkin_seed_cold",name:"Масло тыквенных семечек",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"max",micros:{VitE:15,VitK:25,Zn:0.5,Omega3:15000,Omega6:40000,OleicAcid:25}},
  {id:"oil_rice_bran_organic",name:"Масло рисовых отрубей",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"mid",micros:{VitE:32,VitK:7,VitB3:2,OleicAcid:42,Omega3:1600}},
  {id:"oil_perilla",name:"Перилловое масло",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"max",bestFor:["maintenance"],micros:{Omega3:60000,Omega6:15000,VitE:3.5,OleicAcid:16}},
  {id:"oil_hazelnut",name:"Масло фундука",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"mid",micros:{VitE:47,VitK:6,OleicAcid:78,Omega3:1000,Omega6:11000}},

  // ═══════════════════════════════════════════════════════════════
  // NUTS (20)
  // ═══════════════════════════════════════════════════════════════
  {id:"tiger_nuts",name:"Чуфа (тигровый орех)",category:"fat",kcal:400,protein:5,fat:25,carbs:40,fiber:10,gi:20,servingSize:"30 г",tier:"mid",bestFor:["maintenance"],micros:{Fe:3.5,Mg:80,P:150,K:400,Zn:2,Cu:0.4,VitE:5}},
  {id:"hickory_nuts",name:"Гикори (пекан американский)",category:"fat",kcal:690,protein:9,fat:71,carbs:14,fiber:9.5,gi:10,servingSize:"30 г",tier:"mid",bestFor:["mass"],micros:{Mn:4.3,Cu:1.1,Zn:4,Mg:115,VitB1:0.6,VitE:1.2}},
  {id:"butternut",name:"Орех масляный (белый)",category:"fat",kcal:612,protein:12,fat:62,carbs:18,fiber:6,gi:10,servingSize:"30 г",tier:"mid",bestFor:["mass","maintenance"],micros:{Mg:150,P:340,Zn:3.5,Cu:0.9,Mn:3,Fe:4,VitE:2.5}},
  {id:"mixed_nuts_roasted",name:"Смесь орехов жареная",category:"fat",kcal:610,protein:16,fat:55,carbs:18,fiber:7,gi:15,servingSize:"30 г",tier:"basic",bestFor:["mass","maintenance"],micros:{Mg:150,P:320,Zn:3.5,Fe:3,Cu:0.8,Mn:1.5,VitE:6}},
  {id:"nut_blend_raw",name:"Ореховый микс сырой",category:"fat",kcal:600,protein:17,fat:52,carbs:19,fiber:8,gi:10,servingSize:"30 г",tier:"basic",bestFor:["mass","maintenance"],micros:{Mg:180,P:350,Zn:4,Fe:3.5,Cu:1,Mn:2,VitE:7}},
  {id:"almond_flour",name:"Миндальная мука",category:"fat",kcal:580,protein:21,fat:51,carbs:20,fiber:11,gi:10,servingSize:"30 г",tier:"mid",bestFor:["cutting","mass"],isGlutenFree:true,micros:{Ca:250,Fe:3.5,Mg:260,P:490,Zn:3,Cu:0.9,Mn:1.5,VitE:25}},
  {id:"hazelnut_paste",name:"Паста из фундука (урбеч)",category:"fat",kcal:625,protein:15,fat:60,carbs:17,fiber:9,gi:10,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{VitE:15,Mn:6,Cu:1.7,Mg:160,Fe:4.5,P:300,VitB6:0.5}},
  {id:"pistachio_paste",name:"Фисташковая паста",category:"fat",kcal:560,protein:20,fat:45,carbs:28,fiber:10,gi:15,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{VitB6:1.7,Cu:1.3,Mn:1.2,P:490,Mg:120,K:1000,Fe:3.8}},
  {id:"peanut_flour_defatted",name:"Арахисовая мука (обезжиренная)",category:"fat",kcal:330,protein:53,fat:5,carbs:22,fiber:14,gi:15,servingSize:"20 г",tier:"mid",bestFor:["cutting"],isGlutenFree:true,micros:{Fe:3.5,Mg:190,P:440,Zn:3.5,Cu:0.6,Mn:1.8,VitB3:13}},
  {id:"coconut_flakes",name:"Кокосовая стружка",category:"fat",kcal:660,protein:7,fat:65,carbs:24,fiber:16,gi:20,servingSize:"20 г",tier:"basic",bestFor:["mass"],isVegan:true,isDairyFree:true,isGlutenFree:true,micros:{Fe:3.5,Mg:90,P:200,Zn:2,Cu:0.4,Mn:2,Se:10}},
  {id:"cashew_butter",name:"Паста кешью (урбеч)",category:"fat",kcal:550,protein:18,fat:44,carbs:30,fiber:3,gi:20,servingSize:"30 г",tier:"max",bestFor:["mass","maintenance"],micros:{Mg:260,P:480,Fe:6.5,Zn:5.5,Cu:2,Mn:1.5,VitK:30,Se:10}},
  {id:"almond_butter",name:"Миндальная паста (урбеч)",category:"fat",kcal:580,protein:21,fat:50,carbs:22,fiber:12,gi:10,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Ca:250,Fe:3.5,Mg:260,P:500,Zn:3,Cu:0.9,Mn:2,VitE:25}},
  {id:"walnut_butter",name:"Паста грецкого ореха",category:"fat",kcal:650,protein:15,fat:64,carbs:14,fiber:6,gi:10,servingSize:"30 г",tier:"max",bestFor:["mass"],micros:{Omega3:9000,Mg:150,P:350,Zn:3,Cu:1.5,Mn:3,Fe:3,VitE:2}},
  {id:"pecan_halves",name:"Пекан (половинки сырые)",category:"fat",kcal:690,protein:9,fat:72,carbs:14,fiber:9.5,gi:10,servingSize:"30 г",tier:"mid",bestFor:["mass"],micros:{Mn:4.5,Cu:1.2,Zn:4.5,Mg:120,VitB1:0.7,VitE:1.4}},
  {id:"chestnut_roasted",name:"Каштан жареный",category:"fat",kcal:245,protein:3.2,fat:2.2,carbs:53,fiber:5,gi:60,servingSize:"50 г",tier:"basic",bestFor:["maintenance"],isGlutenFree:true,micros:{K:500,Mg:30,P:90,Fe:1.2,Cu:0.3,Mn:0.5,VitC:26,VitB6:0.3}},
  {id:"chestnut_raw",name:"Каштан сырой (очищенный)",category:"fat",kcal:195,protein:2.4,fat:1.3,carbs:44,fiber:4,gi:55,servingSize:"50 г",tier:"basic",bestFor:["maintenance"],isGlutenFree:true,micros:{K:450,Mg:25,P:80,Fe:1,Cu:0.3,Mn:0.4,VitC:40,VitB6:0.2}},
  {id:"pistachio_roasted_salted",name:"Фисташки жареные солёные",category:"fat",kcal:565,protein:20,fat:46,carbs:27,fiber:10,gi:15,servingSize:"30 г",tier:"basic",bestFor:["mass"],micros:{VitB6:1.6,Cu:1.2,Mn:1,P:470,Mg:118,K:980,Fe:3.7,Na:450}},
  {id:"macadamia_roasted",name:"Макадамия жареная",category:"fat",kcal:720,protein:8,fat:76,carbs:14,fiber:8,gi:10,servingSize:"30 г",tier:"mid",bestFor:["mass"],micros:{Mn:4,Cu:0.7,Mg:125,Fe:3.5,VitB1:1.1,VitB3:2.3}},
  {id:"almond_smoked",name:"Миндаль копчёный",category:"fat",kcal:590,protein:21,fat:51,carbs:20,fiber:11,gi:10,servingSize:"30 г",tier:"mid",bestFor:["mass"],micros:{Ca:260,Fe:3.8,Mg:260,P:490,Zn:3.2,Cu:1,Mn:2,VitE:24,Na:180}},
  {id:"walnut_halves",name:"Грецкий орех (половинки)",category:"fat",kcal:654,protein:15,fat:65,carbs:14,fiber:6.5,gi:10,servingSize:"30 г",tier:"basic",bestFor:["mass"],micros:{Omega3:9000,Mg:158,P:346,Zn:3.1,Cu:1.6,Mn:3.4,Fe:2.9,VitE:2.6}},

  // ═══════════════════════════════════════════════════════════════
  // SEEDS (15)
  // ═══════════════════════════════════════════════════════════════
  {id:"sesame_seeds",name:"Кунжут (семена)",category:"fat",kcal:573,protein:18,fat:50,carbs:23,fiber:12,gi:10,servingSize:"15 г",tier:"basic",bestFor:["maintenance"],micros:{Ca:975,Fe:14.6,Mg:350,P:630,Zn:7.8,Cu:1.4,Mn:2.5,VitB1:0.8}},
  {id:"nigella_seeds",name:"Чернушка (калинджи, чёрный тмин)",category:"fat",kcal:350,protein:16,fat:20,carbs:40,fiber:8,gi:10,servingSize:"5 г",tier:"max",bestFor:["maintenance"],micros:{Fe:5,Ca:180,Mg:80,P:250,Zn:1.5,Cu:0.4,VitE:3,VitB3:2}},
  {id:"fenugreek_seeds",name:"Пажитник (семена)",category:"fat",kcal:323,protein:23,fat:6,carbs:58,fiber:25,gi:15,servingSize:"10 г",tier:"mid",bestFor:["mass","maintenance"],micros:{Fe:33,Mg:190,P:300,Zn:2.5,Cu:1.1,Mn:1.2,VitB1:0.3,VitB3:1.6}},
  {id:"cumin_seeds",name:"Кумин (зира)",category:"fat",kcal:375,protein:18,fat:22,carbs:44,fiber:10,gi:5,servingSize:"5 г",tier:"basic",bestFor:["maintenance"],micros:{Fe:66,Ca:930,Mg:365,P:500,Zn:4.8,Cu:0.9,Mn:3.3,K:1780}},
  {id:"coriander_seeds",name:"Кориандр (семена)",category:"fat",kcal:298,protein:12,fat:17,carbs:55,fiber:12,gi:5,servingSize:"5 г",tier:"basic",micros:{Fe:8,Ca:709,Mg:330,P:370,Zn:3,K:870,Mn:1.9,Cu:0.9}},
  {id:"fennel_seeds",name:"Фенхель (семена)",category:"fat",kcal:345,protein:16,fat:14,carbs:52,fiber:14,gi:5,servingSize:"5 г",tier:"basic",bestFor:["maintenance"],micros:{Ca:1200,Fe:18.5,Mg:385,P:480,K:1700,Zn:4,Cu:1,Mn:6.5}},
  {id:"mustard_seeds",name:"Горчица (семена)",category:"fat",kcal:508,protein:26,fat:36,carbs:28,fiber:12,gi:5,servingSize:"5 г",tier:"basic",micros:{Se:200,Fe:9.2,Mg:370,P:840,K:738,Zn:6,Cu:0.6,Mn:2}},
  {id:"caraway_seeds",name:"Тмин (семена)",category:"fat",kcal:333,protein:20,fat:14,carbs:49,fiber:13,gi:5,servingSize:"5 г",tier:"basic",micros:{Fe:16,Ca:690,Mg:260,P:500,K:1350,Zn:5.5,Cu:0.9,Mn:2.7,VitE:2.5}},
  {id:"psyllium_husk",name:"Псиллиум (шелуха подорожника)",category:"supplement",kcal:200,protein:2.5,fat:0.5,carbs:85,fiber:80,gi:0,servingSize:"10 г",tier:"basic",bestFor:["cutting"],isVegan:true,isGlutenFree:true,micros:{Ca:30,Fe:1.5,Mg:15,P:20,K:200,Zn:0.2}},
  {id:"amaranth_seeds",name:"Амарант (семена)",category:"fat",kcal:370,protein:14,fat:7,carbs:65,fiber:7,gi:35,servingSize:"30 г",tier:"mid",bestFor:["maintenance"],isGlutenFree:true,micros:{Fe:7.5,Mg:250,P:560,K:500,Zn:2.9,Cu:0.5,Mn:3,VitB6:0.6,VitB9:85}},
  {id:"quinoa_seeds",name:"Киноа (зерно, семена)",category:"fat",kcal:368,protein:14,fat:6,carbs:64,fiber:7,gi:35,servingSize:"50 г",tier:"basic",bestFor:["maintenance"],isGlutenFree:true,micros:{Fe:4.6,Mg:200,P:460,K:560,Zn:3.1,Cu:0.6,Mn:2,VitB9:180}},
  {id:"basil_seeds",name:"Семена базилика (тулси)",category:"fat",kcal:340,protein:14,fat:14,carbs:50,fiber:40,gi:5,servingSize:"10 г",tier:"mid",bestFor:["maintenance"],isVegan:true,micros:{Ca:300,Fe:8.5,Mg:160,P:210,K:1300,Zn:2,Cu:0.6,Mn:1.8}},
  {id:"celery_seeds",name:"Сельдерей (семена)",category:"fat",kcal:392,protein:18,fat:25,carbs:41,fiber:12,gi:5,servingSize:"5 г",tier:"basic",micros:{Ca:1760,Fe:44,Mg:440,P:550,Zn:7,K:1400,Cu:1.4,Mn:2.7}},
  {id:"dill_seeds",name:"Укроп (семена)",category:"fat",kcal:305,protein:16,fat:14,carbs:55,fiber:22,gi:5,servingSize:"5 г",tier:"basic",micros:{Ca:1500,Fe:16,Mg:255,P:280,K:1190,Zn:5,Cu:1.1,Mn:2}},
  {id:"anise_seeds",name:"Анис (семена)",category:"fat",kcal:337,protein:18,fat:16,carbs:50,fiber:15,gi:5,servingSize:"5 г",tier:"basic",micros:{Ca:650,Fe:37,Mg:170,P:440,K:1440,Zn:5.3,Cu:1,Mn:2.3,VitC:21}},
];
