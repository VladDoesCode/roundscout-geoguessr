(() => {
  "use strict";

  const RAW_COUNTRIES = [
    {
      code: "AL",
      name: "Albania",
      tips: [
        "Albanian uses lots of e and c with marks, plus letter clusters like sh and gj.",
        "Mountain roads, rough pavement, and red-roof villages are common outside cities.",
        "Older concrete utility poles and patched roads can separate it from Croatia or Slovenia.",
        "Mediterranean plants appear near the coast, while the interior quickly turns rugged.",
        "License plates are usually white EU-style plates, but the road quality often feels more Balkan."
      ]
    },
    {
      code: "AD",
      name: "Andorra",
      tips: [
        "Look for steep Pyrenees valleys, stone buildings, and dense mountain towns.",
        "Catalan is common on signs, so names can look Spanish or French but with Catalan spellings.",
        "Roads are very clean and mountain-focused, with frequent tunnels and switchbacks.",
        "Small country feel: ski shops, duty-free stores, and compact urban strips are common."
      ]
    },
    {
      code: "AR",
      name: "Argentina",
      tips: [
        "Spanish signs with wide open pampas, dry Patagonia, or flat farming roads are common.",
        "Modern plates are black with white text, while older plates can be white.",
        "Roads often use yellow center lines and long straight stretches outside towns.",
        "Patagonia feels dry, windy, and sparse; the north can look warmer and greener."
      ]
    },
    {
      code: "AU",
      name: "Australia",
      tips: [
        "Left-side driving with wide roads and yellow diamond warning signs is a strong clue.",
        "Red soil, eucalyptus trees, and dry scrub are common away from the coast.",
        "Road signs are in English, often with long-distance highway shields and animal warnings.",
        "Suburbs tend to have broad streets, low houses, and lots of driveway space."
      ]
    },
    {
      code: "AT",
      name: "Austria",
      tips: [
        "German language plus Alpine scenery, tidy villages, and red-roof houses points strongly here.",
        "Austrian road posts are white with black tops and small red reflectors.",
        "Roads are clean and well-marked, often winding through green valleys.",
        "Look for village names ending in -dorf, -berg, -kirchen, or -bruck.",
        "Compared with Germany, it often feels hillier and more Alpine."
      ]
    },
    {
      code: "BD",
      name: "Bangladesh",
      tips: [
        "Bengali script is rounded and dense, unlike Thai, Khmer, or Sinhala.",
        "Very flat terrain, rice fields, water, and crowded roads are common.",
        "Green auto-rickshaws, buses, and roadside shops are frequent beginner clues.",
        "Traffic keeps left, and roads can feel narrow and busy.",
        "Tropical vegetation and low-lying villages separate it from India or Sri Lanka."
      ]
    },
    {
      code: "BE",
      name: "Belgium",
      tips: [
        "License plates often have red text on a white background.",
        "Dutch, French, and sometimes German signs can appear depending on region.",
        "Brick houses, dense villages, and flat or gently rolling land are common.",
        "Roads can feel more cluttered and urban than the Netherlands.",
        "Blue motorway signs and frequent town signage make it feel compact."
      ]
    },
    {
      code: "BG",
      name: "Bulgaria",
      tips: [
        "Cyrillic signs are common, but the country is in the EU and uses EU-style plates.",
        "Dry rolling fields, sunflower areas, and red-roof villages appear often.",
        "Concrete utility poles and older road surfaces are useful Balkan clues.",
        "Mountains can appear suddenly, especially in the west and south.",
        "Compared with Serbia or North Macedonia, EU plates and Bulgarian letters can help."
      ]
    },
    {
      code: "BT",
      name: "Bhutan",
      tips: [
        "Mountain roads, steep green valleys, and dramatic drop-offs are very common.",
        "Traditional painted buildings with decorative woodwork are a huge clue.",
        "Dzongkha script and Buddhist prayer flags may appear near towns or temples.",
        "Traffic keeps left, unlike many nearby mainland Asian countries.",
        "Roads are often narrow and winding, with very little flat land."
      ]
    },
    {
      code: "BO",
      name: "Bolivia",
      tips: [
        "High-altitude Andean landscapes, dry mountains, and brick buildings are common.",
        "Spanish signs plus very rugged roads can separate it from Chile or Peru.",
        "Urban outskirts often show unfinished red-brick construction.",
        "The Altiplano can feel flat, cold, bright, and treeless.",
        "Tropical lowlands exist, but beginner rounds often show mountains or dry plateaus."
      ]
    },
    {
      code: "BW",
      name: "Botswana",
      tips: [
        "Left-side driving with dry savanna, flat roads, and English signs is common.",
        "Roads often feel long, straight, quiet, and well-spaced.",
        "Look for sandy shoulders, thorny scrub, and low, open horizons.",
        "License plates can show white fronts and yellow rears, similar to nearby southern Africa.",
        "Compared with South Africa, it often feels emptier and drier."
      ]
    },
    {
      code: "BR",
      name: "Brazil",
      tips: [
        "Portuguese language is the main separator from most of Latin America.",
        "Red soil, tropical greenery, and concrete utility poles are common.",
        "Road center lines are often yellow, and roads vary widely in quality.",
        "Look for words like rua, avenida, posto, cidade, and prefeitura.",
        "The country is huge: Amazon, dry northeast, dense cities, and southern farmland can all appear."
      ]
    },
    {
      code: "KH",
      name: "Cambodia",
      tips: [
        "Khmer script has rounded, clustered letters and is very distinctive.",
        "Flat rural roads, red dirt shoulders, motos, and tuk-tuks are common.",
        "Temples, simple shopfronts, and tropical palms appear often.",
        "Traffic keeps right, unlike Thailand or Malaysia.",
        "Roads can feel dusty and less developed than Thailand."
      ]
    },
    {
      code: "CA",
      name: "Canada",
      tips: [
        "North American roads with metric speed limits are a major clue.",
        "English and French both appear, with French especially common in Quebec.",
        "Large signs, wide roads, forests, and big skies are common.",
        "Road shields and province names can identify the area quickly.",
        "Compared with the US, look for km/h signs and Canadian-style route markers."
      ]
    },
    {
      code: "CL",
      name: "Chile",
      tips: [
        "Spanish signs plus the Andes or a long dry coastal feel often points to Chile.",
        "The north can be extremely dry and desert-like; the south becomes green and cool.",
        "Roads often have yellow center lines and clean white edge lines.",
        "Long narrow valleys, vineyards, and mountains on one side are common.",
        "Compared with Peru or Bolivia, roads often feel more maintained."
      ]
    },
    {
      code: "CO",
      name: "Colombia",
      tips: [
        "Yellow license plates are a strong beginner clue.",
        "Spanish signs, steep green mountains, and tropical towns appear often.",
        "Roads use yellow center lines and can wind through valleys.",
        "Brick buildings and colorful town centers are common.",
        "Compared with Ecuador, Colombia often has more yellow plates visible in traffic."
      ]
    },
    {
      code: "CR",
      name: "Costa Rica",
      tips: [
        "Spanish signs with lush tropical hills and narrow roads are common.",
        "Roads often have deep drainage ditches and heavy greenery close to the pavement.",
        "White license plates and many small roadside businesses appear often.",
        "Look for volcano/mountain terrain mixed with tropical vegetation.",
        "Compared with Panama, it can feel less urban and more hilly."
      ]
    },
    {
      code: "CY",
      name: "Cyprus",
      tips: [
        "Left-side driving with Greek and English signs is a strong clue.",
        "Dry Mediterranean hills, pale stone buildings, and coastal towns are common.",
        "Greek script appears often, but the road setup can feel British-influenced.",
        "Yellow rear plates and white front plates may appear on vehicles.",
        "Compared with Greece, left-side driving is the quickest separator."
      ]
    },
    {
      code: "HR",
      name: "Croatia",
      tips: [
        "Croatian Latin letters like c, s, z with marks appear on town and street signs.",
        "The coast has stone walls, dry hills, and Adriatic architecture; inland is greener.",
        "EU-style plates, red roofs, and Balkan road signs are common.",
        "Roads often feel cleaner and more maintained than Albania or Serbia.",
        "Place names ending in -ac, -ica, or -ovo are frequent."
      ]
    },
    {
      code: "CW",
      name: "Curacao",
      tips: [
        "Dry Caribbean island scenery with colorful Dutch-style buildings is common.",
        "Dutch, English, Spanish, and Papiamento can all appear on signs.",
        "Roads feel compact, sunny, and urban or semi-arid.",
        "Look for bright painted houses, cactus-like vegetation, and coastal roads."
      ]
    },
    {
      code: "CZ",
      name: "Czechia",
      aliases: ["Czech Republic"],
      tips: [
        "Czech uses letters like r with a mark, u with a circle, and many accent marks.",
        "Red-roof villages, rolling fields, and tidy but older roads are common.",
        "White roadside posts with black caps and red reflectors appear often.",
        "Town names ending in -ice, -ov, -any, and -nice are frequent.",
        "Compared with Slovakia, Czechia often feels flatter and more urbanized."
      ]
    },
    {
      code: "DK",
      name: "Denmark",
      tips: [
        "Very flat land, neat villages, and lots of bike infrastructure are common.",
        "Danish uses ae, o with slash, and a with ring in place names.",
        "License plates usually have a red border around the white plate.",
        "Road signs and houses feel very orderly, with brick and dark roofs common.",
        "Coastal or island roads often have low horizons and wind turbines."
      ]
    },
    {
      code: "DO",
      name: "Dominican Republic",
      tips: [
        "Spanish signs with a Caribbean, tropical urban feel are common.",
        "Motos, colorful buildings, and concrete utility poles appear often.",
        "Roads can be busy and uneven, with dense roadside shops.",
        "Palm trees, warm light, and coastal-looking towns are common clues."
      ]
    },
    {
      code: "EC",
      name: "Ecuador",
      tips: [
        "Spanish signs with steep Andean roads or lush tropical lowlands are common.",
        "Yellow or orange-tinted plates can appear, but landscape is often more useful.",
        "Look for volcanoes, green mountains, and towns built on slopes.",
        "Coastal banana-growing areas and humid roads can also appear.",
        "Compared with Colombia, yellow plates are less consistently visible."
      ]
    },
    {
      code: "EE",
      name: "Estonia",
      tips: [
        "Flat forests, gravel roads, and quiet Baltic villages are common.",
        "Estonian uses o with tilde plus many double vowels.",
        "Road signs feel Nordic/Baltic, with clean white posts and blue place signs.",
        "Wooden houses and sparse settlements appear often outside Tallinn.",
        "Compared with Latvia or Lithuania, the language looks more Finnish."
      ]
    },
    {
      code: "SZ",
      name: "Eswatini",
      aliases: ["Swaziland"],
      tips: [
        "Left-side driving with green hills and southern Africa road styling is common.",
        "English appears often, sometimes with siSwati names.",
        "Yellow rear plates can appear, similar to nearby countries.",
        "Roads are often more mountainous and compact than Botswana.",
        "It can look like South Africa, but with denser hills and smaller-town roads."
      ]
    },
    {
      code: "FO",
      name: "Faroe Islands",
      tips: [
        "Treeless green islands, steep ocean cliffs, and cloudy weather are major clues.",
        "Road tunnels, turf-roof buildings, and tiny coastal villages appear often.",
        "The language looks Nordic, with letters like o with slash and eth.",
        "Roads are clean, narrow, and surrounded by grass and sheep pastures."
      ]
    },
    {
      code: "FI",
      name: "Finland",
      tips: [
        "Flat conifer forests, lakes, and quiet rural roads are common.",
        "Finnish has long double vowels and letters like ae and oe in names.",
        "Yellow center lines on many roads help separate it from Estonia.",
        "Red wooden houses and blue-white signs are frequent clues.",
        "Compared with Sweden, Finnish words look longer and less Germanic."
      ]
    },
    {
      code: "FR",
      name: "France",
      tips: [
        "French language, yellow diamond priority signs, and European road markings are common.",
        "Villages often have stone or plaster buildings with shutters.",
        "Road signs use department road numbers like D123 and town names on white signs.",
        "Landscape ranges from flat farmland to mountains, but road signage is very consistent.",
        "License plates are white and usually have blue strips on both sides."
      ]
    },
    {
      code: "DE",
      name: "Germany",
      tips: [
        "German language plus very orderly roads, villages, and traffic signs is the core clue.",
        "Roadside delineator posts often have a black panel with reflectors.",
        "Town names ending in -dorf, -heim, -hausen, and -berg are common.",
        "Architecture is clean and practical, with many red roofs in smaller towns.",
        "Compared with Austria or Switzerland, it is often flatter and less Alpine."
      ]
    },
    {
      code: "GH",
      name: "Ghana",
      tips: [
        "English signs, tropical vegetation, and red dirt shoulders are common.",
        "A black tape or bar visible on the Google car roof is a classic clue.",
        "Roadside churches, schools, and small businesses often have English names.",
        "Traffic keeps right, unlike Kenya, Uganda, or South Africa.",
        "The landscape often feels humid, busy, and colorful."
      ]
    },
    {
      code: "GI",
      name: "Gibraltar",
      tips: [
        "The Rock of Gibraltar, dense streets, and UK-style details are the biggest clues.",
        "English signs are common, with Spanish influence nearby.",
        "Small urban roads, sea views, and limestone cliffs appear often.",
        "License plates and street furniture can feel British, but the setting is Mediterranean."
      ]
    },
    {
      code: "GL",
      name: "Greenland",
      tips: [
        "Treeless Arctic towns, colorful houses, and rocky coastlines are major clues.",
        "Road networks are tiny, with sea, mountains, or snow often nearby.",
        "Danish and Greenlandic names can appear on signs.",
        "The landscape feels much colder and more remote than Iceland or the Faroe Islands."
      ]
    },
    {
      code: "GR",
      name: "Greece",
      tips: [
        "Greek script is the strongest clue and appears on road signs and shops.",
        "Dry rocky hills, olive trees, white buildings, and coastal roads are common.",
        "Roads often have white edge lines and EU-style signs.",
        "License plates are white with a blue EU strip.",
        "Compared with Cyprus or Turkey, the Greek alphabet and EU road feel help."
      ]
    },
    {
      code: "GT",
      name: "Guatemala",
      tips: [
        "Spanish signs with volcanic highlands and colorful towns are common.",
        "Tuk-tuks, pickup trucks, and concrete roads show up often.",
        "Many towns have bright painted walls, markets, and colonial-style centers.",
        "Roads can be rough or steep, with lush mountains nearby.",
        "Compared with Mexico, it often feels smaller, hillier, and more tropical."
      ]
    },
    {
      code: "HK",
      name: "Hong Kong",
      tips: [
        "Left-side driving, dense high-rises, and bilingual English/Traditional Chinese signs are core clues.",
        "Double-decker buses, taxis, and narrow urban roads appear often.",
        "Road signs often have British-style shapes and lane markings.",
        "Hilly roads with sea views can appear surprisingly close to dense city areas.",
        "Traditional Chinese characters help separate it from mainland China or Singapore."
      ]
    },
    {
      code: "HU",
      name: "Hungary",
      tips: [
        "Hungarian words look unlike nearby Slavic languages and often use accents like a and o with marks.",
        "Flat plains, red-roof villages, and concrete utility poles are common.",
        "Street names often include utca, and town signs can feel compact and simple.",
        "Roadside posts and older pavement can resemble Romania or Slovakia.",
        "Compared with Austria, it is flatter and less Alpine."
      ]
    },
    {
      code: "IS",
      name: "Iceland",
      tips: [
        "Treeless volcanic landscapes, black lava, moss, and big skies are huge clues.",
        "Icelandic uses eth, thorn, and many accented letters.",
        "Roads are sparse, with mountains, glaciers, or ocean often nearby.",
        "Villages are small, colorful, and widely spaced.",
        "If it looks like another planet and has Nordic letters, think Iceland."
      ]
    },
    {
      code: "IN",
      name: "India",
      tips: [
        "Left-side driving with English plus Hindi or regional scripts is common.",
        "Yellow commercial plates, dense traffic, and many motorbikes are strong clues.",
        "Road dividers, painted curbs, and busy shops appear often in cities.",
        "Landscape varies hugely, so script and traffic are safer than scenery alone.",
        "Compared with Bangladesh, India often has more English road signage and broader roads."
      ]
    },
    {
      code: "ID",
      name: "Indonesia",
      tips: [
        "Left-side driving, tropical vegetation, and many motorbikes are common.",
        "Older plates often appear black with white text; newer plates may be white.",
        "Mosques, red-white curbs, tiled roofs, and roadside warung shops are frequent clues.",
        "Indonesian language uses Latin letters with words like jalan, desa, and kota.",
        "Palm plantations and humid rural roads are very common."
      ]
    },
    {
      code: "IE",
      name: "Ireland",
      tips: [
        "Left-side driving with English and Irish Gaelic on many signs is a major clue.",
        "Road signs often use green for national roads and white for local signs.",
        "Hedges, stone walls, narrow lanes, and lush green fields are common.",
        "License plates are white and use a year-county-number style.",
        "Compared with the UK, bilingual Irish place names are the easiest separator."
      ]
    },
    {
      code: "IL",
      name: "Israel",
      tips: [
        "Hebrew, Arabic, and English often appear together on road signs.",
        "Yellow license plates are a strong clue.",
        "Dry hills, white stone buildings, and Mediterranean/desert transitions are common.",
        "Roads are modern and well-marked, with right-side driving.",
        "Compared with Jordan, Hebrew text and yellow plates help a lot."
      ]
    },
    {
      code: "IT",
      name: "Italy",
      tips: [
        "Italian language, blue plate strips on both sides, and European road signs are common.",
        "Cypress trees, stone towns, vineyards, and dry hills appear often.",
        "Roadside bollards often have dark caps and red reflectors.",
        "Architecture varies by region, but old stone or plaster villages are frequent.",
        "Look for place names ending in -ano, -ini, -ello, and -zione words on signs."
      ]
    },
    {
      code: "JP",
      name: "Japan",
      tips: [
        "Left-side driving, Japanese script, and dense utility poles are core clues.",
        "Kei cars, convex roadside mirrors, and narrow streets appear often.",
        "Road markings, snow poles, and mountainous roads vary strongly by region.",
        "Signs often mix Japanese with occasional English romanization.",
        "Compared with South Korea or Taiwan, the scripts and left-side driving separate it quickly."
      ]
    },
    {
      code: "JO",
      name: "Jordan",
      tips: [
        "Arabic and English signs together are common on larger roads.",
        "Dry desert hills, beige stone buildings, and sparse vegetation are frequent.",
        "Roads are right-side drive and often feel wide or dusty outside cities.",
        "Black-yellow curb paint and desert highways can appear.",
        "Compared with Israel, plates are not the same bright yellow and Hebrew is absent."
      ]
    },
    {
      code: "KE",
      name: "Kenya",
      tips: [
        "Left-side driving with English and Swahili signs is common.",
        "Red soil, savanna, tea fields, and highland roads appear often.",
        "Yellow rear plates can show up on vehicles.",
        "Roadside shops, schools, and churches often use English names.",
        "Compared with Uganda, Kenya can feel drier and more open in many areas."
      ]
    },
    {
      code: "KG",
      name: "Kyrgyzstan",
      aliases: ["Kyrgyz Republic"],
      tips: [
        "Huge mountains, dry valleys, and wide steppe landscapes are core clues.",
        "Cyrillic appears often, especially Russian and Kyrgyz place names.",
        "Roads can be rough, sparse, and surrounded by dramatic peaks.",
        "Older cars, simple villages, and open high-altitude scenery are common.",
        "Compared with Mongolia, Kyrgyzstan usually feels more mountainous and less flat."
      ]
    },
    {
      code: "LA",
      name: "Laos",
      tips: [
        "Lao script is rounded and flowing, but different from Thai when practiced.",
        "Right-side driving separates it from Thailand, Malaysia, and Indonesia.",
        "Tropical hills, red dirt, simple roads, and small villages are common.",
        "Buddhist temples and roadside shops appear often.",
        "Compared with Cambodia, Laos is usually hillier and greener."
      ]
    },
    {
      code: "LI",
      name: "Liechtenstein",
      tips: [
        "Alpine villages, very clean roads, and German-language signs are common.",
        "The country feels like a compact mix of Switzerland and Austria.",
        "Mountain backdrops, tidy houses, and dense small-town roads appear often.",
        "Non-EU plate styling and a wealthy Alpine look help separate it from Austria."
      ]
    },
    {
      code: "LV",
      name: "Latvia",
      tips: [
        "Latvian uses long marks over vowels and letters like c, s, z with marks.",
        "Flat forests, wooden houses, and quiet roads are common.",
        "Road signs often feel Baltic, with simple blue/white styling.",
        "Compared with Estonia, the language looks more Slavic-like but is still Baltic.",
        "Compared with Lithuania, Latvia can feel more forested and less densely settled."
      ]
    },
    {
      code: "LS",
      name: "Lesotho",
      tips: [
        "Very mountainous, high-altitude scenery is the biggest clue.",
        "Left-side driving and southern Africa road style are common.",
        "Stone houses, rondavels, and dry grass slopes appear often.",
        "Yellow rear plates may appear, but landscape is usually stronger.",
        "If it looks like South Africa but much higher and more mountainous, consider Lesotho."
      ]
    },
    {
      code: "LT",
      name: "Lithuania",
      tips: [
        "Lithuanian uses letters like e with dot, u with hook, and s/z with marks.",
        "Flat fields, forests, and small villages are common.",
        "Wooden utility poles and simple rural roads appear often.",
        "Road signs can look Baltic, with blue place signs and clean white posts.",
        "Compared with Latvia, Lithuanian words often end in -as, -is, or -ai."
      ]
    },
    {
      code: "LU",
      name: "Luxembourg",
      tips: [
        "Yellow license plates are a very useful clue.",
        "French, German, and Luxembourgish names can all appear.",
        "Villages are tidy, wealthy-looking, and compact, with dense road networks.",
        "Terrain is hilly but not alpine, with forests and clean roads.",
        "It can resemble Belgium or France, but yellow plates and multilingual signs help."
      ]
    },
    {
      code: "MY",
      name: "Malaysia",
      tips: [
        "Left-side driving, tropical greenery, and black license plates are common.",
        "Malay and English signs use Latin letters, often with words like jalan and taman.",
        "Green highway signs, palm plantations, and mosque domes are frequent clues.",
        "Road quality is often better than Indonesia in urban or highway areas.",
        "Compared with Singapore, it is less dense and more rural/tropical outside cities."
      ]
    },
    {
      code: "MT",
      name: "Malta",
      tips: [
        "Left-side driving with English and Maltese signs is a strong clue.",
        "Limestone buildings, dry roads, and dense compact towns are common.",
        "The landscape is Mediterranean but very urban and stone-colored.",
        "Roads can be narrow, with UK-style influences and coastal views.",
        "Maltese includes letters and names that look Semitic mixed with Latin script."
      ]
    },
    {
      code: "MX",
      name: "Mexico",
      tips: [
        "Spanish signs, varied license plates, and frequent speed bumps called topes are common.",
        "Dry desert, tropical areas, and dense towns all appear, so signs matter.",
        "Concrete utility poles, painted curbs, and roadside shops are frequent.",
        "Roads often have yellow center lines and many small businesses.",
        "Compared with Guatemala, Mexico often has wider highways and more varied regional signage."
      ]
    },
    {
      code: "MC",
      name: "Monaco",
      tips: [
        "Dense wealthy Mediterranean streets, tunnels, and sea views are common.",
        "French language dominates, with very compact urban roads.",
        "High-rise buildings, luxury shops, and steep streets are frequent clues.",
        "It can resemble coastal France, but the scale is much smaller and denser."
      ]
    },
    {
      code: "MN",
      name: "Mongolia",
      tips: [
        "Vast open steppe, sparse roads, and huge skies are the main clues.",
        "Cyrillic signs appear, but settlements are much sparser than Russia or Kyrgyzstan.",
        "Yurts, dry grassland, and distant mountains can appear.",
        "Roads may be paved highways or rough tracks through empty landscapes.",
        "Compared with Kyrgyzstan, Mongolia is usually flatter and more open."
      ]
    },
    {
      code: "ME",
      name: "Montenegro",
      tips: [
        "Rocky Balkan mountains, Adriatic coast, and red-roof villages are common.",
        "Both Latin and Cyrillic can appear, but Latin is frequent on signs.",
        "Roads often wind through steep valleys or along the sea.",
        "The country can feel like Croatia with more rugged mountains and smaller roads.",
        "Look for place names ending in -grad, -ica, or -nik."
      ]
    },
    {
      code: "NL",
      name: "Netherlands",
      tips: [
        "Yellow license plates on both front and rear are the fastest clue.",
        "Flat land, canals, bike lanes, and brick row houses are common.",
        "Dutch language has words like straat, weg, and gemeente.",
        "Roads and towns are extremely organized and dense.",
        "Red cycle paths and careful lane design appear often."
      ]
    },
    {
      code: "NZ",
      name: "New Zealand",
      tips: [
        "Left-side driving with lush hills, mountains, and ocean roads is common.",
        "Road signs are in English, with place names often from Maori.",
        "Roadside bollards and black-yellow chevrons are frequent on rural roads.",
        "The landscape often looks greener and more dramatic than Australia.",
        "Yellow center lines and narrow winding roads appear often."
      ]
    },
    {
      code: "NG",
      name: "Nigeria",
      tips: [
        "English signs, busy roads, and tropical urban scenes are common.",
        "Traffic keeps right, unlike Ghana, Kenya, or Uganda.",
        "Green-white national colors and many business signs can appear.",
        "Roads can feel crowded, dusty, and full of small shops.",
        "Red soil and dense roadside activity are useful clues."
      ]
    },
    {
      code: "MK",
      name: "North Macedonia",
      aliases: ["Macedonia"],
      tips: [
        "Cyrillic and Latin signs can both appear in towns.",
        "Dry Balkan mountains, red roofs, and compact villages are common.",
        "Roads often feel older and less polished than Slovenia or Croatia.",
        "Look for place names ending in -ovo, -ci, and -ska.",
        "Compared with Bulgaria, it is not in the EU and may lack EU-style plate cues."
      ]
    },
    {
      code: "NO",
      name: "Norway",
      tips: [
        "Fjords, mountains, tunnels, and red or white wooden houses are major clues.",
        "Norwegian uses ae, o with slash, and a with ring in place names.",
        "Roads are clean, often narrow, and frequently follow water or cliffs.",
        "Yellow center lines appear on many roads.",
        "Compared with Sweden or Finland, Norway is usually much more mountainous."
      ]
    },
    {
      code: "PA",
      name: "Panama",
      tips: [
        "Spanish signs with lush tropical roads and modern city areas are common.",
        "Panama City can show high-rises, highways, and water nearby.",
        "Rural areas are green, humid, and often flatter than Costa Rica.",
        "Roads use right-side driving and Latin American signage.",
        "Compared with Costa Rica, Panama often feels hotter, flatter, and more urban near the capital."
      ]
    },
    {
      code: "PE",
      name: "Peru",
      tips: [
        "Spanish signs with dry coastal deserts or high Andean roads are common.",
        "Unfinished brick buildings and steep mountain towns appear often.",
        "Mototaxis can be a clue in some towns.",
        "The coast can look extremely dry and sandy, while the Andes are rugged and high.",
        "Compared with Bolivia, Peru often has more coastal desert coverage."
      ]
    },
    {
      code: "PH",
      name: "Philippines",
      tips: [
        "English and Tagalog signs, tropical roads, and many tricycles or jeepneys are common.",
        "Traffic keeps right, unlike Malaysia, Indonesia, or Thailand.",
        "Concrete roads, dense roadside shops, and colorful vehicles appear often.",
        "License plates and signboards often use English words.",
        "Palm trees, humid light, and island-town density are frequent clues."
      ]
    },
    {
      code: "PL",
      name: "Poland",
      tips: [
        "Polish uses letters like l with slash, a/e with tails, and many consonant clusters.",
        "Flat or gently rolling farmland, red roofs, and concrete utility poles are common.",
        "White-red roadside posts and EU-style road signs appear often.",
        "Village names ending in -owo, -ice, -ska, and -w are frequent.",
        "Compared with Czechia or Slovakia, the language looks more consonant-heavy."
      ]
    },
    {
      code: "PT",
      name: "Portugal",
      tips: [
        "Portuguese language with words like rua, estrada, and freguesia is common.",
        "Whitewashed villages, dry hills, and tiled roofs appear often.",
        "Cobbled sidewalks and blue azulejo tiles can show up in towns.",
        "Road signs are European, with blue motorways and white local signs.",
        "Compared with Spain, Portuguese words often use ao, lh, nh, and c with cedilla."
      ]
    },
    {
      code: "PR",
      name: "Puerto Rico",
      tips: [
        "Spanish signs with US-style road infrastructure are the main clue.",
        "Route shields may show PR numbers, and roads drive on the right.",
        "Tropical scenery, concrete houses, and dense towns are common.",
        "English can appear, but Spanish dominates most local signs.",
        "It often feels like the Caribbean mixed with American road design."
      ]
    },
    {
      code: "QA",
      name: "Qatar",
      tips: [
        "Arabic and English signs, desert surroundings, and very modern roads are common.",
        "Wide highways, pale buildings, and intense sun are strong clues.",
        "Right-side driving and Gulf-style road signs appear often.",
        "The landscape is flatter and more urban/desert than Jordan or UAE mountain areas."
      ]
    },
    {
      code: "RO",
      name: "Romania",
      tips: [
        "Romanian uses Latin letters with s and t marks, and words like strada are common.",
        "Concrete utility poles, red-roof villages, and rolling farmland are frequent clues.",
        "Rural roads can show horse carts, older houses, and patched pavement.",
        "Mountains appear in central regions, while the south/east can be flat.",
        "Compared with Hungary, the language looks Romance rather than unique Hungarian."
      ]
    },
    {
      code: "RU",
      name: "Russia",
      tips: [
        "Cyrillic signs, wide roads, and long distances are common clues.",
        "Birch forests, apartment blocks, and rougher road edges appear often.",
        "License plates are white and usually lack EU styling.",
        "Urban areas may have large signs and broad avenues.",
        "Compared with Ukraine or Bulgaria, the scale often feels larger and less EU-like."
      ]
    },
    {
      code: "RW",
      name: "Rwanda",
      tips: [
        "Hilly green terrain and red soil are very common.",
        "French, English, and Kinyarwanda can appear on signs.",
        "Roads often look clean and maintained, with right-side driving.",
        "Dense rural settlement on hillsides is a useful clue.",
        "Compared with Uganda or Kenya, Rwanda often feels hillier and tidier."
      ]
    },
    {
      code: "SM",
      name: "San Marino",
      tips: [
        "Italian language with steep hill towns and very compact roads is common.",
        "Stone walls, old fortifications, and views over surrounding Italy can appear.",
        "Roads feel clean and small-scale, with lots of curves and elevation.",
        "It can look like Italy, but the tiny hill-country setting is the key clue."
      ]
    },
    {
      code: "SN",
      name: "Senegal",
      tips: [
        "French signs plus dry Sahel scenery and sandy shoulders are common.",
        "Right-side driving and colorful buses or taxis can appear.",
        "Roadside shops, low buildings, and sparse vegetation are frequent.",
        "The landscape often feels flatter and drier than Ghana or Uganda.",
        "Arabic influence can appear, but French signage is usually the best clue."
      ]
    },
    {
      code: "RS",
      name: "Serbia",
      tips: [
        "Both Cyrillic and Latin scripts can appear on signs.",
        "Flat northern plains and hillier southern areas both show up.",
        "Red-roof villages, older roads, and Balkan utility poles are common.",
        "License plates are white with a blue strip, but not EU-star plates.",
        "Compared with Croatia or Slovenia, it often feels less coastal/Alpine and more inland."
      ]
    },
    {
      code: "SG",
      name: "Singapore",
      tips: [
        "Left-side driving, dense high-rises, and extremely clean urban roads are core clues.",
        "Signs are mainly English, often with Chinese, Malay, or Tamil nearby.",
        "Roads are highly organized, with tropical greenery and HDB apartment blocks.",
        "Black license plates with white text can appear.",
        "Compared with Malaysia, it feels much denser, cleaner, and more city-like."
      ]
    },
    {
      code: "SK",
      name: "Slovakia",
      tips: [
        "Slovak uses accents like l/ t with marks and words similar to Czech but not identical.",
        "Hilly villages, forests, and red roofs are common.",
        "White roadside bollards and Central European road signs appear often.",
        "Town names ending in -ova, -ice, -any, and -ce are frequent.",
        "Compared with Czechia, Slovakia often feels hillier and more mountainous."
      ]
    },
    {
      code: "SI",
      name: "Slovenia",
      tips: [
        "Alpine green hills, tidy villages, and red roofs are common.",
        "Slovene uses c, s, z with marks, and place names can look Slavic but very neat.",
        "EU plates, clean roads, and mountain backdrops are frequent clues.",
        "Bollards and road signs often feel Central European rather than Balkan.",
        "Compared with Croatia, it is usually greener, hillier, and more Alpine."
      ]
    },
    {
      code: "ZA",
      name: "South Africa",
      tips: [
        "Left-side driving, English/Afrikaans place names, and long open roads are common.",
        "Yellow shoulder lines are a classic South African road clue.",
        "Landscape varies from dry scrub to green hills, but roads often feel spacious.",
        "Suburbs may have walls, gates, and wide streets.",
        "Compared with Botswana or Lesotho, look for more developed roads and more varied scenery."
      ]
    },
    {
      code: "KR",
      name: "South Korea",
      aliases: ["Korea", "Republic of Korea"],
      tips: [
        "Hangul script is the strongest clue and appears on most signs.",
        "Mountainous roads, dense towns, tunnels, and green/blue highway signs are common.",
        "Traffic keeps right, unlike Japan.",
        "Urban areas show many apartment towers and compact commercial streets.",
        "Compared with Taiwan, the script is simpler and block-like rather than Chinese characters."
      ]
    },
    {
      code: "ES",
      name: "Spain",
      tips: [
        "Spanish is common, but Catalan, Basque, or Galician can appear regionally.",
        "Dry hills, red soil, olive groves, and white villages are common in many regions.",
        "Road signs are European, with blue motorways and N/A/region route labels.",
        "License plates are white with EU strip and no regional text.",
        "Compared with Portugal, Spanish words usually lack ao, lh, and nh patterns."
      ]
    },
    {
      code: "LK",
      name: "Sri Lanka",
      tips: [
        "Left-side driving with Sinhala, Tamil, and English signs is common.",
        "Sinhala script is very curly and distinctive.",
        "Tuk-tuks, tropical greenery, tea hills, and red soil appear often.",
        "Roads can be narrow and busy, with many small shops.",
        "Compared with India, Sri Lanka often feels more tropical and island-like."
      ]
    },
    {
      code: "SE",
      name: "Sweden",
      tips: [
        "Forests, red wooden houses, and clean Nordic roads are common.",
        "Swedish uses a with ring, ae, and oe in place names.",
        "Blue/yellow direction signs and wintery northern scenery can appear.",
        "Roads often feel wider and less mountainous than Norway.",
        "Compared with Finland, Swedish words look more Germanic and less vowel-heavy."
      ]
    },
    {
      code: "CH",
      name: "Switzerland",
      tips: [
        "Alpine scenery, very clean roads, and wealthy villages are major clues.",
        "License plates are not EU-style and can be small or distinctive.",
        "German, French, Italian, or Romansh can appear depending on region.",
        "Road signs and markings are extremely orderly, with many tunnels and mountain roads.",
        "Compared with Austria, it often feels even cleaner and uses more multilingual cues."
      ]
    },
    {
      code: "TW",
      name: "Taiwan",
      tips: [
        "Traditional Chinese characters, scooters, and dense urban streets are common.",
        "Traffic keeps right, unlike Hong Kong or Japan.",
        "Mountainous tropical roads and blue road signs appear often.",
        "Utility poles, tiled buildings, and busy shopfronts are frequent clues.",
        "Compared with Hong Kong, roads are less British-style and driving is on the right."
      ]
    },
    {
      code: "TH",
      name: "Thailand",
      tips: [
        "Thai script plus left-side driving is the core clue.",
        "Tropical roads, temples, concrete utility poles, and pickup trucks are common.",
        "Yellow/black warning signs and painted curbs appear often.",
        "Roads can be wide and well-paved compared with Cambodia or Laos.",
        "Compared with Laos, Thailand drives left and often has denser road infrastructure."
      ]
    },
    {
      code: "TN",
      name: "Tunisia",
      tips: [
        "Arabic and French signs together are common.",
        "Dry Mediterranean scenery, white buildings, and olive groves appear often.",
        "Black license plates with white text can be a strong clue.",
        "Roads drive on the right and often feel North African but fairly developed.",
        "Compared with Jordan, French signs and Mediterranean towns help."
      ]
    },
    {
      code: "TR",
      name: "Turkey",
      aliases: ["Turkiye"],
      tips: [
        "Turkish uses Latin letters with g, s, i, and c variations that stand out.",
        "Mosques, minarets, red flags, and dry Anatolian landscapes are common.",
        "License plates usually have a blue TR band but no EU stars.",
        "Road signs are European-style, often with red borders and clear town names.",
        "Terrain varies from coastal green to dry plateaus, but language is the safest clue."
      ]
    },
    {
      code: "UG",
      name: "Uganda",
      tips: [
        "Left-side driving with English signs, red soil, and lush greenery is common.",
        "Roadside schools, churches, and small shops often use English names.",
        "Yellow rear plates may appear on vehicles.",
        "Roads can be busy and uneven, with tropical hills or flatlands nearby.",
        "Compared with Kenya, Uganda often feels greener and more humid."
      ]
    },
    {
      code: "UA",
      name: "Ukraine",
      tips: [
        "Cyrillic signs with blue/yellow national colors can appear.",
        "Flat fields, wide roads, older pavement, and concrete utility poles are common.",
        "Villages may show long straight roads and simple houses.",
        "License plates are white and can have a blue/yellow strip.",
        "Compared with Russia, Ukraine often feels more agricultural and European in signage."
      ]
    },
    {
      code: "AE",
      name: "United Arab Emirates",
      aliases: ["UAE"],
      tips: [
        "Arabic and English signs, desert surroundings, and very wide modern roads are common.",
        "Urban areas show glass towers, clean highways, and Gulf-style road signs.",
        "Right-side driving and hot, flat, sandy landscapes are typical.",
        "Palm landscaping, large interchanges, and luxury-looking roads appear often.",
        "Compared with Qatar, UAE may show more varied emirate road signs and city density."
      ]
    },
    {
      code: "GB",
      name: "United Kingdom",
      aliases: ["UK", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"],
      tips: [
        "Left-side driving with yellow rear plates and white front plates is a huge clue.",
        "English signs, hedgerows, stone walls, and narrow lanes are common.",
        "Road signs use miles, not kilometers.",
        "Road markings and traffic furniture have a very distinctive British style.",
        "Compared with Ireland, there is usually no Irish Gaelic on ordinary road signs."
      ]
    },
    {
      code: "US",
      name: "United States",
      aliases: ["USA", "United States of America", "U.S.", "US"],
      tips: [
        "Mph speed limits, double yellow center lines, and state route shields are common.",
        "Roads are wide, signs are in English, and license plates vary by state.",
        "Suburbs often show large roads, sidewalks or lawns, and big parking lots.",
        "Landscape is extremely varied, so road signs and state clues matter most.",
        "Compared with Canada, speed signs are in mph and road shields are often state-specific."
      ]
    },
    {
      code: "UY",
      name: "Uruguay",
      tips: [
        "Spanish signs with flat green farmland and quiet towns are common.",
        "Mercosur-style plates can appear on vehicles.",
        "Roads often feel calmer and less mountainous than Argentina or Chile.",
        "Palm trees, eucalyptus, and low rolling countryside are useful clues.",
        "Compared with Argentina, Uruguay often feels smaller, greener, and more coastal."
      ]
    },
    {
      code: "VN",
      name: "Vietnam",
      tips: [
        "Vietnamese has many tone marks and distinctive words like duong and pho.",
        "Motorbikes, dense shops, red flags with yellow stars, and tropical roads are common.",
        "Traffic keeps right, unlike Thailand or Malaysia.",
        "Urban streets can be very dense, with narrow buildings and overhead wires.",
        "Compared with Cambodia or Laos, Latin-script Vietnamese is the easiest separator."
      ]
    }
  ];

  const EXTRA_ALIASES = {
    "Cote d Ivoire": "CI",
    "Czech Republic": "CZ",
    "Holland": "NL",
    "Republic of Korea": "KR",
    "South Korea": "KR",
    "Swaziland": "SZ",
    "UAE": "AE",
    "UK": "GB",
    "USA": "US",
    "United States of America": "US"
  };

  function slugify(value) {
    return value
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const countries = RAW_COUNTRIES
    .map((country) => {
      const slug = country.slug || slugify(country.name);
      return {
        ...country,
        slug,
        plonkit: country.plonkit || `https://www.plonkit.net/${slug}`,
        gallery: country.gallery || []
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const aliases = {};

  for (const country of countries) {
    aliases[country.name.toLowerCase()] = country.code;
    aliases[country.code.toLowerCase()] = country.code;
    for (const alias of country.aliases || []) {
      aliases[alias.toLowerCase()] = country.code;
    }
  }

  for (const [alias, code] of Object.entries(EXTRA_ALIASES)) {
    aliases[alias.toLowerCase()] = code;
  }

  window.GG_STUDY_DATA_VERSION = "2026-06-28";
  window.GG_STUDY_COUNTRIES = countries;
  window.GG_STUDY_COUNTRY_ALIASES = aliases;
})();
