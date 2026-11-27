import type { CSSProperties } from 'react'
import type { ConcreteThemePresetId } from '@toeic/shared'

interface FallingFlake {
  x: number
  size: number
  dur: number
  delay: number
  drift: number
  opacity: number
  crystal: boolean
}

interface TreeLight {
  x: number
  y: number
  r: number
  color: string
  dur: number
  delay: number
}

interface FireworkSpec {
  x: number
  y: number
  scale: number
  primary: string
  secondary: string
  dur: number
  delay: number
}

interface FallingPetal {
  x: number
  rx: number
  ry: number
  color: string
  dur: number
  delay: number
  drift: number
  opacity: number
}

interface RisingLantern {
  x: number
  y: number
  scale: number
  dur: number
  delay: number
  drift: number
  opacity: number
}

interface TwinkleStar {
  x: number
  y: number
  r: number
  color: string
  dur: number
  delay: number
}

interface BatSpec {
  y: number
  scale: number
  dur: number
  delay: number
}

const SNOWFLAKES: readonly FallingFlake[] = [
  { x: 74, size: 9, dur: 9.8, delay: -1.4, drift: 26, opacity: 0.92, crystal: true },
  { x: 138, size: 5.2, dur: 11.6, delay: -6.8, drift: -18, opacity: 0.85, crystal: false },
  { x: 196, size: 7.2, dur: 10.4, delay: -9.4, drift: 22, opacity: 0.9, crystal: false },
  { x: 248, size: 11.5, dur: 12.6, delay: -3.7, drift: -24, opacity: 0.95, crystal: true },
  { x: 294, size: 5.5, dur: 9.2, delay: -7.5, drift: 16, opacity: 0.86, crystal: false },
  { x: 344, size: 8.5, dur: 11.4, delay: -0.6, drift: 28, opacity: 0.92, crystal: true },
  { x: 392, size: 4.8, dur: 13.0, delay: -11.2, drift: -14, opacity: 0.82, crystal: false },
  { x: 446, size: 9.5, dur: 10.1, delay: -4.9, drift: 20, opacity: 0.92, crystal: true },
  { x: 498, size: 6.0, dur: 12.2, delay: -8.3, drift: -22, opacity: 0.88, crystal: false },
  { x: 548, size: 10.5, dur: 11.1, delay: -5.6, drift: 24, opacity: 0.94, crystal: true },
  { x: 598, size: 5.2, dur: 9.6, delay: -10.1, drift: -16, opacity: 0.84, crystal: false },
  { x: 648, size: 7.4, dur: 12.8, delay: -2.8, drift: 18, opacity: 0.9, crystal: false },
  { x: 694, size: 11.0, dur: 10.6, delay: -6.2, drift: -26, opacity: 0.96, crystal: true },
  { x: 742, size: 5.8, dur: 11.8, delay: -12.4, drift: 20, opacity: 0.86, crystal: false },
  { x: 786, size: 9.2, dur: 9.9, delay: -3.2, drift: -19, opacity: 0.94, crystal: true },
  { x: 834, size: 5.0, dur: 13.4, delay: -8.9, drift: 22, opacity: 0.84, crystal: false },
  { x: 882, size: 11.8, dur: 11.1, delay: -1.9, drift: -24, opacity: 0.96, crystal: true },
  { x: 928, size: 6.4, dur: 10.3, delay: -7.1, drift: 18, opacity: 0.88, crystal: false },
  { x: 976, size: 5.4, dur: 12.4, delay: -10.7, drift: -20, opacity: 0.84, crystal: false },
  { x: 1024, size: 9.8, dur: 9.7, delay: -4.4, drift: 25, opacity: 0.94, crystal: true },
  { x: 1072, size: 6.0, dur: 11.9, delay: -9.8, drift: -16, opacity: 0.86, crystal: false },
  { x: 1122, size: 10.6, dur: 10.9, delay: -5.1, drift: 21, opacity: 0.94, crystal: true },
  { x: 1170, size: 5.2, dur: 13.6, delay: -13.1, drift: -15, opacity: 0.84, crystal: false },
  { x: 1218, size: 8.8, dur: 11.2, delay: -1.2, drift: 24, opacity: 0.92, crystal: true },
  { x: 1266, size: 6.2, dur: 12.3, delay: -11.9, drift: -22, opacity: 0.88, crystal: false },
  { x: 1314, size: 9.4, dur: 10.5, delay: -0.9, drift: 19, opacity: 0.92, crystal: true },
  { x: 1362, size: 6.8, dur: 12.9, delay: -7.8, drift: -25, opacity: 0.88, crystal: false },
  { x: 1412, size: 10.0, dur: 9.4, delay: -6.5, drift: 22, opacity: 0.92, crystal: true },
  { x: 1462, size: 6.6, dur: 12.7, delay: -2.4, drift: -18, opacity: 0.88, crystal: false },
  { x: 1516, size: 9.0, dur: 10.4, delay: -9.0, drift: -14, opacity: 0.9, crystal: true },
  { x: 224, size: 6.8, dur: 11.6, delay: -14.1, drift: 20, opacity: 0.88, crystal: false },
  { x: 372, size: 12.0, dur: 13.2, delay: -2.1, drift: -22, opacity: 0.96, crystal: true },
  { x: 522, size: 7.0, dur: 8.9, delay: -13.8, drift: 26, opacity: 0.9, crystal: false },
  { x: 668, size: 8.6, dur: 10.2, delay: -15.0, drift: -18, opacity: 0.92, crystal: true },
  { x: 760, size: 7.4, dur: 9.1, delay: -5.4, drift: 16, opacity: 0.92, crystal: false },
  { x: 856, size: 10.4, dur: 11.5, delay: -12.8, drift: -20, opacity: 0.95, crystal: true },
  { x: 952, size: 6.5, dur: 9.5, delay: -3.9, drift: 22, opacity: 0.88, crystal: false },
  { x: 1098, size: 8.4, dur: 12.1, delay: -0.3, drift: -24, opacity: 0.92, crystal: true },
  { x: 1242, size: 7.2, dur: 10.8, delay: -8.1, drift: 18, opacity: 0.9, crystal: false },
  { x: 1388, size: 6.2, dur: 13.8, delay: -4.7, drift: -16, opacity: 0.86, crystal: false },
  { x: 468, size: 7.5, dur: 10.0, delay: -1.6, drift: -20, opacity: 0.9, crystal: false },
  { x: 1148, size: 7.2, dur: 9.8, delay: -6.9, drift: 22, opacity: 0.9, crystal: false },
]

