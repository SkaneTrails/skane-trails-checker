# Foraging data per month with icons
foraging_calendar = {
    "Jan": ["None"],
    "Feb": ["None"],
    "Mar": ["🧄 Wild Garlic"],
    "Apr": ["🧄 Wild Garlic", "🌿 Herbs"],
    "May": ["🫐 Berries", "🧄 Wild Garlic"],
    "Jun": ["🫐 Berries", "🌰 Nuts"],
    "Jul": ["🫐 Berries", "🍄 Mushrooms"],
    "Aug": ["🍄 Mushrooms", "🍎 Apples"],
    "Sep": ["🍄 Mushrooms", "🍎 Apples", "🌿 Herbs"],
    "Oct": ["🍄 Mushrooms", "🌰 Nuts"],
    "Nov": ["🍄 Mushrooms"],
    "Dec": ["None"],
}

# Define nature emojis for selection
# fmt: off
nature_emojis = [
    "🍄", "🌿", "🌱", "🌲", "🌳", "🌴", "🌵", "🌾", "🌸", "🌼", "🌻", "🌺", "🌹", "🌷", "🍀",
    "🍁", "🍂", "🍃", "🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🍎", "🍏", "🍐", "🍑", "🍒",
    "🍓", "🥝", "🥥", "🥑", "🥔", "🥕", "🥒", "🌽", "🍅", "🍆", "🌶️", "🫑", "🌰", "🧄", "🧅",
    "🫐", "🫒", "🥭", "🍠", "🥦", "🥬", "🍄", "🦌", "🐚", "🐌", "🐝", "🦋", "🐞", "🏞️", "⛰️",
]
# fmt: on

