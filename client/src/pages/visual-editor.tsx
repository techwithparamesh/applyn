/**
 * Visual App Editor - Appy Pie Style Component Editor
 * 
 * A drag-and-drop visual editor for building native app screens
 * with components like Text, Image, Button, Gallery, Forms, etc.
 */

import { useMemo, useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getTemplateById, cloneTemplate, type IndustryTemplate, type TemplateScreen } from "@/lib/app-templates";
import { DevicePreview } from "@/components/device-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Reorder } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Undo2,
  Redo2,
  ExternalLink,
  Smartphone,
  Monitor,
  Plus,
  Trash2,
  Copy,
  Type,
  Image as ImageIcon,
  Square,
  Grid3X3,
  Table,
  Heading1,
  AlignLeft,
  MousePointer,
  Star,
  FormInput,
  MapPin,
  Video,
  List,
  Sparkles,
  Layers,
  GripVertical,
  ChevronRight,
  Menu,
  MoreHorizontal,
  Loader2,
  Eye,
  Globe,
  Layout,
  Code2,
  QrCode,
  Bot,
  ListTree,
  Link2,
} from "lucide-react";

import { QRCodeSVG } from "qrcode.react";

// Component types for the editor (extended to support industry templates)
type ComponentType = 
  | "text" 
  | "heading" 
  | "image" 
  | "button" 
  | "container" 
  | "fixedContainer"
  | "grid"
  | "gallery"
  | "section"
  | "divider"
  | "spacer"
  | "icon"
  | "card"
  | "list"
  | "form"
  | "input"
  | "table"
  | "video"
  | "map"
  // Extended template components
  | "hero"
  | "productGrid"
  | "productCard"
  | "carousel"
  | "testimonial"
  | "pricingCard"
  | "contactForm"
  | "socialLinks"
  | "featureList"
  | "stats"
  | "team"
  | "faq";

// Component definition
interface EditorComponent {
  id: string;
  type: ComponentType;
  props: Record<string, any>;
  children?: EditorComponent[];
}

// Screen/Page definition
interface EditorScreen {
  id: string;
  name: string;
  icon: string;
  components: EditorComponent[];
  isHome?: boolean;
}

// Basic components palette
const BASIC_COMPONENTS: { type: ComponentType; name: string; icon: any; description: string }[] = [
  { type: "text", name: "Text", icon: Type, description: "Paragraph or text block" },
  { type: "heading", name: "Heading", icon: Heading1, description: "Title or heading text" },
  { type: "image", name: "Image", icon: ImageIcon, description: "Image or photo" },
  { type: "button", name: "Button", icon: MousePointer, description: "Clickable button" },
  { type: "container", name: "Container", icon: Square, description: "Container for grouping" },
  { type: "fixedContainer", name: "Fixed", icon: Layout, description: "Sticky container" },
  { type: "grid", name: "Grid", icon: Grid3X3, description: "Grid layout" },
  { type: "gallery", name: "Gallery", icon: ImageIcon, description: "Image gallery" },
  { type: "section", name: "Section", icon: AlignLeft, description: "Content section" },
  { type: "card", name: "Card", icon: Square, description: "Card with content" },
  { type: "table", name: "Table", icon: Table, description: "Rows and columns" },
  { type: "divider", name: "Divider", icon: AlignLeft, description: "Horizontal line" },
  { type: "icon", name: "Icon", icon: Star, description: "Icon element" },
  { type: "list", name: "List", icon: List, description: "Bullet or numbered list" },
];

// Form components
const FORM_COMPONENTS: { type: ComponentType; name: string; icon: any }[] = [
  { type: "form", name: "Form", icon: FormInput },
  { type: "input", name: "Input", icon: FormInput },
];

// Media components
const MEDIA_COMPONENTS: { type: ComponentType; name: string; icon: any }[] = [
  { type: "video", name: "Video", icon: Video },
  { type: "map", name: "Map", icon: MapPin },
];

// Pre-built section templates
const SECTION_TEMPLATES = [
  {
    id: "hero-1",
    name: "Hero Banner",
    preview: "🖼️",
    components: [
      {
        id: "hero-container",
        type: "container" as ComponentType,
        props: { padding: 40, backgroundColor: "#f8f9fa" },
        children: [
          { id: "hero-title", type: "heading" as ComponentType, props: { text: "Welcome to Our App", level: 1, color: "#000" } },
          { id: "hero-subtitle", type: "text" as ComponentType, props: { text: "Discover amazing features and services", fontSize: 16, color: "#666" } },
          { id: "hero-btn", type: "button" as ComponentType, props: { text: "Get Started", variant: "primary" } },
        ]
      }
    ]
  },
  {
    id: "features-grid",
    name: "Features Grid",
    preview: "⬛⬛⬛",
    components: [
      {
        id: "features-section",
        type: "section" as ComponentType,
        props: { title: "Our Features", padding: 20 },
        children: [
          {
            id: "features-grid",
            type: "grid" as ComponentType,
            props: { columns: 3, gap: 16 },
            children: [
              { id: "f1", type: "card" as ComponentType, props: { title: "Feature 1", description: "Description here", icon: "⚡" } },
              { id: "f2", type: "card" as ComponentType, props: { title: "Feature 2", description: "Description here", icon: "🚀" } },
              { id: "f3", type: "card" as ComponentType, props: { title: "Feature 3", description: "Description here", icon: "💡" } },
            ]
          }
        ]
      }
    ]
  },
  {
    id: "contact-form",
    name: "Contact Form",
    preview: "📝",
    components: [
      {
        id: "contact-section",
        type: "section" as ComponentType,
        props: { title: "Contact Us", padding: 20 },
        children: [
          {
            id: "contact-form-1",
            type: "form" as ComponentType,
            props: { submitText: "Submit" },
            children: [
              { id: "name-input", type: "input" as ComponentType, props: { label: "Name", placeholder: "Your name", required: true } },
              { id: "email-input", type: "input" as ComponentType, props: { label: "Email", placeholder: "your@email.com", type: "email", required: true } },
              { id: "submit-btn", type: "button" as ComponentType, props: { text: "Send Message", variant: "primary" } },
            ]
          }
        ]
      }
    ]
  },
];

