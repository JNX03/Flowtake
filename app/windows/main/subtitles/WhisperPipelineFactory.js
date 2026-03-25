const TASK = "automatic-speech-recognition"
// const MODEL = "distil-whisper/distil-large-v3"
// const MODEL = "Xenova/whisper-large"
// const MODEL = "Xenova/whisper-medium"
export const MODEL = "Xenova/whisper-tiny"

export default class WhisperPipelineFactory {
    static instance = null;
    static task = TASK;
    static model = MODEL;
    static quantized = false;

    constructor(tokenizer) {
        this.tokenizer = tokenizer
    }

    static async getInstance(progress_callback = null, model = this.model) {
        if (this.instance === null) {
            const { pipeline } = await import("@huggingface/transformers")
            this.instance = pipeline(this.task, model, {
                quantized: this.quantized,
                progress_callback,

                // For medium models, we need to load the `no_attentions` revision to avoid running out of memory
                revision: model.includes("/whisper-medium") ? "no_attentions" : "main",
                device: "webgpu",
                dtype: "fp32"
            })
        }

        return this.instance
    }
}
