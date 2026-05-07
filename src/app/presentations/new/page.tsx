"use client";

import { ProductWizard, type WizardConfig } from "@/components/ProductWizard";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_GEN_PRODUCTS_ENABLED === "true";

const CONFIG: WizardConfig = {
  product: "presentation",
  generateUrl: "/api/generate-presentation",
  publishUrl: "/api/publish-presentation",
  publishPathPrefix: "/p",
  countParamName: "slideCount",
  countRange: { min: 5, max: 25, default: 10 },
  elementLabelGenitive: "слайдов",
  productTitle: "Презентации",
  productHeroLine: "О чём презентация?",
  briefPlaceholder:
    "Например: Питч приложения по доставке еды в Алматы. Главная проблема — еда едет 60+ минут. Решение — гарантия 30 минут или возврат денег. Аудитория: офисные работники 25-40. Стиль: динамичный, оранжевый акцент.",
  downloadFileName: "aicreative-presentation",
  featureEnabled: FEATURE_ENABLED,
  iconKind: "presentation",
};

export default function PresentationsNewPage() {
  return <ProductWizard config={CONFIG} />;
}
