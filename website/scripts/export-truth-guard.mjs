const EXPORT_CONTEXT = /\b(?:export|exporter|output|edited|finished|final|render|mp4)\w*\b/iu;
const UNSUPPORTED_OUTPUT = /\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu;
const HUMAN_EXPORT_TERM = /\b(?:export|exporter|output|edited|finished|final|render|mp4|ffmpeg|mediabunny|audio|sound|soundtrack|narration|format|container|codec|encoder|bitrate|profile)\w*\b/iu;

const normalize = (value) => value.replace(/\s+/gu, " ").trim();
const normalizeCodecDots = (value) => value
  .replace(/\bh\s*\.\s*265\b/giu, "H265")
  .replace(/\bh\s*\.\s*264\b/giu, "H264")
  .replace(/\.(webm|mkv|mov|avi|gif|flv|m4v|ogv)\b/giu, "$1");

function splitContrasts(statement) {
  if (/^although\b/iu.test(statement)) {
    const [first, ...rest] = statement.replace(/^although\s+/iu, "").split(/,\s*/u);
    if (rest.length > 0) return [first, rest.join(", ")];
  }

  return statement.split(/(?:,\s*|\s+)\b(?:but|however|yet|while|whereas|although|except)\b(?:\s+|,\s*)/iu);
}