const CHRISTMAS_LIGHTS_LIGHT: readonly TreeLight[] = [
  { x: 786, y: 292, r: 5.5, color: '#F59E0B', dur: 1.9, delay: -0.3 },
  { x: 816, y: 312, r: 5.5, color: '#EF4444', dur: 2.3, delay: -1.1 },
  { x: 768, y: 348, r: 6.0, color: '#3B82F6', dur: 2.1, delay: -0.7 },
  { x: 832, y: 365, r: 6.0, color: '#FACC15', dur: 2.6, delay: -1.6 },
  { x: 748, y: 405, r: 6.5, color: '#F43F5E', dur: 2.2, delay: -0.4 },
  { x: 800, y: 418, r: 6.5, color: '#10B981', dur: 2.7, delay: -1.9 },
  { x: 852, y: 432, r: 6.5, color: '#F59E0B', dur: 2.0, delay: -1.2 },
  { x: 730, y: 472, r: 7.0, color: '#3B82F6', dur: 2.5, delay: -0.8 },
  { x: 784, y: 492, r: 7.0, color: '#EF4444', dur: 1.9, delay: -1.4 },
  { x: 842, y: 505, r: 7.0, color: '#FACC15', dur: 2.4, delay: -0.2 },
  { x: 720, y: 556, r: 7.2, color: '#F59E0B', dur: 2.3, delay: -1.7 },
  { x: 874, y: 568, r: 7.2, color: '#F43F5E', dur: 2.1, delay: -0.9 },
  { x: 800, y: 356, r: 5.8, color: '#FDE047', dur: 2.0, delay: -0.5 },
  { x: 808, y: 538, r: 6.8, color: '#38BDF8', dur: 2.4, delay: -1.3 },
]

const CHRISTMAS_LIGHTS_DARK: readonly TreeLight[] = [
  { x: 782, y: 178, r: 5.5, color: '#FDE047', dur: 1.9, delay: -0.3 },
  { x: 822, y: 204, r: 5.5, color: '#F87171', dur: 2.3, delay: -1.1 },
  { x: 758, y: 248, r: 6.0, color: '#60A5FA', dur: 2.1, delay: -0.7 },
  { x: 842, y: 268, r: 6.0, color: '#FACC15', dur: 2.6, delay: -1.6 },
  { x: 736, y: 318, r: 6.5, color: '#FB7185', dur: 2.2, delay: -0.4 },
  { x: 802, y: 336, r: 6.5, color: '#34D399', dur: 2.7, delay: -1.9 },
  { x: 866, y: 354, r: 6.5, color: '#FDE047', dur: 2.0, delay: -1.2 },
  { x: 716, y: 404, r: 7.0, color: '#60A5FA', dur: 2.5, delay: -0.8 },
  { x: 788, y: 422, r: 7.0, color: '#F87171', dur: 1.9, delay: -1.4 },
  { x: 862, y: 442, r: 7.0, color: '#FACC15', dur: 2.4, delay: -0.2 },
  { x: 702, y: 502, r: 7.2, color: '#FDE047', dur: 2.3, delay: -1.7 },
  { x: 892, y: 518, r: 7.2, color: '#FB7185', dur: 2.1, delay: -0.9 },
  { x: 800, y: 256, r: 5.8, color: '#FEF08A', dur: 2.0, delay: -0.5 },
  { x: 805, y: 472, r: 6.8, color: '#38BDF8', dur: 2.4, delay: -1.3 },
]

