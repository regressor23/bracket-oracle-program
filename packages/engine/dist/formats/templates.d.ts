import type { FormatTemplate } from './schema.js';
export declare const theInternational: FormatTemplate;
export declare const pglWallachia: FormatTemplate;
export declare const blastSlam: FormatTemplate;
/**
 * Version 2 (3 November 2026): every Stage 3 series is Bo3, as at IEM Cologne Major 2026 and PGL
 * Major Singapore 2026. Version 1 had Bo1 for series that neither advance nor eliminate, as at
 * StarLadder Budapest Major 2025; the replay fixture of that Major keeps version 1.
 */
export declare const cs2Major: FormatTemplate;
export declare const lolWorlds: FormatTemplate;
export declare const lolMsi: FormatTemplate;
export declare const FORMAT_TEMPLATES: readonly FormatTemplate[];
export declare function getFormatTemplate(id: string): FormatTemplate | undefined;
//# sourceMappingURL=templates.d.ts.map