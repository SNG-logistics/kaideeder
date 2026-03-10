/**
 * src/lib/cat-rules.ts
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for product category detection rules.
 * Used by:
 *   - src/app/api/products/import/route.ts
 *   - src/app/api/products/import-raw/route.ts
 *   - scripts/recategorize-products.js  (duplicated in JS — keep in sync)
 *
 * Priority order: specific → general (first match wins)
 * ─────────────────────────────────────────────────────────────────
 */

export type CatRule = { code: string; re: RegExp[] }

export const CAT_RULES: CatRule[] = [

    // ════════════════════════════════════════════
    // 1. วัตถุดิบแช่แข็ง/กึ่งสำเร็จ/ของทานเล่น
    // ════════════════════════════════════════════
    { code: 'FROZEN', re: [
        /แช่แข็ง|frozen|กึ่งสำเร็จ|สำเร็จรูป|instant/i,
        /เฟรนฟราย|เฟรนฟรายด์|french.?fr(y|ies)/i,
        /ปอเปี้ย|spring.?roll/i,
        /ข้าวเกรียบ|rice.?cracker/i,
        /ถั่วทอด|fried.?peanut/i,
        /เม็ดมะม่วง|cashew/i,
        /ปูอัด|imitation.?crab|surimi/i,
        /เนื้อปูก้อน|crab.?meat.*frozen/i,
    ]},

    // ════════════════════════════════════════════
    // 2. เห็ด
    // ════════════════════════════════════════════
    { code: 'MUSHROOM', re: [/เห็ด|mushroom|shiitake|enoki|oyster.?mush/i] },

    // ════════════════════════════════════════════
    // 3. ซีฟู้ด (สด/ดิบ) — ก่อน PROTEIN
    // ════════════════════════════════════════════
    { code: 'SEAFOOD', re: [
        /กุ้ง(?!.*แห้ง)|shrimp|prawn/i,
        /หมึก|squid|calamari/i,
        /หอย(?!แครง.*ลวก)|clam|oyster|scallop|mussel/i,
        /ปู(?!อัด|ก้อน.*แช่)|crab(?!.?stick)/i,
        /กั้ง|mantis.?shrimp/i,
        /แมงกระพรุน|jellyfish/i,
        /กระเพาะปลา|fish.?maw/i,
        /ปลาร้า|fermented.?fish/i,
        /สาหร่าย|seaweed|nori/i,
        /แซลมอน|salmon/i,
        /หนังปลา|fish.?skin/i,
        /ปู(?!อัด).*แร่|ปลา(?!ร้า.*บรรจุ)|fish(?!.?ball|.?cake)/i,
    ]},

    // ════════════════════════════════════════════
    // 4. โปรตีน — หมู
    // ════════════════════════════════════════════
    { code: 'PROTEIN_PORK', re: [
        /หมู(?!ป่า)|pork|swine/i,
        /เบคอน|bacon|แฮม|ham/i,
        /ไส้กรอก|sausage/i,
        /ซี่โครง(?!วัว)/i,
        /สันคอ|สามชั้น|หมูบด|หมูสับ/i,
        /ตับหมู|นมหมู|ต้นคอหมู/i,
        /แหนม|หมูยอ|หมูหัน/i,
        /หมูแดดเดียว|หมูหยอง/i,
        /หนังหมู(?!ทอด.*เป็น.*frozen)/i,
        /ไส้อ่อน|ไส้ตัน|กระดูกอ่อน(?=หมู|แหนม)/i,
        /แค็ปหมู|แค๊ปหมู(?!.*frozen)/i,      // แค๊ปหมูดิบ
        /คอหมู|สันหมู/i,
    ]},

    // ════════════════════════════════════════════
    // 5. โปรตีน — เนื้อสัตว์อื่น (วัว/ไก่/เป็ด/พิเศษ)
    // ════════════════════════════════════════════
    { code: 'PROTEIN_MEAT', re: [
        /เนื้อวัว|เนื้อโค|เนื้อโคขุน|เนื้อเสือร้องไห้|ขาลาย|เหงือกวัว|เหงือก|ลิ้นวัว|ดีวัว|เอ็น(?!ไก่)/i,
        /ชุดลาบ|ชุดทำลาบ/i,
        /อกไก่|เนื้ออกไก่|ปีกไก่|ปีกกลางไก่|ขาโต้ไก่|น่องไก่|น่องติดสะโพก/i,
        /ตีนไก่|เล็บมือนาง|หนังไก่|กึ๋น|เครื่องในไก่|ไก่ย่าง(?=.*ตัว)|ไก่จ้อ|ไก่แช่เหล้า/i,
        /ไก่(?:ตัว|ลาด|เขาสวนกวาง)|chicken(?!.?wing.*fri)/i,
        /เป็ด|duck|อกเป็ด|คางเป็ด|ปีกเป็ด/i,
        /กบ(?! ลอกหนัง.*แช่)|กบลอกหนัง/i,
        /นกกระจอกเทศ|ostrich/i,
        /จระเข้|crocodile/i,
        /หมูป่า|wild.?boar/i,
        /เนื้อกวาง|venison/i,
        /เนื้อ(?=.*ปิ้ง|.*ย่าง|.*ผัด|.*สด)/i,
    ]},

    // ════════════════════════════════════════════
    // 6. ไข่
    // ════════════════════════════════════════════
    { code: 'EGG', re: [
        /ไข่ไก่|ไข่เป็ด|ไข่นกกระทา|egg/i,
        /ไข่เค็ม|ไข่เคม|ไข่แดงเค็ม/i,
        /ไข่เยี่ยวม้า|century.?egg/i,
        /พวงไข่|ไข่มดแดง|ไข่กุ้ง/i,
    ]},

    // ════════════════════════════════════════════
    // 7. นม/เนย/ชีส/ครีม
    // ════════════════════════════════════════════
    { code: 'DAIRY', re: [
        /นมวัว|นมสด|นมหมู(?!.*ปิ้ง.*เมนู)|milk|dairy/i,
        /วิปปัง|วิปครีม|whipping.?cream/i,
        /เนยจืด|เนยสด|butter/i,
        /cream\b|ครีมสลัด|ครีมสลัส/i,
        /ชีส|cheese|cheddar|mozzarella|parmesan|พาเมซาน|พราเมทราน/i,
        /มายองเนส|mayonnaise/i,
        /โยเกิร์ต|yogurt/i,
    ]},

    // ════════════════════════════════════════════
    // 8. ผัก/สมุนไพร/เครื่องแกง
    // ════════════════════════════════════════════
    { code: 'VEGHERB', re: [
        // สมุนไพร/ใบ
        /ใบชะพลู|ใบโหระพา|ใบกะเพรา|ใบมะกรูด|ใบกฐิน|ใบทาม|โรสเมรี่|rosemary/i,
        /ออริกาโน|oregano|พาสลี่|parsley|โหระพา|basil/i,
        // หัวเครื่อง
        /กระเทียม|garlic|หัวหอม|หอมแดง|หอมหัวใหญ่|หอมลาบ|ต้นหอม|shallot|onion/i,
        /ตะไคร้|lemongrass|ข่า|galangal|ขิง|ginger|ขิงดอง/i,
        /กระชาย|ผักชีลาว|dill|coriander|ผักชี/i,
        // ผักทั่วไป
        /ผัก(?!บุ้ง.*ทอด|กาด.*ดอง.*นาน)|vegetable|veg\b/i,
        /คะน้า|กวางตุ้ง|ผักบุ้ง|บุ้งจีน|กระเฉด|spinach|watercress/i,
        /ชะอม|ผักหวาน|ขึ้นฉ่าย|celery|กะหลั่ม|กะหล่ำ|cabbage/i,
        /ผักกาดขาว|บล็อกโครี่|บล็อคโคลี่|broccoli|แครอท|carrot/i,
        /ถั่วพู|ถั่วฝักยาว|ถั่วงอก|ถั่วแระ|bean(?!.?cake)|lentil/i,
        /แตงกวา|cucumber|มะเขือ|eggplant/i,
        /มะนาว|lemon|เลม่อน|lime/i,
        /มะเขือเทศ|tomato/i,
        /ฟักทอง|pumpkin|มะระ|bitter.?melon|มะขามเปียก|tamarind/i,
        /หัวปลี|banana.?flower|ดอกกล้วย/i,
        /สับปะรด|pineapple(?!.*juice.*brand)|มะม่วง(?!.*ปั่น.*เมนู)|มะละกอ(?!.*ส้มตำ.*เมนู)/i,
        /เต้าหู้|tofu|bean.?curd/i,
    ]},

    // ════════════════════════════════════════════
    // 9. เครื่องปรุง/ซอส/น้ำมัน/เครื่องเทศ
    // ════════════════════════════════════════════
    { code: 'DRY_GOODS', re: [
        /น้ำปลา|fish.?sauce|น้ำปลาร้า/i,
        /น้ำพริก|พริกแกง/i,
        /กะปิ|กระปิ|shrimp.?paste/i,
        /ซีอิ้ว|ซีอิ๊ว|soy.?sauce|โชยุ|โชยุคิโคแมน/i,
        /เต้าเจี้ยว|fermented.?soybean/i,
        /เกลือ|salt/i,
        /น้าตาล|น้ำตาล|sugar/i,
        /พริกไทย|pepper(?!.?sauce)/i,
        /พริกป่น|พริกแห้ง|chili(?!.?sauce)|dried.?chili/i,
        /น้ำจิ้ม|dipping.?sauce/i,
        /น้ำมัน(?!.*อาร์)|oil\b/i,
        /น้ำส้มสายชู|vinegar/i,
        /น้ำเชื่อม|simple.?syrup/i,
        /ซอส|sauce/i,
        /รสดี|ผงซูรส|msg|monosodium/i,
        /ผงกะหรี่|curry.?powder/i,
        /คะนอร์|knorr/i,
        /อโรมาด|ผงหมัก/i,
        /บาวน์ซอส|brown.?sauce|worcestershire/i,
        /ข้าวคั่ว|toasted.?rice/i,
        /แป้งพิซซ่า|pizza.?dough/i,
        /แป้งสาลี|แป้งทอด|แป้งฮ่องกง|\bflour\b|\bdough\b/i,
        /เส้น|ก๋วยเตี๋ยว|noodle|บะหมี่|วุ้นเส้น|มาม่า|สปาเก็ตตี้|ข้าวปุ้น/i,
        /ข้าวสาร|ข้าวเหนียว|ข้าวโพด|rice(?!\s+dish)/i,
        /มะขาม(?!.*เปียก.*ผัก)|tamarind.?paste/i,
        /น้ำมะนาวขวด|bottled.?lime/i,
        /น้ำปู(?!.*สด)|น้ำพริกเผา/i,
        /บาวน์ซอส|คะนอร์ก้อน|อโรมาด|ปอเปี้ย(?!.*frozen)|/i,
    ]},

    // ════════════════════════════════════════════
    // 10. Supply / บรรจุภัณฑ์
    // ════════════════════════════════════════════
    { code: 'TISSUE_CLEAN', re: [/ทิชชู่|ผ้าขี้ริ้ว|ผ้าเย็น|ผ้าเช็ด|น้ำยา.*ล้าง|สบู่|detergent|ลูกโป่ง|balloon/i] },
    { code: 'BOX_BAG', re: [/บรรจุภัณฑ์|กล่อง(?!.*ซอส)|ถุงใส|ถุงร้อน|ถุงซิป|ถุงรูด|แก้วพลาสติก|แก้วกระดาษ|จานโฟม|จานกระดาษ|packaging|ฟอยล์|ใบตอง(?=.*ห่อ|.*ตกแต่ง)/i] },
    { code: 'DISPOSABLE', re: [/ถุงมือ|ไม้จิ้มฟัน|ช้อนพลาสติก|ส้อมพลาสติก|หลอดดูด|ไม้เสียบ|ยางรัด|เทป\b/i] },

    // ════════════════════════════════════════════
    // 11. เครื่องดื่มแอลกอฮอล์
    // ════════════════════════════════════════════
    { code: 'BEER_DRAFT', re: [
        /เบียร์สด|beerlao.*สด|เบียร์ลาวสด|ไฮเนเก้นสด/i,
        /ทาวเวอร์|tower\b|draft.?beer|เบียร์สดจอก/i,
        /เบียร์ลาวแก้ว/i,
    ]},
    { code: 'BEER', re: [
        /เบียร์(?!สด|.*ทาวเวอร์)|beerlao\b|\bbeer\b/i,
        /heineken|ไฮเนเก้น|singha|chang|leo/i,
        /budweiser|corona|asahi|1664|carlsberg/i,
        /somersby|hoegard|ซอมเมอร์บี้/i,
        /ipa\b|white.*beer|เบียร์.*กระป๋อง|เบียร์.*ขวด/i,
    ]},
    { code: 'WINE', re: [
        /ไวน์|\bwine\b/i,
        /penfolds|rawson|jacob|hoonuga|siegel|carmenere|chardonnay/i,
        /วิสกี้|whisky|whiskey|เหล้า|สุรา/i,
        /champagne|prosecco|brandy|bourbon/i,
        /rum\b|vodka|\bgin\b/i,
        /hennessy|vsop|chivas|ballantine/i,
        /johnnie|johnny|regency|singerton|singleton/i,
        /เหล้าจีน/i,
    ]},
    { code: 'SOJU', re: [/soju|โซจู|chum.?churum|jinro|chamisul/i] },

    // ════════════════════════════════════════════
    // 12. เครื่องดื่มไม่มีแอลกอฮอล์/มิกเซอร์
    // ════════════════════════════════════════════
    { code: 'WATER', re: [/น้ำดื่ม(?!.*brand)|น้ำแข็ง|\bice\b|น้ำเปล่า|mineral.?water/i] },
    { code: 'SOFT_DRINK', re: [
        /โซดา(?!ผสม.*recipe)|\bsoda\b|schweppes|ชเวปส์/i,
        /pepsi|coke|โค้ก|sprite|fanta|7.?up/i,
        /มิกเซอร์|mixer|tonic/i,
        /โออิชิ|ลีเจน|sting\b|สะติง|red.?bull/i,
    ]},
    { code: 'COFFEE', re: [
        /กาแฟ|กาเฟ|coffee/i,
        /latte|espresso|americano|cappuccino|mocha|frappe/i,
        /คาปูชิโน่|คาลาเมว|ม็อกค่า|เอสเพรสโซ่/i,
        /maple.*coffee|rose.*coffee|coconut.*coffee|กาแฟ.*เสาวรส|กาเฟ.*งาดำ/i,
    ]},
    { code: 'TEA', re: [/ชา\b|tea\b|โกโก้|cocoa|ชาเขียว|ชาไทย|ชานม|มัทฉะ|matcha|มัดฉะ/i] },
    { code: 'SMOOTHIE', re: [
        /ปั่น|smoothie|shake/i,
        /น้ำผลไม้|juice(?!.*brand)/i,
        /น้ำส้มปั้น|ลิ้นจี่โซดา|พีชโซดา|มิกซ์เบอร์รี่.*โซดา|สตรอเบอรี่.*โซดา|บลูเบอร์รี่.*โซดา/i,
        /มิ้นโซดา|mint.*soda/i,
    ]},

    // ════════════════════════════════════════════
    // 13. ผลไม้สด (วัตถุดิบ ไม่ใช่เมนูปั่น)
    // ════════════════════════════════════════════
    // NOTE: placed AFTER SMOOTHIE — ปั่น matches first if both present

    // ════════════════════════════════════════════
    // 14. บริการ/ค่าใช้จ่าย/Entertain
    // ════════════════════════════════════════════
    { code: 'ENTERTAIN', re: [
        /entertain|pr\b|ดิ้ง.*pr/i,
        /ค่าเปิด(?:วาย|เหล้า)/i,
        /ค่าขวด|ค่าแก้ว|แก้ว.*แตก|โต้ะแตก/i,
        /ค่าชั่วโมง|ราคาเหมา|ราคา.*ชั่วโมง/i,
        /ค่าเอ็น\b|ออกนอกสถานที่/i,
        /โปรวันเกิด|โปรแถม|แจกฟรี|สาวมา.*แถม/i,
        /ค่าพนักงาน|ค่าบริการ/i,
    ]},
    { code: 'KARAOKE', re: [/คาราโอเกะ|karaoke|ค่าห้อง(?!.*ชั่วโมง)/i] },
    { code: 'SET', re: [/\bset\b|เซ็ต|combo\b|บุฟเฟต์|buffet/i] },
]

