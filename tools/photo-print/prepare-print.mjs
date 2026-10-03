import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, chmod } from 'node:fs/promises';

const exec = promisify(execFile);
const run = async args => (await exec('/usr/bin/sips', args, {timeout:20000,maxBuffer:1048576})).stdout;
const dimensions = async file => {
  const info = await run(['-g','pixelWidth','-g','pixelHeight',file]);
  const width = Number(/pixelWidth:\s*(\d+)/.exec(info)?.[1]);
  const height = Number(/pixelHeight:\s*(\d+)/.exec(info)?.[1]);
  if (!width || !height) throw new Error('Invalid print image dimensions.');
  return {width,height};
};

export function safePrintLayout(width,height,orientation,marginMm=4) {
  const landscape = orientation === 'landscape';
  if (!['portrait','landscape'].includes(orientation) ||
      !Number.isFinite(marginMm) || marginMm < 3 || marginMm > 8 ||
      width !== (landscape?1748:1181) || height !== (landscape?1181:1748))
    throw new Error('Invalid postcard safe-area configuration.');
  const insetX = Math.ceil(width*marginMm/(landscape?148:100));
  const insetY = Math.ceil(height*marginMm/(landscape?100:148));
  const scale = Math.min((width-2*insetX)/width,(height-2*insetY)/height);
  return {width,height,innerWidth:Math.floor(width*scale),innerHeight:Math.floor(height*scale)};
}

// Printer-specific safe area applied to the entire immutable JPEG, including
// frame/text/photo. Native macOS tools keep the installed worker dependency-free.
// Stored server images and guest crop/filter snapshots are preserved.
export async function preparePrintFile(input,output,orientation,config={}) {
  const color = config.print_background || 'FBF5EB';
  if (!/^[0-9a-f]{6}$/i.test(color)) throw new Error('Invalid print background.');
  const size = await dimensions(input);
  const layout = safePrintLayout(size.width,size.height,orientation,config.safe_margin_mm ?? 4);
  await copyFile(input,output); await chmod(output,0o600);
  await run(['--resampleHeightWidth',String(layout.innerHeight),String(layout.innerWidth),
    '-s','formatOptions','best',output]);
  await run(['--padToHeightWidth',String(layout.height),String(layout.width),'--padColor',color,
    '-s','dpiHeight','300','-s','dpiWidth','300','-s','formatOptions','best',output]);
  // sips replaces the file and resets permissions on macOS.
  await chmod(output,0o600);
  const result = await dimensions(output);
  if (result.width !== layout.width || result.height !== layout.height)
    throw new Error('Print safe-area output size mismatch.');
  return output;
}
