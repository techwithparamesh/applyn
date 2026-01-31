import type { AppBlueprint } from "@shared/blueprints";
import { buildEcommerceBlueprint } from "@/sections/presets/ecommerce";
import { buildRestaurantBlueprint } from "@/sections/presets/restaurant";
import { buildRealEstateBlueprint } from "@/sections/presets/realestate";
import { buildHealthcareBlueprint } from "@/sections/presets/healthcare";

export function buildBlueprintForTemplate(args: {
  templateId: string;
  appName: string;
  prompt?: string;
}): AppBlueprint | null {
  const templateId = String(args.templateId || "").trim().toLowerCase();
  if (templateId === "ecommerce" || templateId === "ecommerce_bamboo") {
    return buildEcommerceBlueprint({ appName: args.appName, prompt: args.prompt });
  }
  if (templateId === "restaurant" || templateId === "restaurant_biryani") {
    return buildRestaurantBlueprint({ appName: args.appName, prompt: args.prompt });
  }
  if (templateId === "realestate") {
    return buildRealEstateBlueprint({ appName: args.appName, prompt: args.prompt });
  }
  if (templateId === "healthcare") {
    return buildHealthcareBlueprint({ appName: args.appName, prompt: args.prompt });
  }
  return null;
}

