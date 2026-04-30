/**
 * Product categories + category-specific scene presets.
 *
 * Replaces the old universal scene-presets.ts which had 4 generic
 * scenes that worked OK for some products but felt weird for others
 * (e.g. "in-use" makes sense for headphones, but for food it should
 * be "served on a plate" instead).
 *
 * Each category lists scenes that are realistic and useful for THAT
 * category. The image-gen prompt (`prompt`) and the thumbnail
 * generation prompt (`thumbGenPrompt`) are tuned per scene.
 */

export type CategoryId =
  | "clothing"
  | "accessories"
  | "food"
  | "cosmetics"
  | "gadgets"
  | "home"
  | "other";

export interface CategoryScene {
  id: string; // unique within category
  label: string;
  subtitle: string;
  /** Path to the example thumbnail in /public/scene-thumbs/<category>/<id>.png */
  thumbSrc: string;
  /** English clause appended to the image-gen prompt. */
  prompt: string;
  /** English prompt used to generate the thumbnail itself (one-time). */
  thumbGenPrompt: string;
}

export interface ProductCategory {
  id: CategoryId;
  label: string;
  /** Russian description used for AI category detection. */
  detectHint: string;
  scenes: CategoryScene[];
}

const tp = (id: CategoryId, sceneId: string) => `/scene-thumbs/${id}/${sceneId}.png`;