// ── หมวดที่ถือเป็น "เครื่องดื่ม" — skip ใน import-raw (วัตถุดิบ) ──────────
export const DRINK_CODES = new Set([
    'BEER', 'BEER_DRAFT', 'WINE', 'SOJU',
    'COFFEE', 'TEA', 'SMOOTHIE', 'SOFT_DRINK', 'WATER',
])

// ── หมวดที่ให้ productType = ENTERTAIN ────────────────────────────────────
export const ENTERTAIN_CODES = new Set(['ENTERTAIN', 'KARAOKE'])

// ── หมวดที่ให้ productType = PACKAGING ────────────────────────────────────
export const PACKAGING_CODES = new Set(['BOX_BAG', 'TISSUE_CLEAN', 'DISPOSABLE', 'PACKAGING'])

// ── SKU prefix ─────────────────────────────────────────────────────────────
export const SKU_PREFIX: Record<string, string> = {
    // เครื่องดื่มแอลกอฮอล์
    BEER: 'B', BEER_DRAFT: 'BD', WINE: 'W', SOJU: 'SJ', COCKTAIL: 'CK',
    // เครื่องดื่มอื่น
    WATER: 'WI', SOFT_DRINK: 'SD', COFFEE: 'CF', TEA: 'TE', SMOOTHIE: 'SM',
    // อาหารเมนู
    FOOD_GRILL: 'FG', FOOD_FRY: 'FF', FOOD_RICE: 'FR', FOOD_SEA: 'FS',
    FOOD_SALAD: 'FL', FOOD_BOIL: 'FB', FOOD_STIR: 'FT', FOOD_SNACK: 'FK',
    // วัตถุดิบ
    PROTEIN_PORK: 'PP', PROTEIN_MEAT: 'PM', SEAFOOD: 'SF', EGG: 'EG',
    DAIRY: 'DY', VEGHERB: 'VH', MUSHROOM: 'MU', DRY_GOODS: 'DG',
    FROZEN: 'FZ',
    // supply
    BOX_BAG: 'BB', TISSUE_CLEAN: 'TC', DISPOSABLE: 'DS',
    // บริการ
    KARAOKE: 'KR', SET: 'ST', ENTERTAIN: 'EN',
    // legacy fallback
    RAW_MEAT: 'PM', RAW_PORK: 'PP', RAW_SEA: 'SF', RAW_VEG: 'VH',
    PACKAGING: 'BB', OTHER: 'OT',
}

/** วิเคราะห์ชื่อสินค้า → คืน category code (null = ไม่รู้จัก) */
export function guessCategory(name: string): string | null {
    const n = (name ?? '').toLowerCase()
    for (const rule of CAT_RULES) {
        if (rule.re.some(re => re.test(n))) return rule.code
    }
    return null
}
