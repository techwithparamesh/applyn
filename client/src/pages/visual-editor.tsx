/**
 * Visual App Editor - Appy Pie Style Component Editor
 * 
 * A drag-and-drop visual editor for building native app screens
 * with components like Text, Image, Button, Gallery, Forms, etc.
 */

import { useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getTemplateById, cloneTemplate, type IndustryTemplate, type TemplateScreen } from "@/lib/app-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Type,
  Image as ImageIcon,
  Square,
  Grid3X3,
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
} from "lucide-react";

// Component types for the editor (extended to support industry templates)
type ComponentType = 
  | "text" 
  | "heading" 
  | "image" 
  | "button" 
  | "container" 
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
  { type: "grid", name: "Grid", icon: Grid3X3, description: "Grid layout" },
  { type: "gallery", name: "Gallery", icon: ImageIcon, description: "Image gallery" },
  { type: "section", name: "Section", icon: AlignLeft, description: "Content section" },
  { type: "card", name: "Card", icon: Square, description: "Card with content" },
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
    case "container": return { padding: 16, backgroundColor: "transparent" };
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
    case "video": return { src: "", autoplay: false, controls: true };
    case "map": return { latitude: 0, longitude: 0, zoom: 15 };
    default: return {};
  }
};

// Component renderer for preview
function ComponentPreview({ component, isSelected, onClick }: { 
  component: EditorComponent; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const baseClass = `relative cursor-pointer transition-all ${isSelected ? 'ring-2 ring-cyan-500 ring-offset-2' : 'hover:ring-1 hover:ring-cyan-500/50'}`;
  
  const renderComponent = () => {
    switch (component.type) {
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
        return (
          <button 
            className={`px-6 py-2 rounded-lg font-medium ${
              component.props.variant === 'primary' 
                ? 'bg-cyan-500 text-white' 
                : 'bg-slate-200 text-slate-800'
            }`}
          >
            {component.props.text}
          </button>
        );
      case "container":
        return (
          <div 
            style={{ padding: component.props.padding, backgroundColor: component.props.backgroundColor }}
            className="border border-dashed border-slate-300 rounded min-h-[60px]"
          >
            {component.children?.map((child) => (
              <ComponentPreview key={child.id} component={child} isSelected={false} onClick={() => {}} />
            ))}
            {(!component.children || component.children.length === 0) && (
              <div className="text-center text-slate-400 py-4 text-sm">Drop components here</div>
            )}
          </div>
        );
      case "grid":
        return (
          <div className="grid gap-4 min-h-[60px]" style={{ gridTemplateColumns: `repeat(${component.props.columns}, 1fr)` }}>
            {component.children?.map((child) => (
              <ComponentPreview key={child.id} component={child} isSelected={false} onClick={() => {}} />
            ))}
            {(!component.children || component.children.length === 0) && (
              <div className="col-span-full text-center text-slate-400 py-4 text-sm border border-dashed rounded">Drop components here</div>
            )}
          </div>
        );
      case "card":
        return (
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="text-2xl mb-2">{component.props.icon}</div>
            <h3 className="font-semibold text-slate-900">{component.props.title}</h3>
            <p className="text-sm text-slate-500">{component.props.description}</p>
          </div>
        );
      case "section":
        return (
          <div style={{ padding: component.props.padding }} className="bg-slate-50 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-slate-900">{component.props.title}</h2>
            {component.children?.map((child) => (
              <ComponentPreview key={child.id} component={child} isSelected={false} onClick={() => {}} />
            ))}
          </div>
        );
      case "divider":
        return <hr style={{ borderColor: component.props.color, borderWidth: component.props.thickness }} className="my-4" />;
      case "spacer":
        return <div style={{ height: component.props.height }} />;
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
              <ComponentPreview key={child.id} component={child} isSelected={false} onClick={() => {}} />
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
        
      // ---- Extended Template Components ----
      case "hero":
        return (
          <div 
            className="relative rounded-lg overflow-hidden"
            style={{ 
              backgroundImage: component.props.backgroundImage ? `url(${component.props.backgroundImage})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              height: component.props.height || 200
            }}
          >
            <div className="absolute inset-0" style={{ backgroundColor: component.props.overlayColor || 'rgba(0,0,0,0.4)' }} />
            <div className="relative z-10 flex flex-col justify-center items-center h-full text-center p-4">
              <h2 className="text-xl font-bold text-white mb-2">{component.props.title}</h2>
              {component.props.subtitle && <p className="text-sm text-white/80 mb-4">{component.props.subtitle}</p>}
              {component.props.buttonText && (
                <button className="px-6 py-2 bg-white text-gray-900 rounded-full font-medium text-sm">
                  {component.props.buttonText}
                </button>
              )}
            </div>
          </div>
        );
        
      case "productGrid":
        return (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${component.props.columns || 2}, 1fr)` }}>
            {component.props.products?.slice(0, 4).map((product: any, i: number) => (
              <div key={i} className="bg-white rounded-lg border overflow-hidden">
                {product.image && (
                  <img src={product.image} alt={product.name} className="w-full h-24 object-cover" />
                )}
                <div className="p-2">
                  <p className="font-medium text-xs truncate">{product.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-bold text-green-600">{product.price}</p>
                    {product.rating && <span className="text-xs text-amber-500">★ {product.rating}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
        
      case "carousel":
        return (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {component.props.items?.map((item: any, i: number) => (
              <div key={i} className="flex-shrink-0 w-48 rounded-lg overflow-hidden bg-white border">
                {item.image && <img src={item.image} alt={item.title} className="w-full h-24 object-cover" />}
                <div className="p-2">
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        );
        
      case "testimonial":
        return (
          <div className="space-y-3">
            {component.props.reviews?.map((review: any, i: number) => (
              <div key={i} className="bg-white rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-2">
                  {review.avatar && <img src={review.avatar} alt="" className="w-8 h-8 rounded-full" />}
                  <div>
                    <p className="font-medium text-sm">{review.name}</p>
                    <div className="flex text-amber-500 text-xs">{'★'.repeat(review.rating || 5)}</div>
                  </div>
                </div>
                <p className="text-xs text-gray-600">"{review.text}"</p>
              </div>
            ))}
          </div>
        );
        
      case "stats":
        return (
          <div className="grid grid-cols-3 gap-3 p-3 bg-white rounded-lg">
            {component.props.items?.map((stat: any, i: number) => (
              <div key={i} className="text-center">
                <span className="text-lg">{stat.icon}</span>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        );
        
      case "team":
        return (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {component.props.members?.map((member: any, i: number) => (
              <div key={i} className="flex-shrink-0 text-center w-24">
                <img src={member.image} alt={member.name} className="w-16 h-16 rounded-full mx-auto object-cover" />
                <p className="font-medium text-xs mt-2 truncate">{member.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{member.role}</p>
              </div>
            ))}
          </div>
        );
        
      case "contactForm":
        return (
          <div className="space-y-3 p-3 bg-white rounded-lg border">
            {component.props.fields?.map((field: string, i: number) => (
              <input 
                key={i}
                type={field === 'email' ? 'email' : 'text'}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            ))}
            <button className="w-full py-2 bg-cyan-500 text-white rounded-lg font-medium text-sm">
              {component.props.submitText || 'Submit'}
            </button>
          </div>
        );
        
      case "socialLinks":
        return (
          <div className="flex justify-center gap-4 p-3">
            {component.props.links?.map((link: any, i: number) => (
              <div key={i} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">
                {link.platform === 'instagram' ? '📷' : 
                 link.platform === 'twitter' ? '🐦' :
                 link.platform === 'facebook' ? '📘' :
                 link.platform === 'youtube' ? '📺' : '🔗'}
              </div>
            ))}
          </div>
        );

      default:
        return <div className="p-4 bg-slate-100 rounded text-sm text-slate-500">{component.type}</div>;
    }
  };

  return (
    <div className={baseClass} onClick={onClick}>
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
      <div className="p-4 text-center text-slate-400">
        <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Select an element to edit</p>
      </div>
    );
  }

  const renderPropsEditor = () => {
    switch (component.type) {
      case "text":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Text Content</Label>
              <Textarea
                value={component.props.text}
                onChange={(e) => onUpdate({ ...component.props, text: e.target.value })}
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Font Size</Label>
              <Input
                type="number"
                value={component.props.fontSize}
                onChange={(e) => onUpdate({ ...component.props, fontSize: parseInt(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Text Color</Label>
              <div className="flex gap-2 mt-1">
                <input
                  type="color"
                  value={component.props.color}
                  onChange={(e) => onUpdate({ ...component.props, color: e.target.value })}
                  className="h-9 w-12 rounded cursor-pointer"
                />
                <Input value={component.props.color} onChange={(e) => onUpdate({ ...component.props, color: e.target.value })} className="font-mono text-sm" />
              </div>
            </div>
          </div>
        );
      case "heading":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Heading Text</Label>
              <Input value={component.props.text} onChange={(e) => onUpdate({ ...component.props, text: e.target.value })} className="mt-1" />
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
      default:
        return <div className="text-sm text-slate-500">Properties for {component.type}</div>;
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900 capitalize">{component.type}</span>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:text-red-600 hover:bg-red-50">
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
  const [editorMode, setEditorMode] = useState<"components" | "website">("website"); // Default to website view
  const [sidebarTab, setSidebarTab] = useState<"components" | "templates">("components");
  const [hasChanges, setHasChanges] = useState(false);
  const [showComponentTree, setShowComponentTree] = useState(true);

  // Fetch app data
  const { data: app, isLoading } = useQuery<any>({
    queryKey: [`/api/apps/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  // Load saved screens from app OR initialize from industry template
  useEffect(() => {
    if (app?.editorScreens && app.editorScreens.length > 0) {
      // Load existing screens from saved data
      setScreens(app.editorScreens);
    } else if (app?.industry && !app?.editorScreens?.length) {
      // No saved screens but has industry template - load the template
      const template = getTemplateById(app.industry);
      if (template) {
        // Clone template to get fresh IDs
        const clonedTemplate = cloneTemplate(template);
        // Convert template screens to editor screens
        const templateScreens: EditorScreen[] = clonedTemplate.screens.map((ts: TemplateScreen) => ({
          id: ts.id,
          name: ts.name,
          icon: ts.icon,
          isHome: ts.isHome,
          components: ts.components as EditorComponent[],
        }));
        setScreens(templateScreens);
        setHasChanges(true); // Mark as changed so user can save
      }
    }
  }, [app]);

  // Get active screen
  const activeScreen = screens.find(s => s.id === activeScreenId);
  
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
      children: ["container", "grid", "section", "form"].includes(type) ? [] : undefined,
    };

    setScreens(prev => prev.map(screen => 
      screen.id === activeScreenId 
        ? { ...screen, components: [...screen.components, newComponent] }
        : screen
    ));
    setSelectedComponentId(newComponent.id);
    setHasChanges(true);
  }, [activeScreen, activeScreenId]);

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

  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/apps/${id}/preview`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {/* Device Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <Button
              variant={deviceView === "mobile" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDeviceView("mobile")}
              className="h-8"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
            <Button
              variant={deviceView === "desktop" ? "default" : "ghost"}
              size="sm"
              onClick={() => setDeviceView("desktop")}
              className="h-8"
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>

          {/* Editor Mode Toggle - Website vs Components */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg ml-2">
            <Button
              variant={editorMode === "website" ? "default" : "ghost"}
              size="sm"
              onClick={() => setEditorMode("website")}
              className={`h-8 ${editorMode === "website" ? "bg-cyan-500 hover:bg-cyan-600" : ""}`}
            >
              <Globe className="h-4 w-4 mr-1" />
              <span className="text-xs">Website</span>
            </Button>
            <Button
              variant={editorMode === "components" ? "default" : "ghost"}
              size="sm"
              onClick={() => setEditorMode("components")}
              className={`h-8 ${editorMode === "components" ? "bg-purple-500 hover:bg-purple-600" : ""}`}
            >
              <Layout className="h-4 w-4 mr-1" />
              <span className="text-xs">Screens</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Visual Editor</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-900">{activeScreen?.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" title="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline"
            size="sm"
            onClick={() => window.open(`/live-preview/${id}`, "_blank")}
          >
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Components (only shown in components mode) */}
        <aside className={`w-64 bg-white border-r flex flex-col overflow-hidden shrink-0 ${editorMode === "website" ? "hidden" : ""}`}>
          <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 m-2 mb-0 rounded-lg shrink-0">
              <TabsTrigger value="components" className="text-xs">Components</TabsTrigger>
              <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
            </TabsList>
            
            <TabsContent value="components" className="flex-1 overflow-auto p-2 m-0">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase px-2 mb-2">Basic</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {BASIC_COMPONENTS.map((comp) => (
                      <button
                        key={comp.type}
                        onClick={() => addComponent(comp.type)}
                        className="flex flex-col items-center gap-1 p-3 rounded-lg border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50 transition-colors"
                      >
                        <comp.icon className="h-5 w-5 text-slate-600" />
                        <span className="text-xs text-slate-700">{comp.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase px-2 mb-2">Form</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {FORM_COMPONENTS.map((comp) => (
                      <button
                        key={comp.type}
                        onClick={() => addComponent(comp.type)}
                        className="flex flex-col items-center gap-1 p-3 rounded-lg border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50 transition-colors"
                      >
                        <comp.icon className="h-5 w-5 text-slate-600" />
                        <span className="text-xs text-slate-700">{comp.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase px-2 mb-2">Media</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {MEDIA_COMPONENTS.map((comp) => (
                      <button
                        key={comp.type}
                        onClick={() => addComponent(comp.type)}
                        className="flex flex-col items-center gap-1 p-3 rounded-lg border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50 transition-colors"
                      >
                        <comp.icon className="h-5 w-5 text-slate-600" />
                        <span className="text-xs text-slate-700">{comp.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="flex-1 overflow-auto p-2 m-0">
              <div className="space-y-2">
                {SECTION_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => addTemplate(template)}
                    className="w-full p-3 rounded-lg border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{template.preview}</span>
                      <span className="text-sm font-medium text-slate-700">{template.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Component Tree */}
          {showComponentTree && activeScreen && activeScreen.components.length > 0 && (
            <div className="border-t p-2 max-h-48 overflow-auto shrink-0">
              <div className="flex items-center justify-between px-2 mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Tree
                </h3>
              </div>
              <div className="space-y-0.5">
                {activeScreen.components.map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedComponentId(comp.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                      selectedComponentId === comp.id 
                        ? "bg-cyan-50 text-cyan-700 font-medium" 
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <GripVertical className="h-3 w-3 text-slate-400" />
                    <span className="capitalize">{comp.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Screens List */}
          <div className="border-t p-2 shrink-0">
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase">Screens</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addScreen}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {screens.map((screen) => (
                <button
                  key={screen.id}
                  onClick={() => { setActiveScreenId(screen.id); setSelectedComponentId(null); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    activeScreenId === screen.id 
                      ? "bg-cyan-50 text-cyan-700 font-medium" 
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{screen.icon}</span>
                  <span>{screen.name}</span>
                  {screen.isHome && <Badge className="ml-auto text-[10px] h-4" variant="secondary">Home</Badge>}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 overflow-auto p-8 flex items-start justify-center">
          {editorMode === "website" ? (
            /* Website Preview Mode - Shows actual website in mobile frame */
            <div className="flex flex-col items-center gap-4">
              {/* Mobile Device Frame */}
              <div className="relative mx-auto border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl">
                <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute z-10"></div>
                <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
                <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
                
                <div className="rounded-[2rem] overflow-hidden w-full h-full bg-white relative flex flex-col">
                  {/* Status Bar */}
                  <div className="h-7 bg-gray-900 flex items-center justify-between px-5 text-[10px] font-medium text-white select-none z-20 shrink-0">
                    <span>9:41</span>
                    <div className="flex gap-1 items-center">
                      <span className="ml-1">100%</span>
                    </div>
                  </div>

                  {/* App Header Bar */}
                  <div 
                    className="h-11 flex items-center justify-between px-4 shadow-md z-10 shrink-0"
                    style={{ backgroundColor: app?.primaryColor || "#2563EB" }}
                  >
                    <div className="text-white font-bold flex items-center gap-2 text-sm">
                      <span className="text-base">{app?.icon || "📱"}</span>
                      <span className="truncate max-w-[180px]">{app?.name || "My App"}</span>
                    </div>
                    <Menu className="w-5 h-5 text-white/80" />
                  </div>

                  {/* Website Content - Live iframe */}
                  <div className="flex-1 bg-white relative overflow-hidden">
                    {app?.url ? (
                      <iframe
                        src={app.url}
                        className="w-full h-full border-0"
                        title="Website Preview"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4">
                        <Globe className="h-10 w-10 mb-3 opacity-50" />
                        <p className="text-sm text-center">No website URL configured</p>
                        <p className="text-xs mt-1">Go to Settings to add your website URL</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Bottom Navigation */}
                  <div className="h-12 bg-white border-t border-gray-200 flex items-center justify-around px-4 shrink-0">
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5" style={{ color: app?.primaryColor || "#2563EB" }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                      </svg>
                    </div>
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* App name label */}
              <p className="text-sm text-slate-600 text-center font-medium">
                {app?.name || "My App"}
              </p>
              
              {/* Quick Info */}
              {app?.url && (
                <a 
                  href={app.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1"
                >
                  <Globe className="h-3 w-3" />
                  {app.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : (
            /* Component Editor Mode - Drag and drop components */
            <div 
              className={`bg-white rounded-2xl shadow-xl overflow-hidden transition-all ${
                deviceView === "mobile" ? "w-[375px]" : "w-full max-w-4xl"
              }`}
              style={{ minHeight: deviceView === "mobile" ? "667px" : "600px" }}
            >
              {/* Phone Header */}
              {deviceView === "mobile" && (
                <div 
                  className="h-12 flex items-center justify-between px-4"
                  style={{ backgroundColor: app?.primaryColor || "#1f2937" }}
                >
                  <Menu className="h-5 w-5 text-white" />
                  <span className="text-white font-medium text-sm">{activeScreen?.name}</span>
                  <MoreHorizontal className="h-5 w-5 text-white" />
                </div>
              )}

              {/* Content Area with Reorder */}
              <div className="p-4">
                {activeScreen && activeScreen.components.length > 0 ? (
                  <Reorder.Group 
                    axis="y" 
                    values={activeScreen.components} 
                    onReorder={handleReorder}
                    className="space-y-4"
                  >
                    {activeScreen.components.map((component) => (
                      <Reorder.Item 
                        key={component.id} 
                        value={component}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        <ComponentPreview
                          component={component}
                          isSelected={selectedComponentId === component.id}
                          onClick={() => setSelectedComponentId(component.id)}
                        />
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                ) : (
                  <div className="py-20 text-center text-slate-400">
                    <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Click a component to add it here</p>
                    <p className="text-xs mt-1">Or use a template to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Properties (only shown in components mode) */}
        <aside className={`w-72 bg-white border-l flex flex-col overflow-hidden shrink-0 ${editorMode === "website" ? "hidden" : ""}`}>
          <div className="p-3 border-b flex items-center gap-2 shrink-0">
            <Sparkles className="h-4 w-4 text-cyan-500" />
            <span className="text-sm font-semibold">Properties</span>
          </div>
          <ScrollArea className="flex-1">
            <PropertiesPanel
              component={selectedComponent}
              onUpdate={updateComponent}
              onDelete={deleteComponent}
            />
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
