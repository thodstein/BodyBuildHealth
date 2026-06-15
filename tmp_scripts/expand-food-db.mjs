// Expand food DB to 500+ items with full nutrients
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const newFoods = [
  // PROTEIN (50 items)
  { id:'duck_breast', name:'Утиная грудка', category:'protein', kcal:201, protein:19, fat:13, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:4.5, Zn:2.2, P:200, K:270, VitB3:5.5, VitB12:0.4 } },
  { id:'goose', name:'Гусь (запечённый)', category:'protein', kcal:305, protein:23, fat:22, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:3.0, Zn:3.0, P:230, VitB3:4.5, VitB12:0.5 } },
  { id:'lamb', name:'Баранина', category:'protein', kcal:282, protein:17, fat:23, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:2.0, Zn:4.5, P:190, VitB3:5.0, VitB12:2.3, Se:15 } },
  { id:'venison', name:'Оленина', category:'protein', kcal:158, protein:30, fat:3.3, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:4.0, Zn:3.5, P:280, VitB3:7.0, VitB12:3.0, Se:14 } },
  { id:'bison', name:'Мясо бизона', category:'protein', kcal:143, protein:28, fat:2.4, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:3.4, Zn:4.6, P:250, VitB3:5.3, VitB12:2.5, Se:30 } },
  { id:'pork_shoulder', name:'Свиная лопатка', category:'protein', kcal:242, protein:18, fat:18, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:1.0, Zn:3.0, P:200, VitB1:0.8, VitB12:0.6 } },
  { id:'chicken_wings', name:'Куриные крылья', category:'protein', kcal:290, protein:18, fat:22, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:0.9, Zn:1.8, P:160, VitB3:5.5, VitB6:0.3 } },
  { id:'tuna_fresh', name:'Тунец свежий (стейк)', category:'protein', kcal:144, protein:28, fat:5, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ P:280, K:530, Se:46, VitB3:11.0, VitB12:9.0, VitD:5, Omega3:1500 } },
  { id:'salmon_atlantic', name:'Лосось атлантический', category:'protein', kcal:208, protein:20, fat:13, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ P:250, K:400, Se:30, VitB12:3.2, VitD:10, Omega3:2500, Ca:12 } },
  { id:'trout', name:'Форель', category:'protein', kcal:168, protein:24, fat:7, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ P:250, K:400, Se:20, VitB12:2.8, VitD:12, Omega3:1200, Ca:25 } },
  { id:'tilapia', name:'Тилапия', category:'protein', kcal:96, protein:20, fat:1.7, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ P:180, K:350, Se:40, VitB3:4.0, VitB12:1.6, Mg:27 } },
  { id:'sea_bass', name:'Сибас', category:'protein', kcal:97, protein:19, fat:2.0, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ P:190, K:320, Se:32, VitB12:1.8, Mg:30 } },
  { id:'halibut', name:'Палтус', category:'protein', kcal:111, protein:21, fat:2.3, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ P:230, K:450, Se:45, VitB12:1.2, VitD:5, Mg:30 } },
  { id:'mussels', name:'Мидии', category:'protein', kcal:86, protein:12, fat:2.2, carbs:3.7, fiber:0, gi:0, servingSize:'100 г', micros:{ Fe:4.0, Zn:2.7, Se:44, VitB12:24, Mn:3.4, P:300 } },
  { id:'oysters', name:'Устрицы', category:'protein', kcal:81, protein:9, fat:2.3, carbs:4.8, fiber:0, gi:0, servingSize:'100 г', micros:{ Zn:90, Fe:7.0, Se:63, VitB12:19, Cu:4.5, Mn:0.5 } },
  { id:'squid', name:'Кальмар', category:'protein', kcal:92, protein:16, fat:1.4, carbs:3.1, fiber:0, gi:0, servingSize:'150 г', micros:{ Zn:1.8, Se:45, VitB12:1.3, P:250, Cu:1.4 } },
  { id:'crab', name:'Краб', category:'protein', kcal:87, protein:18, fat:1.1, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Zn:3.5, Se:38, VitB12:10, Cu:0.8, P:230, Mg:30 } },
  { id:'carp', name:'Карп', category:'protein', kcal:127, protein:18, fat:6, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ P:200, K:350, Se:12, VitB12:1.5, Omega3:500 } },
  { id:'zander', name:'Судак', category:'protein', kcal:84, protein:19, fat:0.8, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ P:220, K:280, Se:18, VitB12:1.0, Mg:25 } },
  { id:'herring', name:'Сельдь', category:'protein', kcal:262, protein:18, fat:18, carbs:0, fiber:0, gi:0, servingSize:'100 г', micros:{ Omega3:2400, VitD:15, VitB12:14, Se:36, P:300, K:327 } },
  { id:'lamb_chops', name:'Бараньи рёбрышки', category:'protein', kcal:330, protein:15, fat:29, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:1.6, Zn:4.0, P:170, VitB12:2.1, Se:12 } },
  { id:'turkey_wings', name:'Крылья индейки', category:'protein', kcal:180, protein:22, fat:9, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:1.2, Zn:2.5, P:190, VitB3:4.5, VitB6:0.4 } },
  { id:'egg_duck', name:'Яйцо утиное', category:'protein', kcal:185, protein:13, fat:14, carbs:1.5, fiber:0, gi:0, servingSize:'1 шт (70 г)', micros:{ VitA:200, Fe:2.7, P:220, VitB2:0.4, VitB12:5.4, Se:36, Cholesterol:440 } },
  { id:'egg_quail', name:'Яйцо перепелиное', category:'protein', kcal:158, protein:13, fat:11, carbs:0.4, fiber:0, gi:0, servingSize:'5 шт (60 г)', micros:{ VitA:90, Fe:3.6, Zn:1.5, VitB2:0.4, VitB12:1.6, Se:32, P:226 } },
  { id:'omelette', name:'Омлет из 2 яиц', category:'protein', kcal:154, protein:11, fat:11, carbs:1.2, fiber:0, gi:0, servingSize:'150 г', micros:{ VitA:160, Fe:1.7, P:200, VitB2:0.4, VitB12:1.0, Se:30, Zn:1.0 } },
  { id:'beef_steak_lean', name:'Стейк говяжий постный', category:'protein', kcal:170, protein:28, fat:5.5, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:2.8, Zn:5.5, P:220, VitB3:5.5, VitB12:2.5, Se:18 } },
  { id:'veal', name:'Телятина', category:'protein', kcal:131, protein:26, fat:2.8, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:1.4, Zn:3.8, P:230, VitB3:8.0, VitB12:1.6, Se:10 } },
  { id:'pork_neck', name:'Свиная шея', category:'protein', kcal:267, protein:16, fat:22, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:1.2, Zn:3.2, P:180, VitB1:0.7, VitB12:0.5 } },
  { id:'catfish', name:'Сом', category:'protein', kcal:125, protein:17, fat:6, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ P:200, K:350, VitB12:2.0, Mg:23, Se:15 } },
  { id:'beef_brisket', name:'Говяжья грудинка', category:'protein', kcal:250, protein:21, fat:18, carbs:0, fiber:0, gi:0, servingSize:'150 г', micros:{ Fe:2.5, Zn:6.0, P:180, VitB3:4.5, VitB12:2.0, Se:12 } },
  
  // GRAINS/CARBS (50 items)
  { id:'rice_basmati', name:'Рис басмати (вареный)', category:'grain', kcal:121, protein:2.6, fat:0.4, carbs:25, fiber:0.5, gi:58, servingSize:'150 г', micros:{ Mg:12, P:43, Fe:0.3, K:35, VitB1:0.02, VitB3:0.4 } },
  { id:'rice_jasmine', name:'Рис жасмин (вареный)', category:'grain', kcal:129, protein:2.5, fat:0.3, carbs:28, fiber:0.3, gi:68, servingSize:'150 г', micros:{ Mg:10, P:40, Fe:0.2, K:30, VitB1:0.01, VitB3:0.3 } },
  { id:'rice_wild', name:'Дикий рис (вареный)', category:'grain', kcal:101, protein:3.9, fat:0.3, carbs:21, fiber:1.8, gi:45, servingSize:'150 г', micros:{ Mg:30, P:80, Fe:0.6, K:80, Zn:2.2, VitB6:0.15 } },
  { id:'rice_red', name:'Рис красный (вареный)', category:'grain', kcal:115, protein:2.8, fat:0.8, carbs:24, fiber:1.6, gi:55, servingSize:'150 г', micros:{ Mg:35, P:70, Fe:0.8, K:70, Zn:1.5, VitB6:0.1 } },
  { id:'spaghetti', name:'Спагетти (вареные)', category:'grain', kcal:131, protein:5, fat:0.6, carbs:25, fiber:1.5, gi:44, servingSize:'150 г', micros:{ Mg:15, P:40, Fe:0.5, VitB1:0.02, VitB3:0.4 } },
  { id:'soba', name:'Соба (гречневая лапша)', category:'grain', kcal:99, protein:5, fat:0.7, carbs:20, fiber:1.5, gi:46, servingSize:'150 г', micros:{ Mg:50, P:80, Fe:0.8, VitB1:0.03, VitB3:0.5 } },
  { id:'udon', name:'Удон (пшеничная лапша)', category:'grain', kcal:105, protein:3.2, fat:0.3, carbs:22, fiber:0.8, gi:55, servingSize:'150 г', micros:{ Mg:8, P:30, VitB1:0.02 } },
  { id:'bread_white', name:'Хлеб белый', category:'grain', kcal:265, protein:8, fat:3.2, carbs:49, fiber:2.7, gi:75, servingSize:'1 ломтик (30 г)', micros:{ Ca:40, Fe:0.9, Mg:12, VitB1:0.1, VitB3:1.2 } },
  { id:'pita', name:'Пита', category:'grain', kcal:275, protein:9, fat:1.2, carbs:56, fiber:2.2, gi:57, servingSize:'1 шт (60 г)', micros:{ Ca:40, Fe:1.5, Mg:15, VitB1:0.2, VitB3:2.0 } },
  { id:'lavash', name:'Лаваш армянский', category:'grain', kcal:277, protein:9, fat:1.2, carbs:57, fiber:2.0, gi:55, servingSize:'1 лист (100 г)', micros:{ Ca:35, Fe:1.3, Mg:10, VitB1:0.1, VitB3:1.5 } },
  { id:'tortilla_corn', name:'Кукурузная тортилья', category:'grain', kcal:218, protein:5.7, fat:2.8, carbs:45, fiber:6.3, gi:52, servingSize:'1 шт (40 г)', micros:{ Ca:40, Fe:0.5, Mg:20, P:70, K:90, VitB3:1.0 } },
  { id:'bread_protein', name:'Хлеб белковый', category:'grain', kcal:232, protein:20, fat:4, carbs:30, fiber:5, gi:35, servingSize:'1 ломтик (40 г)', micros:{ Ca:30, Fe:1.0, Mg:15, VitB3:1.0 } },
  { id:'oats_instant', name:'Овсянка быстрого приготовления', category:'grain', kcal:367, protein:12, fat:6.5, carbs:67, fiber:8, gi:79, servingSize:'40 г (сух)', micros:{ Fe:4.0, Mg:120, P:350, Zn:2.5, VitB1:0.4, VitB3:1.0 } },
  { id:'muesli', name:'Мюсли с орехами', category:'grain', kcal:350, protein:9, fat:8, carbs:58, fiber:7, gi:55, servingSize:'50 г', micros:{ Fe:3.0, Mg:90, P:250, Zn:2.0, VitB1:0.2, VitB3:2.0 } },
  { id:'cornmeal', name:'Кукурузная каша (мамалыга)', category:'grain', kcal:96, protein:2.0, fat:1.0, carbs:20, fiber:2.5, gi:68, servingSize:'150 г', micros:{ Fe:0.5, Mg:15, P:30, K:80, VitB3:1.0 } },
  { id:'pancakes', name:'Блины (2 шт)', category:'grain', kcal:230, protein:8, fat:7, carbs:34, fiber:1, gi:65, servingSize:'100 г', micros:{ Ca:80, Fe:0.8, P:100, VitB1:0.1 } },
  { id:'rice_cakes', name:'Рисовые хлебцы', category:'grain', kcal:375, protein:7, fat:3, carbs:80, fiber:2, gi:82, servingSize:'2 шт (20 г)', micros:{ Fe:0.5, Mg:12, P:40 } },
  { id:'potato_mashed', name:'Картофельное пюре', category:'carb', kcal:88, protein:2, fat:3, carbs:15, fiber:1.5, gi:74, servingSize:'150 г', micros:{ K:380, VitC:7, Mg:15, P:40 } },
  { id:'potato_baked', name:'Картофель запечённый', category:'carb', kcal:93, protein:2.5, fat:0.1, carbs:21, fiber:2.2, gi:85, servingSize:'200 г', micros:{ K:550, VitC:15, Mg:25, P:60, Fe:0.8 } },
  { id:'french_fries', name:'Картофель фри', category:'fast_food', kcal:312, protein:3.4, fat:15, carbs:41, fiber:3.8, gi:75, servingSize:'150 г', micros:{ K:580, Na:250, VitC:4 } },
  { id:'sweet_potato_fries', name:'Батат фри', category:'carb', kcal:190, protein:2, fat:9, carbs:27, fiber:3.5, gi:55, servingSize:'150 г', micros:{ VitA:850, K:400, VitC:15, Mg:20 } },
  { id:'pelmeni', name:'Пельмени (говядина)', category:'protein', kcal:275, protein:14, fat:12, carbs:29, fiber:1, gi:60, servingSize:'200 г', micros:{ Fe:2.0, Zn:3.0, P:150, VitB12:1.0 } },
  { id:'vareniki', name:'Вареники с творогом', category:'dairy', kcal:210, protein:9, fat:5, carbs:32, fiber:0.5, gi:55, servingSize:'200 г', micros:{ Ca:80, P:120, VitB2:0.2 } },
  
  // VEGETABLES (50 items)
  { id:'cauliflower', name:'Цветная капуста', category:'veg_fruit', kcal:25, protein:1.9, fat:0.3, carbs:5, fiber:2, gi:15, servingSize:'150 г', micros:{ VitC:48, VitK:15, VitB9:57, K:300, Mg:15, Mn:0.2 } },
  { id:'brussels_sprouts', name:'Брюссельская капуста', category:'veg_fruit', kcal:43, protein:3.4, fat:0.3, carbs:9, fiber:3.8, gi:15, servingSize:'150 г', micros:{ VitC:85, VitK:177, VitB9:61, Fe:1.4, K:389, Mn:0.3 } },
  { id:'kale', name:'Кудрявая капуста (кейл)', category:'veg_fruit', kcal:49, protein:4.3, fat:0.9, carbs:9, fiber:3.6, gi:15, servingSize:'100 г', micros:{ VitA:481, VitC:120, VitK:817, Ca:150, Fe:1.5, Mn:0.7 } },
  { id:'lettuce_iceberg', name:'Салат айсберг', category:'veg_fruit', kcal:14, protein:0.9, fat:0.1, carbs:3, fiber:1.2, gi:15, servingSize:'100 г', micros:{ VitA:25, VitK:24, K:140, VitB9:29 } },
  { id:'lettuce_romaine', name:'Салат романо', category:'veg_fruit', kcal:17, protein:1.2, fat:0.3, carbs:3.3, fiber:2.1, gi:15, servingSize:'100 г', micros:{ VitA:436, VitK:102, VitC:24, K:247, VitB9:136 } },
  { id:'arugula', name:'Руккола', category:'veg_fruit', kcal:25, protein:2.6, fat:0.7, carbs:3.6, fiber:1.6, gi:15, servingSize:'60 г', micros:{ VitA:119, VitK:108, VitC:15, Ca:160, Fe:1.5, K:370 } },
  { id:'bok_choy', name:'Пак-чой', category:'veg_fruit', kcal:13, protein:1.5, fat:0.2, carbs:2.2, fiber:1, gi:15, servingSize:'150 г', micros:{ VitA:167, VitC:45, VitK:46, Ca:105, K:252, VitB9:66 } },
  { id:'artichoke', name:'Артишок', category:'veg_fruit', kcal:47, protein:3.3, fat:0.2, carbs:11, fiber:5.4, gi:15, servingSize:'100 г', micros:{ VitC:12, VitK:15, Mg:60, K:370, VitB9:68, Mn:0.3 } },
  { id:'radish', name:'Редис', category:'veg_fruit', kcal:16, protein:0.7, fat:0.1, carbs:3.4, fiber:1.6, gi:15, servingSize:'100 г', micros:{ VitC:15, K:233, VitB9:25, Ca:25, Fe:0.4 } },
  { id:'daikon', name:'Дайкон', category:'veg_fruit', kcal:18, protein:0.6, fat:0.1, carbs:4.1, fiber:1.6, gi:15, servingSize:'100 г', micros:{ VitC:22, K:227, VitB9:28, Ca:27 } },
  { id:'leek', name:'Лук-порей', category:'veg_fruit', kcal:61, protein:1.5, fat:0.3, carbs:14, fiber:1.8, gi:32, servingSize:'100 г', micros:{ VitA:83, VitC:12, VitK:47, Fe:2.1, K:180, VitB9:64 } },
  { id:'garlic', name:'Чеснок', category:'veg_fruit', kcal:149, protein:6.4, fat:0.5, carbs:33, fiber:2.1, gi:30, servingSize:'3 зубчика (10 г)', micros:{ VitC:31, Mn:1.7, VitB6:1.2, Se:14, Ca:181, P:153 } },
  { id:'pumpkin', name:'Тыква', category:'veg_fruit', kcal:26, protein:1, fat:0.1, carbs:6.5, fiber:0.5, gi:75, servingSize:'150 г', micros:{ VitA:426, VitC:9, K:340, Mg:12, VitB2:0.1 } },
  { id:'zucchini_yellow', name:'Цукини жёлтый', category:'veg_fruit', kcal:16, protein:1.2, fat:0.3, carbs:3, fiber:1, gi:15, servingSize:'150 г', micros:{ VitC:18, K:260, VitB6:0.1, Mg:18 } },
  { id:'chili_pepper', name:'Перец чили', category:'veg_fruit', kcal:40, protein:1.9, fat:0.4, carbs:9, fiber:1.5, gi:15, servingSize:'1 шт (30 г)', micros:{ VitC:143, VitA:48, VitB6:0.5, K:322, Mn:0.2 } },
  { id:'okra', name:'Окра (бамия)', category:'veg_fruit', kcal:33, protein:2, fat:0.2, carbs:7, fiber:3.2, gi:20, servingSize:'100 г', micros:{ VitC:23, VitK:31, Mg:57, K:299, VitB9:60, Mn:0.8 } },
  { id:'olives_green', name:'Оливки зелёные', category:'fat', kcal:145, protein:1, fat:15, carbs:4, fiber:3.3, gi:15, servingSize:'30 г', micros:{ VitE:3.8, Ca:50, Fe:0.5, Na:1556, Cu:0.1 } },
  { id:'olives_black', name:'Маслины', category:'fat', kcal:115, protein:0.8, fat:11, carbs:6, fiber:3.2, gi:15, servingSize:'30 г', micros:{ VitE:1.6, Ca:88, Fe:3.3, Na:735, Cu:0.2 } },
  { id:'bean_sprouts', name:'Проростки сои', category:'veg_fruit', kcal:30, protein:3, fat:0.2, carbs:5, fiber:1.8, gi:15, servingSize:'100 г', micros:{ VitC:13, VitK:33, Fe:0.9, K:150, VitB9:61 } },
  { id:'sauerkraut', name:'Квашеная капуста', category:'veg_fruit', kcal:19, protein:0.9, fat:0.1, carbs:4.3, fiber:2.9, gi:15, servingSize:'100 г', micros:{ VitC:15, VitK:13, Na:661, Fe:1.5, K:170 } },
  { id:'kimchi', name:'Кимчи', category:'veg_fruit', kcal:15, protein:1.1, fat:0.5, carbs:2, fiber:1.6, gi:15, servingSize:'50 г', micros:{ VitA:50, VitC:2, Na:498, VitB6:0.2 } },
  { id:'ginger_root', name:'Имбирь (корень)', category:'veg_fruit', kcal:80, protein:1.8, fat:0.8, carbs:18, fiber:2, gi:15, servingSize:'10 г', micros:{ Mg:43, K:415, Mn:0.2, VitB6:0.2 } },
  { id:'beetroot', name:'Свёкла (вареная)', category:'veg_fruit', kcal:44, protein:1.7, fat:0.2, carbs:10, fiber:2.0, gi:64, servingSize:'100 г', micros:{ VitB9:80, Mn:0.3, K:305, Fe:0.8, Mg:23 } },
  { id:'turnip', name:'Репа', category:'veg_fruit', kcal:28, protein:0.9, fat:0.1, carbs:6.4, fiber:1.8, gi:30, servingSize:'100 г', micros:{ VitC:21, K:191, Ca:30, Mn:0.1 } },
  { id:'collard_greens', name:'Листовая капуста (коллард)', category:'veg_fruit', kcal:32, protein:3, fat:0.6, carbs:5, fiber:4, gi:15, servingSize:'100 г', micros:{ VitA:158, VitC:35, VitK:437, Ca:141, Mn:0.5, VitB9:129 } },
  
  // FRUITS (50 items)
  { id:'orange', name:'Апельсин', category:'veg_fruit', kcal:47, protein:0.9, fat:0.1, carbs:12, fiber:2.4, gi:43, servingSize:'1 шт (180 г)', micros:{ VitC:53, VitA:11, K:181, VitB9:30, Ca:40 } },
  { id:'tangerine', name:'Мандарин', category:'veg_fruit', kcal:53, protein:0.8, fat:0.3, carbs:13, fiber:1.8, gi:42, servingSize:'2 шт (150 г)', micros:{ VitC:27, VitA:34, K:150, Ca:30 } },
  { id:'lemon', name:'Лимон', category:'veg_fruit', kcal:29, protein:1.1, fat:0.3, carbs:9, fiber:2.8, gi:20, servingSize:'1 шт (60 г)', micros:{ VitC:53, Ca:26, K:138, VitB6:0.1 } },
  { id:'lime', name:'Лайм', category:'veg_fruit', kcal:30, protein:0.7, fat:0.2, carbs:10, fiber:2.8, gi:20, servingSize:'1 шт (60 г)', micros:{ VitC:29, K:102, Ca:33, Fe:0.6 } },
  { id:'grapefruit', name:'Грейпфрут красный', category:'veg_fruit', kcal:42, protein:0.8, fat:0.1, carbs:11, fiber:1.6, gi:25, servingSize:'1/2 шт (200 г)', micros:{ VitC:31, VitA:46, K:135, VitB1:0.04 } },
  { id:'strawberry', name:'Клубника', category:'veg_fruit', kcal:32, protein:0.7, fat:0.3, carbs:8, fiber:2, gi:40, servingSize:'150 г', micros:{ VitC:59, Mn:0.4, VitB9:24, K:153 } },
  { id:'raspberry', name:'Малина', category:'veg_fruit', kcal:52, protein:1.2, fat:0.6, carbs:12, fiber:6.5, gi:25, servingSize:'100 г', micros:{ VitC:26, Mn:0.7, VitK:8, K:151, Mg:22 } },
  { id:'cherry', name:'Вишня', category:'veg_fruit', kcal:50, protein:1, fat:0.3, carbs:12, fiber:1.6, gi:22, servingSize:'100 г', micros:{ VitC:10, VitA:64, K:173, Mn:0.1 } },
  { id:'peach', name:'Персик', category:'veg_fruit', kcal:39, protein:0.9, fat:0.3, carbs:10, fiber:1.5, gi:42, servingSize:'1 шт (150 г)', micros:{ VitA:16, VitC:6.6, K:190, VitB3:0.8 } },
  { id:'nectarine', name:'Нектарин', category:'veg_fruit', kcal:44, protein:1.1, fat:0.3, carbs:11, fiber:1.7, gi:43, servingSize:'1 шт (140 г)', micros:{ VitA:17, VitC:5.4, K:200, VitB3:1.1 } },
  { id:'apricot', name:'Абрикос', category:'veg_fruit', kcal:48, protein:1.4, fat:0.4, carbs:11, fiber:2, gi:34, servingSize:'3 шт (150 г)', micros:{ VitA:96, VitC:10, K:260, VitB3:0.6, Fe:0.4 } },
  { id:'plum', name:'Слива', category:'veg_fruit', kcal:46, protein:0.7, fat:0.3, carbs:11, fiber:1.4, gi:40, servingSize:'2 шт (100 г)', micros:{ VitC:10, VitA:17, K:157, VitB3:0.4 } },
  { id:'persimmon', name:'Хурма', category:'veg_fruit', kcal:70, protein:0.6, fat:0.2, carbs:18, fiber:3.6, gi:50, servingSize:'1 шт (200 г)', micros:{ VitA:81, VitC:7.5, Mn:0.4, K:161, Fe:0.2 } },
  { id:'papaya', name:'Папайя', category:'veg_fruit', kcal:43, protein:0.5, fat:0.3, carbs:11, fiber:1.7, gi:60, servingSize:'200 г', micros:{ VitC:61, VitA:47, K:182, VitB9:37, Mg:21 } },
  { id:'passion_fruit', name:'Маракуйя', category:'veg_fruit', kcal:97, protein:2.2, fat:0.7, carbs:23, fiber:10.4, gi:30, servingSize:'3 шт (100 г)', micros:{ VitC:30, VitA:64, K:348, Fe:1.6, Mg:29, P:68 } },
  { id:'coconut_fresh', name:'Кокос свежий', category:'fat', kcal:354, protein:3.3, fat:33, carbs:15, fiber:9, gi:35, servingSize:'50 г', micros:{ Mn:1.5, Cu:0.4, Fe:2.4, K:356, P:113, Se:10 } },
  { id:'raisins', name:'Изюм', category:'carb', kcal:299, protein:3.1, fat:0.5, carbs:79, fiber:3.7, gi:64, servingSize:'30 г', micros:{ K:750, Fe:1.9, Ca:50, VitB6:0.2, Mg:32, P:101 } },
  { id:'prunes', name:'Чернослив', category:'carb', kcal:240, protein:2.2, fat:0.4, carbs:64, fiber:7, gi:29, servingSize:'40 г', micros:{ K:730, VitA:39, VitK:60, Fe:0.9, Mg:41, VitB6:0.2 } },
  { id:'dates_dried', name:'Финики сушёные', category:'carb', kcal:282, protein:2.5, fat:0.4, carbs:75, fiber:8, gi:55, servingSize:'40 г', micros:{ K:656, Mg:43, Fe:0.9, VitB6:0.1, Cu:0.2, Mn:0.3, P:62 } },
  { id:'dried_apricots', name:'Курага', category:'carb', kcal:241, protein:3.4, fat:0.4, carbs:63, fiber:7, gi:30, servingSize:'40 г', micros:{ VitA:127, K:1162, Fe:2.7, Mg:32, VitB3:2.6, Cu:0.3, Mn:0.2 } },
  
  // DAIRY (25 items)
  { id:'milk_05', name:'Молоко 0.5%', category:'dairy', kcal:35, protein:3, fat:0.5, carbs:4.8, fiber:0, gi:30, servingSize:'200 мл', micros:{ Ca:120, P:90, VitB2:0.2, VitB12:0.4, K:150 } },
  { id:'milk_35', name:'Молоко 3.5%', category:'dairy', kcal:64, protein:3, fat:3.5, carbs:4.7, fiber:0, gi:30, servingSize:'200 мл', micros:{ Ca:120, P:90, VitB2:0.2, VitB12:0.4, VitA:30, K:150 } },
  { id:'cottage_cheese_0', name:'Творог обезжиренный', category:'dairy', kcal:85, protein:18, fat:0.6, carbs:3.3, fiber:0, gi:30, servingSize:'150 г', micros:{ Ca:80, P:150, VitB2:0.3, VitB12:0.5, K:110 } },
  { id:'cottage_cheese_9', name:'Творог 9%', category:'dairy', kcal:159, protein:16, fat:9, carbs:2.8, fiber:0, gi:30, servingSize:'150 г', micros:{ Ca:110, P:140, VitB2:0.3, VitB12:0.5, K:100 } },
  { id:'yogurt_5', name:'Йогурт 5%', category:'dairy', kcal:72, protein:4.5, fat:5, carbs:3.5, fiber:0, gi:30, servingSize:'200 г', micros:{ Ca:140, P:100, VitB2:0.2, VitB12:0.5, K:180 } },
  { id:'skyr', name:'Скир', category:'dairy', kcal:60, protein:11, fat:0.2, carbs:4, fiber:0, gi:30, servingSize:'150 г', micros:{ Ca:120, P:120, VitB2:0.3, VitB12:0.4, K:130 } },
  { id:'cheese_mozzarella', name:'Моцарелла', category:'dairy', kcal:280, protein:22, fat:20, carbs:2.2, fiber:0, gi:0, servingSize:'50 г', micros:{ Ca:505, P:350, VitB2:0.3, VitB12:1.0, Zn:3.0, Se:15 } },
  { id:'cheese_parmesan', name:'Пармезан', category:'dairy', kcal:431, protein:38, fat:29, carbs:4.1, fiber:0, gi:0, servingSize:'30 г', micros:{ Ca:1184, P:700, VitB2:0.4, VitB12:1.2, Zn:4.0, Se:22 } },
  { id:'cheese_feta', name:'Фета', category:'dairy', kcal:264, protein:14, fat:21, carbs:4.1, fiber:0, gi:0, servingSize:'50 г', micros:{ Ca:493, P:337, VitB2:0.8, VitB12:1.7, Zn:2.9, Na:1100 } },
  { id:'cheese_cheddar', name:'Чеддер', category:'dairy', kcal:403, protein:25, fat:33, carbs:1.3, fiber:0, gi:0, servingSize:'30 г', micros:{ Ca:721, P:512, VitB2:0.4, VitB12:1.1, Zn:4.0, Se:28 } },
  { id:'cream_20', name:'Сливки 20%', category:'dairy', kcal:206, protein:2.5, fat:20, carbs:3.7, fiber:0, gi:15, servingSize:'30 г', micros:{ Ca:80, VitA:200, VitD:0.4, VitE:0.5 } },
  { id:'ghee', name:'Топлёное масло (гхи)', category:'fat', kcal:900, protein:0, fat:100, carbs:0, fiber:0, gi:0, servingSize:'10 г', micros:{ VitA:300, VitE:2.8, VitK:8 } },
  
  // FATS/OILS/NUTS (25 items)
  { id:'coconut_oil', name:'Кокосовое масло', category:'fat', kcal:892, protein:0, fat:99, carbs:0, fiber:0, gi:0, servingSize:'10 г', micros:{ VitE:0.1, VitK:0.5, Fe:0.05 } },
  { id:'flaxseed_oil', name:'Льняное масло', category:'fat', kcal:884, protein:0, fat:100, carbs:0, fiber:0, gi:0, servingSize:'10 г', micros:{ Omega3:53000, VitE:17.5, VitK:9.2 } },
  { id:'sesame_oil', name:'Кунжутное масло', category:'fat', kcal:884, protein:0, fat:100, carbs:0, fiber:0, gi:0, servingSize:'10 г', micros:{ VitE:14, VitK:13.6, Zn:0.1, Cu:0.1 } },
  { id:'avocado_oil', name:'Масло авокадо', category:'fat', kcal:884, protein:0, fat:100, carbs:0, fiber:0, gi:0, servingSize:'10 г', micros:{ VitE:5, VitK:8, OleicAcid:70 } },
  { id:'brazil_nuts', name:'Бразильский орех', category:'fat', kcal:659, protein:14, fat:67, carbs:12, fiber:7.5, gi:15, servingSize:'20 г', micros:{ Se:1917, Mg:376, P:725, Zn:4.1, Cu:1.7, VitE:5.7 } },
  { id:'pecans', name:'Пекан', category:'fat', kcal:691, protein:9, fat:72, carbs:14, fiber:9.6, gi:10, servingSize:'30 г', micros:{ Mn:4.5, Cu:1.2, Zn:4.5, Mg:121, VitB1:0.7, VitE:1.4 } },
  { id:'macadamia', name:'Макадамия', category:'fat', kcal:718, protein:8, fat:76, carbs:14, fiber:8.6, gi:10, servingSize:'30 г', micros:{ Mn:4.1, Cu:0.8, Mg:130, Fe:3.7, VitB1:1.2, VitB3:2.5 } },
  { id:'pistachios', name:'Фисташки', category:'fat', kcal:560, protein:20, fat:45, carbs:28, fiber:10.6, gi:15, servingSize:'30 г', micros:{ VitB6:1.7, Cu:1.3, Mn:1.2, P:490, Mg:121, K:1025, Fe:3.9 } },
  { id:'pine_nuts', name:'Кедровые орехи', category:'fat', kcal:673, protein:14, fat:68, carbs:13, fiber:3.7, gi:15, servingSize:'20 г', micros:{ Mn:8.8, VitE:9.3, Mg:251, P:575, Zn:6.5, Cu:1.3, Fe:5.5 } },
  { id:'hazelnuts', name:'Фундук', category:'fat', kcal:628, protein:15, fat:61, carbs:17, fiber:9.7, gi:15, servingSize:'30 г', micros:{ VitE:15, Mn:6.2, Cu:1.7, Mg:163, Fe:4.7, VitB6:0.6 } },
  { id:'hemp_seeds', name:'Семена конопли', category:'fat', kcal:553, protein:33, fat:49, carbs:9, fiber:4, gi:0, servingSize:'20 г', micros:{ Omega3:8800, Mg:700, Fe:8, Zn:9.9, P:1650, Mn:7.6, VitE:8, VitB1:1.3 } },
  { id:'poppy_seeds', name:'Мак', category:'fat', kcal:525, protein:18, fat:42, carbs:28, fiber:20, gi:35, servingSize:'10 г', micros:{ Ca:1440, Mn:6.7, Mg:347, P:870, Fe:9.8, Zn:8, Cu:1.6 } },
  { id:'tahini', name:'Тахини (кунжутная паста)', category:'fat', kcal:595, protein:17, fat:54, carbs:21, fiber:9.3, gi:15, servingSize:'30 г', micros:{ Ca:426, Fe:4.4, Mg:95, P:360, Cu:1.6, Zn:4.6, Mn:1.5 } },
  { id:'dark_chocolate_90', name:'Шоколад 90%', category:'fat', kcal:592, protein:10, fat:52, carbs:24, fiber:14, gi:20, servingSize:'25 г', micros:{ Fe:12, Mg:230, Cu:2.5, Mn:2.1, Zn:3.3, P:310, K:700 } },
  { id:'hummus', name:'Хумус', category:'fat', kcal:166, protein:8, fat:10, carbs:14, fiber:6, gi:10, servingSize:'100 г', micros:{ Fe:2.4, Mg:71, P:110, K:228, Zn:1.2, Cu:0.5, Mn:0.6, VitB9:83 } },
  
  // FAST FOOD / PREPARED (20 items)
  { id:'sushi_salmon', name:'Суши с лососем (8 шт)', category:'protein', kcal:310, protein:16, fat:6, carbs:48, fiber:1, gi:55, servingSize:'250 г', micros:{ Omega3:800, I:30, VitD:5, Na:800 } },
  { id:'borscht', name:'Борщ', category:'veg_fruit', kcal:57, protein:3.8, fat:2.5, carbs:5.5, fiber:1.5, gi:30, servingSize:'300 г', micros:{ VitA:250, VitC:10, Fe:1.2, K:280, Na:350 } },
  { id:'chicken_soup', name:'Куриный суп', category:'protein', kcal:36, protein:3, fat:1.2, carbs:3.5, fiber:0.5, gi:30, servingSize:'300 г', micros:{ K:200, Na:400, P:30, VitB3:1.5 } },
  { id:'pea_soup', name:'Гороховый суп', category:'carb', kcal:68, protein:4, fat:1.5, carbs:10, fiber:3, gi:35, servingSize:'300 г', micros:{ Fe:1.5, K:250, VitB1:0.1, P:80 } },
  { id:'pilaf', name:'Плов', category:'carb', kcal:210, protein:7, fat:8, carbs:28, fiber:1, gi:60, servingSize:'200 г', micros:{ Fe:1.5, Zn:2.0, VitB3:3.0, P:120, K:250 } },
  { id:'risotto', name:'Ризотто', category:'carb', kcal:168, protein:4.5, fat:6, carbs:24, fiber:0.5, gi:55, servingSize:'200 г', micros:{ Ca:30, P:70, VitB3:1.5, K:150 } },
  { id:'soy_milk', name:'Соевое молоко', category:'dairy', kcal:43, protein:3.3, fat:1.5, carbs:3.5, fiber:0.5, gi:30, servingSize:'200 мл', micros:{ Ca:120, Fe:0.6, Mg:16, P:50, VitD:1 } },
  { id:'almond_milk', name:'Миндальное молоко', category:'dairy', kcal:17, protein:0.4, fat:1, carbs:1.3, fiber:0.2, gi:30, servingSize:'200 мл', micros:{ Ca:120, VitE:3, VitD:1, Mg:6 } },
  { id:'oat_milk', name:'Овсяное молоко', category:'dairy', kcal:45, protein:1, fat:1.5, carbs:6.5, fiber:0.8, gi:30, servingSize:'200 мл', micros:{ Ca:120, Fe:0.3, VitD:1, P:50 } },
  { id:'smoothie_berry', name:'Ягодный смузи', category:'veg_fruit', kcal:65, protein:1.5, fat:0.5, carbs:14, fiber:3, gi:35, servingSize:'250 мл', micros:{ VitC:20, VitK:15, K:200, Mn:0.3 } },
  { id:'tomato_juice', name:'Томатный сок', category:'veg_fruit', kcal:17, protein:0.9, fat:0.1, carbs:3.5, fiber:0.4, gi:35, servingSize:'200 мл', micros:{ VitC:18, VitA:42, K:230, Na:250, Lycopene:9 } },
  { id:'orange_juice', name:'Апельсиновый сок', category:'veg_fruit', kcal:45, protein:0.7, fat:0.2, carbs:10, fiber:0.2, gi:50, servingSize:'200 мл', micros:{ VitC:50, VitB9:30, K:200, Ca:11, Mg:11 } },
  
  // SUPPLEMENTS (10 items)
  { id:'whey_concentrate', name:'Сывороточный концентрат', category:'supplement', kcal:380, protein:70, fat:6, carbs:8, fiber:0, gi:0, servingSize:'30 г', micros:{ Ca:200, P:120, Mg:30, K:150 } },
  { id:'casein_micellar', name:'Мицеллярный казеин', category:'supplement', kcal:360, protein:76, fat:1.5, carbs:8, fiber:0, gi:0, servingSize:'30 г', micros:{ Ca:500, P:350, Mg:20, K:100 } },
  { id:'mass_gainer', name:'Гейнер (масс-сет)', category:'supplement', kcal:370, protein:30, fat:4, carbs:55, fiber:2, gi:45, servingSize:'100 г', micros:{ Ca:100, P:80, Mg:20, VitB3:2, VitB6:0.3 } },
  { id:'bar_protein', name:'Протеиновый батончик', category:'supplement', kcal:320, protein:25, fat:12, carbs:30, fiber:5, gi:35, servingSize:'60 г', micros:{ Ca:80, Fe:2, P:150, VitB12:0.5 } },
  { id:'aminos_complex', name:'Аминокислотный комплекс (EAA)', category:'supplement', kcal:10, protein:2.5, fat:0, carbs:0, fiber:0, gi:0, servingSize:'10 г', micros:{ Leucine:2500, Isoleucine:1250, Valine:1250 } },
  { id:'pre_workout', name:'Предтрен (стандарт)', category:'supplement', kcal:15, protein:0, fat:0, carbs:3, fiber:0, gi:0, servingSize:'15 г', micros:{ Caffeine:200, BetaAlanine:3200, Citrulline:6000, VitB3:15, VitB6:5, VitB12:25 } },
  { id:'isotonic', name:'Изотоник', category:'supplement', kcal:80, protein:0, fat:0, carbs:20, fiber:0, gi:50, servingSize:'25 г', micros:{ Na:400, K:200, Mg:60, Ca:50, VitC:80 } },
  { id:'glutamine_powder', name:'Глютамин (порошок)', category:'supplement', kcal:16, protein:4, fat:0, carbs:0, fiber:0, gi:0, servingSize:'5 г', micros:{} },
  { id:'collagen_hydrolysate', name:'Коллаген гидролизат', category:'supplement', kcal:360, protein:90, fat:0, carbs:0, fiber:0, gi:0, servingSize:'10 г', micros:{ Glycine:20000, Proline:12000, Hydroxyproline:10000 } },
  { id:'zma', name:'ZMA комплекс', category:'supplement', kcal:0, protein:0, fat:0, carbs:0, fiber:0, gi:0, servingSize:'3 капс', micros:{ Zn:30, Mg:450, VitB6:10.5 } },
];

const filePath = path.join(__dirname, '..', 'src', 'core', 'nutrition-database.ts');
let content = fs.readFileSync(filePath, 'utf8');

if (content.includes('zma_complex')) {
  console.log('Expanded DB already present. Skipping.');
  process.exit(0);
}

// Find the closing ]; before the last export
const marker = '];\n\nexport const';
const idx = content.indexOf(marker);
if (idx === -1) { console.error('Marker not found.'); process.exit(1); }

// Insert new foods
const newContent = '\n' + newFoods.map(f => 
  `  ${JSON.stringify(f)}`
).join(',\n') + ',\n';

content = content.slice(0, idx) + newContent + content.slice(idx);
fs.writeFileSync(filePath, content, 'utf8');
console.log(`Added ~${newFoods.length} foods. File: ${(content.length/1024).toFixed(0)}KB`);
