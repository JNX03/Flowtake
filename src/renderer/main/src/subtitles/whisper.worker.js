import WhisperPipelineFactory, { MODEL } from "./WhisperPipelineFactory"

const TASK = "automatic-speech-recognition"

self.addEventListener("message", async (event) => {
    const message = event.data

    // Do some work...
    let transcript = await transcribe(
        message.audio,
        message.multilingual,
        message.subtask,
        message.language,
    )
    if (transcript === null) return

    // Send the result back to the main thread
    self.postMessage({
        status: "complete",
        task: TASK,
        data: transcript,
    })
})

const transcribe = async (
    audio,
    multilingual,
    subtask,
    language,
) => {

    const isDistilWhisper = MODEL.startsWith("distil-whisper/")

    let modelName = MODEL
    if (!isDistilWhisper && !multilingual) {
        modelName += ".en"
    }

    let transcriber

    try {
        // Load transcriber model
        transcriber = await WhisperPipelineFactory.getInstance((data) => {
            self.postMessage(data)
        }, modelName)
    } catch (error) {
        self.postMessage({
            status: "network-error",
            task: TASK,
            data: error,
        })
        return null
    }

    const time_precision =
        transcriber.processor.feature_extractor.config.chunk_length /
        transcriber.model.config.max_source_positions

    // Storage for chunks to be processed. Initialise with an empty chunk.
    let chunks_to_process = [
        {
            tokens: [],
            finalised: false,
        },
    ]

    // TODO: Storage for fully-processed and merged chunks
    // let decoded_chunks = [];

    function chunk_callback(chunk) {
        let last = chunks_to_process[chunks_to_process.length - 1]

        // Overwrite last chunk with new info
        Object.assign(last, chunk)
        last.finalised = true

        // Create an empty chunk after, if it not the last chunk
        if (!chunk.is_last) {
            chunks_to_process.push({
                tokens: [],
                finalised: false,
            })
        }
    }

    // Inject custom callback function to handle merging of chunks
    function callback_function(item) {
        let last = chunks_to_process[chunks_to_process.length - 1]

        // Update tokens of last chunk
        last.tokens = [...item[0].output_token_ids]

        // Merge text chunks
        // TODO optimise so we don't have to decode all chunks every time
        let data = transcriber.tokenizer._decode_asr(chunks_to_process, {
            time_precision: time_precision,
            return_timestamps: true,
            force_full_sequences: false,
        })

        self.postMessage({
            status: "update",
            task: TASK,
            data: data,
        })
    }

    const config = {
        // Greedy
        top_k: 0,
        do_sample: false,

        // Sliding window
        chunk_length_s: isDistilWhisper ? 20 : 30,
        stride_length_s: isDistilWhisper ? 3 : 5,

        // Language and task
        language,
        task: subtask,

        // Return timestamps
        // return_timestamps: true,
        return_timestamps: "word",
        force_full_sequences: false,

        // Callback functions
        callback_function: callback_function, // after each generation step
        chunk_callback: chunk_callback, // after each chunk is processed
    }

    // Actually run transcription
    let output = await transcriber(audio, config).catch((error) => {
        self.postMessage({
            status: "error",
            task: TASK,
            data: error,
        })
        return null
    })

    return output
}
