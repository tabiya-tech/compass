export interface EmployerGroup {
  province: string;
  employers: string[];
}

export interface Consideration {
  title: string;
  body: string;
}

export interface SectorStaticData {
  displayName: string;
  sectorApiParam: string;
  heroColor: string;
  ladderColors: string[];
  avgEarnings: string;
  heroText: string;
  heroHighlight: string;
  geoLabel: string;
  mapFile: string;
  mapAlt: string;
  employers: EmployerGroup[];
  programmeSubtitleSuffix: string;
  considerations: Consideration[];
  sources: string;
}

const SECTOR_DATA: Record<string, SectorStaticData> = {
  "agriculture-pathway": {
    displayName: "Agriculture",
    sectorApiParam: "Agriculture",
    heroColor: "#2D7D46",
    ladderColors: ["#2D7D46", "#267a3e", "#1f6d35", "#18602c", "#115523"],
    avgEarnings: "K3,746",
    heroText:
      "Agriculture is Zambia's largest employer, with over one million people working across crop production, livestock, aquaculture, and forestry. The country's large commercial farms achieve world-class maize yields of 10 MT/ha, nearly double the global average. Soya output is forecast to double by 2030 and wheat yields on irrigated farms reach 7.4 MT/ha compared to a global average of 2.6.",
    heroHighlight:
      "With growing demand for agricultural engineers, agronomists, and agribusiness professionals, the sector is actively diversifying beyond traditional farming into precision agriculture, data analytics, and climate-smart technologies.",
    geoLabel:
      "Agricultural employment is spread across all provinces, with the highest concentration in Central, Southern, and Eastern provinces. Commercial farming operations are primarily in Central and Southern, while smallholder farming dominates Eastern, Northern, and Western provinces.",
    mapFile: "zm-agriculture-map.svg",
    mapAlt: "Map of Zambia highlighting Central, Southern, and Eastern provinces",
    employers: [
      {
        province: "Central / Lusaka",
        employers: [
          "Zambeef Products (integrated agribusiness)",
          "NWK Limited (agricultural services)",
          "Olam Agri (soybean)",
        ],
      },
      {
        province: "Southern",
        employers: ["Zambia Sugar / Nakambala Estate (Mazabuka)", "Zambeef (cattle ranching)"],
      },
      {
        province: "Eastern",
        employers: ["Various commercial farms", "Tobacco and cotton operations"],
      },
      {
        province: "Nationwide",
        employers: ["Hybrid Poultry", "FirstWave Group (aquaculture)", "AgDevCo (investment)"],
      },
    ],
    programmeSubtitleSuffix:
      "Offered at training centres in Central, Southern, Eastern, Lusaka, Northern, and other provinces.",
    considerations: [
      {
        title: "Formality and earnings",
        body: "92.6% of agricultural employment is informal. Average formal sector earnings of K3,746/month are below the national average, though commercial farm and agribusiness roles pay significantly more. Formal positions offer benefits including social security.",
      },
      {
        title: "Geographic spread",
        body: "Agricultural work is available across all provinces, unlike mining or energy which concentrate in specific areas. However, commercial operations with formal employment are mainly in Central, Southern, and Lusaka provinces.",
      },
      {
        title: "Seasonal and climate factors",
        body: "Agricultural work is seasonal, with planting and harvest periods driving labour demand. Climate variability, including droughts and floods, affects production and employment. Climate-smart skills are increasingly valued.",
      },
      {
        title: "Industry outlook",
        body: "The World Bank projects $0.3–1.5 billion in agricultural investment and 20,000–60,000 new jobs by 2030. Soya, wheat, and aquaculture are the fastest-growing subsectors. Less than 3% of farmers currently access bank finance, creating opportunities in agricultural fintech.",
      },
    ],
    sources:
      "Sources: 2023 Labour Force Survey (ZamStats) · EEI 2022/2023 (ZamStats) · Critical Skills List (TEVETA, 2025) · TEVETA Master Dataset (Dec 2025) · Priority Curriculum Development (ILO/TEVETA, 2026) · Zambia CPSD (World Bank, 2024) · ZDA Agriculture Sector Profile (2024)",
  },

  "mining-pathway": {
    displayName: "Mining",
    sectorApiParam: "Mining",
    heroColor: "#0A5C4A",
    ladderColors: ["#0A5C4A", "#0a6b56", "#0c7a62", "#0e896e", "#10987a"],
    avgEarnings: "K14,182",
    heroText:
      "Zambia is the world's seventh-largest copper producer and a top source of emeralds, with mining driving over 70% of the country's export earnings. It is the highest-paying industrial sector in Zambia, with jobs concentrated primarily in the Copperbelt and North-Western provinces.",
    heroHighlight:
      "With 6 percent of the world's known copper reserves, as well as large deposits of cobalt, nickel, and manganese, all essential for electric vehicles, batteries, and renewable energy, demand for skilled mining professionals is set to grow as the world shifts to low-carbon technologies.",
    geoLabel:
      "58.9% of mining employment is concentrated in Copperbelt Province. North-Western Province is the fastest-growing mining region.",
    mapFile: "zm-mining-map.svg",
    mapAlt: "Map of Zambia highlighting Copperbelt and North-Western provinces",
    employers: [
      {
        province: "Copperbelt",
        employers: [
          "Mopani Copper Mines (Kitwe, Mufulira)",
          "Konkola Copper Mines / KCM (Chingola)",
          "Chambishi Metals (Chambishi)",
        ],
      },
      {
        province: "North-Western",
        employers: [
          "First Quantum Minerals (Kansanshi, Solwezi)",
          "First Quantum Minerals (Sentinel, Kalumbila)",
          "KoBold Metals (exploration stage)",
        ],
      },
      {
        province: "Southern / Central",
        employers: ["Barrick Gold (Lumwana Mine)"],
      },
    ],
    programmeSubtitleSuffix:
      "Offered at training centres in Copperbelt, Lusaka, North-Western, Central, Southern, and other provinces.",
    considerations: [
      {
        title: "Location and lifestyle",
        body: "Mining jobs are concentrated in Copperbelt towns (Kitwe, Mufulira, Chingola) and North-Western Province (Solwezi, Kalumbila). Relocation from Lusaka or other provinces is common. Many mining companies provide housing or housing allowances, transport, and meals for employees.",
      },
      {
        title: "Working conditions",
        body: "Mining is physically demanding and involves shift work, often on a rotational basis (e.g. 14 days on, 7 days off). Underground and open-pit operations carry safety risks. All employers provide occupational health and safety training, and 67% of mining jobs are formal with social security and benefits.",
      },
      {
        title: "Career progression",
        body: "Mining offers structured progression from ZQF 3 (1 year) through to ZQF 6 (3 years). Bridging courses allow workers to move between specialisations, for example from automotive repair to heavy equipment repair. Recognition of Prior Learning (RPL) enables experienced workers without formal qualifications to gain certification.",
      },
      {
        title: "Industry outlook",
        body: "$9.3 billion has been invested in Zambian mining since 2024, with direct employment projected to grow from 56,000 to 200,000 jobs. Global demand for copper is accelerating due to electric vehicles and renewable energy infrastructure. Only 55% of Zambia has been geologically mapped, meaning new deposits and mines are likely.",
      },
    ],
    sources:
      "Sources: 2023 Labour Force Survey (ZamStats) · EEI 2022/2023 (ZamStats) · Critical Skills List (TEVETA, 2025) · TEVETA Approved Programs (2020) · Priority Curriculum Development (ILO/TEVETA, 2026) · Zambia CPSD (World Bank, 2024) · Ministry of Mines Briefing (2024)",
  },

  "energy-pathway": {
    displayName: "Energy",
    sectorApiParam: "Energy",
    heroColor: "#D44B1A",
    ladderColors: ["#D44B1A", "#c24316", "#b03a12", "#9e320e", "#8c2a0a"],
    avgEarnings: "K13,607",
    heroText:
      "Zambia is undergoing a major energy transformation, with only 48 percent of households currently connected to the electricity grid and demand projected to grow by over 150 percent by 2030. The country's installed solar capacity is set to expand from 123 MW to over 2,000 MW, creating thousands of new skilled jobs.",
    heroHighlight:
      "With the second-highest average formal sector earnings of all industrial sectors, energy offers strong career prospects across generation, transmission, distribution, and renewable technologies.",
    geoLabel:
      "Zambia's energy infrastructure spans all provinces, with ZESCO operating nationwide. The Copperbelt is a major demand centre, while new solar capacity is concentrated in Central and Southern provinces.",
    mapFile: "zm-energy-map.svg",
    mapAlt: "Map of Zambia highlighting energy infrastructure provinces",
    employers: [
      {
        province: "Copperbelt",
        employers: ["ZESCO (nationwide, HQ Lusaka)", "Copperbelt Energy Corporation / CEC (Kitwe)"],
      },
      {
        province: "Southern",
        employers: ["Maamba Collieries (Maamba)", "ZESCO (Kariba)"],
      },
      {
        province: "Central / Lusaka",
        employers: ["SkyPower Global (solar)", "Chisamba Solar (100MW)"],
      },
      {
        province: "Various",
        employers: ["Independent Power Producers (IPPs)", "EPIROC", "Sandvik"],
      },
    ],
    programmeSubtitleSuffix:
      "Offered at training centres in Copperbelt, Lusaka, Central, Southern, and other provinces.",
    considerations: [
      {
        title: "Market structure",
        body: "ZESCO dominates 81% of the electricity market. Reforms to allow more independent power producers are underway, opening new employment opportunities beyond the state utility.",
      },
      {
        title: "Rapid technology change",
        body: "Solar, wind, battery storage, and smart grid technologies are evolving quickly. Workers who can adapt to new systems and equipment will be most in demand.",
      },
      {
        title: "Career progression",
        body: "Energy careers span from 2-week cable jointing courses through to 3-year engineering diplomas. Bridging courses and RPL pathways allow experienced workers to formalise their qualifications.",
      },
      {
        title: "Industry outlook",
        body: "Solar capacity is expanding 17x by 2030. Electricity exports to the Southern African Power Pool rose from $87M in 2019 to $397M in 2023, creating regional demand for Zambian energy skills.",
      },
    ],
    sources:
      "Sources: 2023 Labour Force Survey (ZamStats) · EEI 2022/2023 (ZamStats) · Critical Skills List (TEVETA, 2025) · TEVETA Master Dataset (Dec 2025) · Energy Sector Priorities (TEVETA) · Zambia CPSD (World Bank, 2024) · Integrated Resource Plan (ERB)",
  },

  "hospitality-pathway": {
    displayName: "Hospitality & Tourism",
    sectorApiParam: "Hospitality",
    heroColor: "#B45309",
    ladderColors: ["#B45309", "#9a4708", "#803b07", "#663006", "#4d2405"],
    avgEarnings: "K3,955",
    heroText:
      "Zambia's tourism sector is anchored by Victoria Falls, 20 national parks, and some of Africa's finest safari destinations. Over 102,000 people work in accommodation and food services, making it one of the most female-represented sectors with 67% women. Entry is accessible, with training programmes as short as three months in tour guiding and digital marketing.",
    heroHighlight:
      "The World Bank projects $35–100 million in tourism investment and 2,000–6,000 new jobs by 2030, with particular growth in nature-based tourism, adventure tourism, and the meetings and events (MICE) segment.",
    geoLabel:
      "Tourism employment is concentrated around Zambia's key destinations. Southern Province (Livingstone and Victoria Falls) and Eastern Province (South Luangwa National Park) are the primary tourism hubs, with Lusaka serving as the business tourism centre.",
    mapFile: "zm-hospitality-map.svg",
    mapAlt: "Map of Zambia highlighting Southern, Eastern, and Lusaka provinces for tourism",
    employers: [
      {
        province: "Southern (Livingstone)",
        employers: [
          "Time + Tide / Norman Carr Safaris",
          "The Bushcamp Company",
          "Royal Livingstone by Anantara",
          "Taj Hotels",
        ],
      },
      {
        province: "Eastern (South Luangwa)",
        employers: ["Robin Pope Safaris", "Green Safaris", "Flatdogs Camp"],
      },
      {
        province: "Lusaka",
        employers: ["Taj Pamodzi", "Radisson Blu", "InterContinental"],
      },
      {
        province: "Lower Zambezi / Kafue",
        employers: ["Various safari operators and lodges"],
      },
    ],
    programmeSubtitleSuffix:
      "Offered at training centres in Southern, Lusaka, Eastern, Copperbelt, and other provinces.",
    considerations: [
      {
        title: "Informality",
        body: "74.3% of hospitality employment is informal, meaning lower pay and fewer benefits. Formal roles at hotels, lodges, and tour operators are better paid but more competitive. A TEVET qualification significantly improves access to formal positions.",
      },
      {
        title: "Seasonality",
        body: "Tourism is seasonal, with peak visitor periods driving demand. External events such as pandemics and economic downturns can significantly impact the industry. Workers with diverse skills across food service, guiding, and hospitality management are more resilient.",
      },
      {
        title: "Location",
        body: "Tourism jobs are concentrated around key destinations: Livingstone (Victoria Falls), South Luangwa, Lower Zambezi, and Lusaka. Accommodation is often provided by employers at safari lodges and remote tourism operations.",
      },
      {
        title: "Industry outlook",
        body: "Zambia is positioning itself as a premium eco-tourism destination. The MICE segment is growing with new convention facilities in Lusaka. Regional tourism from the DRC, Zimbabwe, and other neighbouring countries provides a growing visitor base.",
      },
    ],
    sources:
      "Sources: 2023 Labour Force Survey (ZamStats) · EEI 2022/2023 (ZamStats) · Critical Skills List (TEVETA, 2025) · TEVETA Master Dataset (Dec 2025) · Priority Curriculum Development (ILO/TEVETA, 2026) · Zambia CPSD (World Bank, 2024)",
  },

  "water-pathway": {
    displayName: "Water & Sanitation",
    sectorApiParam: "Water",
    heroColor: "#0E7490",
    ladderColors: ["#0E7490", "#0c6680", "#0a5870", "#084a60", "#063c50"],
    avgEarnings: "K7,813",
    heroText:
      "Only 36 percent of Zambians have access to safely managed drinking water, and just 25 percent have adequate sanitation. As one of the most rapidly urbanising countries in sub-Saharan Africa, Zambia's demand for water infrastructure, treatment, and waste management is growing fast. The sector encompasses over 70 identified occupations across water supply, wastewater treatment, solid waste management, environmental services, hydrology, and instrumentation.",
    heroHighlight:
      "With a formality rate of 64.8 percent, well above average, and earnings in line with the national formal sector average, water and sanitation careers offer stable employment with significant growth potential as infrastructure investment increases.",
    geoLabel:
      "Water utility employment is 91.6% urban, spread across all provincial capitals. Lusaka Water and Sewerage Company and Nkana Water (Copperbelt) are the largest utilities. Zambia operates 11 commercial water utilities nationwide.",
    mapFile: "zm-water-map.svg",
    mapAlt: "Map of Zambia highlighting water and sanitation employment areas",
    employers: [
      {
        province: "Lusaka",
        employers: ["Lusaka Water Supply and Sanitation Company (LWSC), serving 3M+ customers"],
      },
      {
        province: "Copperbelt",
        employers: ["Nkana Water Supply and Sanitation Company (Kitwe, Kalulushi, Lufwanyama)"],
      },
      {
        province: "Southern",
        employers: ["Southern Water and Sewerage Company"],
      },
      {
        province: "Nationwide",
        employers: [
          "11 commercial water utilities regulated by NWASCO",
          "Ministry of Water Development and Sanitation",
          "NGOs and development partners (UNICEF, WaterAid)",
        ],
      },
    ],
    programmeSubtitleSuffix: "Offered at training centres across Zambia's provincial capitals.",
    considerations: [
      {
        title: "Essential services",
        body: "Water and sanitation underpin public health. These roles are essential regardless of economic conditions, providing greater job security than many other sectors. The 64.8% formality rate means most workers receive benefits.",
      },
      {
        title: "Infrastructure gap",
        body: "The gap between 36% current water access and universal coverage represents decades of sustained work in construction, operations, and maintenance. This is a sector that needs to grow significantly.",
      },
      {
        title: "Utility employment",
        body: "Most formal water sector jobs are with the 11 commercial water utilities. These are regulated by NWASCO and offer structured career paths. Competition for utility positions can be high in urban areas.",
      },
      {
        title: "Climate and growth",
        body: "Climate variability is increasing the importance of water resource management, flood control, and drought-resilient systems. Urban population growth is driving demand for expanded water distribution, sewerage, and waste management services.",
      },
    ],
    sources:
      "Sources: 2023 Labour Force Survey (ZamStats) · EEI 2022/2023 (ZamStats) · Critical Skills List (TEVETA, 2025) · TEVETA Master Dataset (Dec 2025) · WHO/UNICEF Joint Monitoring Programme (2023) · NWASCO",
  },
};

export default SECTOR_DATA;
