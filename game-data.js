// Green Radius Game — content from official PDF (Frog v12 FINAL, 2026)
// Structure: 6 sectors × 4 tiers × (1, 2, 3, 4) questions = 60 steps total.
// Tiers 1–3 are fixed steps. Tier 4 is "advanced" — for each of its 4 slots,
// the player picks a topic from a dropdown and answers Yes/No on it.

window.SECTORS = [
  // ── FOOD ────────────────────────────────────────────────────────────────
  {
    id: 'food', code: 'F', name: 'Food', icon: 'food',
    color: '#7AB85C',
    bigGoal: "Create radical solutions for efficient, economical and ecological food selection. Purchase mindfully, share food and cooking, reduce food waste.",
    resourceLink: { label: 'Food page — Green Camp Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/food' },
    levels: [
      // Tier 1 (1 question)
      [{
        id: 'F1', code: 'F1', step: 1, title: 'Meal Plan',
        prompt: "Have you whipped up a Meal Plan for your camp?",
        description: "Forgot milk? Forgot vegan? Forgot time? Closest grocery is 100 km away, and you can't leave anyway. Make sure everyone has enough food, special diets included, balanced with less food waste — leftovers can be repurposed into another meal.",
        link: { label: 'Whip up a Meal Plan', url: 'https://southernsustainabilityinstitute.org/meal-planning-for-the-planet-how-reducing-food-waste-starts-in-your-kitchen/' }
      }],
      // Tier 2 (2 questions)
      [{
        id: 'F2', code: 'F2', step: 2, title: '25% Food Waste Reduction',
        prompt: "Are you below 0.35 kg of food waste / person / day?",
        description: "US average is 0.45 kg / person / day (1 lb). 0.45 × 75% = 0.34 kg. Annually about 30–40% of the entire US food supply is discarded. Avoid spoiling, eat leftovers soon. Bring what you can't eat to a BRC Compost Collection Station.",
        link: { label: 'EPA — Food Waste in America', url: 'https://www.epa.gov/sustainable-management-food' }
      }, {
        id: 'F3', code: 'F3', step: 3, title: 'Share Food Ideas in Camp',
        prompt: "Does every camper understand the Meal Plan, food waste, and their individual impact?",
        description: "Food footprint Acculturation! Food Waste Coffee Talk. Make your grocery list before leaving home. Every camper ought to understand the Meal Plan, food waste, and their individual impact — and how to wash dishes with little water.",
        link: { label: 'Food Footprint Calculator', url: 'https://harvard-foodprint-calculator.github.io/' }
      }],
      // Tier 3 (3 questions)
      [{
        id: 'F4', code: 'F4', step: 4, title: 'Share One Kitchen',
        prompt: "Does your camp share one kitchen (or fewer)?",
        description: "Saves space, time + money. More FUN! Share cooking, refrigeration, dishwashing, utensils, food and supplies. Centralizing is more hygienic and helps monitoring for temperature and spoiling. Sharing a kitchen can still allow different people to cook for special diets.",
        link: { label: 'Large-scale recipes', url: 'https://www.cdkitchen.com/recipes/holidays-parties/cooking-for-a-crowd/' }
      }, {
        id: 'F5', code: 'F5', step: 5, title: 'Gift Food in Camp',
        prompt: "Does your camp gift food to the public?",
        description: "Food is perhaps the most sacred gift for Community Engagement. Your gift could be a sweet and salty snack, or a 7-course feast. Provide food for public engagement, community building and enjoyment. Share unpackaged food hygienically.",
        link: { label: 'Gifting Food', url: 'https://easyhealthyfoods.com/what-does-it-mean-when-someone-gives-you-food/' }
      }, {
        id: 'F6', code: 'F6', step: 6, title: 'Show People! Food Ideas',
        prompt: "Does your camp showcase its green food ideas to the public?",
        description: "Leave No Food Waste — our Leftovers Cookbook! Help us all reduce food waste. Send your leftovers recipes to our cookbook, host a cooking class in camp, or a vegan cook-off. We are Burners — we showcase our experiments through signage, exhibits, programs, games, plays, music, Green ART.",
        link: { label: 'Green Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/food' }
      }],
      // Tier 4 — pick a topic from this list, then yes/no (4 picks)
      // Marker: tier4 = true; topics is the dropdown options
      []
    ],
    tier4Topics: [
      { id: 'F-hub', title: 'Be a Food HUB', description: "Provide food and kitchens for your Placement HUB camps. Join a HUB with other camps in the Placement system." },
      { id: 'F-communal', title: 'Communal Meals', description: "Sharing within camp builds member relationships. Plus, less energy use for cooking, heating, cooling." },
      { id: 'F-reusable', title: 'Reusable Eatery', description: "Drink + food containers + utensils. No disposables. Encourage everyone to bring their own plate, cup, utensils.", link: { label: 'Reusable eatery', url: 'https://www.greenthemecampcommunity.org/resource-guide/food' } },
      { id: 'F-packaging', title: 'Reduce Packaging', description: "Minimize individually-packaged foods. Buy in bulk. Make communal meals easier. Freeze or store in large containers to minimize packaging.", link: { label: 'Waste from Food Packaging', url: 'https://foodprint.org/issues/the-environmental-impact-of-food-packaging/' } },
      { id: 'F-cooling', title: 'Reduce Cooling', description: "Ice chests, rated coolers, fewer fridges + freezers. Use Arctica. Ice intelligently: shade, elevate, insulate, wrap coolers. Try no-cooling meals.", link: { label: 'Ice Intelligently', url: 'https://www.greenthemecampcommunity.org/resource-guide/food' } },
      { id: 'F-cooking', title: 'Reduce Cooking', description: "Try solar cooking. Or no cooking. Pre-make more. Experiment with reflective, radiant and induction methods. Consider solar slow-cooking and reheating." },
      { id: 'F-washing', title: 'Reduce Washing', description: "Try dishwashing with low water. Or no water. Eat all food on your plate or scrape into compost. Spray bottles with white vinegar and water. Or three-bucket wash: pre-wash, soap, rinse, air-dry." },
      { id: 'F-local', title: 'Source Locally', description: "Increase food freshness, reduce transportation. Source food in Northern Nevada or local to your hometown. Buying local supports growers, increases food security.", link: { label: 'Source Local Foods', url: 'https://www.greenthemecampcommunity.org/resource-guide/food' } },
      { id: 'F-plant', title: 'Source Plant-based Foods', description: "More veggies! Increase plant-based regenerative meats. Meat production has a high environmental impact. Transition to more plant-based meals.", link: { label: 'More Plant-based Foods', url: 'https://worldmetrics.org/plant-based-diet-statistics/' } },
      { id: 'F-collexodus', title: 'Gift to Collexodus', description: "Collexodus collects leftover food and drinks for BM staff and Resto. As you make your exodus from BRC at 6:00 and K, donate unused unopened non-perishable food, beer or booze." },
      { id: 'F-camp', title: "Our Camp's Idea", description: "Describe one of your camp's own food ideas, and answer whether you actually achieved it." },
    ]
  },

  // ── WATER ───────────────────────────────────────────────────────────────
  {
    id: 'water', code: 'H', name: 'Water', icon: 'water',
    color: '#4FA8C9',
    bigGoal: "We are 60–75% water. Drink it. Share it. Reuse it. In the very near future, water will replace power as the most important green variable.",
    resourceLink: { label: 'Water page — Green Camp Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/water' },
    levels: [
      [{
        id: 'H1', code: 'H1', step: 1, title: 'Estimate Water',
        prompt: "Have you centrally planned at least 6 L / person / day of water?",
        description: "Hydrate, Hydrate, Hydrate. The Survival Guide hydration minimum is 1.5 gallons (6 litres) per person per day. Plus cooking, washing, showering, gifting. Plus spills, evaporation and contingency. Don't die.",
        link: { label: 'Potable Water — Burning Man', url: 'https://burningman.org/black-rock-city/preparation/camping-tips/water/' }
      }],
      [{
        id: 'H2', code: 'H2', step: 2, title: '75% Water Reduction',
        prompt: "Are you below 75 L / person / day of water consumption?",
        description: "US average water consumption is 310 L / person / day (82 gal). 310 × 25% = 78 L. This should be easy — we don't have a water utility, toilets to flush, or lawns to irrigate.",
        link: { label: 'EPA — US Water Consumption', url: 'https://www.epa.gov/watersense' }
      }, {
        id: 'H3', code: 'H3', step: 3, title: 'Share Water Ideas in Camp',
        prompt: "Does every camper understand hydration, drinking water, greywater, and their individual impact?",
        description: "Water footprint Acculturation! Talk while refilling your bottle. Talk water at your camp meeting before playa. Talk going to get ice at Arctica. Talk water while showering."
      }],
      [{
        id: 'H4', code: 'H4', step: 4, title: '100% Shared Water Source',
        prompt: "Does your camp provide ALL the water for ALL your campers?",
        description: "Large volumes are cheaper, more efficient, and lower-CO2e. At least all your potable drinking water. Water is heavy and costs a lot to transport."
      }, {
        id: 'H5', code: 'H5', step: 5, title: 'Gift Water in Camp',
        prompt: "Does your camp gift water to the public?",
        description: "Gift water for everyone's survival. Provide water for the public. Put a water cooler on your bar, have a hydration station out on your street. Hydrated burners are happy burners."
      }, {
        id: 'H6', code: 'H6', step: 6, title: 'Show People! Water Ideas',
        prompt: "Does your camp showcase its green water ideas to the public?",
        description: "Mist my Street! Camp Hydro-Hydra drags a giant tentacle hose into the middle of their street, pumping out cool misty air. We are Burners — we showcase our experiments through signage, exhibits, programs, ART."
      }],
      []
    ],
    tier4Topics: [
      { id: 'H-hub', title: 'Be a Water HUB', description: "Provide fresh or grey water systems, showers or kitchens. Join a Placement Water HUB with other camps." },
      { id: 'H-oss', title: 'Use OSS', description: "Out-Side Services sells fresh water and pumps grey/black water on playa. Large-volume OSS trucks are more efficient for transport and emissions.", link: { label: 'OSS', url: 'https://burningman.org/black-rock-city/preparation/infrastructure/deliveries/outside-services-program/' } },
      { id: 'H-arctica', title: 'Use Arctica', description: "Arctica provides ice, block and bag, on playa. Ice use can reduce refrigeration and power. Melt water can be used for washing. Three locations across BRC.", link: { label: 'Arctica ice sales', url: 'https://burningman.org/black-rock-city/preparation/infrastructure/arctica-ice-sales/' } },
      { id: 'H-local', title: 'Local Water', description: "Fill water in Northern Nevada. Reno has lots of water stores. Water weighs a ton — don't drive it across the country.", link: { label: 'Potable Water — Burning Man', url: 'https://burningman.org/black-rock-city/preparation/camping-tips/water/' } },
      { id: 'H-bottles', title: 'Reusable Bottles', description: "People: get your own water bottle. Put your name on it. Sleep with it. Avoid single-use water containers. For public watering, provide compostable cone Dixie cups." },
      { id: 'H-grey', title: 'Greywater Processing', description: "Build a system for evaporation, filtration, or reuse. Try a Greywater Evaporation Pond, Wikatron, or wind-power. Locate away from your compost-drying racks." },
      { id: 'H-reduce', title: 'More Reduction', description: "Even less water: food prep, dishwashing, cleaning, showers. Low-flow sprayers, fixtures, shower heads. Tubs for different dish water types. Discounts for showering with a friend." },
      { id: 'H-camp', title: "Our Camp's Idea", description: "Describe one of your camp's own water ideas, and answer whether you actually achieved it." },
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
        description: "Join the planet's best + biggest single restoration effort. Our approach to waste is the most advanced program in the world. MOOP = Matter Out Of Place. Pre-MOOP, Daily MOOP, Post-MOOP. MOOP everywhere, MOOP all the time.",
        link: { label: 'Leaving No Trace — Burning Man', url: 'https://burningman.org/event/preparation/leaving-no-trace/' }
      }],
      [{
        id: 'W2', code: 'W2', step: 2, title: '50% Waste Reduction',
        prompt: "Are you below 1 kg of waste / person / day?",
        description: "US average is 2.3 kg / person / day (5 lbs). 2.3 × 50% = 1.2 kg. Reduce, refuse, repurpose.",
        link: { label: 'EPA — US Waste Generation', url: 'https://www.epa.gov/facts-and-figures-about-materials-waste-and-recycling' }
      }, {
        id: 'W3', code: 'W3', step: 3, title: 'Share Waste Ideas in Camp',
        prompt: "Does every camper understand the LNT + MOOP plan, recycling, composting, and their individual impact?",
        description: "Waste footprint Acculturation! Talk trash while gifting compost. Zoom before playa. Talk about waste while sorting recycling, flattening boxes, balling twine."
      }],
      [{
        id: 'W4', code: 'W4', step: 4, title: '100% Recycling + Composting',
        prompt: "Does your camp recycle and compost 100% of materials that can be recycled?",
        description: "Plastic + metal, wet + dry. Sparkling water bottles, PBR cans. Inevitably there will be some containers — try for 100% of materials which CAN BE recycled. Separate waste streams. Reduce landfill. Pack-it-in / Pack-it-OUT.",
        link: { label: 'Waste Disposal + Recycling — Burning Man', url: 'https://burningman.org/black-rock-city/preparation/leaving-no-trace/leave-nevada-beautiful/' }
      }, {
        id: 'W5', code: 'W5', step: 5, title: 'Gift Waste to BRC',
        prompt: "Does your camp bring compost & recycling to BRC stations, or MOOP your hood?",
        description: "Bring your compost to a BRC Compost Collection Station. OR MOOP past your camp, around your hood, and beyond. Streets have the most MOOP, fire lanes too. Carry a MOOP bag with you at all times.",
        link: { label: 'Composting — Burning Man', url: 'https://burningman.org/black-rock-city/preparation/leaving-no-trace/composting/' }
      }, {
        id: 'W6', code: 'W6', step: 6, title: 'Show People! Waste Ideas',
        prompt: "Does your camp showcase its green waste ideas to the public?",
        description: "Compost-drying Observation Research Laboratory. Camp Lost-R-Grant is building one. We are Burners — we showcase our experiments through signage, exhibits, programs, plays, music, Green ART."
      }],
      []
    ],
    tier4Topics: [
      { id: 'W-hub', title: 'Be a Waste HUB', description: "Collect recycling, waste, or compost for your HUB-mates. Join a Placement Waste HUB for collection, sorting, and disposal." },
      { id: 'W-single', title: 'Reduce Single-Use', description: "Containers, bottles, boxes. Think Costco and kegs. Purchase in larger quantities. Use ziplock bags, minimize film plastic. Bring reusable containers." },
      { id: 'W-cover', title: 'Ground Cover', description: "Waterproof tarps under kitchens, showers. Oil-pan under VW bus. Highest priority: avoid spills on playa, especially chemicals. Second: dust control." },
      { id: 'W-toilets', title: 'Composting Toilets', description: "Chemical, sawdust, organic. Excrement experiments. Multiple toilet types available. Put tarps underneath. DON'T put your toilet compost in the Portos." },
      { id: 'W-wood', title: 'Wood Recycling', description: "Boxes, pallets, packaging, structures. Instant Art on Playa. After the burn, burn leftover wood at Esplanade burn barrels at 3:00, 5:30, and 9:00. Or take it home for upcycled art." },
      { id: 'W-camp', title: "Our Camp's Idea", description: "Describe one of your camp's own waste ideas, and answer whether you actually achieved it." },
    ]
  },

  // ── TRANSPORT ───────────────────────────────────────────────────────────
  {
    id: 'transport', code: 'T', name: 'Transport', icon: 'transport',
    color: '#9B7AC9',
    bigGoal: "Take a risk, share a ride. Share stuff, save cash. Our toxin du-jour is CO2e — reduce and offset.",
    resourceLink: { label: 'Transport page — Green Camp Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/transportation' },
    levels: [
      [{
        id: 'T1', code: 'T1', step: 1, title: 'Carpool Plan',
        prompt: "Has your camp planned ride-sharing from home to BRC and back?",
        description: "Be a Merry Prankster! Our ancestors rode a Magic Bus. Plan ride sharing all the way from home to BRC, and back. Include people and cargo. Getting there is half the fun.",
        link: { label: 'Magic Bus — Merry Pranksters', url: 'https://en.wikipedia.org/wiki/Furthur_(bus)' }
      }],
      [{
        id: 'T2', code: 'T2', step: 2, title: '90% Ride Sharing',
        prompt: "Are at least 90% of your campers carpooling, taking BXB, or otherwise sharing the ride?",
        description: "Carpool, BXB, public transport, any multi-passenger vehicle. Sharing saves CO2e, energy, and money. Try for at least 90% of campers carpooling most of the way, especially the last roads to the playa.",
        link: { label: 'Burner Express — Burning Man', url: 'https://burningman.org/event/preparation/getting-there-back/burner-express/' }
      }, {
        id: 'T3', code: 'T3', step: 3, title: 'Share Transport Ideas in Camp',
        prompt: "Does every camper know the carpool plan, cargo sharing, and their individual CO2e impact?",
        description: "CO2e-culturation! Carpool plan before playa. Talk about emissions on your road trip. For extra credit, swag your CO2e reduction."
      }],
      [{
        id: 'T4', code: 'T4', step: 4, title: '50% Cargo Reduction',
        prompt: "Has your camp reduced cargo (weight + volume of stuff) by 50%?",
        description: "Reduce weight and volume of YOUR STUFF. Share Stuff. Share everything, make do, innovate. Leave stuff at home. Don't replicate home — you're camping.",
        link: { label: 'Stuff Optimization — Carlin', url: 'https://www.youtube.com/watch?v=MvgN5gCuLac' }
      }, {
        id: 'T5', code: 'T5', step: 5, title: 'Gift CO2e Offsets',
        prompt: "Does your camp offset CO2e — by reducing back home, planting, or buying credits?",
        description: "Plant a tree with a child. Ride bikes. Love Mother Earth. Reduction back home is the first and most important offset, so take public transport, ride your bike more. Be neutral or negative now — don't wait until 2030."
      }, {
        id: 'T6', code: 'T6', step: 6, title: 'Show People! Transport Ideas',
        prompt: "Does your camp showcase its green transport ideas to the public?",
        description: "Camp Tralfamadore is Tap Dancing for Transport! The Tralfamadorians wrote a musical about reducing methane emissions by increasing tap dancing. We are Burners — we showcase our experiments through ART."
      }],
      []
    ],
    tier4Topics: [
      { id: 'T-hub', title: 'Be a Transport HUB', description: "Provide rides for other campers in your HUB — and their stuff. Offer people and cargo sharing through a Placement Transport HUB." },
      { id: 'T-rideshare', title: 'Rideshare', description: "Offer rides through the Burner Ride Share Board, or your local and regional internet/social-media networks.", link: { label: 'BM Rideshare', url: 'https://burningman.org/black-rock-city/preparation/getting-there-and-back/rideshare/' } },
      { id: 'T-mv', title: 'Mutant Vehicle', description: "Many MVs gift rides. It takes a lot of work to offer an MV — like bicycles, MVs are our Burning Man-unique CO2e reductions.", link: { label: 'DMV — Department of Mutant Vehicles', url: 'https://burningman.org/black-rock-city/volunteering/dept-of-mutant-vehicles/' } },
      { id: 'T-container', title: 'BM Container', description: "Have a BM Container, vehicle storage, or still on the wait-list. The Burning Man Container program is the BEST — saves time, money, transport, CO2e. Apply even if you haven't gotten one yet.", link: { label: 'BRC Storage Program', url: 'https://burningman.org' } },
      { id: 'T-storelocal', title: 'Store Local', description: "Empire, Fernley, Wadsworth, Sparks, Reno, NW NV, or NE CA. If you don't have a BM Container, use any place in the region to reduce transport of stuff." },
      { id: 'T-55', title: 'Drive 55', description: "Or 88 km per hour. Saves gas, money, CO2e. 55 MPH max to and from BRC. An ancient proven green success." },
      { id: 'T-ev', title: 'EV Hauling', description: "Electric, wood, steam, corn, hydrogen, wind. Anything but petrol. Make sure you have enough juice to get back home — Black Rock City has no Ethanol farms." },
      { id: 'T-share-haul', title: 'Share Long Hauls', description: "City or regional long-distance hauling. Consolidate hauling with other Burners in your region. Tubs, crates, containers, pods. Philly camps share a trailer/rail program." },
      { id: 'T-bikes', title: '100% People Bicycles', description: "All our campers have real bicycles. Not E-bikes. Or tricycles, unicycles, any person-powered vehicle. Powered wheelchairs are cool but E-BIKES DON'T COUNT." },
      { id: 'T-toxins', title: 'Reduce Future Toxins', description: "CO2e is easy. Batteries are our worst toxin. Lost batteries leach lead, lithium, nickel, cadmium, plastic, paint, rust into the playa. Collect batteries separately, take them home to a safe recycling center." },
      { id: 'T-camp', title: "Our Camp's Idea", description: "Describe one of your camp's own transport ideas, and answer whether you actually achieved it." },
    ]
  },

  // ── SHELTER ─────────────────────────────────────────────────────────────
  {
    id: 'shelter', code: 'S', name: 'Shelter', icon: 'shelter',
    color: '#D9885C',
    bigGoal: "While the sun may burn you, the wind will kill you. Provide protection and shelter. Sun, wind, dust. And a place to get a good night's sleep, even in the daytime.",
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
        description: "Provide protected sleeping spaces for every camper, 100%. Extras — shade over tents? Maybe even an over-night-dust-storm-visitor spot or two."
      }, {
        id: 'S3', code: 'S3', step: 3, title: 'Share Shelter Ideas in Camp',
        prompt: "Does every camper know where protected areas are for the public, the camp, and themselves?",
        description: "Start planning shelter at your January camp Zoom — it's big. Talk about shelter before a thunderstorm or on a freezing night."
      }],
      [{
        id: 'S4', code: 'S4', step: 4, title: 'Camp Commons',
        prompt: "Does your camp have a common sheltered space — just for your campers?",
        description: "Public sheltered space is a good gift, but sometimes your campers need 'private' shelter, separate from public space. Your Interactive Public Space is the Living Room; your Camp Commons is the Den in the back of the house."
      }, {
        id: 'S5', code: 'S5', step: 5, title: 'Gift Shelter for the Public',
        prompt: "Does your camp's public space provide shelter — sun, rain, wind, or dust?",
        description: "Does your café have a rain awning? Is your bar 100-Proof Dust-Proof? When you're hunkered-down in a 4-hour white-out, you'll meet the people who will change your life."
      }, {
        id: 'S6', code: 'S6', step: 6, title: 'Show People! Shelter Ideas',
        prompt: "Does your camp showcase its green shelter ideas to the public?",
        description: "Toothpick Towers! Kamp Kross-Brace's Structural Engineers invite Burners to come huff and puff at a three-story shelter made entirely of recycled toothpicks. We are Burners — we showcase our experiments through ART."
      }],
      []
    ],
    tier4Topics: [
      { id: 'S-hub', title: 'Be a Shelter HUB', description: "Provide shade, protection, common areas, structures. Protect your campers by participating in the Placement Shelter HUB program." },
      { id: 'S-storm', title: 'Storm Drainage', description: "Rain prep: level, Pre-MOOP, slope, channel to north side of the street. Drag a 2×4 board around to cut down little dunes. Direct water out to streets and fire lanes." },
      { id: 'S-roof', title: 'Roof Drainage', description: "Tilt your shade just a little for rainwater run-off. Raise a few columns, or put blocks of wood underneath for a high point. Keep electrical wires off the ground." },
      { id: 'S-stake', title: 'Stake Count', description: "Count and whisker tent stakes, lag bolts, screws, re-bar. Buried metal is our number-one MOOP problem. Count every stake before you pack at home, count again on build, MOOP exactly there on strike. Bring a magnet or metal detector — Resto will love you forever.", link: { label: 'MOOP Map — Playa Resto', url: 'https://burningman.org/black-rock-city/volunteering/playa-restoration/' } },
      { id: 'S-cover', title: 'Ground Cover', description: "Tarps, mats, carpets, sandbags. Ideal to cut down blowing dust and keep you dry. Sandbags can hold down lots of stuff — they're cheap, weigh nothing, avoid stakes." },
      { id: 'S-shade', title: 'More Shade', description: "Over tents, trailers, RVs. Especially over sleeping spaces. Extra shade reduces AC + cooling demand, hopefully sheds rain, and may give dust protection." },
      { id: 'S-optimize', title: 'Optimize Shelter', description: "Rent vs. buy? Or gift in the off-season, or use at home? Shelter is a big investment for a week. Renting a trailer or RV can be practical for BRC and have a low green footprint overall." },
      { id: 'S-camp', title: "Our Camp's Idea", description: "Describe one of your camp's own shelter ideas, and answer whether you actually achieved it." },
    ]
  },

  // ── POWER ───────────────────────────────────────────────────────────────
  {
    id: 'power', code: 'P', name: 'Power', icon: 'power',
    color: '#E0B85C',
    bigGoal: "Power reduction is our priority goal. Alternative sources are secondary. Reduction impacts everything in the power stream — smaller solar panels, batteries, wiring, controls.",
    resourceLink: { label: 'Power page — Green Camp Resource Guide', url: 'https://www.greenthemecampcommunity.org/resource-guide/power' },
    levels: [
      [{
        id: 'P1', code: 'P1', step: 1, title: 'Guess Power',
        prompt: "Have you inventoried your stuff and your power needs?",
        description: "Geeks use our Ohm-azing spreadsheet in our Resource Guide. Non-engineers, guess-estimate — count fridges, ACs, lights, blow dryers.",
        link: { label: 'Electrical Inventory — RAT', url: 'https://www.greenthemecampcommunity.org/resource-guide/power' }
      }],
      [{
        id: 'P2', code: 'P2', step: 2, title: '50% Power Reduction',
        prompt: "Are you below 6 kWh / person / day?",
        description: "US average was 12 kWh / person / day (2015). 12 × 50% = 6 kWh. Or go the no-math way — count sharing. Can you leave half your appliances at home?",
        link: { label: 'US Power Consumption — Solar Tech', url: 'https://solartechonline.com/blog/how-much-electricity-does-us-use-2025-guide/' }
      }, {
        id: 'P3', code: 'P3', step: 3, title: 'Share Power Ideas in Camp',
        prompt: "Does every camper understand your power estimate, consumption reduction, and their individual impact?",
        description: "Talk about reduction and sharing way way way before playa. Have power talks when you're orienting collectors, connecting them, dusting them off."
      }],
      [{
        id: 'P4', code: 'P4', step: 4, title: '75% Renewable Power',
        prompt: "Is at least 75% of your camp's power from renewables (solar, wind)?",
        description: "Get a little solar. With current technology and BRC's limitations, solar is a good value now. Off-the-shelf packaged units at reasonable prices. Backup petrol generator only for emergencies — keep it under 25%.",
        link: { label: 'Intro to Renewable Power — RAT', url: 'https://www.renewablesforartiststeam.org/intro-to-renewable-power' }
      }, {
        id: 'P5', code: 'P5', step: 5, title: 'Gift Power in Camp',
        prompt: "Does your camp provide a small-scale power source open to the public?",
        description: "Provide a small solar phone-charging station in your bar? Ideally, in your interactive space or by the street."
      }, {
        id: 'P6', code: 'P6', step: 6, title: 'Show People! Power Ideas',
        prompt: "Does your camp showcase its green power ideas to the public?",
        description: "Solar Spa (and Mudwrestling) East Side Electrocuties Camp! The Cuties offer a solar-powered spa with directly-heated mud baths. We are Burners — we showcase our experiments through ART."
      }],
      []
    ],
    tier4Topics: [
      { id: 'P-hub', title: 'Be a Power HUB', description: "Provide electricity, equipment, expertise. Share solar panels, batteries, wire-strippers. Plus safety education so Burners don't get shocked. Or burned by acid. Only burned by consent." },
      { id: 'P-no', title: 'NO POWER!!!', description: "Give up electricity for a week. Really experience the desert. Turn off the phone when you leave the pavement. Ice chests. Grill food. Layer clothes. Acoustic guitar. Candles. Bring a flashlight or two for emergencies." },
      { id: 'P-ac', title: 'Turn Off AC', description: "It's not that hot. Low humidity. Wide diurnal swing. BRC may reach 32°C (90°F) for only 2–3 hours in the afternoon. If dusty, run only your fan. It can get quite cold at night — bring hoodies and blankets." },
      { id: 'P-less', title: 'Less Electricity', description: "Efficient ACs, fridges, freezers, cooking. Bring cycling appliances that regulate electrical peak loads with power supply availability — fridges with most cooling at night." },
      { id: 'P-no-genie', title: 'NO Genie', description: "Nope. Not even for emergencies. Didn't even bring one. No petrol. Didn't bring petrol cans, spill containers, fire extinguishers, and all that other heavy stinky dangerous stuff." },
      { id: 'P-nice-genie', title: 'Nice Genie', description: "Be a nice neighbor. Turn off at night. Direct exhaust fumes away. Minimize generator use. Reduce noisy and stinky. Let people sleep and breathe.", link: { label: 'Generators — Burning Man', url: 'https://burningman.org' } },
      { id: 'P-opt-genie', title: 'Optimize Genie', description: "Match demand and supply. Add batteries. Smaller generator, or two very small generators for precise load matching. Batteries level power peaks." },
      { id: 'P-opt-solar', title: 'Optimize Solar', description: "Rent vs. buy? Or gift in the off-season, or use at home? Solar is a big investment for a week. Donate equipment off-season — BWB coordinated camps' equipment to support forest fire victims." },
      { id: 'P-rat', title: 'RAT (Renewable Artists Team)', description: "If you're an Art Support Camp and only need a generator for your art, don't bring it. Go solar. Join RAT. No noise. No fumes. Just Art.", link: { label: 'RAT', url: 'https://burningman.org' } },
      { id: 'P-mv', title: 'Renewable MV', description: "Solar MVs? People-powered? Wind? No petrol. Lots of MVs offer rides — but the best are powered by renewable alternatives." },
      { id: 'P-camp', title: "Our Camp's Idea", description: "Describe one of your camp's own power ideas, and answer whether you actually achieved it." },
    ]
  },
];
