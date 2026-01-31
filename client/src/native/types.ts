export type NativeComponent = {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: NativeComponent[];
};

export type NativeScreen = {
  id: string;
  name: string;
  icon: string;
  isHome?: boolean;
  components: NativeComponent[];
};

export type NativeActionHandler = (action: string, payload?: any) => void;

export type NativeRenderContext = {
  themeColor: string;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  onAction: NativeActionHandler;
};