const TET_FIREWORKS_DARK: readonly FireworkSpec[] = [
  { x: 340, y: 152, scale: 1.05, primary: '#FDE047', secondary: '#FB7185', dur: 5.4, delay: -0.2 },
  { x: 520, y: 112, scale: 0.95, primary: '#F43F5E', secondary: '#FDE047', dur: 5.8, delay: -1.1 },
  { x: 710, y: 132, scale: 1.12, primary: '#FACC15', secondary: '#34D399', dur: 4.9, delay: -2.2 },
  { x: 890, y: 108, scale: 1.0, primary: '#FB7185', secondary: '#38BDF8', dur: 5.6, delay: -3.1 },
  { x: 1080, y: 146, scale: 1.06, primary: '#34D399', secondary: '#FDE047', dur: 5.2, delay: -4.0 },
  { x: 1270, y: 124, scale: 0.92, primary: '#F472B6', secondary: '#FBBF24', dur: 6.1, delay: -5.0 },
]

const TET_FIREWORKS_LIGHT: readonly FireworkSpec[] = [
  { x: 340, y: 152, scale: 1.05, primary: '#E11D48', secondary: '#D97706', dur: 5.4, delay: -0.2 },
  { x: 520, y: 112, scale: 0.95, primary: '#DC2626', secondary: '#F59E0B', dur: 5.8, delay: -1.1 },
  { x: 710, y: 132, scale: 1.12, primary: '#D97706', secondary: '#059669', dur: 4.9, delay: -2.2 },
  { x: 890, y: 108, scale: 1.0, primary: '#DB2777', secondary: '#EA580C', dur: 5.6, delay: -3.1 },
  { x: 1080, y: 146, scale: 1.06, primary: '#059669', secondary: '#E11D48', dur: 5.2, delay: -4.0 },
  { x: 1270, y: 124, scale: 0.92, primary: '#EA580C', secondary: '#DB2777', dur: 6.1, delay: -5.0 },
]

const NATIONAL_FIREWORKS_DARK: readonly FireworkSpec[] = [
  { x: 380, y: 138, scale: 1.0, primary: '#FACC15', secondary: '#EF4444', dur: 5.6, delay: -0.6 },
  { x: 790, y: 105, scale: 1.12, primary: '#FDE047', secondary: '#F87171', dur: 5.1, delay: -2.4 },
  { x: 1210, y: 142, scale: 1.02, primary: '#FB7185', secondary: '#FACC15', dur: 5.9, delay: -4.1 },
]

const NATIONAL_FIREWORKS_LIGHT: readonly FireworkSpec[] = [
  { x: 380, y: 138, scale: 1.0, primary: '#DC2626', secondary: '#D97706', dur: 5.6, delay: -0.6 },
  { x: 790, y: 105, scale: 1.12, primary: '#E11D48', secondary: '#F59E0B', dur: 5.1, delay: -2.4 },
  { x: 1210, y: 142, scale: 1.02, primary: '#D97706', secondary: '#DC2626', dur: 5.9, delay: -4.1 },
]

