/**
 * THE LAB KIT (decision 0021; the curriculum's §4.2): what the tutorial's live figures share, so each
 * lesson's code keeps only its idea. A lesson imports it like any library: `import { createLab } from 'lab'`.
 * It grows with the curriculum.
 */
export { createLab, type Lab, type LabOptions } from './lab';
export { arrow, point, line, circle, plane, frame, axes, type Arrow } from './draw';
export { draggable } from './drag';
export { numbers } from './numbers';
export { rayPlane, centreShift, type V3 } from './geometry';
export type { Label } from './labels';
