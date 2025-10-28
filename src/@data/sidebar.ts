import { SidebarElements } from '@/types/interfaces';

const sidebar: SidebarElements[] = [
  {
    id: 12,
    image: '/svg/line.svg',
    title: 'Reference Line',
    type: 'spatial',
  },
  {
    id: 14,
    image: '/images/origin.png',
    title: 'Origin',
    type: 'spatial',
  },
  {
    id: 1,
    image: '/images/circle.png',
    title: 'Recessed',
    type: 'lighting',
  },
  {
    id: 2,
    image: '/images/arrow-out-circle.png',
    title: 'Step',
    type: 'lighting',
  },
  {
    id: 6,
    image: '/images/double-bar.png',
    title: 'Strip',
    type: 'lighting',
  },
  {
    id: 4,
    image: '/images/arrow-right.png',
    title: 'Spot',
    type: 'lighting',
  },
  {
    id: 5,
    image: '/images/single-bar.png',
    title: 'Pendant',
    type: 'lighting',
  },
  {
    id: 8,
    image: '/images/x-switch.png',
    title: 'Pendant',
    type: 'lighting',
  },
  {
    id: 15,
    image: '/images/sconce-vertical.png',
    title: 'Sconce Vertical',
    type: 'lighting',
  },
  {
    id: 16,
    image: '/images/sconce-directional.png',
    title: 'Sconce Directional',
    type: 'lighting',
  },
  {
    id: 17,
    image: '/images/sconce-wash.png',
    title: 'Sconce Wash',
    type: 'lighting',
  },
  {
    id: 18,
    image: '/images/chandelier.png',
    title: 'Chandelier',
    type: 'lighting',
  },

  {
    id: 3,
    image: '/images/arrow-in-circle.png',
    title: 'Presence Sensor',
    type: 'control',
  },
  {
    id: 7,
    image: '/images/d-switch.png',
    title: 'Dimming Engine',
    type: 'control',
  },
  {
    id: 13,
    image: '/images/dimmer.png',
    title: 'Dimmer',
    type: 'control',
  },
  {
    id: 10,
    image: '/svg/polygon.svg',
    title: 'Zone',
    type: 'control',
  },
  {
    id: 11,
    image: '/svg/line.svg',
    title: 'Boundary',
    type: 'control',
  },
];

// Function to get name/title by ID
export const getNameById = (id: number): string => {
  const item = sidebar.find(element => element.id === id);
  return item ? item.title : '';
};

// Function to get full sidebar item by ID
export const getItemById = (id: number): SidebarElements | undefined => {
  return sidebar.find(element => element.id === id);
};

export default sidebar;
