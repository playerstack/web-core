export interface IconProps {
  width?: number | string;
  height?: number | string;
}

export interface SvgElement {
  tag: 'path' | 'rect' | 'polygon' | 'circle' | 'g' | 'line';
  attrs: Record<string, string | number>;
  children?: SvgElement[];
}

export interface IconDescriptor {
  viewBox: string;
  fill?: string;
  elements: SvgElement[];
}
