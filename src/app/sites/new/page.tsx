"use client";

import { ProductWizard, type WizardConfig } from "@/components/ProductWizard";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_GEN_PRODUCTS_ENABLED === "true";

const CONFIG: WizardConfig = {
  product: "site",
  generateUrl: "/api/generate-site",
  publishUrl: "/api/publish-site",
  publishPathPrefix: "/s",
  countParamName: "sectionCount",
  countRange: { min: 3, max: 12, default: 6 },
  elementLabelGenitive: "секций",
  productTitle: "Сайты",
  productHeroLine: "Расскажи о продукте",
  briefPlaceholder:
    "Например: Беспроводные наушники Apple AirPods Pro. Главная выгода — премиум-звук и тишина в шумном городе. Аудитория: молодые профессионалы 25-35, ценят минимализм. Стиль: премиум, тёмный режим, золотой акцент. Цена 25 990 ₸ со скидкой −30%.",
  downloadFileName: "aicreative-landing",
  featureEnabled: FEATURE_ENABLED,
  iconKind: "site",
};

export default function SitesNewPage() {
  return <ProductWizard config={CONFIG} />;
}