// Generate unique ID
const generateId = () => `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Default props for each component type
const getDefaultProps = (type: ComponentType): Record<string, any> => {
  switch (type) {
    case "text": return { text: "Enter your text here", fontSize: 16, color: "#333333" };
    case "heading": return { text: "Heading", level: 2, color: "#000000" };
    case "image": return { src: "", alt: "Image", width: "100%", height: "auto" };
    case "button": return { text: "Button", variant: "primary", action: "none" };
    case "container": return { padding: 16, backgroundColor: "transparent", direction: "column", gap: 12 };
    case "fixedContainer": return { padding: 12, backgroundColor: "#ffffff", direction: "row", gap: 12, top: 0, zIndex: 20, shadow: true };
    case "grid": return { columns: 2, gap: 16 };
    case "gallery": return { columns: 2, images: [] };
    case "section": return { title: "Section Title", padding: 20 };
    case "card": return { title: "Card Title", description: "Card description", icon: "📦" };
    case "divider": return { color: "#e5e7eb", thickness: 1 };
    case "spacer": return { height: 20 };
    case "icon": return { icon: "⭐", size: 24 };
    case "list": return { items: ["Item 1", "Item 2", "Item 3"], ordered: false };
    case "form": return { submitText: "Submit" };
    case "input": return { label: "Label", placeholder: "Enter value", type: "text", required: false };
    case "table": return { columns: ["Item", "Price"], rows: [["Fresh Tomatoes", "$3.99"], ["Organic Apples", "$5.49"], ["Farm Eggs", "$4.25"]], striped: true };
    case "video": return { src: "", autoplay: false, controls: true };
    case "map": return { latitude: 0, longitude: 0, zoom: 15 };
    default: return {};
  }
};

// Component renderer for preview
type PreviewInteraction = {
  activeCategory?: string;
  setActiveCategory?: (category: string) => void;
  setEditorMode?: (mode: "components" | "website") => void;
};

function ComponentPreview({
  component,
  selectedComponentId,
  onSelect,
  interaction,
}: {
  component: EditorComponent;
  selectedComponentId: string | null;
  onSelect: (id: string) => void;
  interaction?: PreviewInteraction;
}) {
  const isSelected = selectedComponentId === component.id;
  const baseClass = `relative cursor-pointer transition-all ${isSelected ? 'ring-2 ring-cyan-500 ring-offset-2' : 'hover:ring-1 hover:ring-cyan-500/50'}`;

  const handleSelect = (e: any) => {
    e.stopPropagation?.();
    onSelect(component.id);
  };

  const categoryOptions = ["All", "Vegetables", "Fruits", "Dairy"];
  const isCategoryButton =
    component.type === "button" &&
    typeof component.props?.text === "string" &&
    categoryOptions.includes(component.props.text);
  const activeCategory = interaction?.activeCategory || "All";
  
  const renderComponent = () => {
    switch (component.type) {
      case "spacer": {
        const height = Number(component.props?.height ?? 12);
        return <div style={{ height: Number.isFinite(height) ? height : 12 }} />;
      }
      case "divider": {
        const thickness = Number(component.props?.thickness ?? 1);
        const color = component.props?.color || "#e5e7eb";
        return (
          <div
            className="w-full"
            style={{ height: Number.isFinite(thickness) ? thickness : 1, backgroundColor: color }}
          />
        );
      }
      case "text":
        return (
          <p style={{ fontSize: component.props.fontSize, color: component.props.color }} className="py-2">
            {component.props.text}
          </p>
        );
      case "heading":
        const level = component.props.level || 2;
        const headingStyles = { color: component.props.color };
        if (level === 1) return <h1 style={headingStyles} className="font-bold py-2 text-3xl">{component.props.text}</h1>;
        if (level === 2) return <h2 style={headingStyles} className="font-bold py-2 text-2xl">{component.props.text}</h2>;
        if (level === 3) return <h3 style={headingStyles} className="font-bold py-2 text-xl">{component.props.text}</h3>;
        return <h4 style={headingStyles} className="font-bold py-2 text-lg">{component.props.text}</h4>;
      case "image":
        return (
          <div className="bg-slate-200 rounded-lg flex items-center justify-center py-8">
            {component.props.src ? (
              <img src={component.props.src} alt={component.props.alt} className="max-w-full rounded" />
            ) : (
              <div className="text-center text-slate-400">
                <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                <span className="text-sm">Add Image</span>
              </div>
            )}
          </div>
        );
      case "button":
        {
          const size = component.props.size;
          const paddingClass = size === "sm" ? "px-3 py-1.5 text-xs" : "px-6 py-2 text-sm";

          const variant = isCategoryButton
            ? (component.props.text === activeCategory ? "primary" : "outline")
            : component.props.variant;

          const className = `${paddingClass} rounded-lg font-medium transition-colors ${
            variant === 'primary' 
              ? 'bg-cyan-500 text-white' 
              : 'bg-slate-200 text-slate-800'
          }`;

          return (
            <button
              className={className}
              onClick={(e) => {
                handleSelect(e);

                if (isCategoryButton) {
                  interaction?.setActiveCategory?.(component.props.text);
                }
                if (component.props.action === "switch-to-website") {
                  interaction?.setEditorMode?.("website");
                }
              }}
            >
              {component.props.text}
            </button>
          );
        }
      case "container":
        return (
          <div
            style={{
              padding: component.props.padding,
              backgroundColor: component.props.backgroundColor,
              display: "flex",
              flexDirection: component.props.direction || "column",
              gap: component.props.gap ?? 0,
            }}
            className="border border-dashed border-slate-300 rounded min-h-[60px]"
          >
            {component.children?.map((child) => (
              <ComponentPreview
                key={child.id}
                component={child}
                selectedComponentId={selectedComponentId}
                onSelect={onSelect}
                interaction={interaction}
              />
            ))}
            {(!component.children || component.children.length === 0) && (
              <div className="text-center text-slate-400 py-4 text-sm">Drop components here</div>
            )}
          </div>
        );
      case "fixedContainer":
        return (
          <div
            style={{
              position: "sticky",
              top: component.props.top ?? 0,
              zIndex: component.props.zIndex ?? 20,
              padding: component.props.padding,
              backgroundColor: component.props.backgroundColor,
              display: "flex",
              flexDirection: component.props.direction || "row",
              gap: component.props.gap ?? 0,
            }}
            className={`border border-dashed border-slate-300 rounded min-h-[60px] ${component.props.shadow ? "shadow-sm" : ""}`}
          >
            <div className="absolute -top-3 right-2 text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded">
              Fixed
            </div>
            {component.children?.map((child) => (
              <ComponentPreview
                key={child.id}
                component={child}
                selectedComponentId={selectedComponentId}
                onSelect={onSelect}
                interaction={interaction}
              />
            ))}
            {(!component.children || component.children.length === 0) && (
              <div className="text-center text-slate-400 py-4 text-sm flex-1">Drop components here</div>
            )}
          </div>
        );
      case "grid":
        return (
          <div className="grid gap-4 min-h-[60px]" style={{ gridTemplateColumns: `repeat(${component.props.columns}, 1fr)` }}>
            {component.children?.map((child) => (
              <ComponentPreview
                key={child.id}
                component={child}
                selectedComponentId={selectedComponentId}
                onSelect={onSelect}
                interaction={interaction}
              />
            ))}
            {(!component.children || component.children.length === 0) && (
              <div className="col-span-full text-center text-slate-400 py-4 text-sm border border-dashed rounded">Drop components here</div>
            )}
          </div>
        );
      case "card": {
        const title = component.props?.title;
        const subtitle = component.props?.subtitle;
        const description = component.props?.description;
        const icon = component.props?.icon;
        const image = component.props?.image;
        const compact = !!component.props?.compact;
        const horizontal = !!component.props?.horizontal;
        const backgroundColor = component.props?.backgroundColor;

        if (horizontal) {
          return (
            <div
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white"
              style={backgroundColor ? { backgroundColor } : undefined}
            >
              {image ? (
                <img src={image} alt={title || "Card"} className="w-14 h-14 rounded-lg object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xl">
                  {icon || "📦"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {title && <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>}
                {subtitle && <div className="text-[11px] text-gray-500 truncate">{subtitle}</div>}
              </div>
              <div className="text-gray-400">›</div>
            </div>
          );
        }

        return (
          <div
            className={
              "rounded-xl border border-gray-200 bg-white " +
              (compact ? "p-3" : "p-4")
            }
            style={backgroundColor ? { backgroundColor } : undefined}
          >
            <div className="flex items-start gap-3">
              {icon && <div className="text-2xl leading-none">{icon}</div>}
              <div className="flex-1 min-w-0">
                {title && <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>}
                {subtitle && <div className="text-[11px] text-gray-500 truncate">{subtitle}</div>}
                {description && !compact && (
                  <div className="text-[11px] text-gray-600 mt-1 line-clamp-2">{description}</div>
                )}
              </div>
            </div>
          </div>
        );
      }
      case "section":
        return (
          <div style={{ padding: component.props.padding }} className="bg-slate-50 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-slate-900">{component.props.title}</h2>
            {component.children?.map((child) => (
              <ComponentPreview
                key={child.id}
                component={child}
                selectedComponentId={selectedComponentId}
                onSelect={onSelect}
                interaction={interaction}
              />
            ))}
          </div>
        );
      case "gallery":
        return (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${component.props.columns}, 1fr)` }}>
            {[1,2,3,4].map((i) => (
              <div key={i} className="aspect-square bg-slate-200 rounded-lg flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-slate-400" />
              </div>
            ))}
          </div>
        );
      case "input":
        return (
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">{component.props.label}</label>
            <input 
              type={component.props.type || "text"}
              placeholder={component.props.placeholder}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        );
      case "form":
        return (
          <form className="space-y-4 p-4 bg-white rounded-lg border">
            {component.children?.map((child) => (
              <ComponentPreview
                key={child.id}
                component={child}
                selectedComponentId={selectedComponentId}
                onSelect={onSelect}
                interaction={interaction}
              />
            ))}
          </form>
        );
      case "list":
        // Handle different list variants
        if (component.props.variant === 'menu') {
          return (
            <div className="bg-white rounded-lg divide-y divide-gray-100">
              {component.props.items?.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm flex-1">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              ))}
            </div>
          );
        }

        if (component.props.variant === 'menu-item') {
          return (
            <div className="space-y-3">
              {component.props.items?.map((item: any, i: number) => (
                <div key={i} className="flex gap-3 p-3 bg-white rounded-lg border">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-md object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-slate-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm truncate">{item.name}</p>
                      <p className="font-semibold text-sm whitespace-nowrap">{item.price}</p>
                    </div>
                    {item.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {item.badge && (
                        <span className={
                          "text-[10px] px-2 py-0.5 rounded-full border " +
                          (String(item.badge).toLowerCase().includes("veg")
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200")
                        }>
                          {item.badge}
                        </span>
                      )}
                      <button className="ml-auto text-xs px-3 py-1 rounded-full bg-cyan-600 text-white">
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (component.props.variant === 'cart' || component.props.variant === 'orders') {
          return (
            <div className="space-y-3">
              {component.props.items?.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-white rounded-lg border">
                  {item.image && <img src={item.image} alt={item.name} className="w-14 h-14 rounded object-cover" />}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.quantity ? `Qty: ${item.quantity}` : item.status}</p>
                  </div>
                  <p className="font-semibold text-sm">{item.price || item.total}</p>
                </div>
              ))}
            </div>
          );
        }
        // Default bullet list
        return (
          <ul className="list-disc list-inside space-y-1">
            {component.props.items?.map((item: any, i: number) => (
              <li key={i} className="text-slate-700">{typeof item === 'string' ? item : item.name || item.title}</li>
            ))}
          </ul>
        );

      case "table":
        {
          const columns: string[] = Array.isArray(component.props.columns) ? component.props.columns : [];
          const rows: any[] = Array.isArray(component.props.rows) ? component.props.rows : [];
          return (
            <div className="overflow-hidden rounded-lg border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {columns.map((c, i) => (
                      <th key={i} className="text-left px-3 py-2 font-semibold text-slate-700">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r: any, i: number) => (
                    <tr key={i} className={component.props.striped && i % 2 === 1 ? "bg-slate-50/60" : ""}>
                      {(Array.isArray(r) ? r : []).slice(0, columns.length).map((cell: any, j: number) => (
                        <td key={j} className="px-3 py-2 border-t text-slate-700">
                          {String(cell ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-400" colSpan={Math.max(columns.length, 1)}>
                        Add rows in Properties
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        }
        
      // ---- Extended Template Components ----
      case "hero":
        return (
          <div
            className="relative rounded-xl overflow-hidden"
            style={{
              backgroundImage: component.props?.backgroundImage ? `url(${component.props.backgroundImage})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              height: component.props?.height || 180,
              backgroundColor: component.props?.backgroundImage ? undefined : "#2563EB",
            }}
          >
            <div className="absolute inset-0" style={{ backgroundColor: component.props?.overlayColor || "rgba(0,0,0,0.35)" }} />
            <div className="relative z-10 h-full p-4 flex flex-col justify-end text-white">
              <div className="text-xl font-bold break-words">{component.props?.title || "Welcome"}</div>
              {component.props?.subtitle && <div className="text-xs text-white/80 mt-1 break-words">{component.props.subtitle}</div>}
              {component.props?.buttonText && (
                <div className="mt-3">
                  <button className="px-4 py-2 bg-white text-gray-900 rounded-full text-xs font-semibold">{component.props.buttonText}</button>
                </div>
              )}
            </div>
          </div>
        );
        
      case "productGrid": {
        const products: any[] = Array.isArray(component.props?.products) ? component.props.products : [];
        const columns = component.props?.columns || 2;
        const categoryLower = String(activeCategory || "All").toLowerCase();
        const filtered = categoryLower === "all"
          ? products
          : products.filter((p) => String(p?.category || "").toLowerCase() === categoryLower);
        const visible = filtered.length > 0 ? filtered : products;

        return (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {visible.slice(0, 6).map((product, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {product.image && <img src={product.image} alt={product.name} className="w-full h-24 object-cover" />}
                <div className="p-2">
                  <div className="text-xs font-medium truncate">{product.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-sm font-bold text-cyan-600">{product.price}</div>
                    {product.rating && <div className="text-[10px] text-amber-600">★ {product.rating}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }
        
      case "carousel": {
        const items: any[] = Array.isArray(component.props?.items) ? component.props.items : [];
        return (
          <div className="-mx-4 px-4">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {items.slice(0, 10).map((item, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 w-44 bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  {item?.image && <img src={item.image} alt={item?.title || ""} className="w-full h-24 object-cover" />}
                  <div className="p-3">
                    <div className="text-xs font-semibold text-gray-900 truncate">{item?.title || item?.name || "Item"}</div>
                    {item?.subtitle && <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{item.subtitle}</div>}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-xs text-gray-500">No items</div>
              )}
            </div>
          </div>
        );
      }
        
      case "testimonial": {
        const items: any[] = Array.isArray(component.props?.items) ? component.props.items : [];
        return (
          <div className="space-y-3">
            {items.slice(0, 4).map((t, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="text-[11px] text-gray-700 leading-relaxed">"{t?.quote || t?.text || "Great experience!"}"</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-gray-900 truncate">{t?.name || "Customer"}</div>
                  {t?.rating && <div className="text-[10px] text-amber-600">★ {t.rating}</div>}
                </div>
              </div>
            ))}
          </div>
        );
      }
        
      case "stats": {
        const items: any[] = Array.isArray(component.props?.items) ? component.props.items : [];
        const columns = component.props?.columns || 2;
        return (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {items.slice(0, 6).map((s, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="text-lg font-bold text-cyan-600">{s?.value ?? s?.number ?? "0"}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{s?.label || s?.title || "Stat"}</div>
              </div>
            ))}
          </div>
        );
      }
        
      case "team": {
        const members: any[] = Array.isArray(component.props?.members) ? component.props.members : [];
        return (
          <div className="grid grid-cols-2 gap-3">
            {members.slice(0, 6).map((m, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {m?.image ? (
                  <img src={m.image} alt={m?.name || "Member"} className="w-full h-20 object-cover" />
                ) : (
                  <div className="w-full h-20 bg-gray-100" />
                )}
                <div className="p-2">
                  <div className="text-xs font-semibold text-gray-900 truncate">{m?.name || "Team"}</div>
                  {m?.role && <div className="text-[10px] text-gray-500 truncate">{m.role}</div>}
                </div>
              </div>
            ))}
          </div>
        );
      }
        
      case "contactForm": {
        const fields: any[] = Array.isArray(component.props?.fields) ? component.props.fields : [];
        const buttonText = component.props?.buttonText || "Send";
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
            {fields.slice(0, 6).map((f, idx) => (
              <input
                key={idx}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder={f?.placeholder || f?.label || "Field"}
                type={f?.type || "text"}
              />
            ))}
            <button className="w-full px-3 py-2 rounded-lg text-white text-sm font-semibold bg-cyan-600">
              {buttonText}
            </button>
          </div>
        );
      }
        
      case "map": {
        const height = Number(component.props?.height ?? 150);
        const latitude = component.props?.latitude;
        const longitude = component.props?.longitude;
        return (
          <div
            className="w-full rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-xs text-gray-500"
            style={{ height: Number.isFinite(height) ? height : 150 }}
          >
            Map preview {latitude != null && longitude != null ? `(${latitude}, ${longitude})` : ""}
          </div>
        );
      }
      case "socialLinks": {
        const links: any[] = Array.isArray(component.props?.links) ? component.props.links : [];
        return (
          <div className="flex flex-wrap gap-2">
            {links.slice(0, 8).map((l, idx) => (
              <button
                key={idx}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-800"
                style={l?.color ? { borderColor: `${l.color}40` } : undefined}
              >
                <span className="mr-1">{l?.icon || "🔗"}</span>
                {l?.label || l?.name || "Link"}
              </button>
            ))}
          </div>
        );
      }

      default:
        return (
          <div className="p-3 rounded-xl border border-dashed border-gray-300 bg-white text-[11px] text-gray-500">
            Unsupported component: <span className="font-semibold">{String(component.type || "unknown")}</span>
          </div>
        );
    }
  };

  return (
    <div className={baseClass} onClick={handleSelect}>
      {renderComponent()}
      {isSelected && (
        <div className="absolute -top-3 -left-3 bg-cyan-500 text-white text-xs px-2 py-0.5 rounded z-20">
          {component.type}
        </div>
      )}
    </div>
  );
}

// Properties panel for selected component
function PropertiesPanel({ 
  component, 
  onUpdate, 
  onDelete 
}: { 
  component: EditorComponent | null;
  onUpdate: (props: Record<string, any>) => void;
  onDelete: () => void;
}) {
  if (!component) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-slate-600/50">
          <Sparkles className="h-8 w-8 text-slate-500" />
        </div>
        <p className="text-sm text-slate-400">Select an element to edit</p>
        <p className="text-xs text-slate-500 mt-1">Click any component in the preview</p>
      </div>
    );
  }

  const inputClass = "mt-1.5 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20";
  const labelClass = "text-xs text-slate-400 font-medium";

  const renderPropsEditor = () => {
    switch (component.type) {
      case "container":
        return (
          <div className="space-y-4">
            <div>
              <Label className={labelClass}>Padding (px)</Label>
              <Input
                type="number"
                value={component.props.padding ?? 0}
                onChange={(e) => onUpdate({ ...component.props, padding: parseInt(e.target.value || "0") })}
                className={inputClass}
              />
            </div>
            <div>
              <Label className={labelClass}>Direction</Label>
              <Select value={String(component.props.direction || "column")} onValueChange={(v) => onUpdate({ ...component.props, direction: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="column">Column</SelectItem>
                  <SelectItem value="row">Row</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelClass}>Gap (px)</Label>
              <Input
                type="number"
                value={component.props.gap ?? 0}
                onChange={(e) => onUpdate({ ...component.props, gap: parseInt(e.target.value || "0") })}
                className={inputClass}
              />
            </div>
            <div>
              <Label className={labelClass}>Background</Label>
              <Input
                value={component.props.backgroundColor ?? "transparent"}
                onChange={(e) => onUpdate({ ...component.props, backgroundColor: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>
        );
      case "fixedContainer":
        return (
          <div className="space-y-4">
            <div>
              <Label className={labelClass}>Padding (px)</Label>
              <Input
                type="number"
                value={component.props.padding ?? 0}
                onChange={(e) => onUpdate({ ...component.props, padding: parseInt(e.target.value || "0") })}
                className={inputClass}
              />
            </div>
            <div>
              <Label className={labelClass}>Top Offset (px)</Label>
              <Input
                type="number"
                value={component.props.top ?? 0}
                onChange={(e) => onUpdate({ ...component.props, top: parseInt(e.target.value || "0") })}
                className={inputClass}
              />
            </div>
            <div>
              <Label className={labelClass}>Z-Index</Label>
              <Input
                type="number"
                value={component.props.zIndex ?? 20}
                onChange={(e) => onUpdate({ ...component.props, zIndex: parseInt(e.target.value || "0") })}
                className={inputClass}
              />
            </div>
            <div>
              <Label className={labelClass}>Direction</Label>
              <Select value={String(component.props.direction || "row")} onValueChange={(v) => onUpdate({ ...component.props, direction: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="row">Row</SelectItem>
                  <SelectItem value="column">Column</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelClass}>Gap (px)</Label>
              <Input
                type="number"
                value={component.props.gap ?? 0}
                onChange={(e) => onUpdate({ ...component.props, gap: parseInt(e.target.value || "0") })}
                className={inputClass}
              />
            </div>
            <div>
              <Label className={labelClass}>Background</Label>
              <Input
                value={component.props.backgroundColor ?? "#ffffff"}
                onChange={(e) => onUpdate({ ...component.props, backgroundColor: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={labelClass}>Shadow</p>
                <p className="text-[11px] text-slate-500">Adds subtle elevation</p>
              </div>
              <input
                type="checkbox"
                checked={!!component.props.shadow}
                onChange={(e) => onUpdate({ ...component.props, shadow: e.target.checked })}
              />
            </div>
          </div>
        );
      case "text":
        return (
          <div className="space-y-4">
            <div>
              <Label className={labelClass}>Text Content</Label>
              <Textarea
                value={component.props.text}
                onChange={(e) => onUpdate({ ...component.props, text: e.target.value })}
                rows={3}
                className={inputClass}
              />
            </div>
            <div>
              <Label className={labelClass}>Font Size</Label>
              <Input
                type="number"
                value={component.props.fontSize}
                onChange={(e) => onUpdate({ ...component.props, fontSize: parseInt(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div>
              <Label className={labelClass}>Text Color</Label>
              <div className="flex gap-2 mt-1.5">
                <input
                  type="color"
                  value={component.props.color}
                  onChange={(e) => onUpdate({ ...component.props, color: e.target.value })}
                  className="h-9 w-12 rounded-lg cursor-pointer bg-slate-800 border border-slate-700"
                />
                <Input value={component.props.color} onChange={(e) => onUpdate({ ...component.props, color: e.target.value })} className={`${inputClass} font-mono text-sm`} />
              </div>
            </div>
          </div>
        );
      case "heading":
        return (
          <div className="space-y-4">
            <div>
              <Label className={labelClass}>Heading Text</Label>
              <Input value={component.props.text} onChange={(e) => onUpdate({ ...component.props, text: e.target.value })} className={inputClass} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Heading Level</Label>
              <Select value={String(component.props.level)} onValueChange={(v) => onUpdate({ ...component.props, level: parseInt(v) })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">H1 - Main Title</SelectItem>
                  <SelectItem value="2">H2 - Section Title</SelectItem>
                  <SelectItem value="3">H3 - Subsection</SelectItem>
                  <SelectItem value="4">H4 - Small Title</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case "button":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Button Text</Label>
              <Input value={component.props.text} onChange={(e) => onUpdate({ ...component.props, text: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Style</Label>
              <Select value={component.props.variant} onValueChange={(v) => onUpdate({ ...component.props, variant: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary (Filled)</SelectItem>
                  <SelectItem value="secondary">Secondary (Outline)</SelectItem>
                  <SelectItem value="ghost">Ghost (Text)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Action</Label>
              <Select value={component.props.action} onValueChange={(v) => onUpdate({ ...component.props, action: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="link">Open Link</SelectItem>
                  <SelectItem value="screen">Go to Screen</SelectItem>
                  <SelectItem value="call">Make Call</SelectItem>
                  <SelectItem value="email">Send Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case "image":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Image URL</Label>
              <Input value={component.props.src} onChange={(e) => onUpdate({ ...component.props, src: e.target.value })} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Alt Text</Label>
              <Input value={component.props.alt} onChange={(e) => onUpdate({ ...component.props, alt: e.target.value })} className="mt-1" />
            </div>
          </div>
        );
      case "grid":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Columns</Label>
              <Select value={String(component.props.columns)} onValueChange={(v) => onUpdate({ ...component.props, columns: parseInt(v) })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Column</SelectItem>
                  <SelectItem value="2">2 Columns</SelectItem>
                  <SelectItem value="3">3 Columns</SelectItem>
                  <SelectItem value="4">4 Columns</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Gap (px)</Label>
              <Input type="number" value={component.props.gap} onChange={(e) => onUpdate({ ...component.props, gap: parseInt(e.target.value) })} className="mt-1" />
            </div>
          </div>
        );
      case "card":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Title</Label>
              <Input value={component.props.title} onChange={(e) => onUpdate({ ...component.props, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Description</Label>
              <Textarea value={component.props.description} onChange={(e) => onUpdate({ ...component.props, description: e.target.value })} rows={2} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Icon/Emoji</Label>
              <Input value={component.props.icon} onChange={(e) => onUpdate({ ...component.props, icon: e.target.value })} className="mt-1" />
            </div>
          </div>
        );
      case "section":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Section Title</Label>
              <Input value={component.props.title} onChange={(e) => onUpdate({ ...component.props, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Padding (px)</Label>
              <Input type="number" value={component.props.padding} onChange={(e) => onUpdate({ ...component.props, padding: parseInt(e.target.value) })} className="mt-1" />
            </div>
          </div>
        );
      case "input":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Label</Label>
              <Input value={component.props.label} onChange={(e) => onUpdate({ ...component.props, label: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Placeholder</Label>
              <Input value={component.props.placeholder} onChange={(e) => onUpdate({ ...component.props, placeholder: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Input Type</Label>
              <Select value={component.props.type} onValueChange={(v) => onUpdate({ ...component.props, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="tel">Phone</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case "table":
        {
          const columns = Array.isArray(component.props.columns) ? component.props.columns : [];
          const rows = Array.isArray(component.props.rows) ? component.props.rows : [];
          return (
            <div className="space-y-4">
              <div>
                <Label className={labelClass}>Columns (comma-separated)</Label>
                <Input
                  value={columns.join(", ")}
                  onChange={(e) => {
                    const next = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    onUpdate({ ...component.props, columns: next });
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <Label className={labelClass}>Rows (JSON array)</Label>
                <Textarea
                  value={JSON.stringify(rows, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      if (Array.isArray(parsed)) {
                        onUpdate({ ...component.props, rows: parsed });
                      }
                    } catch {
                      // ignore invalid JSON while typing
                    }
                  }}
                  rows={6}
                  className={`${inputClass} font-mono text-xs`}
                />
                <p className="text-[11px] text-slate-500 mt-1">Example: [["Item","$1"],["Item2","$2"]]</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={labelClass}>Striped Rows</p>
                  <p className="text-[11px] text-slate-500">Alternating background</p>
                </div>
                <input
                  type="checkbox"
                  checked={!!component.props.striped}
                  onChange={(e) => onUpdate({ ...component.props, striped: e.target.checked })}
                />
              </div>
            </div>
          );
        }
      default:
        return <div className="text-sm text-slate-400">Properties for {component.type}</div>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-500/30">
            <span className="text-sm">✨</span>
          </div>
          <span className="text-sm font-medium text-white capitalize">{component.type}</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onDelete} 
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {renderPropsEditor()}
    </div>
  );
}

// Main Visual Editor Page
export default function VisualEditor() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Editor state
  const [screens, setScreens] = useState<EditorScreen[]>([
    { id: "home", name: "Home", icon: "🏠", components: [], isHome: true }
  ]);
  const [activeScreenId, setActiveScreenId] = useState("home");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [deviceView, setDeviceView] = useState<"mobile" | "desktop">("mobile");
  const [editorMode, setEditorMode] = useState<"components" | "website">("components"); // Default to components for native apps
  const [canvasPreviewMode, setCanvasPreviewMode] = useState<"edit" | "live">("edit");
  const [followActiveScreen, setFollowActiveScreen] = useState(true);
  const [liveScreenIndex, setLiveScreenIndex] = useState(0);
  const [rightSidebarTab, setRightSidebarTab] = useState<"agent" | "properties" | "code" | "qr">("properties");
  const [paletteSearch, setPaletteSearch] = useState<string>("");
  const [websitePreviewUrl, setWebsitePreviewUrl] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [showComponentTree, setShowComponentTree] = useState(true);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [activeCategoryByScreen, setActiveCategoryByScreen] = useState<Record<string, string>>({});

  // Fetch app data
  const { data: app, isLoading } = useQuery<any>({
    queryKey: [`/api/apps/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  // Set editor mode based on app type
  useEffect(() => {
    if (app) {
      // Native apps should show components mode, website apps show website mode
      const isNative = app.isNativeOnly || app.url === "native://app" || !app.url;
      setEditorMode(isNative ? "components" : "website");
    }
  }, [app]);

  // Keep preview mode sensible: live preview is only meaningful in mobile + components mode.
  useEffect(() => {
    if (editorMode !== "components") {
      setCanvasPreviewMode("edit");
    }
  }, [editorMode]);

  const activeScreenIndex = useMemo(() => {
    const idx = screens.findIndex((s) => s.id === activeScreenId);
    return idx >= 0 ? idx : 0;
  }, [screens, activeScreenId]);

  // When following, keep the live preview index aligned.
  useEffect(() => {
    if (followActiveScreen) {
      setLiveScreenIndex(activeScreenIndex);
    }
  }, [followActiveScreen, activeScreenIndex]);

  const webviewPages = useMemo(() => {
    const modules = (app as any)?.modules;
    if (!Array.isArray(modules)) return [] as Array<{ id: string; label: string; url: string; icon?: string }>;
    const webview = modules.find((m: any) => m?.type === "webviewPages");
    const pages = webview?.config?.pages;
    if (!Array.isArray(pages)) return [];
    return pages
      .filter((p: any) => p && typeof p.url === "string")
      .map((p: any) => ({
        id: String(p.id || p.url),
        label: String(p.label || p.url),
        url: String(p.url),
        icon: typeof p.icon === "string" ? p.icon : "🌐",
      }));
  }, [app]);

  // Keep a stable website preview URL (use imported pages when available)
  useEffect(() => {
    if (!app) return;
    if (websitePreviewUrl) return;
    if (webviewPages.length > 0) {
      setWebsitePreviewUrl(webviewPages[0].url);
      return;
    }
    if (typeof (app as any)?.url === "string" && (app as any).url !== "native://app") {
      setWebsitePreviewUrl((app as any).url);
    }
  }, [app, webviewPages, websitePreviewUrl]);

  const search = paletteSearch.trim().toLowerCase();
  const componentGroups = useMemo(() => {
    const groups: Array<{ title: string; items: Array<{ type: ComponentType; name: string; icon: any }> }> = [
      { title: "Basic", items: BASIC_COMPONENTS.map((c) => ({ type: c.type, name: c.name, icon: c.icon })) },
      { title: "Form", items: FORM_COMPONENTS },
      { title: "Media", items: MEDIA_COMPONENTS },
    ];
    if (!search) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.name.toLowerCase().includes(search) || String(i.type).toLowerCase().includes(search)),
      }))
      .filter((g) => g.items.length > 0);
  }, [search]);

  const filteredSections = useMemo(() => {
    if (!search) return SECTION_TEMPLATES;
    return SECTION_TEMPLATES.filter((t) => t.name.toLowerCase().includes(search) || String(t.id).toLowerCase().includes(search));
  }, [search]);

  // Helper function to personalize template content with app name
  const personalizeTemplateContent = useCallback((template: IndustryTemplate, appName: string): EditorScreen[] => {
    const clonedTemplate = cloneTemplate(template);
    
    // Replace placeholder text with app name and personalized content
    const personalizeComponent = (comp: any): any => {
      const newComp = { ...comp };
      
      // Personalize hero sections
      if (comp.type === 'hero' && comp.props) {
        if (comp.props.title?.includes('Fresh Products') || comp.props.title?.includes('Welcome')) {
          newComp.props = { ...comp.props, title: appName };
        }
        if (comp.props.subtitle) {
          // Keep original subtitle or make it more personalized
          const subtitles: Record<string, string> = {
            'ecommerce': 'Shop the best products online',
            'salon': 'Book your perfect appointment',
            'restaurant': 'Delicious food, delivered fresh',
            'church': 'Join our community of faith',
            'fitness': 'Transform your body and mind',
            'education': 'Learn something new today',
            'healthcare': 'Your health, our priority',
            'realestate': 'Find your dream home',
            'photography': 'Capturing moments that matter',
            'music': 'Feel the rhythm',
            'business': 'Professional services for you',
            'news': 'Stay informed, stay ahead',
            'radio': 'Tune in to great music',
          };
          newComp.props.subtitle = subtitles[template.id] || comp.props.subtitle;
        }
      }
      
      // Personalize headings that say "About Us" or company-related
      if (comp.type === 'heading' && comp.props?.text) {
        if (comp.props.text === 'About Us') {
          newComp.props = { ...comp.props, text: `About ${appName}` };
        }
        if (comp.props.text === 'Contact Us') {
          newComp.props = { ...comp.props, text: `Contact ${appName}` };
        }
      }
      
      // Recursively personalize children
      if (comp.children) {
        newComp.children = comp.children.map(personalizeComponent);
      }
      
      return newComp;
    };
    
    return clonedTemplate.screens.map((ts: TemplateScreen) => ({
      id: ts.id,
      name: ts.name,
      icon: ts.icon,
      isHome: ts.isHome,
      components: ts.components.map(personalizeComponent) as EditorComponent[],
    }));
  }, []);

  // Load saved screens from app OR initialize from industry template OR create default
  useEffect(() => {
    if (!app || templatesLoaded) return;
    
    console.log('[Visual Editor] Loading screens for app:', app.name, 'Industry:', app.industry);

    const normalizeIndustryId = (raw: string | undefined | null) => {
      if (!raw) return null;
      const v = String(raw).trim().toLowerCase();
      const normalized = v
        .replace(/&/g, "and")
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
      // direct ids
      if (getTemplateById(normalized)) return normalized;
      // synonyms
      if (normalized.includes("salon") || normalized.includes("spa") || normalized.includes("beauty")) return "salon";
      if (normalized.includes("restaurant") || normalized.includes("food") || normalized.includes("cafe")) return "restaurant";
      if (normalized.includes("ecommerce") || normalized.includes("e commerce") || normalized.includes("store") || normalized.includes("shop")) return "ecommerce";
      if (normalized.includes("church") || normalized.includes("ministry")) return "church";
      if (normalized.includes("fitness") || normalized.includes("gym")) return "fitness";
      if (normalized.includes("education") || normalized.includes("school") || normalized.includes("college")) return "education";
      if (normalized.includes("radio") || normalized.includes("station") || normalized.includes("podcast")) return "radio";
      if (normalized.includes("health") || normalized.includes("clinic") || normalized.includes("medical") || normalized.includes("hospital")) return "healthcare";
      if (normalized.includes("real estate") || normalized.includes("realestate") || normalized.includes("property")) return "realestate";
      if (normalized.includes("photo") || normalized.includes("photography") || normalized.includes("studio")) return "photography";
      if (normalized.includes("music") || normalized.includes("band") || normalized.includes("artist")) return "music";
      if (normalized.includes("news") || normalized.includes("magazine") || normalized.includes("blog")) return "news";
      if (normalized.includes("business") || normalized.includes("company") || normalized.includes("corporate")) return "business";
      return null;
    };

    const isPlaceholderScreens = (maybeScreens: any[] | null | undefined) => {
      if (!maybeScreens || !Array.isArray(maybeScreens) || maybeScreens.length === 0) return false;
      try {
        const allText = maybeScreens
          .flatMap((s: any) => (s?.components || []).map((c: any) => JSON.stringify(c?.props || {})))
          .join(" ")
          .toLowerCase();
        return allText.includes("your app is ready to customize") || allText.includes("start customizing your app");
      } catch {
        return false;
      }
    };

    const normalizedIndustry = normalizeIndustryId(app.industry);
    
    // Check for existing saved screens with actual content
    if (app.editorScreens && Array.isArray(app.editorScreens) && app.editorScreens.length > 0) {
      const hasContent = app.editorScreens.some((s: EditorScreen) => 
        s.components && Array.isArray(s.components) && s.components.length > 0
      );
      
      // If saved screens are just placeholders and we have an industry template, prefer the template.
      if (hasContent && !(isPlaceholderScreens(app.editorScreens) && normalizedIndustry && getTemplateById(normalizedIndustry))) {
        console.log('[Visual Editor] Loading saved screens:', app.editorScreens.length);
        setScreens(app.editorScreens);
        const homeScreen = app.editorScreens.find((s: EditorScreen) => s.isHome);
        setActiveScreenId(homeScreen?.id || app.editorScreens[0].id);
        setTemplatesLoaded(true);
        return;
      }
    }
    
    // Load industry template if available
    if (normalizedIndustry && normalizedIndustry !== 'custom') {
      console.log('[Visual Editor] Looking for template:', normalizedIndustry);
      const template = getTemplateById(normalizedIndustry);
      
      if (template) {
        console.log('[Visual Editor] Found template:', template.name, 'with', template.screens.length, 'screens');
        
        // Personalize template with app name
        const templateScreens = personalizeTemplateContent(template, app.name || 'My App');
        
        setScreens(templateScreens);
        const homeScreen = templateScreens.find(s => s.isHome);
        setActiveScreenId(homeScreen?.id || templateScreens[0].id);
        setHasChanges(true);
        setTemplatesLoaded(true);
        
        toast({
          title: "✨ Template loaded!",
          description: `${template.name} template personalized for ${app.name}. ${templateScreens.length} screens ready to customize.`,
        });
        return;
      } else {
        console.log('[Visual Editor] Template not found for:', normalizedIndustry);
      }
    }
    
    // Check if this is a website-based app (not native-only)
    const isWebsiteApp = app.url && app.url !== "native://app" && app.url.startsWith("http");
    
    if (isWebsiteApp) {
      // For website apps, create screens that complement the website
      console.log('[Visual Editor] Creating website-complement screens for:', app.name);
      const homeId = generateId();
      const websiteScreens: EditorScreen[] = [
        {
          id: homeId,
          name: "Home",
          icon: "🏠",
          isHome: true,
          components: [
            {
              id: generateId(),
              type: "hero",
              props: {
                title: app.name || "Welcome",
                subtitle: "Native screens for your app",
                backgroundImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
                buttonText: "Explore",
                buttonLink: "#",
                height: 180
              }
            },
            {
              id: generateId(),
              type: "text",
              props: {
                text: "💡 These are optional native screens for your website app. Your main content comes from your website. Use these screens for features like push notifications landing, offline content, or special promotions.",
                fontSize: 13,
                color: "#6B7280"
              }
            },
            {
              id: generateId(),
              type: "button",
              props: {
                text: "🌐 View Website Mode",
                variant: "outline",
                action: "switch-to-website"
              }
            }
          ]
        },
        {
          id: generateId(),
          name: "Notifications",
          icon: "🔔",
          isHome: false,
          components: [
            {
              id: generateId(),
              type: "heading",
              props: {
                text: "Notifications",
                level: 1,
                color: "#1F2937"
              }
            },
            {
              id: generateId(),
              type: "text",
              props: {
                text: "Push notification landing screen. When users tap a notification, they can land here with relevant content.",
                fontSize: 14,
                color: "#6B7280"
              }
            }
          ]
        },
        {
          id: generateId(),
          name: "Offline",
          icon: "📴",
          isHome: false,
          components: [
            {
              id: generateId(),
              type: "heading",
              props: {
                text: "You're Offline",
                level: 1,
                color: "#1F2937"
              }
            },
            {
              id: generateId(),
              type: "text",
              props: {
                text: "This content is shown when the user has no internet connection. Customize it with helpful info or cached content.",
                fontSize: 14,
                color: "#6B7280"
              }
            },
            {
              id: generateId(),
              type: "button",
              props: {
                text: "Try Again",
                variant: "primary",
                action: "refresh"
              }
            }
          ]
        }
      ];
      setScreens(websiteScreens);
      setActiveScreenId(homeId);
      setHasChanges(true);
      setTemplatesLoaded(true);
      return;
    }
    
    // Create default screens for native-only apps without industry templates
    console.log('[Visual Editor] Creating default screens for native app:', app.name);
    const homeId = generateId();
    const defaultScreens: EditorScreen[] = [
        {
          id: homeId,
          name: "Home",
          icon: "🏠",
          isHome: true,
          components: [
            {
              id: generateId(),
              type: "hero",
              props: {
                title: app.name || "Welcome",
                subtitle: "Your app is ready to customize",
                backgroundImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
                buttonText: "Get Started",
                buttonLink: "#",
                height: 200
              }
            },
            {
              id: generateId(),
              type: "text",
              props: {
                text: "Start customizing your app by adding components from the left panel. Drag and drop to rearrange, and click to edit properties.",
                fontSize: 14,
                color: "#6B7280"
              }
            }
          ]
        },
        {
          id: generateId(),
          name: "About",
          icon: "ℹ️",
          isHome: false,
          components: [
            {
              id: generateId(),
              type: "heading",
              props: {
                text: `About ${app.name || 'Us'}`,
                level: 1,
                color: "#1F2937"
              }
            },
            {
              id: generateId(),
              type: "text",
              props: {
                text: "Welcome to our app! We're dedicated to providing you with the best experience. Edit this section to tell your story.",
                fontSize: 14,
                color: "#6B7280"
              }
            },
            {
              id: generateId(),
              type: "image",
              props: {
                src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800",
                alt: "Our Team"
              }
            }
          ]
        },
        {
          id: generateId(),
          name: "Contact",
          icon: "📞",
          isHome: false,
          components: [
            {
              id: generateId(),
              type: "heading",
              props: {
                text: `Contact ${app.name || 'Us'}`,
                level: 1,
                color: "#1F2937"
              }
            },
            {
              id: generateId(),
              type: "text",
              props: {
                text: "We'd love to hear from you! Reach out using the information below.",
                fontSize: 14,
                color: "#6B7280"
              }
            },
            {
              id: generateId(),
              type: "button",
              props: {
                text: "📧 Email Us",
                url: "mailto:contact@example.com",
                backgroundColor: "#2563EB",
                textColor: "#FFFFFF"
              }
            },
            {
              id: generateId(),
              type: "button",
              props: {
                text: "📞 Call Us",
                url: "tel:+1234567890",
                backgroundColor: "#059669",
                textColor: "#FFFFFF"
              }
            }
          ]
        }
      ];
      setScreens(defaultScreens);
      setActiveScreenId(homeId);
      setHasChanges(true);
      setTemplatesLoaded(true);
  }, [app, templatesLoaded, toast, personalizeTemplateContent]);

  // Ensure activeScreenId always points to a valid screen
  useEffect(() => {
    if (screens.length > 0) {
      const screenExists = screens.some(s => s.id === activeScreenId);
      if (!screenExists) {
        // Find home screen or use first screen
        const homeScreen = screens.find(s => s.isHome);
        setActiveScreenId(homeScreen?.id || screens[0].id);
      }
    }
  }, [screens, activeScreenId]);

  // Get active screen - use memoized lookup
  const activeScreen = screens.find(s => s.id === activeScreenId) || screens[0];

  const activeCategory = activeCategoryByScreen[activeScreenId] || "All";
  const setActiveCategory = useCallback((category: string) => {
    setActiveCategoryByScreen((prev) => ({ ...prev, [activeScreenId]: category }));
  }, [activeScreenId]);
  
  // Find component by ID recursively
  const findComponent = (components: EditorComponent[], targetId: string): EditorComponent | null => {
    for (const comp of components) {
      if (comp.id === targetId) return comp;
      if (comp.children) {
        const found = findComponent(comp.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };
  
  const selectedComponent = selectedComponentId && activeScreen
    ? findComponent(activeScreen.components, selectedComponentId)
    : null;

  // Add component to screen
  const addComponent = useCallback((type: ComponentType) => {
    if (!activeScreen) return;
    
    const newComponent: EditorComponent = {
      id: generateId(),
      type,
      props: getDefaultProps(type),
      children: ["container", "fixedContainer", "grid", "section", "form"].includes(type) ? [] : undefined,
    };

    setScreens(prev => prev.map(screen => 
      screen.id === activeScreenId 
        ? { ...screen, components: [...screen.components, newComponent] }
        : screen
    ));
    setSelectedComponentId(newComponent.id);
    setHasChanges(true);
  }, [activeScreen, activeScreenId]);

  const copyToClipboard = useCallback(async (text: string, successLabel: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: successLabel });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access." });
    }
  }, [toast]);

  // Add template section
  const addTemplate = useCallback((template: typeof SECTION_TEMPLATES[0]) => {
    if (!activeScreen) return;
    
    const cloneWithNewIds = (comps: EditorComponent[]): EditorComponent[] => {
      return comps.map(comp => ({
        ...comp,
        id: generateId(),
        children: comp.children ? cloneWithNewIds(comp.children) : undefined,
      }));
    };

    const newComponents = cloneWithNewIds(template.components);
    setScreens(prev => prev.map(screen => 
      screen.id === activeScreenId 
        ? { ...screen, components: [...screen.components, ...newComponents] }
        : screen
    ));
    setHasChanges(true);
  }, [activeScreen, activeScreenId]);

  // Update component
  const updateComponent = useCallback((props: Record<string, any>) => {
    if (!selectedComponentId || !activeScreen) return;

    const updateInTree = (components: EditorComponent[]): EditorComponent[] => {
      return components.map(comp => {
        if (comp.id === selectedComponentId) return { ...comp, props };
        if (comp.children) return { ...comp, children: updateInTree(comp.children) };
        return comp;
      });
    };

    setScreens(prev => prev.map(screen => 
      screen.id === activeScreenId 
        ? { ...screen, components: updateInTree(screen.components) }
        : screen
    ));
    setHasChanges(true);
  }, [selectedComponentId, activeScreen, activeScreenId]);

  // Delete component
  const deleteComponent = useCallback(() => {
    if (!selectedComponentId || !activeScreen) return;

    const removeFromTree = (components: EditorComponent[]): EditorComponent[] => {
      return components
        .filter(comp => comp.id !== selectedComponentId)
        .map(comp => ({
          ...comp,
          children: comp.children ? removeFromTree(comp.children) : undefined,
        }));
    };

    setScreens(prev => prev.map(screen => 
      screen.id === activeScreenId 
        ? { ...screen, components: removeFromTree(screen.components) }
        : screen
    ));
    setSelectedComponentId(null);
    setHasChanges(true);
  }, [selectedComponentId, activeScreen, activeScreenId]);

  // Reorder components
  const handleReorder = useCallback((newOrder: EditorComponent[]) => {
    setScreens(prev => prev.map(screen => 
      screen.id === activeScreenId 
        ? { ...screen, components: newOrder }
        : screen
    ));
    setHasChanges(true);
  }, [activeScreenId]);

  // Add screen
  const addScreen = useCallback(() => {
    const newScreen: EditorScreen = {
      id: generateId(),
      name: `Screen ${screens.length + 1}`,
      icon: "📄",
      components: [],
    };
    setScreens(prev => [...prev, newScreen]);
    setActiveScreenId(newScreen.id);
    setHasChanges(true);
  }, [screens.length]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/apps/${id}`, { editorScreens: screens });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: [`/api/apps/${id}`] });
      toast({ title: "Saved!", description: "Your changes have been saved." });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  // Check if this is a native-only app
  const isNativeApp = app?.isNativeOnly || app?.url === "native://app" || !app?.url;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden">
      {/* Top Toolbar - Modern Dark Theme */}
      <header className="h-16 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation(`/apps/${id}/preview`)}
            className="text-slate-300 hover:text-white hover:bg-slate-700/50"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {/* App Name & Info */}
          <div className="flex items-center gap-3 border-l border-slate-700/50 pl-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-lg shadow-lg">
              {app?.icon || "📱"}
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">{app?.name || "My App"}</h1>
              <p className="text-slate-400 text-xs">
                {isNativeApp ? "Native App" : "Web App"} • {activeScreen?.name || "Home"}
              </p>
            </div>
          </div>

          {/* Editor Mode Toggle - Only show for non-native apps */}
          {!isNativeApp && (
            <TooltipProvider>
              <div className="flex items-center gap-1 p-1 bg-slate-800/80 rounded-xl ml-4 border border-slate-700/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={() => setEditorMode("website")}
                      className={`h-8 px-4 font-medium rounded-lg transition-all ${editorMode === "website" 
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25" 
                        : "bg-transparent hover:bg-slate-700/50 text-slate-400"}`}
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      Website
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">Website Mode</p>
                    <p className="text-xs text-muted-foreground">Preview your actual website as it appears in the app</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={() => setEditorMode("components")}
                      className={`h-8 px-4 font-medium rounded-lg transition-all ${editorMode === "components" 
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25" 
                        : "bg-transparent hover:bg-slate-700/50 text-slate-400"}`}
                    >
                      <Layout className="h-4 w-4 mr-2" />
                      Screens
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">Native Screens</p>
                    <p className="text-xs text-muted-foreground">Add extra native screens like push notification landing, offline content, or promotions</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Device Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-800/80 rounded-lg border border-slate-700/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeviceView("mobile")}
              className={`h-8 w-8 p-0 ${deviceView === "mobile" 
                ? "text-cyan-400 bg-cyan-500/10" 
                : "text-slate-400 hover:text-white"}`}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeviceView("desktop")}
              className={`h-8 w-8 p-0 ${deviceView === "desktop" 
                ? "text-cyan-400 bg-cyan-500/10" 
                : "text-slate-400 hover:text-white"}`}
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>

          {/* In-canvas preview mode (Edit vs Live) */}
          {editorMode === "components" && (
            <div className="flex items-center gap-1 p-1 bg-slate-800/80 rounded-lg border border-slate-700/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCanvasPreviewMode("edit")}
                className={`h-8 px-3 ${canvasPreviewMode === "edit"
                  ? "text-cyan-300 bg-cyan-500/10"
                  : "text-slate-400 hover:text-white"}`}
              >
                <MousePointer className="h-4 w-4 mr-2" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedComponentId(null); setCanvasPreviewMode("live"); }}
                className={`h-8 px-3 ${canvasPreviewMode === "live"
                  ? "text-purple-300 bg-purple-500/10"
                  : "text-slate-400 hover:text-white"}`}
              >
                <Eye className="h-4 w-4 mr-2" /> Live
              </Button>
            </div>
          )}

          <div className="h-6 w-px bg-slate-700" />

          <Button variant="ghost" size="icon" title="Undo" className="text-slate-400 hover:text-white">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Redo" className="text-slate-400 hover:text-white">
            <Redo2 className="h-4 w-4" />
          </Button>
          
          <div className="h-6 w-px bg-slate-700" />
          
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/apps/${id}/structure`)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:text-white"
          >
            <ListTree className="h-4 w-4 mr-2" /> Structure
          </Button>

          {!isNativeApp && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/apps/${id}/import`)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:text-white"
            >
              <Link2 className="h-4 w-4 mr-2" /> Import
            </Button>
          )}

          <Button 
            variant="outline"
            size="sm"
            onClick={() => window.open(`/live-preview/${id}`, "_blank")}
            className="border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:text-white"
          >
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/25"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Components Panel */}
        <aside className="w-72 bg-slate-900/95 border-r border-slate-700/50 flex flex-col overflow-hidden shrink-0">
          <div className="p-3 border-b border-slate-700/50 shrink-0">
            <Label className="text-[11px] text-slate-500">Search</Label>
            <Input
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              placeholder="Pages, screens, components, sections..."
              className="mt-1.5 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
            />
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3">
              <Accordion type="multiple" defaultValue={[!isNativeApp ? "pages" : "screens", "add", "layers"]} className="w-full">
                {!isNativeApp && (
                  <AccordionItem value="pages" className="border-slate-700/50">
                    <AccordionTrigger className="text-sm text-slate-200 hover:no-underline">Website Pages</AccordionTrigger>
                    <AccordionContent>
                      {webviewPages.length > 0 ? (
                        <div className="space-y-1">
                          {webviewPages
                            .filter((p) => !search || p.label.toLowerCase().includes(search) || p.url.toLowerCase().includes(search))
                            .slice(0, 30)
                            .map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setWebsitePreviewUrl(p.url);
                                  setEditorMode("website");
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all text-slate-400 hover:bg-slate-800/50 hover:text-white border border-transparent"
                                title={p.url}
                              >
                                <span className="text-base">{p.icon || "🌐"}</span>
                                <span className="flex-1 text-left truncate">{p.label}</span>
                                <ChevronRight className="h-4 w-4 text-slate-600" />
                              </button>
                            ))}
                          <div className="pt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/apps/${id}/import`)}
                              className="border-slate-700 text-slate-200 hover:bg-slate-800/60"
                            >
                              <Link2 className="h-4 w-4 mr-2" /> Import
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/apps/${id}/structure`)}
                              className="border-slate-700 text-slate-200 hover:bg-slate-800/60"
                            >
                              <ListTree className="h-4 w-4 mr-2" /> Structure
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
                          <p className="text-xs text-slate-300 font-medium">No website pages yet</p>
                          <p className="text-[11px] text-slate-500 mt-1">Import pages to build your app navigation.</p>
                          <div className="pt-2">
                            <Button
                              size="sm"
                              onClick={() => setLocation(`/apps/${id}/import`)}
                              className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                            >
                              <Link2 className="h-4 w-4 mr-2" /> Import Website
                            </Button>
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value="screens" className="border-slate-700/50">
                  <AccordionTrigger className="text-sm text-slate-200 hover:no-underline">Native Screens</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] text-slate-500">{screens.length} screens</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                        onClick={addScreen}
                        title="Add screen"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {screens
                        .filter((s) => !search || s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search))
                        .map((screen) => (
                          <button
                            key={screen.id}
                            onClick={() => {
                              setActiveScreenId(screen.id);
                              setSelectedComponentId(null);
                              setEditorMode("components");
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                              activeScreenId === screen.id
                                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30"
                                : "text-slate-400 hover:bg-slate-800/50 hover:text-white border border-transparent"
                            }`}
                          >
                            <span className="text-base">{screen.icon}</span>
                            <span className="flex-1 text-left truncate">{screen.name}</span>
                            {screen.isHome && (
                              <Badge className="text-[10px] h-5 bg-cyan-500/20 text-cyan-400 border-0">Home</Badge>
                            )}
                            <span className="text-xs text-slate-500">{screen.components.length}</span>
                          </button>
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="add" className="border-slate-700/50">
                  <AccordionTrigger className="text-sm text-slate-200 hover:no-underline">Add Elements</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      {componentGroups.map((group) => (
                        <div key={group.title}>
                          <h3 className="text-xs font-bold text-slate-500 uppercase px-1 mb-2">{group.title}</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {group.items.map((comp) => (
                              <button
                                key={comp.type}
                                onClick={() => {
                                  setEditorMode("components");
                                  addComponent(comp.type);
                                }}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-700/50 bg-slate-800/50 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all group"
                              >
                                <comp.icon className="h-5 w-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                                <span className="text-xs text-slate-400 group-hover:text-white transition-colors">{comp.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase px-1 mb-2">Sections</h3>
                        <div className="space-y-2">
                          {filteredSections.slice(0, 30).map((template) => (
                            <button
                              key={template.id}
                              onClick={() => {
                                setEditorMode("components");
                                addTemplate(template);
                              }}
                              className="w-full p-3 rounded-xl border border-slate-700/50 bg-slate-800/50 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-left group"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{template.preview}</span>
                                <span className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors">{template.name}</span>
                              </div>
                            </button>
                          ))}
                          {filteredSections.length === 0 && (
                            <p className="text-xs text-slate-500 px-1">No matching sections.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="layers" className="border-slate-700/50">
                  <AccordionTrigger className="text-sm text-slate-200 hover:no-underline">Layers</AccordionTrigger>
                  <AccordionContent>
                    {editorMode !== "components" ? (
                      <p className="text-xs text-slate-500">Layers are available when editing native screens.</p>
                    ) : activeScreen && activeScreen.components.length > 0 ? (
                      <div className="space-y-1">
                        {activeScreen.components
                          .filter((c) => !search || String(c.type).toLowerCase().includes(search))
                          .map((comp, index) => (
                            <button
                              key={comp.id}
                              onClick={() => setSelectedComponentId(comp.id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                                selectedComponentId === comp.id
                                  ? "bg-cyan-500/20 text-cyan-400 font-medium border border-cyan-500/30"
                                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white border border-transparent"
                              }`}
                            >
                              <span className="text-slate-500 w-4">{index + 1}</span>
                              <span className="capitalize">{comp.type}</span>
                            </button>
                          ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No components on this screen yet.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>
        </aside>

        {/* Canvas Area - Premium Dark Design */}
        <main className="flex-1 overflow-auto p-8 flex items-start justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800">
          {editorMode === "website" ? (
            /* Website Preview Mode - Shows actual website in mobile frame */
            <div className="flex flex-col items-center gap-6">
              {/* Mobile Device Frame - Premium Design */}
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-3xl rounded-full scale-150 opacity-30" />
                
                <div className="relative mx-auto border-gray-900 bg-gray-900 border-[12px] rounded-[3rem] h-[640px] w-[310px] shadow-2xl shadow-black/50">
                  {/* Dynamic Island */}
                  <div className="w-[120px] h-[28px] bg-black top-3 rounded-full left-1/2 -translate-x-1/2 absolute z-20 flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-slate-700 rounded-full" />
                  </div>
                  {/* Side buttons */}
                  <div className="h-[32px] w-[3px] bg-gray-700 absolute -left-[15px] top-[100px] rounded-l-lg"></div>
                  <div className="h-[46px] w-[3px] bg-gray-700 absolute -left-[15px] top-[150px] rounded-l-lg"></div>
                  <div className="h-[46px] w-[3px] bg-gray-700 absolute -left-[15px] top-[210px] rounded-l-lg"></div>
                  <div className="h-[64px] w-[3px] bg-gray-700 absolute -right-[15px] top-[170px] rounded-r-lg"></div>
                  
                  <div className="rounded-[2.5rem] overflow-hidden w-full h-full bg-white relative flex flex-col">
                    {/* Status Bar */}
                    <div className="h-12 bg-black/90 flex items-end justify-between px-6 pb-1 text-[11px] font-medium text-white select-none z-20 shrink-0">
                      <span className="font-semibold">9:41</span>
                      <div className="flex gap-1.5 items-center">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20.5a8.5 8.5 0 100-17 8.5 8.5 0 000 17z" /></svg>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2 17h20v2H2zm2-4h16v2H4zm2-4h12v2H6zm2-4h8v2H8z" /></svg>
                        <span className="ml-0.5 font-semibold">100%</span>
                      </div>
                    </div>

                    {/* App Header Bar */}
                    <div 
                      className="h-12 flex items-center justify-between px-4 shadow-lg z-10 shrink-0"
                      style={{ backgroundColor: app?.primaryColor || "#2563EB" }}
                    >
                      <div className="text-white font-bold flex items-center gap-2 text-sm">
                        <span className="text-lg">{app?.icon || "📱"}</span>
                        <span className="truncate max-w-[180px]">{app?.name || "My App"}</span>
                      </div>
                      <Menu className="w-5 h-5 text-white/80" />
                    </div>

                    {/* Website Content - Live iframe */}
                    <div className="flex-1 bg-white relative overflow-hidden">
                      {websitePreviewUrl && websitePreviewUrl !== "native://app" ? (
                        <iframe
                          src={websitePreviewUrl}
                          className="w-full h-full border-0"
                          title="Website Preview"
                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 bg-gradient-to-b from-slate-50 to-white">
                          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-100 to-purple-100 flex items-center justify-center mb-4">
                            <Globe className="h-10 w-10 text-cyan-500" />
                          </div>
                          <p className="text-sm text-center font-medium text-slate-600">No website URL configured</p>
                          <p className="text-xs mt-2 text-slate-400 text-center">Add your website URL in Settings<br/>or switch to <strong>Screens</strong> mode</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Bottom Navigation */}
                    <div className="h-16 bg-white border-t border-gray-100 flex items-center justify-around px-6 shrink-0 pb-2">
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-6 h-6" style={{ color: app?.primaryColor || "#2563EB" }} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                        </svg>
                        <span className="text-[10px] font-medium" style={{ color: app?.primaryColor || "#2563EB" }}>Home</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="text-[10px] text-gray-400">Search</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-[10px] text-gray-400">Profile</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* App name label */}
              <p className="text-sm text-slate-400 text-center font-medium">
                {app?.name || "My App"}
              </p>
              
              {/* Quick Info */}
              {websitePreviewUrl && websitePreviewUrl !== "native://app" && (
                <a 
                  href={websitePreviewUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50"
                >
                  <Globe className="h-3 w-3" />
                  {websitePreviewUrl.replace(/^https?:\/\//, "").replace(/\/$/, "").substring(0, 30)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : (
            /* Component Editor Mode - Premium Drag and Drop */
            <div className="flex flex-col items-center gap-6">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 blur-3xl rounded-full opacity-20 pointer-events-none" />
              
              <div className="relative">
                {/* Phone glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 blur-3xl rounded-full scale-125 opacity-40" />

                {/* Desktop split view: edit + live side-by-side */}
                {deviceView === "desktop" && canvasPreviewMode === "live" ? (
                  <div className="relative flex items-start gap-8">
                    <div className="shrink-0 sticky top-24">
                      <div className="mb-3 flex items-center justify-between gap-3 px-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              followActiveScreen
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            }
                          >
                            {followActiveScreen ? "Synced" : "Detached"}
                          </Badge>
                          <span className="text-xs text-slate-300">Live preview</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Follow active screen</span>
                          <Switch
                            checked={followActiveScreen}
                            onCheckedChange={(v) => {
                              setFollowActiveScreen(!!v);
                            }}
                          />
                        </div>
                      </div>
                      <DevicePreview
                        url={"native://app"}
                        appName={app?.name || "My App"}
                        primaryColor={app?.primaryColor || ""}
                        icon={String((app as any)?.iconUrl || app?.icon || "📱")}
                        preferLivePreview={true}
                        screens={screens as any}
                        industry={app?.industry || undefined}
                        isNativeOnly={true}
                        screenIndex={followActiveScreen ? activeScreenIndex : liveScreenIndex}
                        onScreenIndexChange={(idx) => {
                          setLiveScreenIndex(idx);
                          if (followActiveScreen) {
                            const next = screens[idx];
                            if (next?.id) {
                              setActiveScreenId(next.id);
                              setSelectedComponentId(null);
                            }
                          }
                        }}
                        showToggle={true}
                        availablePlatforms={["android", "ios"]}
                        defaultPlatform="ios"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div 
                        className="relative bg-white w-full rounded-2xl shadow-2xl shadow-black/50 overflow-hidden transition-all border-[10px] border-slate-900"
                        style={{ minHeight: "600px" }}
                      >
                        {/* Content Area with Reorder */}
                        <ScrollArea className="flex-1" style={{ height: "540px" }}>
                          <div className="min-h-full bg-[#F6F7FB]">
                            <div className="px-4 pt-4 pb-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[17px] font-semibold text-gray-900 truncate">{activeScreen?.name || "Home"}</div>
                                  <div className="text-[11px] text-gray-500 mt-0.5">
                                    Click components to edit • Drag to reorder
                                  </div>
                                </div>
                                <div
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: app?.primaryColor || "#2563EB",
                                    boxShadow: `0 0 0 4px ${(app?.primaryColor || "#2563EB")}22`,
                                  }}
                                  aria-hidden
                                />
                              </div>
                            </div>

                            <div className="px-4 pb-6">
                              {activeScreen && activeScreen.components.length > 0 ? (
                                <Reorder.Group 
                                  axis="y" 
                                  values={activeScreen.components} 
                                  onReorder={handleReorder}
                                  className="space-y-5"
                                >
                                  {activeScreen.components.map((component) => (
                                    <Reorder.Item 
                                      key={component.id} 
                                      value={component}
                                      className="cursor-grab active:cursor-grabbing"
                                    >
                                      <ComponentPreview
                                        component={component}
                                        selectedComponentId={selectedComponentId}
                                        onSelect={setSelectedComponentId}
                                        interaction={{
                                          activeCategory,
                                          setActiveCategory,
                                          setEditorMode,
                                        }}
                                      />
                                    </Reorder.Item>
                                  ))}
                                </Reorder.Group>
                              ) : (
                                <div className="py-16 text-center">
                                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-cyan-100 flex items-center justify-center">
                                    <Sparkles className="h-10 w-10 text-purple-500" />
                                  </div>
                                  <p className="text-slate-600 font-medium">Ready to build!</p>
                                  <p className="text-sm text-slate-400 mt-2">Click components on the left to add them here</p>
                                  <p className="text-xs text-slate-400 mt-1">Drag to reorder • Click to edit</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                ) : canvasPreviewMode === "live" ? (
                  <DevicePreview
                    url={"native://app"}
                    appName={app?.name || "My App"}
                    primaryColor={app?.primaryColor || ""}
                    icon={String((app as any)?.iconUrl || app?.icon || "📱")}
                    preferLivePreview={true}
                    screens={screens as any}
                    industry={app?.industry || undefined}
                    isNativeOnly={true}
                    screenIndex={activeScreenIndex}
                    onScreenIndexChange={(idx) => {
                      const next = screens[idx];
                      if (next?.id) {
                        setActiveScreenId(next.id);
                        setSelectedComponentId(null);
                      }
                    }}
                    showToggle={deviceView === "desktop"}
                    availablePlatforms={deviceView === "desktop" ? ["android", "ios"] : ["android"]}
                    defaultPlatform={deviceView === "desktop" ? "ios" : "android"}
                  />
                ) : (
                
                <div 
                  className={`relative bg-white rounded-[2.5rem] shadow-2xl shadow-black/50 overflow-hidden transition-all border-[10px] border-slate-900 ${
                    deviceView === "mobile" ? "w-[340px]" : "w-full max-w-4xl rounded-2xl"
                  }`}
                  style={{ minHeight: deviceView === "mobile" ? "700px" : "600px" }}
                >
                  {/* Phone Header with Dynamic Island */}
                  {deviceView === "mobile" && (
                    <>
                      {/* Status Bar */}
                      <div className="h-12 bg-black/90 flex items-end justify-between px-6 pb-1 text-[11px] font-semibold text-white select-none z-20 shrink-0 relative">
                        <span>9:41</span>
                        {/* Dynamic Island */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-[100px] h-[26px] bg-black rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-slate-700 rounded-full" />
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <span>100%</span>
                        </div>
                      </div>
                      
                      {/* App Header */}
                      <div 
                        className="h-12 flex items-center justify-between px-4 shadow-lg"
                        style={{ backgroundColor: app?.primaryColor || "#2563EB" }}
                      >
                        <Menu className="h-5 w-5 text-white/80" />
                        <span className="text-white font-semibold text-sm">{activeScreen?.name}</span>
                        <MoreHorizontal className="h-5 w-5 text-white/80" />
                      </div>
                    </>
                  )}

                  {/* Content Area with Reorder */}
                  <ScrollArea className="flex-1" style={{ height: deviceView === "mobile" ? "calc(700px - 140px)" : "540px" }}>
                    <div className="min-h-full bg-[#F6F7FB]">
                      {/* Screen header (mobile-only) */}
                      {deviceView === "mobile" && (
                        <div className="px-4 pt-4 pb-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[17px] font-semibold text-gray-900 truncate">{activeScreen?.name || "Home"}</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                Click components to edit • Drag to reorder
                              </div>
                            </div>
                            <div
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: app?.primaryColor || "#2563EB",
                                boxShadow: `0 0 0 4px ${(app?.primaryColor || "#2563EB")}22`,
                              }}
                              aria-hidden
                            />
                          </div>
                        </div>
                      )}

                      <div className="px-4 pb-6">
                      {activeScreen && activeScreen.components.length > 0 ? (
                        <Reorder.Group 
                          axis="y" 
                          values={activeScreen.components} 
                          onReorder={handleReorder}
                          className="space-y-5"
                        >
                          {activeScreen.components.map((component) => (
                            <Reorder.Item 
                              key={component.id} 
                              value={component}
                              className="cursor-grab active:cursor-grabbing"
                            >
                              <ComponentPreview
                                component={component}
                                selectedComponentId={selectedComponentId}
                                onSelect={setSelectedComponentId}
                                interaction={{
                                  activeCategory,
                                  setActiveCategory,
                                  setEditorMode,
                                }}
                              />
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>
                      ) : (
                        <div className="py-16 text-center">
                          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-cyan-100 flex items-center justify-center">
                            <Sparkles className="h-10 w-10 text-purple-500" />
                          </div>
                          <p className="text-slate-600 font-medium">Ready to build!</p>
                          <p className="text-sm text-slate-400 mt-2">Click components on the left to add them here</p>
                          <p className="text-xs text-slate-400 mt-1">Drag to reorder • Click to edit</p>
                        </div>
                      )}
                      </div>
                    </div>
                  </ScrollArea>

                  {/* Bottom Navigation - Mobile Only */}
                  {deviceView === "mobile" && (
                    <div className="h-16 bg-white/90 backdrop-blur border-t border-gray-200 flex items-center justify-around px-1 shrink-0">
                      {screens.slice(0, 4).map((screen) => {
                        const isActive = screen.id === activeScreenId;
                        return (
                          <button
                            key={screen.id}
                            onClick={() => { setActiveScreenId(screen.id); setSelectedComponentId(null); }}
                            className={
                              "relative flex flex-col items-center justify-center gap-1 min-w-0 w-full h-full px-2 transition-colors " +
                              (isActive ? "text-gray-900" : "text-gray-500")
                            }
                          >
                            {isActive && (
                              <span
                                className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-full"
                                style={{ backgroundColor: app?.primaryColor || "#2563EB" }}
                              />
                            )}
                            <span className={"text-[20px] leading-none " + (isActive ? "" : "opacity-90")}>{screen.icon}</span>
                            <span
                              className="text-[10px] font-medium truncate max-w-[74px]"
                              style={{ color: isActive ? app?.primaryColor || "#2563EB" : undefined }}
                            >
                              {screen.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                )}
              </div>
              
              {/* Screen info */}
              <div className="text-center">
                <p className="text-sm text-slate-400 font-medium">
                  {activeScreen?.name} • {activeScreen?.components.length || 0} components
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Tools Panel (AppyPie-style) */}
        <aside className={`w-80 bg-slate-900/95 border-l border-slate-700/50 flex flex-col overflow-hidden shrink-0 ${editorMode === "website" ? "hidden" : ""}`}>
          <Tabs value={rightSidebarTab} onValueChange={(v) => setRightSidebarTab(v as any)} className="flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-700/50 shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-white">Tools</span>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedComponent ? `Selected: ${selectedComponent.type}` : `${activeScreen?.name || "Screen"}`}
                  </p>
                </div>
              </div>

              <TabsList className="grid w-full grid-cols-4 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <TabsTrigger value="agent" className="text-xs rounded-lg data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                  <Bot className="h-3.5 w-3.5 mr-1.5" /> Agent
                </TabsTrigger>
                <TabsTrigger value="properties" className="text-xs rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Props
                </TabsTrigger>
                <TabsTrigger value="code" className="text-xs rounded-lg data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                  <Code2 className="h-3.5 w-3.5 mr-1.5" /> Code
                </TabsTrigger>
                <TabsTrigger value="qr" className="text-xs rounded-lg data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                  <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="properties" className="flex-1 m-0">
              <ScrollArea className="h-full bg-slate-800/30">
                <div className="p-4">
                  <PropertiesPanel
                    component={selectedComponent}
                    onUpdate={updateComponent}
                    onDelete={deleteComponent}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="code" className="flex-1 m-0">
              <ScrollArea className="h-full bg-slate-800/30">
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-600 text-slate-200 hover:bg-slate-700/50"
                      onClick={() => copyToClipboard(JSON.stringify(activeScreen, null, 2), "Copied screen JSON")}
                    >
                      <Copy className="h-4 w-4 mr-2" /> Screen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-600 text-slate-200 hover:bg-slate-700/50"
                      onClick={() => copyToClipboard(JSON.stringify(screens, null, 2), "Copied all screens JSON")}
                    >
                      <Copy className="h-4 w-4 mr-2" /> All
                    </Button>
                    {selectedComponent && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-200 hover:bg-slate-700/50"
                        onClick={() => copyToClipboard(JSON.stringify(selectedComponent, null, 2), "Copied component JSON")}
                      >
                        <Copy className="h-4 w-4 mr-2" /> Component
                      </Button>
                    )}
                  </div>

                  <Textarea
                    value={JSON.stringify(selectedComponent || activeScreen, null, 2)}
                    readOnly
                    rows={18}
                    className="bg-slate-900/60 border-slate-700/50 text-slate-100 font-mono text-xs"
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="qr" className="flex-1 m-0">
              <ScrollArea className="h-full bg-slate-800/30">
                <div className="p-4 space-y-4">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center gap-3">
                    <QRCodeSVG
                      value={`${window.location.origin}/live-preview/${id}`}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#111827"
                      level="M"
                    />
                    <p className="text-xs text-slate-400 text-center">
                      Scan to open live preview
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-200 hover:bg-slate-700/50"
                        onClick={() => window.open(`/live-preview/${id}`, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" /> Open
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-200 hover:bg-slate-700/50"
                        onClick={() => copyToClipboard(`${window.location.origin}/live-preview/${id}`, "Copied preview link")}
                      >
                        <Copy className="h-4 w-4 mr-2" /> Copy
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="agent" className="flex-1 m-0">
              <ScrollArea className="h-full bg-slate-800/30">
                <div className="p-4">
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
                    <p className="text-sm text-white font-medium">AI Agent</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Coming next: “Describe what you want” → auto-add components and style.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