# Define the foraging items with details
foraging_items = [
    {
        "name": "Chanterelle Mushroom (Kantarell)",
        "emoji": "🍄",
        "season": "July to October",
        "image_url": "app/media/cantarelle.jpg",
        "description": "The chanterelle is a golden-yellow funnel-shaped mushroom with a fruity smell and a mild, peppery taste. They're commonly found in deciduous and coniferous forests, especially near oak, beech, and pine trees.",
        "usage": "Clean with a brush or knife (avoid washing). Sauté in butter with salt and pepper, or add to soups, sauces, and risottos. Can be dried or frozen after pre-cooking.",
    },
    {
        "name": "Blueberries (Blåbär)",
        "emoji": "🫐",
        "season": "July to August",
        "image_url": "app/media/blueberries.jpg",
        "description": "Wild blueberries in Skåne are smaller and more flavorful than cultivated ones. They grow on low bushes in forests, especially in areas with acidic soil. The European blueberry (bilberry) has a dark blue, almost black color with a reddish-purple flesh.",
        "usage": "Eat fresh, use in pies, jams, smoothies, or desserts. They can be frozen whole or made into preserves. Traditional Swedish dishes include blåbärssoppa (blueberry soup) and blåbärspaj (blueberry pie).",
    },
    {
        "name": "Wild Garlic (Ramslök)",
        "emoji": "🧄",
        "season": "March to May",
        "image_url": "app/media/wild_garlic.jpg",
        "description": "Wild garlic has broad, lily-of-the-valley-like leaves and white star-shaped flowers. It grows in deciduous woodland with moist soils, often near streams. The leaves have a strong garlic smell when crushed. CAUTION: Can be confused with lily-of-the-valley, which is poisonous.",
        "usage": "Use the leaves fresh in salads, pesto, butter, soups, and as a herb in cooking. Best harvested before flowering. Preserves well in oil, vinegar, or frozen in butter or as pesto.",
    },
    {
        "name": "Lingonberries (Lingon)",
        "emoji": "🍒",
        "season": "August to October",
        "image_url": "app/media/lingonberries.jpg",
        "description": "Small, red berries that grow on low evergreen shrubs in forests, particularly pine forests with acidic soil. Lingonberries are tart and slightly bitter when raw but sweeten when cooked.",
        "usage": "Traditionally served as lingonsylt (lingonberry jam) with Swedish meatballs, pancakes, and other dishes. Can be used in sauces, compotes, and desserts. They preserve well due to natural benzoic acid.",
    },
    {
        "name": "Wild Raspberries (Vilda hallon)",
        "emoji": "🍓",
        "season": "July to August",
        "image_url": "app/media/hallon.jpg",
        "description": "Wild raspberries are smaller but often more flavorful than cultivated varieties. They grow on thorny bushes in forest clearings, roadsides, and abandoned fields. Look for the distinctive cup shape left when picking.",
        "usage": "Delicious eaten fresh, added to desserts, or made into jam. They freeze well for later use. Can also be used to make cordials, vinegar, or infused into spirits.",
    },
    {
        "name": "Nettle (Brännässla)",
        "emoji": "🌿",
        "season": "April to October (best in spring)",
        "image_url": "app/media/nettle.jpg",
        "description": "Stinging nettles grow abundantly in Skåne. Young plants are best for cooking. Wear gloves when harvesting to avoid the sting. Rich in vitamins A and C, iron, and protein.",
        "usage": "Cooking removes the sting. Use young leaves like spinach in soups, pasta, pesto, or tea. Blanch briefly before using in other recipes. Can be dried for winter use as tea or seasoning.",
    },
    {
        "name": "Sheep Sorrel (Ängssyra)",
        "emoji": "🌱",
        "season": "April to September",
        "image_url": "app/media/sheep-sorrel.jpg",
        "description": "Sheep sorrel has arrow-shaped leaves and a lemony, acidic taste. Common in meadows, pastures, and along paths. The leaves are rich in vitamin C and oxalic acid.",
        "usage": "Use sparingly in salads, soups, or as a garnish due to its strong flavor and oxalic acid content. Excellent in small amounts for adding a citrusy tang to fish dishes or mixed with milder greens.",
    },
    {
        "name": "Beech Nuts (Bokollon)",
        "emoji": "🌰",
        "season": "September to October",
        "image_url": "app/media/bokollon.jpg",
        "description": "Small triangular nuts found in the distinctive spiny husks beneath beech trees, which are common throughout Skåne. They have a mild, sweet taste similar to hazelnuts when fresh.",
        "usage": "Can be eaten raw but are better roasted to improve digestibility. Use as you would other nuts in baking or cooking, or roast and grind as a coffee substitute. High in fat and protein.",
    },
    {
        "name": "Karl Johan Mushroom (Karljohansvamp)",
        "emoji": "🍄",
        "season": "August to October",
        "image_url": "app/media/Karljohansvamp.jpg",
        "description": "The Karl Johan mushroom (Boletus edulis) is prized for its rich, nutty flavor. It has a brown cap, thick stem, and white to yellowish pores underneath instead of gills. Found in mixed forests, especially near pine and spruce trees. The firm flesh stays white when cut, which helps distinguish it from less desirable Boletes.",
        "usage": "One of Sweden's most valued edible mushrooms. Excellent sautéed in butter, added to risottos, or dried for later use (where the flavor intensifies). The stems can be slightly tough but are good for stocks and sauces. Can be dried, frozen, or pickled for preservation.",
    },
    {
        "name": "Russula Mushrooms (Kremlor)",
        "emoji": "🍄",
        "season": "July to October",
        "image_url": "app/media/kremlor.jpg",
        "description": "Russulas are common in Skåne forests and come in many colors - red, green, purple, yellow. They have brittle flesh that breaks like chalk. The edible species include Russula vesca (Bare-toothed Russula) and Russula integra (Entire Russula). CAUTION: Some Russulas are inedible or cause stomach upset - proper identification is essential.",
        "usage": "The mild-tasting edible varieties can be sautéed, added to mushroom mixes, or used in soups and stews. They have a more delicate flavor than many other wild mushrooms. Russulas don't preserve as well as some mushrooms but can be dried or pickled. A good rule is to taste a tiny bit of cap - if it's not bitter or hot, it's likely edible once cooked.",
    },
]

# Define color options
color_options = {
    "red": "Red",
    "blue": "Blue",
    "green": "Green",
    "yellow": "Yellow",
    "orange": "Orange",
    "purple": "Purple",
    "pink": "Pink",
    "brown": "Brown",
    "black": "Black",
    "gray": "Gray",
    "darkgreen": "Dark Green",
    "saddlebrown": "Saddle Brown",
    "navy": "Navy",
    "teal": "Teal",
    "olive": "Olive",
    "maroon": "Maroon",
}

# Create month mapping to match season descriptions
month_to_season = {
    "January": ["January", "Jan"],
    "February": ["February", "Feb"],
    "March": ["March", "Mar"],
    "April": ["April", "Apr"],
    "May": ["May"],
    "June": ["June", "Jun"],
    "July": ["July", "Jul"],
    "August": ["August", "Aug"],
    "September": ["September", "Sep"],
    "October": ["October", "Oct"],
    "November": ["November", "Nov"],
    "December": ["December", "Dec"],
}

# Define default foraging types and their colors
default_foraging_types = {
    "Blueberries": {"icon": "🫐", "color": "blue"},
    "Raspberries": {"icon": "🍓", "color": "red"},
    "Mushrooms": {"icon": "🍄", "color": "brown"},
    "Wild Garlic": {"icon": "🧄", "color": "green"},
    "Nuts": {"icon": "🌰", "color": "saddlebrown"},
    "Herbs": {"icon": "🌿", "color": "darkgreen"},
    "Apples": {"icon": "🍎", "color": "red"},
    "Other": {"icon": "🌱", "color": "gray"},
}
