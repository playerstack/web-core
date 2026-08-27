import type { IconDescriptor } from '@typings/icons.types';

export const mobileCloseIcon: IconDescriptor = {
  viewBox: '0 0 24 24',
  fill: 'none',
  elements: [
    {
      tag: 'line',
      attrs: {
        x1: '18',
        y1: '6',
        x2: '6',
        y2: '18',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    {
      tag: 'line',
      attrs: {
        x1: '6',
        y1: '6',
        x2: '18',
        y2: '18',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
  ],
};
