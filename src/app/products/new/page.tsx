"use client";

import { ProductWizard, type WizardConfig } from "@/components/ProductWizard";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_GEN_PRODUCTS_ENABLED === "true";

const CONFIG: WizardConfig = {
  product: "product-cards",
  generateUrl: "/api/generate-products",
  // Product cards don't have a /publish flow yet — they download as a
  // ZIP/HTML, since marketplace listings are uploaded directly to Kaspi/WB.
  publishUrl: undefined,
  publishPathPrefix: undefined,
  countParamName: "cardCount",
  countRange: { min: 3, max: 12, default: 6 },
  elementLabelGenitive: "карточек",
  productTitle: "Карточки товара",
  productHeroLine: "Опиши товар",
  briefPlaceholder:
    "Например: Кофемолка ручная, керамические жернова, для эспрессо. Цена от 18 990 ₸. Аудитория — кофеманы 25-45 готовые инвестировать в качество. Стиль — тёплый, премиум, ремесленный.",
  downloadFileName: "aicreative-product-cards",
  featureEnabled: FEATURE_ENABLED,
  iconKind: "product",
};

export default function ProductsNewPage() {
  return <ProductWizard config={CONFIG} />;
}
