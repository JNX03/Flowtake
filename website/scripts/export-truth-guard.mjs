const EXPORT_CONTEXT = /\b(?:export|exporter|output|edited|finished|final|render|writ|save|deliver|generate|download|convert|return|mp4)\w*\b/iu;
const UNSUPPORTED_OUTPUT = /\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu;
const HUMAN_EXPORT_TERM = /\b(?:export|exporter|output|edited|finished|final|render|mp4|ffmpeg|mediabunny|audio|sound|soundtrack|narration|voiceover|format|container|codec|encoder|bitrate|profile)\w*\b/iu;
const POSITIVE_OUTPUT_CAPABILITY = /\b(?:exports|exporting|outputs|outputting|support|offer|provide|produce|create|encode|mux|render|write|save|deliver|generate|accept|include|allow|enable|select|choose|switch|adjust|change|let|download|convert|return|have|has|available|exportable)\w*\b/iu;
const NEGATION = /\b(?:no|not(?!\s+only\b)|never|cannot|can't|doesn't|does\s+not|don't|do\s+not|isn't|is\s+not|aren't|are\s+not)\b/iu;
const MAX_PUBLIC_COPY_LITERAL_LENGTH = 1000;

const normalize = (value) => value.replace(/\s+/gu, " ").trim();
const normalizeCodecDots = (value) => value
  .replace(/\bh\s*\.\s*265\b/giu, "H265")
  .replace(/\bh\s*\.\s*264\b/giu, "H264")
  .replace(/\.(webm|mkv|mov|avi|gif|flv|m4v|ogv)\b/giu, "$1");

function startsPositiveOutputClause(value) {
  const claim = normalize(value).replace(/^[“”"'‘’]\s*/u, "");
  const positiveOutputPredicate = UNSUPPORTED_OUTPUT.test(claim)
    && (/\b(?:is|are)\s+(?:an?\s+)?(?:output\s+)?(?:option|choice)\b/iu.test(claim)
      || /\boutput\s+(?:exists?|is\s+available)\b/iu.test(claim));
  if (positiveOutputPredicate && !NEGATION.test(claim)) return true;

  const modalCapability = claim.match(
    /\b(?:can|will|may|able\s+to)\s+(?:be\s+)?(?:export|support|offer|provide|produce|create|encode|mux|render|write|save|deliver|generate|accept|include|allow|enable)\w*\b/iu,
  );
  if (
    modalCapability
    && modalCapability.index <= 96
    && !NEGATION.test(claim.slice(0, modalCapability.index))
  ) {
    return true;
  }

  const capability = claim.match(POSITIVE_OUTPUT_CAPABILITY);
  if (capability && capability.index <= 96) {
    const prefix = claim.slice(0, capability.index);
    const capabilityAndRest = claim.slice(capability.index);
    const negatedPossession = /^(?:has|have)(?:n't|\s+no)\b/iu.test(capabilityAndRest);
    const negatedOutputAction = /^\w+\s+no\s+(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu.test(capabilityAndRest);
    const negatedWithout = /\bwithout\b.{0,40}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu.test(prefix)
      || /\bwithout\s*$/iu.test(prefix);
    if (
      !NEGATION.test(prefix)
      && !negatedPossession
      && !negatedOutputAction
      && !negatedWithout
    ) {
      return true;
    }
  }

  const turnOn = claim.match(/\bturn\w*\b.{0,30}\b(?:it|this|that|them)\b.{0,12}\bon\b/iu);
  return Boolean(turnOn && turnOn.index <= 96 && !NEGATION.test(claim.slice(0, turnOn.index)));
}

function splitContrasts(statement) {
  if (/^although\b/iu.test(statement)) {
    const [first, ...rest] = statement.replace(/^although\s+/iu, "").split(/,\s*/u);
    if (rest.length > 0 && startsPositiveOutputClause(rest.join(", "))) {
      return [first, rest.join(", ")];
    }
  }

  const clauses = [];
  const separators = statement.matchAll(
    /(?:,\s*|\s+)\b(?:but|however|yet|while|whereas|although|except|despite|even\s+though|then)\b(?:\s+|,\s*)|\s+\band\b\s+/giu,
  );
  let clauseStart = 0;

  for (const separator of separators) {
    const nextStart = separator.index + separator[0].length;
    const separatorText = separator[0];
    const precedingClause = statement.slice(clauseStart, separator.index);
    const requiresPriorDenial = /\b(?:and|then)\b/iu.test(separatorText);
    const hasPriorDenial = NEGATION.test(precedingClause)
      || /\b(?:unsupported|unavailable|exclude|omit)\w*\b/iu.test(precedingClause);
    const isException = /\bexcept\b/iu.test(separatorText);
    const followingIsPositive = startsPositiveOutputClause(statement.slice(nextStart));
    const precedingIsPositive = startsPositiveOutputClause(precedingClause);
    if (
      !isException
      && !followingIsPositive
      && (requiresPriorDenial || !precedingIsPositive)
    ) {
      continue;
    }
    if (
      !isException
      && requiresPriorDenial
      && (!hasPriorDenial || !followingIsPositive)
    ) {
      continue;
    }
    clauses.push(statement.slice(clauseStart, separator.index));
    clauseStart = nextStart;
  }

  clauses.push(statement.slice(clauseStart));
  return clauses;
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

    const audioPromptLabel = /^(?:narration|voiceover)\s+prompt\s*:/iu.test(normalizedLine);
    const claimLine = normalizedLine.replace(
      /^(?:narration|voiceover)\s+prompt\s*:\s*/iu,
      "",
    );
    const statements = claimLine
      .split(/[.!?;]+/u)
      .map(normalize)
      .filter(Boolean);
    const lineTopics = {
      audio: audioPromptLabel || /\b(?:audio|sound|soundtrack|narration|voiceover|microphone|system\s+audio|timeline\s+audio)\b/iu.test(claimLine),
      ffmpeg: /\bffmpeg\b/iu.test(claimLine),
      selector: /\b(?:format|container|codec|encoder|bitrate|profile|audio|selector|selection|setting|option|control)\w*\b/iu.test(claimLine),
      unsupportedOutput: UNSUPPORTED_OUTPUT.test(claimLine),
    };
    const lineExportContext = EXPORT_CONTEXT.test(claimLine);

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
  const hasRoleBoundary = /\bffmpeg\b.{0,100}\b(?:record|recording|capture|native\s+media\s+utilit)\w*\b/iu.test(claim)
    && /\bmediabunny\b.{0,100}\b(?:encod|mux)\w*\b.{0,100}\b(?:final|edited|export|mp4)\w*\b/iu.test(claim)
    || /\bmediabunny\b.{0,100}\b(?:encod|mux)\w*\b.{0,100}\b(?:final|edited|export|mp4)\w*\b/iu.test(claim)
    && /\bffmpeg\b.{0,100}\b(?:record|recording|capture|native\s+media\s+utilit)\w*\b/iu.test(claim);
  const hasAdditionalFinalFfmpegClaim = /\bffmpeg\b(?:(?!\bmediabunny\b)[\s\S]){0,100}\b(?:encod|mux|render|produc|creat|writ)\w*\b.{0,100}\b(?:final|edited|finished|export|output|mp4)\w*\b/iu.test(claim);
  const hasAmbiguousInheritedFinalClaim = /\b(?:and|but|yet|however)\b.{0,30}\b(?:it|that\s+encoder|the\s+encoder)\b.{0,100}\b(?:encod|mux|render|produc|creat|writ)\w*\b.{0,100}\b(?:final|edited|finished|export|output|mp4)\w*\b/iu.test(claim);
  return hasRoleBoundary
    && !hasAdditionalFinalFfmpegClaim
    && !hasAmbiguousInheritedFinalClaim;
}

function isUnsupportedOutputDenied(claim) {
  const exporterFirst = /\b(?:export|exporter|exporting|output|edited|finished|final)\w*\b.{0,120}\b(?:does\s+not|doesn't|do\s+not|don't|never|cannot|can't)\b.{0,80}\b(?:support|offer|provide|produce|create|encode|mux|write|include|use)\w*\b.{0,80}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu;
  const denialFirst = /\b(?:does\s+not|doesn't|do\s+not|don't|never|cannot|can't)\b.{0,80}\b(?:export|support|offer|provide|produce|create|encode|mux|write|include|use)\w*\b.{0,80}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu;
  const outputFirst = /\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b.{0,100}\b(?:(?:(?:is|are)\s+(?:not|never)|isn't|aren't)\s+(?:supported|offered|available|exported|produced|encoded|muxed)|unsupported|unavailable)\b/iu;
  const excluded = /\b(?:export|exporter|exporting|output|edited|finished|final)\w*\b.{0,80}\b(?:exclude|omit)\w*\b.{0,80}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu;
  const hasNoOutput = /\b(?:exporter|export|output)\w*\b.{0,40}\bhas\s+no\s+(?:(?:h265|hevc|webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|x264|x265|nvenc|videotoolbox|aac|mp3|opus)(?:\s+or\s+|\s*,\s*)?)+\s+(?:export|output|format|option)s?\b(?:\s+(?:today|currently|yet|at\s+present))?(?=\s*(?:[.,;:!?)]|$))/iu;
  const noOutputOffered = /\bno\s+(?:(?:h265|hevc|webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|x264|x265|nvenc|videotoolbox|aac|mp3|opus)(?:\s+or\s+|\s*,\s*)?)+\s+(?:export|output|format|option)s?\s+(?:is|are)\s+(?:offered|available|supported|provided)\b/iu;
  const pronounDenial = /\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b.{0,140}\b(?:does\s+not|doesn't|do\s+not|don't|never|cannot|can't)\b.{0,60}\b(?:export|support|offer|provide|produce|create|encode|mux|write|include|use)\w*\b.{0,30}\b(?:it|this|that|them|those)\b/iu;
  const actionNoOutput = /\b(?:export|produce|offer|provide|write|save|deliver|generate|create|encode|mux|render)\w*\s+no\s+(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu;
  const passivePronounDenial = /\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b.{0,140}\b(?:it|this|that|them|those)\b.{0,30}\b(?:cannot|can't|is\s+not|isn't|will\s+not|won't)\b.{0,30}\b(?:be\s+)?(?:export|offer|provide|produce|create|encode|mux|write|include|use)\w*\b/iu;
  const negativeCapability = /\b(?:fail|refuse)\w*\b.{0,40}\b(?:to\s+)?(?:export|offer|provide|produce|create|encode|mux|write)\w*\b.{0,80}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b|\b(?:is|are)\s+unable\s+to\s+(?:export|offer|provide|produce|create|encode|mux|write)\w*\b.{0,80}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc|x264|x265|nvenc|videotoolbox|aac|mp3|opus)\b/iu;
  return exporterFirst.test(claim)
    || denialFirst.test(claim)
    || outputFirst.test(claim)
    || excluded.test(claim)
    || hasNoOutput.test(claim)
    || noOutputOffered.test(claim)
    || pronounDenial.test(claim)
    || actionNoOutput.test(claim)
    || passivePronounDenial.test(claim)
    || negativeCapability.test(claim);
}

function isSelectorDenied(claim) {
  const denialFirst = /\b(?:does\s+not|doesn't|do\s+not|don't|never|cannot|can't)\b.{0,50}\b(?:expose|offer|provide|support|include|allow|enable)\w*\b.{0,100}\b(?:format|container|codec|encoder|bitrate|profile|audio)\b/iu;
  const noSelector = /\b(?:no|without)\b.{0,100}\b(?:format|container|codec|encoder|bitrate|profile|audio)\b.{0,100}\b(?:selector|selection|picker|choice|option|control|setting|switch)\w*\b/iu;
  const selectorFirst = /\b(?:format|container|codec|encoder|bitrate|profile|audio)\b.{0,100}\b(?:selector|selection|picker|choice|option|control|setting|switch)\w*\b.{0,60}\b(?:(?:is|are)\s+(?:not|never)\s+(?:available|exposed|offered|supported|enabled)|unavailable|disabled)\b/iu;
  return denialFirst.test(claim) || noSelector.test(claim) || selectorFirst.test(claim);
}

function isAudioDenied(claim) {
  const noAudio = /\bvideo-only\b|\b(?:no|without)\b.{0,100}\b(?:audio|sound|soundtrack|narration|voiceover|microphone|system\s+audio|timeline\s+audio)\b/iu;
  const audioFirst = /\b(?:audio|sound|soundtrack|narration|voiceover|microphone|system\s+audio|timeline\s+audio)\b.{0,100}\b(?:is\s+not|are\s+not|isn't|aren't|never|not)\b.{0,60}\b(?:mux|mix|include|add|retain|carry|contain|export|have|enable)\w*\b/iu;
  const denialFirst = /\b(?:does\s+not|do\s+not|never|cannot|can't)\b.{0,60}\b(?:mux|mix|include|add|retain|carry|contain|export|have|enable)\w*\b.{0,100}\b(?:audio|sound|soundtrack|narration|voiceover|microphone|system\s+audio|timeline\s+audio)\b/iu;
  const pronounDenial = /\b(?:it|that\s+track|the\s+track)\b.{0,50}\b(?:is\s+not|isn't|will\s+not|won't|never)\b.{0,40}\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|enable)\w*\b|\b(?:do\s+not|don't|never)\b.{0,30}\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|enable)\w*\b.{0,30}\b(?:it|that\s+track|the\s+track)\b/iu;
  const lacksAudio = /\b(?:export|output|mp4)\w*\b.{0,80}\black\w*\b.{0,40}\b(?:audio|sound|soundtrack|narration|voiceover|microphone|system\s+audio|timeline\s+audio)\b/iu;
  return noAudio.test(claim)
    || audioFirst.test(claim)
    || denialFirst.test(claim)
    || pronounDenial.test(claim)
    || lacksAudio.test(claim);
}

function hasPositiveAudioAfterBoundary(claim) {
  const audioNegation = /\b(?:no|not(?!\s+only\b)|never|without|cannot|can't|doesn't|does\s+not|don't|do\s+not|isn't|is\s+not|aren't|are\s+not|absent|unavailable|disabled|excluded|omitted)\b/iu;
  for (const boundary of claim.matchAll(/\b(?:and|but|yet|however|except)\b/giu)) {
    const tail = claim.slice(boundary.index + boundary[0].length);
    const positiveAudio = tail.match(
      /\b(?:audio|sound|soundtrack|narration|voiceover|microphone|system\s+audio|timeline\s+audio)\b.{0,100}?\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|have|enable|ship|accompan|embed|bake|feature|available|support)\w*\b|\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|has|have|with|enable|ship|accompan|embed|bake|feature|support)\w*\b.{0,100}?\b(?:audio|sound|soundtrack|narration|voiceover|microphone|system\s+audio|timeline\s+audio)\b/iu,
    );
    if (!positiveAudio) continue;
    const relevantTail = tail.slice(0, positiveAudio.index + positiveAudio[0].length);
    if (!audioNegation.test(relevantTail)) return true;
  }
  return false;
}

function hasExplicitUnsupportedOutputTarget(claim) {
  const format = "(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc)";
  const directAction = "(?:export|writ|save|deliver|generate|download|convert|return)";
  const directedAction = "(?:export|writ|save|deliver|generate|download|convert|return|produce|create|encode|mux)";
  const supportedMp4Destination = /\b(?:as|to|into)\s+(?:an?\s+|the\s+)?(?:(?:avc|h264)\s+)?mp4\b/iu.test(claim);
  const directCodecMediaObject = new RegExp(
    String.raw`\b(?:produce|create|encode|mux)\w*\s+(?:an?\s+|the\s+)?${format}\s+(?:file|video)\b`,
    "iu",
  ).test(claim) && !supportedMp4Destination;
  return directCodecMediaObject || new RegExp(
    String.raw`\b${directAction}\w*\s+(?:an?\s+|the\s+)?${format}\b`
      + String.raw`|\b${directedAction}\w*\b.{0,50}\b(?:as|to|into)\s+(?:an?\s+|the\s+)?${format}\b`
      + String.raw`|\b${directedAction}\w*\b.{0,50}\b${format}\s+(?:output|format|container)\b`
      + String.raw`|\b${format}\s+(?:output|export|format|container)\b`
      + String.raw`|\b(?:output|export|format|container)\b.{0,30}\b(?:as|in|to|into|is)\s+(?:an?\s+|the\s+)?${format}\b`,
    "iu",
  ).test(claim);
}

export function extractJavaScriptStringLiterals(source) {
  return [...source.matchAll(/"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/gu)]
    .map((match) => normalize(match[0].slice(1, -1)));
}

export function extractExportCopyLiterals(source) {
  return extractJavaScriptStringLiterals(source)
    .filter((literal) =>
      literal.length <= MAX_PUBLIC_COPY_LITERAL_LENGTH
      && /\s/u.test(literal)
      && HUMAN_EXPORT_TERM.test(literal));
}

export function findExportTruthViolations(value) {
  const violations = [];

  for (const { claim, exportContext, topics } of claimSegments(value)) {
    const ffmpegSubject = /\bffmpeg\b/iu.test(claim)
      || (topics.ffmpeg && /\b(?:it|that\s+encoder|the\s+encoder)\b/iu.test(claim));
    const unscopedFfmpegEncoding = ffmpegSubject && /\b(?:encod|mux)\w*\b/iu.test(claim);
    const explicitUnsupportedOutputTarget = hasExplicitUnsupportedOutputTarget(claim);
    if (!exportContext && !unscopedFfmpegEncoding && !explicitUnsupportedOutputTarget) continue;

    if (
      ffmpegSubject
      && /\b(?:export|edited|finished|final|render|mp4|encod|mux)\w*\b/iu.test(claim)
      && !isFinalFfmpegDenied(claim)
      && !hasExplicitRoleSeparation(claim)
    ) {
      violations.push({ kind: "final-ffmpeg", claim });
    }

    const nonOutputMediaUse = /\b(?:import(?:ed|ing)?|input|source|recorded|recording|capture)\b.{0,100}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc)\b|\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc)\b.{0,100}\b(?:input|source|import(?:ed|ing)?|preview|recorded|recording|capture|metadata)\b|\b(?:from|using|uses?|built\s+from|made\s+from|created\s+from)\b.{0,30}\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc)\b|\b(?:webm|mkv|matroska|mov|quicktime|avi|gif|mpeg(?:-?ts)?|flv|m4v|ogv|av1|vp9|h265|hevc)\s+(?:file|video)\b.{0,40}\b(?:as|to|into)\s+(?:(?:avc|h264)\s+)?mp4\b/iu.test(claim)
      && !explicitUnsupportedOutputTarget;
    const inheritedUnsupportedOutputClaim = topics.unsupportedOutput
      && !UNSUPPORTED_OUTPUT.test(claim)
      && (/\b(?:it|this|that|they|them|those)\b.{0,80}\b(?:export|support|offer|provide|produce|create|encode|mux|write|allow|enable|select|choose|switch|adjust|change|available|exportable)\w*\b/iu.test(claim)
        || /\b(?:export|support|offer|provide|produce|create|encode|mux|write|allow|enable|select|choose|switch|adjust|change|available|exportable)\w*\b.{0,80}\b(?:it|this|that|they|them|those)\b/iu.test(claim)
        || /\binclude\w*\b.{0,30}\b(?:it|this|that|they|them|those)\b.{0,60}\b(?:final|edited|finished|export|output|mp4)\w*\b/iu.test(claim)
        || /\bturn\w*\b.{0,30}\b(?:it|this|that|them)\b.{0,12}\bon\b/iu.test(claim));
    if (
      (UNSUPPORTED_OUTPUT.test(claim) && !nonOutputMediaUse && !isUnsupportedOutputDenied(claim))
      || inheritedUnsupportedOutputClaim
    ) {
      violations.push({ kind: "unsupported-output", claim });
    }

    const selectorClaim = /\b(?:choose|select|configure|pick|switch|set|adjust|change|support|offer|expose|provide|allow|available|option|control|selector|selection|picker|setting)\w*\b.{0,100}\b(?:format|container|codec|encoder|bitrate|profile|audio)\w*\b|\b(?:format|container|codec|encoder|bitrate|profile|audio)\w*\b.{0,100}\b(?:choose|select|configure|pick|switch|set|adjust|change|support|offer|expose|provide|allow|available|option|control|selector|selection|picker|setting)\w*\b/iu;
    const inheritedSelectorClaim = topics.selector
      && /\b(?:choose|select|configure|pick|switch|set|adjust|change)\w*\b.{0,80}\b(?:one|it|them)\b/iu.test(claim);
    if ((selectorClaim.test(claim) || inheritedSelectorClaim) && !isSelectorDenied(claim)) {
      violations.push({ kind: "unsupported-selector", claim });
    }

    const audioClaim = /\b(?:audio|sound|soundtrack|narration|voiceover|microphone|system\s+audio|timeline\s+audio)\b.{0,100}\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|have|enable|ship|accompan|embed|bake|feature|yes|available|support)\w*\b|\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|has|have|with|enable|ship|accompan|embed|bake|feature|support)\w*\b.{0,100}\b(?:audio|sound|soundtrack|narration|voiceover|microphone|system\s+audio|timeline\s+audio)\b/iu;
    const inheritedAudioClaim = topics.audio
      && (/\b(?:it|that\s+track|the\s+track)\b.{0,80}\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|enable|have|ship|accompan|embed|bake|feature)\w*\b/iu.test(claim)
        || /\b(?:mux|mix|include|add|retain|preserve|carry|contain|export|enable|have|ship|accompan|embed|bake|feature)\w*\b.{0,80}\b(?:it|that\s+track|the\s+track)\b/iu.test(claim)
        || /\bthis\s+is\s+(?:muxed|mixed|included|added|retained|preserved|carried|contained|exported|enabled)\b.{0,60}\b(?:final|edited|finished|export|output|mp4)\w*\b/iu.test(claim)
        || /\b(?:it|that\s+track|the\s+track)\b.{0,30}\b(?:is|are|will\s+be)\b.{0,30}\b(?:in|on|present\s+in|part\s+of)\b.{0,60}\b(?:final|edited|finished|export|output|mp4)\w*\b/iu.test(claim)
        || /^(?:[“”"'‘’]\s*)?(?:present|embedded|baked)\b.{0,40}\b(?:in|into|on)\b.{0,60}\b(?:final|edited|finished|export|output|mp4)\w*\b/iu.test(claim)
        || /^(?:[“”"'‘’]\s*)?(?:mux|mix|include|add|retain|preserve|carry|contain|export|enable|ship|accompany|embed|bake)\w*\b.{0,80}\b(?:final|edited|finished|export|output|mp4)\w*\b/iu.test(claim)
        || /^(?:audio|sound|soundtrack|narration|voiceover)\b.{0,24}$/iu.test(claim)
        || /\b(?:audio|sound|soundtrack|narration|voiceover)\b.{0,50}\b(?:yes|enabled|included|available|supported)\b/iu.test(claim));
    const audioDenied = isAudioDenied(claim);
    if (
      (audioClaim.test(claim) || inheritedAudioClaim)
      && (!audioDenied || hasPositiveAudioAfterBoundary(claim))
      && !isSelectorDenied(claim)
    ) {
      violations.push({ kind: "edited-export-audio", claim });
    }
  }

  return violations;
}