const TET_PETALS: readonly FallingPetal[] = [
  { x: 110, rx: 6.5, ry: 3.8, color: '#FB7185', dur: 10.2, delay: -1.4, drift: 48, opacity: 0.9 },
  { x: 185, rx: 5.5, ry: 3.2, color: '#F43F5E', dur: 12.0, delay: -5.8, drift: 62, opacity: 0.85 },
  { x: 260, rx: 6.8, ry: 4.0, color: '#F472B6', dur: 9.8, delay: -8.2, drift: 42, opacity: 0.88 },
  { x: 335, rx: 5.8, ry: 3.4, color: '#FB7185', dur: 11.4, delay: -3.5, drift: 54, opacity: 0.86 },
  { x: 420, rx: 5.2, ry: 3.0, color: '#F9A8D4', dur: 12.8, delay: -9.7, drift: 38, opacity: 0.82 },
  { x: 510, rx: 6.0, ry: 3.5, color: '#F43F5E', dur: 10.6, delay: -2.9, drift: 44, opacity: 0.86 },
  { x: 595, rx: 5.4, ry: 3.2, color: '#FB7185', dur: 11.8, delay: -6.4, drift: 36, opacity: 0.84 },
  { x: 680, rx: 6.2, ry: 3.6, color: '#F472B6', dur: 10.1, delay: -4.1, drift: 40, opacity: 0.86 },
  { x: 755, rx: 5.8, ry: 3.4, color: '#F59E0B', dur: 11.2, delay: -7.6, drift: -36, opacity: 0.88 },
  { x: 845, rx: 6.0, ry: 3.5, color: '#FACC15', dur: 10.5, delay: -1.8, drift: -42, opacity: 0.9 },
  { x: 930, rx: 5.6, ry: 3.2, color: '#F59E0B', dur: 12.1, delay: -5.3, drift: -38, opacity: 0.86 },
  { x: 1020, rx: 6.4, ry: 3.8, color: '#FACC15', dur: 10.8, delay: -8.9, drift: -46, opacity: 0.9 },
  { x: 1110, rx: 5.5, ry: 3.2, color: '#FBBF24', dur: 11.7, delay: -3.1, drift: -50, opacity: 0.86 },
  { x: 1190, rx: 6.4, ry: 3.8, color: '#FACC15', dur: 10.4, delay: -2.2, drift: -46, opacity: 0.9 },
  { x: 1268, rx: 5.6, ry: 3.2, color: '#F59E0B', dur: 12.2, delay: -6.9, drift: -58, opacity: 0.86 },
  { x: 1345, rx: 6.6, ry: 4.0, color: '#FDE047', dur: 9.9, delay: -4.6, drift: -40, opacity: 0.9 },
  { x: 1428, rx: 5.8, ry: 3.4, color: '#FACC15', dur: 11.6, delay: -9.1, drift: -52, opacity: 0.85 },
  { x: 1508, rx: 5.2, ry: 3.0, color: '#F59E0B', dur: 12.9, delay: -11.3, drift: -36, opacity: 0.82 },
  { x: 142, rx: 5.8, ry: 3.4, color: '#F472B6', dur: 11.1, delay: -7.1, drift: 50, opacity: 0.84 },
  { x: 1390, rx: 6.0, ry: 3.6, color: '#FBBF24', dur: 10.9, delay: -0.7, drift: -48, opacity: 0.88 },
]

const SPRING_PETALS: readonly FallingPetal[] = [
  { x: 80, rx: 6.5, ry: 3.8, color: '#F472B6', dur: 10.4, delay: -1.1, drift: 56, opacity: 0.88 },
  { x: 155, rx: 5.5, ry: 3.2, color: '#FB7185', dur: 11.8, delay: -4.5, drift: 44, opacity: 0.82 },
  { x: 240, rx: 6.8, ry: 4.0, color: '#F43F5E', dur: 9.9, delay: -7.9, drift: 62, opacity: 0.88 },
  { x: 330, rx: 5.6, ry: 3.3, color: '#F9A8D4', dur: 12.5, delay: -2.8, drift: 48, opacity: 0.84 },
  { x: 425, rx: 6.0, ry: 3.5, color: '#FB7185', dur: 10.8, delay: -9.2, drift: 52, opacity: 0.84 },
  { x: 520, rx: 5.2, ry: 3.0, color: '#F472B6', dur: 13.0, delay: -6.1, drift: 40, opacity: 0.8 },
  { x: 635, rx: 6.4, ry: 3.7, color: '#FB7185', dur: 11.2, delay: -3.4, drift: 58, opacity: 0.86 },
  { x: 745, rx: 5.8, ry: 3.4, color: '#F472B6', dur: 12.2, delay: -10.5, drift: 46, opacity: 0.82 },
  { x: 860, rx: 6.2, ry: 3.6, color: '#F9A8D4', dur: 10.6, delay: -1.8, drift: 54, opacity: 0.86 },
  { x: 965, rx: 5.4, ry: 3.2, color: '#FB7185', dur: 11.6, delay: -5.3, drift: 42, opacity: 0.84 },
  { x: 1075, rx: 6.6, ry: 3.9, color: '#F43F5E', dur: 10.1, delay: -8.7, drift: 60, opacity: 0.88 },
  { x: 1185, rx: 5.8, ry: 3.4, color: '#F472B6', dur: 12.6, delay: -4.0, drift: 50, opacity: 0.82 },
  { x: 1295, rx: 6.0, ry: 3.5, color: '#FB7185', dur: 11.0, delay: -7.4, drift: 45, opacity: 0.86 },
  { x: 1395, rx: 6.4, ry: 3.7, color: '#F43F5E', dur: 11.4, delay: -2.2, drift: 56, opacity: 0.88 },
  { x: 1490, rx: 5.5, ry: 3.2, color: '#F9A8D4', dur: 12.1, delay: -9.8, drift: 44, opacity: 0.82 },
  { x: 1555, rx: 5.2, ry: 3.0, color: '#F472B6', dur: 10.5, delay: -6.7, drift: 38, opacity: 0.8 },
]

