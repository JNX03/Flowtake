
import { toMs } from "@shared/helpers"
import Worker from "./whisper.worker.js?worker"

export default class SubtitlesGenerator {

    static INPUT_LANGUAGES = {
        en: "English",
        af: "Afrikaans",
        am: "Amharic",
        ar: "Arabic",
        az: "Azerbaijani",
        ba: "Bashkir",
        be: "Belarusian",
        bg: "Bulgarian",
        bn: "Bengali",
        bo: "Tibetan",
        br: "Breton",
        bs: "Bosnian",
        ca: "Catalan/Valencian",
        cs: "Czech",
        cy: "Welsh",
        da: "Danish",
        de: "German",
        el: "Greek",
        es: "Spanish/Castilian",
        et: "Estonian",
        eu: "Basque",
        fa: "Persian",
        fi: "Finnish",
        fo: "Faroese",
        fr: "French",
        gl: "Galician",
        gu: "Gujarati",
        ha: "Hausa",
        haw: "Hawaiian",
        he: "Hebrew",
        hi: "Hindi",
        hr: "Croatian",
        ht: "Haitian Creole/Haitian",
        hu: "Hungarian",
        hy: "Armenian",
        id: "Indonesian",
        is: "Icelandic",
        it: "Italian",
        ja: "Japanese",
        jw: "Javanese",
        ka: "Georgian",
        kk: "Kazakh",
        km: "Khmer",
        kn: "Kannada",
        ko: "Korean",
        la: "Latin",
        lb: "Luxembourgish/Letzeburgesch",
        ln: "Lingala",
        lo: "Lao",
        lt: "Lithuanian",
        lv: "Latvian",
        mg: "Malagasy",
        mi: "Maori",
        mk: "Macedonian",
        ml: "Malayalam",
        mn: "Mongolian",
        mr: "Marathi",
        ms: "Malay",
        mt: "Maltese",
        my: "Myanmar/Burmese",
        ne: "Nepali",
        nl: "Dutch/Flemish",
        nn: "Nynorsk",
        no: "Norwegian",
        oc: "Occitan",
        pa: "Punjabi/Panjabi",
        pl: "Polish",
        ps: "Pashto/Pushto",
        pt: "Portuguese",
        ro: "Romanian/Moldavian/Moldovan",
        ru: "Russian",
        sa: "Sanskrit",
        sd: "Sindhi",
        si: "Sinhala/Sinhalese",
        sk: "Slovak",
        sl: "Slovenian",
        sn: "Shona",
        so: "Somali",
        sq: "Albanian",
        sr: "Serbian",
        su: "Sundanese",
        sv: "Swedish",
        sw: "Swahili",
        ta: "Tamil",
        tg: "Tajik",
        th: "Thai",
        tl: "Tagalog",
        tk: "Turkmen",
        tr: "Turkish",
        tt: "Tatar",
        uk: "Ukrainian",
        ur: "Urdu",
        uz: "Uzbek",
        vi: "Vietnamese",
        yo: "Yoruba"
    }

    constructor({
        onInitiate,     // file init
        onDownload,     // file start download
        onProgress,     // file download progress
        onDone,         // file download done
        onReady,        // model ready
        onUpdate,       // inference update
        onError,        // inference error
        onNetworkError  // network error
    }) {
        this.worker = new Worker()
        this.onInitiate = onInitiate
        this.onDownload = onDownload
        this.onProgress = onProgress
        this.onDone = onDone
        this.onReady = onReady
        this.onUpdate = onUpdate
        this.onError = onError
        this.onNetworkError = onNetworkError
        this.hasError = false
    }

    async generate(buffer, inputLanguage) {
        this.hasError = false
        const audio = await this.decodeAudio(buffer)
        let subtitles
        try {
            subtitles = await new Promise((resolve, reject) => {
                this.worker.addEventListener("message", e => {

                    switch (e.data.status) {
                        case "initiate":
                            if (!this.hasError) this.onInitiate?.(e.data)
                            break
                        case "download":
                            if (!this.hasError) this.onDownload?.(e.data)
                            break
                        case "progress":
                            if (!this.hasError) this.onProgress?.(e.data)
                            break
                        case "done":
                            if (!this.hasError) this.onDone?.(e.data)
                            break
                        case "ready":
                            if (!this.hasError) this.onReady?.(e.data)
                            break
                        case "update":
                            if (!this.hasError) this.onUpdate?.(e.data)
                            break
                        case "complete":
                            resolve(e.data.data.chunks)
                            break
                        case "error":
                            this.hasError = true
                            this.onError?.()
                            reject()
                            break
                        case "network-error":
                            this.hasError = true
                            this.onNetworkError?.()
                            reject()
                            break
                        default:
                            console.log(e.data)

                    }
                })
                this.worker.postMessage({
                    audio,
                    language: inputLanguage !== "en" ? inputLanguage : null,
                    multilingual: inputLanguage !== "en",
                    subtask: inputLanguage !== "en" ? "transcribe" : null
                })
            })
        } catch {
            return null
        }

        return this.cleanUp(subtitles)
    }

    async decodeAudio(buffer) {
        const audioContext = new AudioContext({ sampleRate: 16000 })

        const audioData = await audioContext.decodeAudioData(buffer)

        let audio
        if (audioData.numberOfChannels === 2) {
            const SCALING_FACTOR = Math.sqrt(2)

            let left = audioData.getChannelData(0)
            let right = audioData.getChannelData(1)

            audio = new Float32Array(left.length)
            for (let i = 0; i < audioData.length; ++i) {
                audio[i] = SCALING_FACTOR * (left[i] + right[i]) / 2
            }
        } else {
            // If the audio is not stereo, we can just use the first channel:
            audio = audioData.getChannelData(0)
        }
        return audio
    }

    cleanUp(subtitles) {
        // max duration ensures that silences are accounted for    
        const maxWordDuration = 1000
        const minWordDuration = 200
        const regex = new RegExp(/^\[.*|.*\]$/) // Regex to match stuff like "[blank audio]"
        // TODO: filter out stuff like "(footsteps)"

        let prev = null
        return subtitles
            .map(({ text, timestamp }) => ({ text: text.trim(), start: toMs(timestamp[0]), end: toMs(timestamp[1]) }))
            .filter(({ text }) => !regex.test(text))
            .map(({ text, start, end }, i) => {
                // Sometimes subtitle timestamps are off.
                // E.g. start === end
                // E.g. First or last words way too long
                // This corrects for that.

                let subtitle

                if (i === 0) {
                    // Make sure first word isn't too long
                    let adjustedStart = end - start > maxWordDuration ? end - maxWordDuration : start
                    subtitle = { text, start: adjustedStart, end }
                } else {
                    // Make sure to use adjusted value from prev subtitle if needed
                    let updatedStart = Math.max(prev.end, start)
                    let updatedEnd = end

                    // Correct if duration is too short (or 0)
                    if (updatedEnd - updatedStart < minWordDuration) {
                        // Case if there is "space" before the word...
                        if (prev.end < updatedStart)
                            updatedStart = end - prev.end < maxWordDuration ? prev.end : end - maxWordDuration
                        // ...otherwise adjust the end
                        else
                            updatedEnd = updatedStart + minWordDuration
                    }

                    // Make sure words aren't too long (especially last word before the end)
                    if (updatedEnd - updatedStart > maxWordDuration)
                        updatedEnd = updatedStart + maxWordDuration

                    subtitle = { text, start: updatedStart, end: updatedEnd }
                }
                prev = subtitle
                return subtitle
            })
    }
}