function claimSegments(value) {
  const lines = normalizeCodecDots(value.replace(/<[^>]+>/gu, " ")).split(/\r?\n/u);
  const segments = [];
  let markdownExportSection = false;
  let exportHeadingLevel = null;

  for (const line of lines) {
    const normalizedLine = normalize(line);
    if (!normalizedLine) continue;

    const heading = normalizedLine.match(/^(#{1,6})\s+(.+)$/u);
    if (heading) {
      const headingLevel = heading[1].length;
      if (/\bexport\b/iu.test(heading[2])) {
        markdownExportSection = true;
        exportHeadingLevel = headingLevel;
      } else if (exportHeadingLevel === null || headingLevel <= exportHeadingLevel) {
        markdownExportSection = false;
        exportHeadingLevel = null;
      }
    }

    const statements = normalizedLine
      .split(/[.!?;]+/u)
      .map(normalize)
      .filter(Boolean);
    const lineTopics = {
      audio: /\b(?:audio|sound|soundtrack|narration|microphone|system\s+audio|timeline\s+audio)\b/iu.test(normalizedLine),
      ffmpeg: /\bffmpeg\b/iu.test(normalizedLine),
      selector: /\b(?:format|container|codec|encoder|bitrate|profile|audio|selector|selection|setting|option|control)\w*\b/iu.test(normalizedLine),
    };
    const lineExportContext = EXPORT_CONTEXT.test(normalizedLine);

    for (const statement of statements) {
      const inheritedExportContext = markdownExportSection
        || lineExportContext
        || EXPORT_CONTEXT.test(statement);

      for (const claim of splitContrasts(statement).map(normalize).filter(Boolean)) {
        segments.push({
          claim,
          exportContext: inheritedExportContext || EXPORT_CONTEXT.test(claim),
          topics: lineTopics,
        });
      }
    }
  }

  return segments;
}

function isFinalFfmpegDenied(claim) {
  const ffmpegFirst = /\bffmpeg\b.{0,180}\b(?:not|never|does\s+not|doesn't|do\s+not|don't|is\s+not|isn't|cannot|can't)\b.{0,100}\b(?:final|edited|finished|export|output|mp4|encoder|encoding|encode|mux|render|use)\w*/iu;
  const outputFirst = /\b(?:final|edited|finished|export|output|mp4)\w*\b.{0,180}\b(?:not|never|does\s+not|doesn't|do\s+not|don't|is\s+not|isn't|cannot|can't)\b.{0,100}\b(?:encod|mux|render|produc|creat|use)\w*\b.{0,100}\bffmpeg\b/iu;
  const denialFirst = /\b(?:not|never|does\s+not|doesn't|do\s+not|don't|cannot|can't)\b.{0,80}\b(?:use|invoke|employ)\w*\b.{0,60}\bffmpeg\b.{0,100}\b(?:final|edited|finished|export|output|mp4)\w*\b/iu;
  return ffmpegFirst.test(claim) || outputFirst.test(claim) || denialFirst.test(claim);
}

function hasExplicitRoleSeparation(claim) {
  return /\bffmpeg\b.{0,100}\b(?:record|recording|capture|native\s+media\s+utilit)\w*\b/iu.test(claim)
    && /\bmediabunny\b.{0,100}\b(?:encod|mux)\w*\b.{0,100}\b(?:final|edited|export|mp4)\w*\b/iu.test(claim)
    || /\bmediabunny\b.{0,100}\b(?:encod|mux)\w*\b.{0,100}\b(?:final|edited|export|mp4)\w*\b/iu.test(claim)
    && /\bffmpeg\b.{0,100}\b(?:record|recording|capture|native\s+media\s+utilit)\w*\b/iu.test(claim);
}

function isUnsupportedOutputDenied(claim) {
  const exporterFirst = /\b(?:export|exporter|exporting|output|edited|finished|final)\w*\b.{0,120}\b(?:does\s+not|doesn't|do\s+not|don't|never|cannot|can't)\b.{0,80}\b(?:support|offer|provide|produce|create|encode|mux|write|include|use)\w*\b.{0,80}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu;
  const denialFirst = /\b(?:does\s+not|doesn't|do\s+not|don't|never|cannot|can't)\b.{0,80}\b(?:export|support|offer|provide|produce|create|encode|mux|write|include|use)\w*\b.{0,80}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu;
  const outputFirst = /\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b.{0,100}\b(?:(?:is|are)\s+(?:not|never)\s+(?:supported|offered|available|exported|produced|encoded|muxed)|unsupported|unavailable)\b/iu;
  const excluded = /\b(?:export|exporter|exporting|output|edited|finished|final)\w*\b.{0,80}\b(?:exclude|omit)\w*\b.{0,80}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu;
  const noOutput = /\b(?:no|without)\b.{0,60}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b.{0,80}\b(?:export|output|support|option)\w*\b/iu;
  return exporterFirst.test(claim)
    || denialFirst.test(claim)
    || outputFirst.test(claim)
    || excluded.test(claim)
    || noOutput.test(claim);
}

function isSelectorDenied(claim) {
  const denialFirst = /\b(?:does\s+not|doesn't|do\s+not|don't|never|cannot|can't)\b.{0,50}\b(?:expose|offer|provide|support|include|allow|enable)\w*\b.{0,100}\b(?:format|container|codec|encoder|bitrate|profile|audio)\b/iu;
  const noSelector = /\b(?:no|without)\b.{0,100}\b(?:format|container|codec|encoder|bitrate|profile|audio)\b.{0,100}\b(?:selector|selection|picker|choice|option|control|setting|switch)\w*\b/iu;
  const selectorFirst = /\b(?:format|container|codec|encoder|bitrate|profile|audio)\b.{0,100}\b(?:selector|selection|picker|choice|option|control|setting|switch)\w*\b.{0,60}\b(?:(?:is|are)\s+(?:not|never)\s+(?:available|exposed|offered|supported|enabled)|unavailable|disabled)\b/iu;
  return denialFirst.test(claim) || noSelector.test(claim) || selectorFirst.test(claim);
}

function isAudioDenied(claim) {
  const noAudio = /\bvideo-only\b|\b(?:no|without)\b.{0,100}\b(?:audio|sound|soundtrack|narration|microphone|system\s+audio|timeline\s+audio)\b/iu;
  const audioFirst = /\b(?:audio|sound|soundtrack|narration|microphone|system\s+audio|timeline\s+audio)\b.{0,100}\b(?:is\s+not|are\s+not|isn't|aren't|never|not)\b.{0,60}\b(?:mux|mix|include|add|retain|carry|contain|export|have|enable)\w*\b/iu;
  const denialFirst = /\b(?:does\s+not|do\s+not|never|cannot|can't)\b.{0,60}\b(?:mux|mix|include|add|retain|carry|contain|export|have|enable)\w*\b.{0,100}\b(?:audio|sound|soundtrack|narration|microphone|system\s+audio|timeline\s+audio)\b/iu;
  return noAudio.test(claim) || audioFirst.test(claim) || denialFirst.test(claim);
}

export function extractJavaScriptStringLiterals(source) {
  return [...source.matchAll(/"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/gu)]
    .map((match) => normalize(match[0].slice(1, -1)));
}

export function extractExportCopyLiterals(source) {
  return extractJavaScriptStringLiterals(source)
    .filter((literal) => /\s/u.test(literal) && HUMAN_EXPORT_TERM.test(literal));
}

export function findExportTruthViolations(value) {
  const violations = [];

  for (const { claim, exportContext, topics } of claimSegments(value)) {
    const ffmpegSubject = /\bffmpeg\b/iu.test(claim)
      || (topics.ffmpeg && /\b(?:it|that\s+encoder|the\s+encoder)\b/iu.test(claim));
    const unscopedFfmpegEncoding = ffmpegSubject && /\b(?:encod|mux)\w*\b/iu.test(claim);
    if (!exportContext && !unscopedFfmpegEncoding) continue;

    if (
      ffmpegSubject
      && /\b(?:export|edited|finished|final|render|mp4|encod|mux)\w*\b/iu.test(claim)
      && !isFinalFfmpegDenied(claim)
      && !hasExplicitRoleSeparation(claim)
    ) {
      violations.push({ kind: "final-ffmpeg", claim });
    }

    if (UNSUPPORTED_OUTPUT.test(claim) && !isUnsupportedOutputDenied(claim)) {
      violations.push({ kind: "unsupported-output", claim });
    }

    const selectorClaim = /\b(?:choose|select|configure|pick|switch|set|adjust|change|support|offer|expose|provide|allow|available|option|control|selector|selection|picker|setting)\w*\b.{0,100}\b(?:format|container|codec|encoder|bitrate|profile|audio)\w*\b|\b(?:format|container|codec|encoder|bitrate|profile|audio)\w*\b.{0,100}\b(?:choose|select|configure|pick|switch|set|adjust|change|support|offer|expose|provide|allow|available|option|control|selector|selection|picker|setting)\w*\b/iu;
    const inheritedSelectorClaim = topics.selector
      && /\b(?:choose|select|configure|pick|switch|set|adjust|change)\w*\b.{0,80}\b(?:one|it|them)\b/iu.test(claim);
    if ((selectorClaim.test(claim) || inheritedSelectorClaim) && !isSelectorDenied(claim)) {
      violations.push({ kind: "unsupported-selector", claim });
    }

    const audioClaim = /\b(?:audio|sound|soundtrack|narration|microphone|system\s+audio|timeline\s+audio)\b.{0,100}\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|have|enable|yes|available|support)\w*\b|\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|has|have|with|enable|support)\w*\b.{0,100}\b(?:audio|sound|soundtrack|narration|microphone|system\s+audio|timeline\s+audio)\b/iu;
    const inheritedAudioClaim = topics.audio
      && (/\b(?:it|they|that\s+track|the\s+track)\b.{0,80}\b(?:mux|mix|include|add|retain|carry|contain|export|enable)\w*\b/iu.test(claim)
        || /\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|enable)\w*\b.{0,80}\b(?:it|they|that\s+track|the\s+track)\b/iu.test(claim)
        || /^(?:audio|sound|soundtrack|narration)\b.{0,24}$/iu.test(claim)
        || /\b(?:audio|sound|soundtrack|narration)\b.{0,50}\b(?:yes|enabled|included|available|supported)\b/iu.test(claim));
    if ((audioClaim.test(claim) || inheritedAudioClaim) && !isAudioDenied(claim) && !isSelectorDenied(claim)) {
      violations.push({ kind: "edited-export-audio", claim });
    }
  }

  return violations;
}
