/**
 * A GLB READER for the art's tests (stage 2e; shared since 4a): a model's JSON, what a glTF says it has,
 * and its binary chunk, the numbers, from the data URL Vite gives a `?inline` import.
 */

/** A file's name, without its folders. */
export const nameOf = (path: string) => path.replace(/^.*\//, '');

/** A GLB: its JSON (what a glTF says it has) and its binary chunk (the numbers). */
export function gltf(dataUrl: string) {
  const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB: it does not start with "glTF"');
  const length = view.getUint32(12, true);
  const binary = 20 + length + 8;
  return {
    size: bytes.length,
    /** An accessor's floats (an animation's keyframe values). */
    floats(
      index: number,
      json: {
        accessors: { bufferView?: number; byteOffset?: number; count: number; type: string; min?: number[]; max?: number[] }[];
        bufferViews: { byteOffset?: number }[];
      },
    ) {
      const a = json.accessors[index]!;
      const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] ?? 1;
      const start = binary + (json.bufferViews[a.bufferView!]!.byteOffset ?? 0) + (a.byteOffset ?? 0);
      return Array.from({ length: a.count * width }, (_, i) => view.getFloat32(start + i * 4, true));
    },
    json: JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length))) as {
      bufferViews: { byteOffset?: number }[];
      meshes: { primitives: { indices: number; material?: number; attributes: Record<string, number> }[] }[];
      accessors: { bufferView?: number; byteOffset?: number; count: number; type: string; min?: number[]; max?: number[] }[];
      materials?: unknown[];
      textures?: unknown[];
      nodes: { name?: string; mesh?: number; children?: number[]; rotation?: number[]; translation?: number[] }[];
      animations?: {
        name: string;
        channels: { sampler: number; target: { node: number; path: string } }[];
        samplers: { input: number; output: number }[];
      }[];
      scenes: { nodes: number[] }[];
    },
  };
}