const AUTUMN_LEAVES: readonly FallingPetal[] = [
  { x: 90, rx: 8.5, ry: 4.5, color: '#F97316', dur: 11.0, delay: -1.5, drift: 64, opacity: 0.9 },
  { x: 195, rx: 7.5, ry: 4.0, color: '#EA580C', dur: 12.6, delay: -5.2, drift: -48, opacity: 0.85 },
  { x: 310, rx: 8.8, ry: 4.6, color: '#F59E0B', dur: 10.4, delay: -8.9, drift: 58, opacity: 0.88 },
  { x: 425, rx: 7.6, ry: 4.1, color: '#DC2626', dur: 13.2, delay: -3.1, drift: -52, opacity: 0.84 },
  { x: 540, rx: 8.0, ry: 4.2, color: '#F97316', dur: 11.6, delay: -10.4, drift: 46, opacity: 0.86 },
  { x: 675, rx: 7.2, ry: 3.8, color: '#FBBF24', dur: 12.1, delay: -4.7, drift: -42, opacity: 0.82 },
  { x: 810, rx: 8.4, ry: 4.5, color: '#EA580C', dur: 10.8, delay: -7.6, drift: 54, opacity: 0.88 },
  { x: 940, rx: 7.6, ry: 4.1, color: '#DC2626', dur: 12.8, delay: -2.0, drift: -56, opacity: 0.86 },
  { x: 1065, rx: 8.2, ry: 4.3, color: '#F59E0B', dur: 11.3, delay: -6.4, drift: 50, opacity: 0.88 },
  { x: 1190, rx: 7.4, ry: 3.9, color: '#F97316', dur: 12.4, delay: -9.5, drift: -46, opacity: 0.84 },
  { x: 1315, rx: 8.6, ry: 4.5, color: '#EA580C', dur: 10.6, delay: -3.8, drift: 60, opacity: 0.88 },
  { x: 1440, rx: 7.5, ry: 4.0, color: '#FBBF24', dur: 11.9, delay: -8.1, drift: -50, opacity: 0.86 },
  { x: 1535, rx: 7.8, ry: 4.1, color: '#DC2626', dur: 13.0, delay: -11.0, drift: 42, opacity: 0.82 },
]

const MID_AUTUMN_LANTERNS: readonly RisingLantern[] = [
  { x: 560, y: 690, scale: 0.9, dur: 15.0, delay: -2.4, drift: 26, opacity: 0.88 },
  { x: 670, y: 740, scale: 1.05, dur: 13.8, delay: -7.8, drift: -20, opacity: 0.92 },
  { x: 785, y: 720, scale: 0.8, dur: 16.4, delay: -12.1, drift: 18, opacity: 0.84 },
  { x: 910, y: 755, scale: 1.0, dur: 14.4, delay: -4.9, drift: -24, opacity: 0.9 },
  { x: 1035, y: 700, scale: 0.85, dur: 15.8, delay: -9.5, drift: 22, opacity: 0.86 },
  { x: 1160, y: 735, scale: 1.08, dur: 14.0, delay: -13.0, drift: -16, opacity: 0.92 },
  { x: 1285, y: 695, scale: 0.82, dur: 16.0, delay: -6.2, drift: 20, opacity: 0.85 },
]

const TWINKLE_STARS: readonly TwinkleStar[] = [
  { x: 140, y: 92, r: 2.8, color: '#FEF08A', dur: 2.6, delay: -0.4 },
  { x: 268, y: 148, r: 2.4, color: '#FFFFFF', dur: 3.2, delay: -1.7 },
  { x: 432, y: 78, r: 3.0, color: '#FDE68A', dur: 2.3, delay: -0.9 },
  { x: 590, y: 126, r: 2.2, color: '#FFFFFF', dur: 3.5, delay: -2.3 },
  { x: 745, y: 68, r: 2.8, color: '#FEF08A', dur: 2.8, delay: -1.2 },
  { x: 930, y: 84, r: 2.6, color: '#FFFFFF', dur: 2.5, delay: -2.0 },
  { x: 1110, y: 118, r: 3.0, color: '#FDE68A', dur: 3.1, delay: -0.6 },
  { x: 1265, y: 72, r: 2.4, color: '#FFFFFF', dur: 2.7, delay: -1.5 },
  { x: 1418, y: 136, r: 2.8, color: '#FEF08A', dur: 3.3, delay: -2.6 },
  { x: 1510, y: 86, r: 2.2, color: '#FFFFFF', dur: 2.4, delay: -0.2 },
]

const HALLOWEEN_BATS: readonly BatSpec[] = [
  { y: 155, scale: 1.05, dur: 13.5, delay: -2.0 },
  { y: 215, scale: 0.82, dur: 16.0, delay: -8.5 },
  { y: 118, scale: 0.92, dur: 14.8, delay: -11.2 },
  { y: 268, scale: 0.74, dur: 17.5, delay: -5.4 },
  { y: 185, scale: 0.88, dur: 15.2, delay: -13.6 },
]

