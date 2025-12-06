import * as THREE from 'three';

export enum OrnamentType {
  CUBE = 'CUBE',
  SPHERE = 'SPHERE',
  STOCKING = 'STOCKING',
  GINGERBREAD = 'GINGERBREAD',
  SANTA = 'SANTA'
}

export enum MaterialStyle {
  GOLD = 'GOLD',
  EMERALD = 'EMERALD',
  PEARL = 'PEARL',
  OBSIDIAN = 'OBSIDIAN',
  SILVER = 'SILVER',
  LEAF = 'LEAF',
  RUBY = 'RUBY',
  MATTE_RED = 'MATTE_RED',
  COOKIE = 'COOKIE',
  FLEECE = 'FLEECE'
}

export interface TreeItemData {
  id: string;
  // Dual coordinate system
  treePosition: [number, number, number]; 
  scatterPosition: [number, number, number];
  treeRotation: [number, number, number];
  scatterRotation: [number, number, number];
  
  scale: number;
  type: OrnamentType;
  style: MaterialStyle;
  isStatic?: boolean;
}

export interface OrnamentProps {
  data: TreeItemData;
  isTreeForm: boolean; // Controls the morph state
  onHover: (id: string | null) => void;
}