export const CATEGORIES: ProductCategory[] = [
  {
    id: "clothing",
    label: "Одежда и обувь",
    detectHint: "одежда, обувь, футболки, штаны, куртки, кроссовки, ботинки, платья",
    scenes: [
      {
        id: "on-model",
        label: "На модели",
        subtitle: "как в магазине",
        thumbSrc: tp("clothing", "on-model"),
        prompt:
          "Show the clothing item worn by a model in a clean store fitting-room environment. Natural pose, mid-shot framing, soft window light. Real-people commerce aesthetic.",
        thumbGenPrompt:
          "Square 1:1 thumbnail icon: female model wearing a clean white t-shirt and beige pants standing in a bright store fitting room, mid-shot, soft window light, neutral wall, professional fashion ecommerce shot, no text",
      },
      {
        id: "flatlay",
        label: "Раскладка",
        subtitle: "flat lay сверху",
        thumbSrc: tp("clothing", "flatlay"),
        prompt:
          "Top-down flat-lay composition of the clothing item neatly folded or arranged on a clean surface, with subtle complementary props (hat, sunglasses, accessories). Soft even daylight, neutral backdrop.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: top-down flat lay of a folded white t-shirt and denim jeans neatly arranged on a textured beige linen background with simple sunglasses and small leather wallet, soft daylight, no text, fashion catalog aesthetic",
      },
      {
        id: "catalog",
        label: "Каталог",
        subtitle: "студийно изолированно",
        thumbSrc: tp("clothing", "catalog"),
        prompt:
          "Clean studio shot of the clothing item on an invisible mannequin or floating, fully isolated on a neutral seamless backdrop. Soft even key light + subtle rim, gentle shadow. Premium e-commerce catalog look.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: white t-shirt on an invisible mannequin floating against a soft neutral grey gradient background, premium ecommerce product photo, soft even lighting, gentle cast shadow, no text, no props",
      },
    ],
  },
  {
    id: "accessories",
    label: "Аксессуары",
    detectHint: "часы, сумки, кошельки, очки, ремни, украшения, шапки",
    scenes: [
      {
        id: "on-person-closeup",
        label: "На человеке",
        subtitle: "крупным планом",
        thumbSrc: tp("accessories", "on-person-closeup"),
        prompt:
          "Close-up of the accessory on a person — wrist watch on a wrist, sunglasses on a face, bag held in hand. Tight crop, the person is implied but the accessory is hero. Lifestyle aesthetic.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: close-up of a stylish silver wristwatch on a person's wrist, light skin, soft daylight, slightly out-of-focus knit sweater background, premium lifestyle photography, no text",
      },
      {
        id: "daily-scene",
        label: "Повседневная сцена",
        subtitle: "часть стиля",
        thumbSrc: tp("accessories", "daily-scene"),
        prompt:
          "The accessory as part of an everyday outfit or lifestyle moment — held while the person walks, placed on a café table next to coffee. Authentic, not posed. Soft natural light.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: brown leather wallet placed on a café table next to a cappuccino cup and a notebook, blurred warm café background, casual everyday lifestyle scene, soft window light, no text",
      },
      {
        id: "catalog",
        label: "Каталог",
        subtitle: "студийно изолированно",
        thumbSrc: tp("accessories", "catalog"),
        prompt:
          "Clean studio product shot of the accessory on a neutral seamless backdrop. Soft even key + rim light, gentle cast shadow. Isolated, no props. Premium catalog aesthetic.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: a single elegant silver wristwatch lying on a soft neutral grey gradient background, premium product catalog photo, soft even lighting, gentle cast shadow, no text, no props",
      },
    ],
  },
  {
    id: "food",
    label: "Еда и напитки",
    detectHint: "еда, напитки, кофе, выпечка, ресторан, продукты, готовая еда",
    scenes: [
      {
        id: "served",
        label: "Сервировка",
        subtitle: "на столе с гарниром",
        thumbSrc: tp("food", "served"),
        prompt:
          "Plated food shot on a beautifully set table with subtle props (cutlery, napkin, glass of water, herbs). Warm natural light, slight overhead angle. Editorial food photography style.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: bowl of creamy pasta carbonara plated on a rustic wooden table with parmesan, parsley garnish, fork, and a glass of white wine, warm natural daylight, editorial food photography, no text",
      },
      {
        id: "ingredients",
        label: "Ингредиенты",
        subtitle: "крупным планом",
        thumbSrc: tp("food", "ingredients"),
        prompt:
          "Macro close-up of the food showing texture and ingredients — drips, melt, glaze, freshness cues. Shallow depth of field, dramatic side light, mouth-watering vibe.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: extreme macro close-up of a fresh burger showing melted cheese drip, juicy beef texture, crisp lettuce, sesame bun detail, dramatic side light, shallow depth of field, no text",
      },
      {
        id: "catalog",
        label: "Каталог",
        subtitle: "студийно",
        thumbSrc: tp("food", "catalog"),
        prompt:
          "Clean studio shot of the food/drink isolated on a soft neutral backdrop, no clutter. Even soft light, subtle reflection. Packaged-product or premium menu look.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: a single glass coffee cup with latte art isolated on a soft neutral cream gradient background, premium product photography, soft even lighting, subtle reflection underneath, no text, no props",
      },
    ],
  },
  {
    id: "cosmetics",
    label: "Косметика и уход",
    detectHint: "косметика, крем, помада, парфюм, уход за кожей, шампунь",
    scenes: [
      {
        id: "composition",
        label: "Композиция",
        subtitle: "с растениями и декором",
        thumbSrc: tp("cosmetics", "composition"),
        prompt:
          "Editorial composition with the cosmetics product surrounded by complementary natural props — eucalyptus leaves, dried flowers, water droplets, marble surface. Soft natural light, premium spa aesthetic.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: a frosted glass cosmetics bottle on a marble surface surrounded by eucalyptus leaves, water droplets, and a small linen cloth, soft natural daylight, premium spa editorial composition, no text",
      },
      {
        id: "in-use",
        label: "В использовании",
        subtitle: "наносится на кожу",
        thumbSrc: tp("cosmetics", "in-use"),
        prompt:
          "The cosmetics product being applied — a hand dispensing cream into another palm, lipstick on a smile, perfume sprayed onto a wrist. Authentic moment, soft warm light.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: woman's hand dispensing a small dollop of white face cream from a glass jar onto her other palm, soft warm daylight, slightly blurred bathroom background, premium skincare lifestyle photo, no text",
      },
      {
        id: "daily-scene",
        label: "Ежедневная сцена",
        subtitle: "на полке в ванной",
        thumbSrc: tp("cosmetics", "daily-scene"),
        prompt:
          "The cosmetics product as part of a daily routine — sitting on a bathroom shelf with a few other minimalist beauty items, soft morning light, neutral colour palette.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: minimalist bathroom shelf with a glass cosmetics bottle, a small bowl of cotton pads, a folded white towel, and a small green plant, soft morning daylight, beige tile wall, no text",
      },
      {
        id: "catalog",
        label: "Каталог",
        subtitle: "студийно изолированно",
        thumbSrc: tp("cosmetics", "catalog"),
        prompt:
          "Clean studio shot of the cosmetics product isolated on a neutral seamless backdrop, soft even lighting, subtle reflection or cast shadow. Premium beauty catalog look.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: a single elegant frosted-glass cosmetics bottle isolated on a soft neutral cream gradient background, premium beauty catalog photography, soft even lighting, subtle reflection underneath, no text",
      },
    ],
  },
  {
    id: "gadgets",
    label: "Гаджеты и техника",
    detectHint: "наушники, смартфоны, ноутбуки, гаджеты, электроника",
    scenes: [
      {
        id: "in-use",
        label: "В использовании",
        subtitle: "руки, рабочий процесс",
        thumbSrc: tp("gadgets", "in-use"),
        prompt:
          "Show the gadget IN ACTUAL USE: human hands or a person interacting with it — wearing it, holding it, pressing a button. Authentic candid moment, soft ambient light, lifestyle photography aesthetic.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: hands holding white wireless earbuds being placed into ears, casual lifestyle moment, soft warm afternoon light, slight bokeh background, candid product-in-use shot, no text",
      },
      {
        id: "in-environment",
        label: "В окружении",
        subtitle: "стол, рабочее место",
        thumbSrc: tp("gadgets", "in-environment"),
        prompt:
          "Place the gadget in its natural environment / lifestyle context (desk, workplace, bag). Surrounding props relate to typical real-world use. Editorial composition.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: black wireless headphones placed on a clean wooden desk next to a laptop and small coffee cup, workplace environment, soft daylight, minimal scandinavian aesthetic, no text",
      },
      {
        id: "closeup",
        label: "Крупный план",
        subtitle: "детали, кнопки, текстура",
        thumbSrc: tp("gadgets", "closeup"),
        prompt:
          "Tight macro close-up of a single key detail of the gadget (button, port, texture, edge). Shallow depth of field, premium product detail photography.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: extreme macro close-up of a black headphone earcup textured surface and metal hinge, shallow depth of field, premium product detail photography, soft side light, no text, dark moody background",
      },
      {
        id: "catalog",
        label: "Каталог",
        subtitle: "студийно изолированно",
        thumbSrc: tp("gadgets", "catalog"),
        prompt:
          "Clean studio product shot of the gadget on a soft neutral backdrop, soft even lighting, subtle cast shadow. Premium e-commerce catalog look.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: clean studio product photo of black wireless headphones isolated on a soft neutral grey gradient backdrop, premium e-commerce catalog look, soft even lighting from upper left, gentle cast shadow underneath, no text, no props",
      },
    ],
  },
  {
    id: "home",
    label: "Дом и мебель",
    detectHint: "мебель, диван, лампа, ваза, декор, посуда, предметы интерьера",
    scenes: [
      {
        id: "in-interior",
        label: "В интерьере",
        subtitle: "товар в комнате",
        thumbSrc: tp("home", "in-interior"),
        prompt:
          "Place the furniture or home item in a real interior — a styled room with complementary decor, soft ambient light, design-magazine aesthetic.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: a stylish beige fabric armchair in a bright modern living room with a side table, plant, and floor lamp, soft window light, scandinavian interior design photo, no text",
      },
      {
        id: "with-person",
        label: "С человеком",
        subtitle: "кто-то использует",
        thumbSrc: tp("home", "with-person"),
        prompt:
          "Show the home item being used or enjoyed by a person — sitting on a sofa with a book, lighting a lamp, arranging flowers in a vase. Authentic relaxed moment.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: woman sitting comfortably on a beige fabric armchair in a sunlit living room, holding a coffee mug, casual home moment, soft daylight, lifestyle interior photography, no text",
      },
      {
        id: "closeup",
        label: "Крупный план",
        subtitle: "текстура, материал",
        thumbSrc: tp("home", "closeup"),
        prompt:
          "Macro close-up of the home item's material or detail (fabric weave, wood grain, brushed metal, ceramic finish). Shallow depth of field, premium materials shot.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: extreme macro close-up of a beige textured fabric weave with subtle stitching detail, shallow depth of field, soft side light, premium textile material shot, no text",
      },
      {
        id: "catalog",
        label: "Каталог",
        subtitle: "студийно изолированно",
        thumbSrc: tp("home", "catalog"),
        prompt:
          "Clean studio shot of the furniture / home item isolated on a soft neutral seamless backdrop. Even soft light, gentle cast shadow. Premium furniture catalog look.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: a single beige fabric armchair isolated on a soft neutral cream gradient backdrop, premium furniture catalog photo, soft even lighting, gentle cast shadow, no text, no props",
      },
    ],
  },
  {
    id: "other",
    label: "Прочее",
    detectHint: "всё остальное",
    scenes: [
      {
        id: "in-use",
        label: "В использовании",
        subtitle: "руки, человек",
        thumbSrc: tp("other", "in-use"),
        prompt:
          "Show the product IN ACTUAL USE — hands or a person interacting with it naturally. Authentic candid moment, lifestyle photography aesthetic.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: a person's hands using a generic everyday product like a notebook with a pen, soft daylight, slightly blurred desk background, lifestyle photo, no text",
      },
      {
        id: "in-environment",
        label: "В окружении",
        subtitle: "контекст и реквизит",
        thumbSrc: tp("other", "in-environment"),
        prompt:
          "Place the product in its natural environment with relevant surrounding props that hint at real-world use. Editorial composition.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: a notebook on a wooden desk surrounded by a coffee mug, pen, and a small plant, soft daylight, casual workspace lifestyle photo, no text",
      },
      {
        id: "catalog",
        label: "Каталог",
        subtitle: "студийно изолированно",
        thumbSrc: tp("other", "catalog"),
        prompt:
          "Clean studio shot of the product isolated on a neutral seamless backdrop, soft even lighting, gentle cast shadow. Premium catalog aesthetic.",
        thumbGenPrompt:
          "Square 1:1 thumbnail: a single brown leather notebook isolated on a soft neutral cream gradient background, premium product catalog photography, soft even lighting, gentle cast shadow, no text, no props",
      },
    ],
  },
];

export function getCategory(id: string | undefined | null): ProductCategory {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function getScene(
  categoryId: string | undefined | null,
  sceneId: string | undefined | null,
): CategoryScene | null {
  if (!sceneId) return null;
  const cat = getCategory(categoryId);
  return cat.scenes.find((s) => s.id === sceneId) ?? null;
}