const SUMMER_MOTES: readonly RisingLantern[] = [
  { x: 190, y: 620, scale: 0.95, dur: 14.0, delay: -2.0, drift: 24, opacity: 0.68 },
  { x: 365, y: 680, scale: 1.15, dur: 15.5, delay: -6.5, drift: -18, opacity: 0.62 },
  { x: 540, y: 640, scale: 0.85, dur: 13.5, delay: -10.2, drift: 20, opacity: 0.64 },
  { x: 760, y: 700, scale: 1.05, dur: 15.0, delay: -4.1, drift: -22, opacity: 0.6 },
  { x: 980, y: 650, scale: 1.2, dur: 14.4, delay: -8.8, drift: 18, opacity: 0.66 },
  { x: 1190, y: 690, scale: 0.9, dur: 16.0, delay: -12.7, drift: -16, opacity: 0.62 },
  { x: 1390, y: 630, scale: 1.1, dur: 13.8, delay: -3.3, drift: 22, opacity: 0.66 },
]

function fxStyle(vars: Record<string, string>): CSSProperties {
  return vars as CSSProperties
}

function Firework({ spec }: { spec: FireworkSpec }) {
  const rays = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5]
  return (
    <g transform={`translate(${spec.x} ${spec.y}) scale(${spec.scale})`}>
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="46"
        stroke={spec.primary}
        strokeWidth="3.5"
        strokeLinecap="round"
        className="fx-firework-trail"
        style={fxStyle({
          '--fx-dur': `${spec.dur}s`,
          '--fx-delay': `${spec.delay}s`,
        })}
      />
      <g
        className="fx-firework-burst"
        style={fxStyle({
          '--fx-dur': `${spec.dur}s`,
          '--fx-delay': `${spec.delay}s`,
        })}
      >
        <circle r="38" fill={spec.primary} opacity="0.22" />
        <circle r="11" fill="#FFFFFF" opacity="0.95" />
        {rays.map((deg, idx) => {
          const rad = (deg * Math.PI) / 180
          const outer = idx % 2 === 0 ? 64 : 46
          const x1 = Math.cos(rad) * 14
          const y1 = Math.sin(rad) * 14
          const x2 = Math.cos(rad) * outer
          const y2 = Math.sin(rad) * outer
          const stroke = idx % 2 === 0 ? spec.primary : spec.secondary
          return (
            <g key={deg}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={idx % 2 === 0 ? '3.4' : '2.4'} strokeLinecap="round" />
              <circle cx={x2} cy={y2} r={idx % 2 === 0 ? '3.6' : '2.6'} fill="#FFFFFF" stroke={stroke} strokeWidth="1.2" />
            </g>
          )
        })}
      </g>
    </g>
  )
}

function SnowLayer({ count, dark }: { count: number; dark: boolean }) {
  const haloStroke = dark ? '#BAE6FD' : '#38BDF8'
  const haloOpacity = dark ? 0.45 : 0.72

  return (
    <g>
      {SNOWFLAKES.slice(0, count).map((flake, i) => (
        <g key={i} transform={`translate(${flake.x} 0)`}>
          <g
            className="fx-snow-fall"
            style={fxStyle({
              '--fx-dur': `${flake.dur}s`,
              '--fx-delay': `${flake.delay}s`,
              '--fx-drift': `${flake.drift}px`,
              '--fx-opacity': `${flake.opacity}`,
            })}
          >
            {flake.crystal ? (
              <g>
                <g stroke={haloStroke} strokeWidth="3.2" strokeLinecap="round" opacity={haloOpacity}>
                  <line x1={-flake.size} y1="0" x2={flake.size} y2="0" />
                  <line x1={-flake.size * 0.5} y1={-flake.size * 0.86} x2={flake.size * 0.5} y2={flake.size * 0.86} />
                  <line x1={-flake.size * 0.5} y1={flake.size * 0.86} x2={flake.size * 0.5} y2={-flake.size * 0.86} />
                </g>
                <g stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round">
                  <line x1={-flake.size} y1="0" x2={flake.size} y2="0" />
                  <line x1={-flake.size * 0.5} y1={-flake.size * 0.86} x2={flake.size * 0.5} y2={flake.size * 0.86} />
                  <line x1={-flake.size * 0.5} y1={flake.size * 0.86} x2={flake.size * 0.5} y2={-flake.size * 0.86} />
                  <circle r="2.2" fill="#FFFFFF" stroke="none" />
                </g>
              </g>
            ) : (
              <circle
                r={flake.size}
                fill="#FFFFFF"
                stroke={haloStroke}
                strokeWidth={dark ? 0.8 : 1.4}
                strokeOpacity={haloOpacity}
              />
            )}
          </g>
        </g>
      ))}
    </g>
  )
}

function PetalLayer({ items }: { items: readonly FallingPetal[] }) {
  return (
    <g>
      {items.map((petal, i) => (
        <g key={i} transform={`translate(${petal.x} 0)`}>
          <g
            className="fx-petal-fall"
            style={fxStyle({
              '--fx-dur': `${petal.dur}s`,
              '--fx-delay': `${petal.delay}s`,
              '--fx-drift': `${petal.drift}px`,
              '--fx-opacity': `${petal.opacity}`,
            })}
          >
            <ellipse rx={petal.rx} ry={petal.ry} fill={petal.color} />
          </g>
        </g>
      ))}
    </g>
  )
}

