// Green Radius Game — content from official PDF (Frog v12 FINAL, 2026), with
// bigGoal/description wording lightly tightened for the app and measurements
// shown imperial-first with the PDF's metric value in parentheses (PR #41);
// question ids, titles, links, and every underlying quantity match the PDF.
// Structure: 6 sectors × 4 tiers × (1, 2, 3, 4) questions = 60 steps total.
// Tiers 1–3 are fixed steps. Tier 4 is "advanced" — for each of its 4 slots,
// the player picks a topic from a dropdown and answers Yes/No on it.
// The per-sector "Our Camp's Idea" topic (id `X-camp`) is the write-in slot:
// the UI collects a free-text description alongside the Yes/No, submitted as
// an `X-camp-note` entry in the answers map (see docs/architecture.md).

window.SECTORS = [
  // ── FOOD ────────────────────────────────────────────────────────────────
  {
    id: 'food', code: 'F', name: 'Food', icon: 'food',
    color: '#7AB85C',
    bigGoal: "Radical solutions for efficient, economical, ecological food. Purchase mindfully, share cooking, reduce food waste.",
    resourceLink: { label: 'Food page — Green Camp Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/food' },
    levels: [
      // Tier 1 (1 question)
      [{
        id: 'F1', code: 'F1', step: 1, title: 'Meal Plan',
        prompt: "Have you whipped up a Meal Plan for your camp?",
        description: "Forgot milk? Forgot vegan? Forgot time? The closest grocery is 60 miles (100 km) away, and you can't leave anyway. Feed everyone, special diets included, with less waste. Leftovers become another meal.",
        link: { label: 'Whip up a Meal Plan', url: 'https://southernsustainabilityinstitute.org/meal-planning-for-the-planet-how-reducing-food-waste-starts-in-your-kitchen/' }
      }],
      // Tier 2 (2 questions)
      [{
        id: 'F2', code: 'F2', step: 2, title: '25% Food Waste Reduction',
        prompt: "Are you below 0.75 lb (0.35 kg) of food waste / person / day?",
        description: "US average is 1 lb / person / day (0.45 kg). 1 × 75% = 0.75 lb. About 30–40% of the US food supply is discarded every year. Avoid spoiling, eat leftovers soon, bring the rest to a BRC Compost Collection Station.",
        link: { label: 'EPA — Food Waste in America', url: 'https://www.epa.gov/sustainable-management-food' }
      }, {
        id: 'F3', code: 'F3', step: 3, title: 'Share Food Ideas in Camp',
        prompt: "Does every camper understand the Meal Plan, food waste, and their individual impact?",
        description: "Food footprint Acculturation! Host a Food Waste Coffee Talk. Make grocery lists before leaving home. Teach everyone the Meal Plan, their impact, and how to wash dishes with little water.",
        link: { label: 'Food Footprint Calculator', url: 'https://harvard-foodprint-calculator.github.io/' }
      }],
      // Tier 3 (3 questions)
      [{
        id: 'F4', code: 'F4', step: 4, title: 'Share One Kitchen',
        prompt: "Does your camp share one kitchen (or fewer)?",
        description: "Saves space, time + money. More FUN! Share cooking, refrigeration, dishwashing, utensils and supplies. Centralizing is more hygienic, easier to monitor for spoiling, and still lets different people cook for special diets.",
        link: { label: 'Large-scale recipes', url: 'https://www.cdkitchen.com/recipes/holidays-parties/cooking-for-a-crowd/' }
      }, {
        id: 'F5', code: 'F5', step: 5, title: 'Gift Food in Camp',
        prompt: "Does your camp gift food to the public?",
        description: "Food is perhaps the most sacred gift. A sweet and salty snack or a 7-course feast: gifted food builds community. Share unpackaged food hygienically.",
        link: { label: 'Gifting Food', url: 'https://easyhealthyfoods.com/what-does-it-mean-when-someone-gives-you-food/' }
      }, {
        id: 'F6', code: 'F6', step: 6, title: 'Show People! Food Ideas',
        prompt: "Does your camp showcase its green food ideas to the public?",
        description: "Leave No Food Waste: our Leftovers Cookbook! Send in your leftovers recipes, host a cooking class, or a vegan cook-off. We are Burners. We showcase our experiments through signage, exhibits, games, plays, music, Green ART.",
        link: { label: 'Green Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/food' }
      }],
      // Tier 4 — pick a topic from this list, then yes/no (4 picks)
      // Marker: tier4 = true; topics is the dropdown options
      []
    ],
    tier4Topics: [
      { id: 'F-hub', title: 'Be a Food HUB', description: "Provide food and kitchens for your Placement HUB camps. Join a HUB with other camps in the Placement system." },
      { id: 'F-communal', title: 'Communal Meals', description: "Shared meals build camp bonds. Plus less energy for cooking, heating, cooling." },
      { id: 'F-reusable', title: 'Reusable Eatery', description: "Drink + food containers + utensils. No disposables. Encourage everyone to bring their own plate, cup, utensils.", link: { label: 'Reusable eatery', url: 'https://www.greenthemecampcommunity.org/resource-guide/food' } },
      { id: 'F-packaging', title: 'Reduce Packaging', description: "Skip individually-packaged foods. Buy in bulk, freeze or store in large containers, make communal meals easier.", link: { label: 'Waste from Food Packaging', url: 'https://foodprint.org/issues/the-environmental-impact-of-food-packaging/' } },
      { id: 'F-cooling', title: 'Reduce Cooling', description: "Ice chests, rated coolers, fewer fridges + freezers. Use Arctica. Ice intelligently: shade, elevate, insulate, wrap coolers. Try no-cooling meals.", link: { label: 'Ice Intelligently', url: 'https://www.greenthemecampcommunity.org/resource-guide/food' } },
      { id: 'F-cooking', title: 'Reduce Cooking', description: "Try solar cooking. Or no cooking. Pre-make more. Experiment with reflective, radiant and induction methods. Consider solar slow-cooking and reheating." },
      { id: 'F-washing', title: 'Reduce Washing', description: "Try dishwashing with low water. Or no water. Eat all food on your plate or scrape into compost. Spray bottles with white vinegar and water. Or three-bucket wash: pre-wash, soap, rinse, air-dry." },
      { id: 'F-local', title: 'Source Locally', description: "Fresher food, less transport. Source in Northern Nevada or near your hometown. Buying local supports growers and food security.", link: { label: 'Source Local Foods', url: 'https://www.greenthemecampcommunity.org/resource-guide/food' } },
      { id: 'F-plant', title: 'Source Plant-based Foods', description: "More veggies! Meat production has a high environmental impact. Shift toward plant-based meals and regenerative meats.", link: { label: 'More Plant-based Foods', url: 'https://worldmetrics.org/plant-based-diet-statistics/' } },
      { id: 'F-collexodus', title: 'Gift to Collexodus', description: "Collexodus collects leftovers for BM staff and Resto. On your exodus, at 6:00 and K, donate unopened non-perishable food, beer or booze." },
      { id: 'F-camp', title: "Our Camp's Idea", prompt: "Did your camp pull it off?", description: "Describe one of your camp's own food ideas, and answer whether you actually achieved it." },
    ]
  },

  // ── WATER ───────────────────────────────────────────────────────────────
  {
    id: 'water', code: 'H', name: 'Water', icon: 'water',
    color: '#4FA8C9',
    bigGoal: "We are 60–75% water. Drink it. Share it. Reuse it. Soon water, not power, will be the most important green variable.",
    resourceLink: { label: 'Water page — Green Camp Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/water' },
    levels: [
      [{
        id: 'H1', code: 'H1', step: 1, title: 'Estimate Water',
        prompt: "Have you centrally planned at least 1.5 gal (6 L) / person / day of water?",
        description: "Hydrate, Hydrate, Hydrate. The Survival Guide minimum is 1.5 gallons (6 litres) per person per day. Plus cooking, washing, showering, gifting. Plus spills, evaporation, contingency. Don't die.",
        link: { label: 'Potable Water — Burning Man', url: 'https://burningman.org/black-rock-city/preparation/camping-tips/water/' }
      }],
      [{
        id: 'H2', code: 'H2', step: 2, title: '75% Water Reduction',
        prompt: "Are you below 20 gal (75 L) / person / day of water consumption?",
        description: "US average is 82 gal / person / day (310 L). 82 × 25% = 20.5 gal. Should be easy: no water utility, no flush toilets, no lawns to irrigate.",
        link: { label: 'EPA — US Water Consumption', url: 'https://www.epa.gov/watersense' }
      }, {
        id: 'H3', code: 'H3', step: 3, title: 'Share Water Ideas in Camp',
        prompt: "Does every camper understand hydration, drinking water, greywater, and their individual impact?",
        description: "Water footprint Acculturation! Talk water while refilling bottles, at pre-playa camp meetings, on Arctica ice runs, in the shower."
      }],
      [{
        id: 'H4', code: 'H4', step: 4, title: '100% Shared Water Source',
        prompt: "Does your camp provide ALL the water for ALL your campers?",
        description: "Large volumes are cheaper, more efficient, lower-CO2e. At minimum, all the potable drinking water. Water is heavy and expensive to haul."
      }, {
        id: 'H5', code: 'H5', step: 5, title: 'Gift Water in Camp',
        prompt: "Does your camp gift water to the public?",
        description: "Gift water for everyone's survival. A cooler on your bar, a hydration station on your street. Hydrated burners are happy burners."
      }, {
        id: 'H6', code: 'H6', step: 6, title: 'Show People! Water Ideas',
        prompt: "Does your camp showcase its green water ideas to the public?",
        description: "Mist my Street! Camp Hydro-Hydra drags a giant tentacle hose into their street, pumping cool mist. We are Burners. We showcase our experiments through signage, exhibits, programs, ART."
      }],
      []
    ],
    tier4Topics: [
      { id: 'H-hub', title: 'Be a Water HUB', description: "Provide fresh or grey water systems, showers or kitchens. Join a Placement Water HUB with other camps." },
      { id: 'H-oss', title: 'Use OSS', description: "Out-Side Services sells fresh water and pumps grey/black water on playa. Large-volume OSS trucks are more efficient for transport and emissions.", link: { label: 'OSS', url: 'https://burningman.org/black-rock-city/preparation/infrastructure/deliveries/outside-services-program/' } },
      { id: 'H-arctica', title: 'Use Arctica', description: "Arctica sells ice, block and bag, on playa. Ice cuts refrigeration and power; melt water washes dishes. Three locations across BRC.", link: { label: 'Arctica ice sales', url: 'https://burningman.org/black-rock-city/preparation/infrastructure/arctica-ice-sales/' } },
      { id: 'H-local', title: 'Local Water', description: "Fill up in Northern Nevada. Reno has plenty of water stores. Water weighs a ton, don't drive it across the country.", link: { label: 'Potable Water — Burning Man', url: 'https://burningman.org/black-rock-city/preparation/camping-tips/water/' } },
      { id: 'H-bottles', title: 'Reusable Bottles', description: "Get your own water bottle. Put your name on it. Sleep with it. No single-use containers. For public watering, compostable cone Dixie cups." },
      { id: 'H-grey', title: 'Greywater Processing', description: "Build a system for evaporation, filtration, or reuse. Try a Greywater Evaporation Pond, Wikatron, or wind-power. Locate away from your compost-drying racks." },
      { id: 'H-reduce', title: 'More Reduction', description: "Even less water: food prep, dishwashing, cleaning, showers. Low-flow sprayers, fixtures, shower heads. Tubs for different dish water types. Discounts for showering with a friend." },
      { id: 'H-camp', title: "Our Camp's Idea", prompt: "Did your camp pull it off?", description: "Describe one of your camp's own water ideas, and answer whether you actually achieved it." },
    ]
  },

  // ── WASTE ───────────────────────────────────────────────────────────────
  {
    id: 'waste', code: 'W', name: 'Waste', icon: 'waste',
    color: '#C97A4F',
    bigGoal: "LNT. Leave No Trace. Simple.",
    resourceLink: { label: 'Waste page — Green Camp Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/waste' },
    levels: [
      [{
        id: 'W1', code: 'W1', step: 1, title: 'LNT + MOOP Plan',
        prompt: "Has your camp written down its LNT + MOOP plan?",
        description: "Join the planet's best + biggest restoration effort, the world's most advanced waste program. MOOP = Matter Out Of Place. Pre-MOOP, Daily MOOP, Post-MOOP. MOOP everywhere, MOOP all the time.",
        link: { label: 'Leaving No Trace — Burning Man', url: 'https://burningman.org/event/preparation/leaving-no-trace/' }
      }],
      [{
        id: 'W2', code: 'W2', step: 2, title: '50% Waste Reduction',
        prompt: "Are you below 2.2 lbs (1 kg) of waste / person / day?",
        description: "US average is 5 lbs / person / day (2.3 kg). 5 × 50% = 2.5 lbs. Reduce, refuse, repurpose.",
        link: { label: 'EPA — US Waste Generation', url: 'https://www.epa.gov/facts-and-figures-about-materials-waste-and-recycling' }
      }, {
        id: 'W3', code: 'W3', step: 3, title: 'Share Waste Ideas in Camp',
        prompt: "Does every camper understand the LNT + MOOP plan, recycling, composting, and their individual impact?",
        description: "Waste footprint Acculturation! Talk trash while gifting compost, sorting recycling, flattening boxes, balling twine. Zoom before playa."
      }],
      [{
        id: 'W4', code: 'W4', step: 4, title: '100% Recycling + Composting',
        prompt: "Does your camp recycle and compost 100% of materials that can be recycled?",
        description: "Plastic + metal, wet + dry. Sparkling water bottles, PBR cans. Containers happen: aim for 100% of what CAN BE recycled. Separate streams, reduce landfill. Pack-it-in / Pack-it-OUT.",
        link: { label: 'Waste Disposal + Recycling — Burning Man', url: 'https://burningman.org/black-rock-city/preparation/leaving-no-trace/leave-nevada-beautiful/' }
      }, {
        id: 'W5', code: 'W5', step: 5, title: 'Gift Waste to BRC',
        prompt: "Does your camp bring compost & recycling to BRC stations, or MOOP your hood?",
        description: "Bring compost to a BRC Compost Collection Station. OR MOOP beyond your camp: streets and fire lanes have the most. Carry a MOOP bag at all times.",
        link: { label: 'Composting — Burning Man', url: 'https://burningman.org/black-rock-city/preparation/leaving-no-trace/composting/' }
      }, {
        id: 'W6', code: 'W6', step: 6, title: 'Show People! Waste Ideas',
        prompt: "Does your camp showcase its green waste ideas to the public?",
        description: "Compost-drying Observation Research Laboratory: Camp Lost-R-Grant is building one. We are Burners. We showcase our experiments through signage, exhibits, plays, music, Green ART."
      }],
      []
    ],
    tier4Topics: [
      { id: 'W-hub', title: 'Be a Waste HUB', description: "Collect recycling, waste, or compost for your HUB-mates. Join a Placement Waste HUB for collection, sorting, and disposal." },
      { id: 'W-single', title: 'Reduce Single-Use', description: "Containers, bottles, boxes: think Costco and kegs. Buy bigger quantities, bring reusables, minimize film plastic." },
      { id: 'W-cover', title: 'Ground Cover', description: "Waterproof tarps under kitchens, showers. Oil-pan under VW bus. Highest priority: avoid spills on playa, especially chemicals. Second: dust control." },
      { id: 'W-toilets', title: 'Composting Toilets', description: "Chemical, sawdust, organic. Excrement experiments! Tarps underneath. DON'T put your toilet compost in the Portos." },
      { id: 'W-wood', title: 'Wood Recycling', description: "Boxes, pallets, packaging, structures: instant Art on Playa. Burn leftover wood at the Esplanade burn barrels at 3:00, 5:30 and 9:00, or take it home for upcycled art." },
      { id: 'W-camp', title: "Our Camp's Idea", prompt: "Did your camp pull it off?", description: "Describe one of your camp's own waste ideas, and answer whether you actually achieved it." },
    ]
  },

  // ── TRANSPORT ───────────────────────────────────────────────────────────
  {
    id: 'transport', code: 'T', name: 'Transport', icon: 'transport',
    color: '#9B7AC9',
    bigGoal: "Take a risk, share a ride. Share stuff, save cash. Our toxin du-jour is CO2e: reduce and offset.",
    resourceLink: { label: 'Transport page — Green Camp Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/transportation' },
    levels: [
      [{
        id: 'T1', code: 'T1', step: 1, title: 'Carpool Plan',
        prompt: "Has your camp planned ride-sharing from home to BRC and back?",
        description: "Be a Merry Prankster! Our ancestors rode a Magic Bus. Plan ride sharing from home to BRC and back, people and cargo alike. Getting there is half the fun.",
        link: { label: 'Magic Bus — Merry Pranksters', url: 'https://en.wikipedia.org/wiki/Furthur_(bus)' }
      }],
      [{
        id: 'T2', code: 'T2', step: 2, title: '90% Ride Sharing',
        prompt: "Are at least 90% of your campers carpooling, taking BXB, or otherwise sharing the ride?",
        description: "Carpool, BXB, public transport, any multi-passenger vehicle. Sharing saves CO2e, energy, money. Aim for at least 90% of campers sharing most of the way, especially the last roads to the playa.",
        link: { label: 'Burner Express — Burning Man', url: 'https://burningman.org/event/preparation/getting-there-back/burner-express/' }
      }, {
        id: 'T3', code: 'T3', step: 3, title: 'Share Transport Ideas in Camp',
        prompt: "Does every camper know the carpool plan, cargo sharing, and their individual CO2e impact?",
        description: "CO2e-culturation! Carpool plan before playa. Talk about emissions on your road trip. For extra credit, swag your CO2e reduction."
      }],
      [{
        id: 'T4', code: 'T4', step: 4, title: '50% Cargo Reduction',
        prompt: "Has your camp reduced cargo (weight + volume of stuff) by 50%?",
        description: "Reduce weight and volume of YOUR STUFF. Share everything, make do, innovate. Leave stuff at home. Don't replicate home, you're camping.",
        link: { label: 'Stuff Optimization — Carlin', url: 'https://www.youtube.com/watch?v=MvgN5gCuLac' }
      }, {
        id: 'T5', code: 'T5', step: 5, title: 'Gift CO2e Offsets',
        prompt: "Does your camp offset CO2e — by reducing back home, planting, or buying credits?",
        description: "Plant a tree with a child. Love Mother Earth. Reduction back home is the first and best offset: public transport, more biking. Go neutral or negative now, don't wait until 2030."
      }, {
        id: 'T6', code: 'T6', step: 6, title: 'Show People! Transport Ideas',
        prompt: "Does your camp showcase its green transport ideas to the public?",
        description: "Tap Dancing for Transport! Camp Tralfamadore wrote a musical about reducing methane emissions by increasing tap dancing. We are Burners. We showcase our experiments through ART."
      }],
      []
    ],
    tier4Topics: [
      { id: 'T-hub', title: 'Be a Transport HUB', description: "Provide rides for your HUB-mates, and their stuff. People and cargo sharing through a Placement Transport HUB." },
      { id: 'T-rideshare', title: 'Rideshare', description: "Offer rides through the Burner Ride Share Board, or your local and regional internet/social-media networks.", link: { label: 'BM Rideshare', url: 'https://burningman.org/black-rock-city/preparation/getting-there-and-back/rideshare/' } },
      { id: 'T-mv', title: 'Mutant Vehicle', description: "Many MVs gift rides. They take real work, and like bicycles, MVs are our Burning Man-unique CO2e reductions.", link: { label: 'DMV — Department of Mutant Vehicles', url: 'https://burningman.org/black-rock-city/volunteering/dept-of-mutant-vehicles/' } },
      { id: 'T-container', title: 'BM Container', description: "Have a BM Container, vehicle storage, or a spot on the wait-list. The Container program is the BEST: saves time, money, transport, CO2e. Apply even if you haven't gotten one yet.", link: { label: 'BRC Storage Program', url: 'https://burningman.org' } },
      { id: 'T-storelocal', title: 'Store Local', description: "Empire, Fernley, Wadsworth, Sparks, Reno, NW NV, or NE CA. No BM Container? Store anywhere in the region and haul less." },
      { id: 'T-55', title: 'Drive 55', description: "55 MPH (88 km/h) max to and from BRC. Saves gas, money, CO2e. An ancient proven green success." },
      { id: 'T-ev', title: 'EV Hauling', description: "Electric, wood, steam, corn, hydrogen, wind. Anything but petrol. Make sure you have enough juice to get back home. Black Rock City has no Ethanol farms." },
      { id: 'T-share-haul', title: 'Share Long Hauls', description: "Consolidate long-distance hauling with other Burners in your region. Tubs, crates, containers, pods. Philly camps share a trailer/rail program." },
      { id: 'T-bikes', title: '100% People Bicycles', description: "Real bicycles. Or tricycles, unicycles, any person-powered vehicle. Powered wheelchairs are cool, but E-BIKES DON'T COUNT." },
      { id: 'T-toxins', title: 'Reduce Future Toxins', description: "CO2e is easy; batteries are our worst toxin. Lost ones leach lead, lithium, nickel, cadmium into the playa. Collect batteries separately, take them home to a safe recycling center." },
      { id: 'T-camp', title: "Our Camp's Idea", prompt: "Did your camp pull it off?", description: "Describe one of your camp's own transport ideas, and answer whether you actually achieved it." },
    ]
  },

  // ── SHELTER ─────────────────────────────────────────────────────────────
  {
    id: 'shelter', code: 'S', name: 'Shelter', icon: 'shelter',
    color: '#D9885C',
    bigGoal: "The sun may burn you, but the wind will kill you. Shelter from sun, wind and dust, plus a good night's sleep, even in the daytime.",
    resourceLink: { label: 'Shelter page — Green Camp Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/shelter' },
    levels: [
      [{
        id: 'S1', code: 'S1', step: 1, title: 'Estimate Shelter',
        prompt: "Have you counted people, tents, trailers, RVs, and shade area?",
        description: "How much protection do you have: sun, wind, dust, rain, heat, cold? If you're a Placed camp, use the numbers from your Placement Plan."
      }],
      [{
        id: 'S2', code: 'S2', step: 2, title: '100% Protected Sleeping',
        prompt: "Does every camper have a protected sleeping space — no one sleeps outside in the dust?",
        description: "Protected sleeping spaces for every camper, 100%. Extra credit: shade over tents, maybe an over-night-dust-storm-visitor spot or two."
      }, {
        id: 'S3', code: 'S3', step: 3, title: 'Share Shelter Ideas in Camp',
        prompt: "Does every camper know where protected areas are for the public, the camp, and themselves?",
        description: "Shelter is big: start planning at your January camp Zoom. Talk it over before a thunderstorm or on a freezing night."
      }],
      [{
        id: 'S4', code: 'S4', step: 4, title: 'Camp Commons',
        prompt: "Does your camp have a common sheltered space — just for your campers?",
        description: "Sometimes campers need 'private' shelter away from the public. Your Interactive Public Space is the Living Room; your Camp Commons is the Den in the back of the house."
      }, {
        id: 'S5', code: 'S5', step: 5, title: 'Gift Shelter for the Public',
        prompt: "Does your camp's public space provide shelter — sun, rain, wind, or dust?",
        description: "Does your café have a rain awning? Is your bar 100-Proof Dust-Proof? When you're hunkered-down in a 4-hour white-out, you'll meet the people who will change your life."
      }, {
        id: 'S6', code: 'S6', step: 6, title: 'Show People! Shelter Ideas',
        prompt: "Does your camp showcase its green shelter ideas to the public?",
        description: "Toothpick Towers! Kamp Kross-Brace invites Burners to huff and puff at a three-story shelter made entirely of recycled toothpicks. We are Burners. We showcase our experiments through ART."
      }],
      []
    ],
    tier4Topics: [
      { id: 'S-hub', title: 'Be a Shelter HUB', description: "Provide shade, protection, common areas, structures through the Placement Shelter HUB program." },
      { id: 'S-storm', title: 'Storm Drainage', description: "Rain prep: level, Pre-MOOP, slope, channel to north side of the street. Drag a 2×4 board around to cut down little dunes. Direct water out to streets and fire lanes." },
      { id: 'S-roof', title: 'Roof Drainage', description: "Tilt your shade a little for rainwater run-off: raise a few columns, or block them up for a high point. Keep electrical wires off the ground." },
      { id: 'S-stake', title: 'Stake Count', description: "Count and whisker tent stakes, lag bolts, screws, re-bar. Buried metal is our number-one MOOP problem. Count at home, count on build, MOOP exactly there on strike. Bring a magnet or metal detector; Resto will love you forever.", link: { label: 'MOOP Map — Playa Resto', url: 'https://burningman.org/black-rock-city/volunteering/playa-restoration/' } },
      { id: 'S-cover', title: 'Ground Cover', description: "Tarps, mats, carpets, sandbags cut blowing dust and keep you dry. Sandbags hold down lots of stuff: cheap, weigh nothing empty, no stakes." },
      { id: 'S-shade', title: 'More Shade', description: "Over tents, trailers, RVs, especially sleeping spaces. Extra shade cuts AC + cooling demand, hopefully sheds rain, and may block dust." },
      { id: 'S-optimize', title: 'Optimize Shelter', description: "Rent vs. buy? Gift it off-season, or use it at home? Shelter is a big investment for one week. Renting a trailer or RV can be practical with a low overall footprint." },
      { id: 'S-camp', title: "Our Camp's Idea", prompt: "Did your camp pull it off?", description: "Describe one of your camp's own shelter ideas, and answer whether you actually achieved it." },
    ]
  },

  // ── POWER ───────────────────────────────────────────────────────────────
  {
    id: 'power', code: 'P', name: 'Power', icon: 'power',
    color: '#E0B85C',
    bigGoal: "Reduction first, alternative sources second. Less demand shrinks everything downstream: smaller solar panels, batteries, wiring, controls.",
    resourceLink: { label: 'Power page — Green Camp Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/power' },
    levels: [
      [{
        id: 'P1', code: 'P1', step: 1, title: 'Guess Power',
        prompt: "Have you inventoried your stuff and your power needs?",
        description: "Geeks: use the Ohm-azing spreadsheet in our Resource Guide. Non-engineers: guess-estimate. Count fridges, ACs, lights, blow dryers.",
        link: { label: 'Electrical Inventory — RAT', url: 'https://www.greenthemecampcommunity.org/resource-guide/power' }
      }],
      [{
        id: 'P2', code: 'P2', step: 2, title: '50% Power Reduction',
        prompt: "Are you below 6 kWh / person / day?",
        description: "US average was 12 kWh / person / day (2015). 12 × 50% = 6 kWh. Or skip the math: can you leave half your appliances at home?",
        link: { label: 'US Power Consumption — Solar Tech', url: 'https://solartechonline.com/blog/how-much-electricity-does-us-use-2025-guide/' }
      }, {
        id: 'P3', code: 'P3', step: 3, title: 'Share Power Ideas in Camp',
        prompt: "Does every camper understand your power estimate, consumption reduction, and their individual impact?",
        description: "Talk reduction and sharing way way way before playa. Power talks while orienting collectors, connecting them, dusting them off."
      }],
      [{
        id: 'P4', code: 'P4', step: 4, title: '75% Renewable Power',
        prompt: "Is at least 75% of your camp's power from renewables (solar, wind)?",
        description: "Get a little solar: it's good value now, with off-the-shelf packaged units at reasonable prices. Backup petrol generator for emergencies only, kept under 25%.",
        link: { label: 'Intro to Renewable Power — RAT', url: 'https://www.renewablesforartiststeam.org/intro-to-renewable-power' }
      }, {
        id: 'P5', code: 'P5', step: 5, title: 'Gift Power in Camp',
        prompt: "Does your camp provide a small-scale power source open to the public?",
        description: "A small solar phone-charging station in your bar, your interactive space, or by the street."
      }, {
        id: 'P6', code: 'P6', step: 6, title: 'Show People! Power Ideas',
        prompt: "Does your camp showcase its green power ideas to the public?",
        description: "Solar Spa (and Mudwrestling)! The East Side Electrocuties offer a solar-powered spa with directly-heated mud baths. We are Burners. We showcase our experiments through ART."
      }],
      []
    ],
    tier4Topics: [
      { id: 'P-hub', title: 'Be a Power HUB', description: "Provide electricity, equipment, expertise. Share solar panels, batteries, wire-strippers. Plus safety education so Burners don't get shocked. Or burned by acid. Only burned by consent." },
      { id: 'P-no', title: 'NO POWER!!!', description: "Give up electricity for a week. Really experience the desert. Turn off the phone when you leave the pavement. Ice chests. Grill food. Layer clothes. Acoustic guitar. Candles. Bring a flashlight or two for emergencies." },
      { id: 'P-ac', title: 'Turn Off AC', description: "It's not that hot. Low humidity, wide diurnal swing. BRC may reach 90°F (32°C) for only 2–3 hours in the afternoon. If dusty, run only your fan. Nights get quite cold: bring hoodies and blankets." },
      { id: 'P-less', title: 'Less Electricity', description: "Efficient ACs, fridges, freezers, cooking. Bring cycling appliances that match peak loads to supply, like fridges that cool hardest at night." },
      { id: 'P-no-genie', title: 'NO Genie', description: "Nope. Not even for emergencies. Didn't even bring one. No petrol. Didn't bring petrol cans, spill containers, fire extinguishers, and all that other heavy stinky dangerous stuff." },
      { id: 'P-nice-genie', title: 'Nice Genie', description: "Be a nice neighbor. Turn off at night. Direct exhaust fumes away. Minimize generator use. Reduce noisy and stinky. Let people sleep and breathe.", link: { label: 'Generators — Burning Man', url: 'https://burningman.org' } },
      { id: 'P-opt-genie', title: 'Optimize Genie', description: "Match demand and supply. Smaller generator, or two very small ones for precise load matching. Batteries level the peaks." },
      { id: 'P-opt-solar', title: 'Optimize Solar', description: "Rent vs. buy? Gift it off-season, or use it at home? Solar is a big investment for one week. BWB has coordinated camps' donated equipment to support forest fire victims." },
      { id: 'P-rat', title: 'RAT (Renewable Artists Team)', description: "If you're an Art Support Camp and only need a generator for your art, don't bring it. Go solar. Join RAT. No noise. No fumes. Just Art.", link: { label: 'RAT', url: 'https://burningman.org' } },
      { id: 'P-mv', title: 'Renewable MV', description: "Solar MVs? People-powered? Wind? No petrol. Lots of MVs offer rides; the best run on renewables." },
      { id: 'P-camp', title: "Our Camp's Idea", prompt: "Did your camp pull it off?", description: "Describe one of your camp's own power ideas, and answer whether you actually achieved it." },
    ]
  },
];

// Content schema stamp — recorded with each response so historical rows stay
// alignable if questions/topics change later. Bump when question content changes.
// v12.1: same Frog v12 questions with tightened description wording and
// imperial-first units (ids and meaning unchanged; four prompts reworded only
// to lead with the imperial measurement); X-camp topics gained a prompt and
// answers may carry free-text `X-camp-note` entries (the write-in Level 4 idea).
window.SCHEMA_VERSION = 'frog-v12.1';