/**
 * Login-only animated SVG overlay aligned 1:1 (`1600x900`) with the illustrated theme backdrops.
 */
export function ThemeEffects({ preset, dark }: { preset: ConcreteThemePresetId; dark: boolean }) {
  const starY = dark ? 122 : 240
  const lights = dark ? CHRISTMAS_LIGHTS_DARK : CHRISTMAS_LIGHTS_LIGHT
  const tetFireworks = dark ? TET_FIREWORKS_DARK : TET_FIREWORKS_LIGHT
  const nationalFireworks = dark ? NATIONAL_FIREWORKS_DARK : NATIONAL_FIREWORKS_LIGHT

  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
    >
      <defs>
        <radialGradient id="fx-gold-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFBEB" stopOpacity="1" />
          <stop offset="35%" stopColor="#FACC15" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fx-moon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.54" />
          <stop offset="60%" stopColor="#FDE68A" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fx-lantern-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#FB923C" stopOpacity="0.78" />
          <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
        </radialGradient>
      </defs>

      {preset === 'christmas' ? (
        <g>
          {/* Glowing & twinkling star atop the central Christmas tree */}
          <g transform={`translate(800 ${starY})`}>
            <circle r="92" fill="url(#fx-gold-glow)" className="fx-star-pulse" />
            <g className="fx-star-rays" strokeLinecap="round">
              <g stroke="#F59E0B" strokeWidth="4.2" opacity="0.65">
                <line x1="-54" y1="0" x2="54" y2="0" />
                <line x1="0" y1="-54" x2="0" y2="54" />
                <line x1="-36" y1="-36" x2="36" y2="36" />
                <line x1="-36" y1="36" x2="36" y2="-36" />
              </g>
              <g stroke="#FEF08A" strokeWidth="2.4">
                <line x1="-52" y1="0" x2="52" y2="0" />
                <line x1="0" y1="-52" x2="0" y2="52" />
                <line x1="-34" y1="-34" x2="34" y2="34" />
                <line x1="-34" y1="34" x2="34" y2="-34" />
              </g>
            </g>
            <polygon
              points="0,-24 5,-5 24,0 5,5 0,24 -5,5 -24,0 -5,-5"
              fill="#FFFBEB"
              stroke={dark ? '#FDE047' : '#F59E0B'}
              strokeWidth="1.6"
              className="fx-star-pulse"
            />
          </g>

          {/* Twinkling lights across the Christmas tree */}
          {lights.map((light, i) => (
            <g key={i} transform={`translate(${light.x} ${light.y})`}>
              <g
                className="fx-flicker"
                style={fxStyle({
                  '--fx-dur': `${light.dur}s`,
                  '--fx-delay': `${light.delay}s`,
                })}
              >
                <circle r={light.r * 2.8} fill={light.color} opacity="0.45" />
                <line x1={-light.r * 1.9} y1="0" x2={light.r * 1.9} y2="0" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="0" y1={-light.r * 1.9} x2="0" y2={light.r * 1.9} stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
                <circle r={light.r} fill="#FFFFFF" stroke={light.color} strokeWidth="1.4" />
              </g>
            </g>
          ))}

          <SnowLayer count={42} dark={dark} />
        </g>
      ) : null}

      {preset === 'winter' ? <SnowLayer count={38} dark={dark} /> : null}

      {preset === 'tet' ? (
        <g>
          {tetFireworks.map((fw, i) => (
            <Firework key={i} spec={fw} />
          ))}
          <PetalLayer items={TET_PETALS} />
          <circle
            cx="295"
            cy="332"
            r="38"
            fill="url(#fx-lantern-glow)"
            className="fx-flicker"
            style={fxStyle({ '--fx-dur': '3.4s', '--fx-delay': '-0.5s' })}
          />
          <circle
            cx="1305"
            cy="332"
            r="38"
            fill="url(#fx-lantern-glow)"
            className="fx-flicker"
            style={fxStyle({ '--fx-dur': '3.8s', '--fx-delay': '-1.8s' })}
          />
        </g>
      ) : null}

      {preset === 'spring' ? <PetalLayer items={SPRING_PETALS} /> : null}

      {preset === 'autumn' ? <PetalLayer items={AUTUMN_LEAVES} /> : null}

      {preset === 'mid_autumn' ? (
        <g>
          <circle cx="328" cy="148" r="145" fill="url(#fx-moon-glow)" className="fx-star-pulse" />
          {TWINKLE_STARS.map((star, i) => (
            <circle
              key={i}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill={star.color}
              className="fx-flicker"
              style={fxStyle({ '--fx-dur': `${star.dur}s`, '--fx-delay': `${star.delay}s` })}
            />
          ))}
          {MID_AUTUMN_LANTERNS.map((lantern, i) => (
            <g key={i} transform={`translate(${lantern.x} ${lantern.y})`}>
              <g
                className="fx-lantern-rise"
                style={fxStyle({
                  '--fx-dur': `${lantern.dur}s`,
                  '--fx-delay': `${lantern.delay}s`,
                  '--fx-drift': `${lantern.drift}px`,
                  '--fx-opacity': `${lantern.opacity}`,
                })}
              >
                <g transform={`scale(${lantern.scale})`}>
                  <circle r="26" fill="url(#fx-lantern-glow)" />
                  <path
                    d="M-10 -12 C-12 -18, 12 -18, 10 -12 L8 10 C6 14, -6 14, -8 10 Z"
                    fill="#FB923C"
                    stroke="#FDE68A"
                    strokeWidth="1.4"
                  />
                  <ellipse cx="0" cy="7" rx="5" ry="3" fill="#FEF08A" />
                </g>
              </g>
            </g>
          ))}
        </g>
      ) : null}

      {preset === 'halloween' ? (
        <g>
          <circle cx="800" cy="325" r="240" fill="url(#fx-moon-glow)" className="fx-star-pulse" />
          {HALLOWEEN_BATS.map((bat, i) => (
            <g key={i} transform={`translate(0 ${bat.y})`}>
              <g
                className="fx-bat-glide"
                style={fxStyle({
                  '--fx-dur': `${bat.dur}s`,
                  '--fx-delay': `${bat.delay}s`,
                })}
              >
                <path
                  d="M-24 4 Q-12 -10 -3 -2 L0 -6 L3 -2 Q12 -10 24 4 Q12 -1 4 4 L0 8 L-4 4 Q-12 -1 -24 4 Z"
                  fill={dark ? '#0F172A' : '#1E1B4B'}
                  transform={`scale(${bat.scale})`}
                />
              </g>
            </g>
          ))}
          <circle
            cx="215"
            cy="775"
            r="30"
            fill="url(#fx-lantern-glow)"
            className="fx-flicker"
            style={fxStyle({ '--fx-dur': '2.4s', '--fx-delay': '-0.6s' })}
          />
          <circle
            cx="1385"
            cy="775"
            r="30"
            fill="url(#fx-lantern-glow)"
            className="fx-flicker"
            style={fxStyle({ '--fx-dur': '2.8s', '--fx-delay': '-1.4s' })}
          />
        </g>
      ) : null}

      {preset === 'liberation' ? (
        <g>
          <PetalLayer
            items={SPRING_PETALS.slice(0, 14).map((p, idx) => ({
              ...p,
              rx: 6.8,
              ry: 3.6,
              color: idx % 3 === 0 ? '#EF4444' : idx % 3 === 1 ? '#F59E0B' : '#3B82F6',
            }))}
          />
          {TWINKLE_STARS.slice(0, 6).map((star, i) => (
            <circle
              key={i}
              cx={star.x}
              cy={star.y + 30}
              r={star.r + 1.2}
              fill="#FACC15"
              className="fx-flicker"
              style={fxStyle({ '--fx-dur': `${star.dur}s`, '--fx-delay': `${star.delay}s` })}
            />
          ))}
        </g>
      ) : null}

      {preset === 'national_day' ? (
        <g>
          {nationalFireworks.map((fw, i) => (
            <Firework key={i} spec={fw} />
          ))}
          {TWINKLE_STARS.slice(0, 8).map((star, i) => (
            <circle
              key={i}
              cx={star.x}
              cy={star.y}
              r={star.r + 1}
              fill="#FACC15"
              className="fx-flicker"
              style={fxStyle({ '--fx-dur': `${star.dur}s`, '--fx-delay': `${star.delay}s` })}
            />
          ))}
        </g>
      ) : null}

      {preset === 'summer' ? (
        <g>
          <circle cx="1320" cy="140" r="195" fill="url(#fx-moon-glow)" className="fx-star-pulse" />
          {SUMMER_MOTES.map((mote, i) => (
            <g key={i} transform={`translate(${mote.x} ${mote.y})`}>
              <circle
                r={8.5 * mote.scale}
                fill="#FDE047"
                className="fx-lantern-rise"
                style={fxStyle({
                  '--fx-dur': `${mote.dur}s`,
                  '--fx-delay': `${mote.delay}s`,
                  '--fx-drift': `${mote.drift}px`,
                  '--fx-opacity': `${mote.opacity}`,
                })}
              />
            </g>
          ))}
        </g>
      ) : null}

      {preset === 'classic' ? (
        <g>
          {TWINKLE_STARS.map((star, i) => (
            <circle
              key={i}
              cx={star.x}
              cy={star.y}
              r={star.r + 0.8}
              fill={dark ? '#93C5FD' : '#3B82F6'}
              className="fx-flicker"
              style={fxStyle({ '--fx-dur': `${star.dur}s`, '--fx-delay': `${star.delay}s` })}
            />
          ))}
        </g>
      ) : null}
    </svg>
  )
}
