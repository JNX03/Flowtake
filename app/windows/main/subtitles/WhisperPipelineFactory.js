import onnxModuleUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url"
import onnxWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url"

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
            const { env, pipeline } = await import("@huggingface/transformers")
            // Load the packaged runtime directly. The library's WASM cache
            // imports a generated blob module, which the app's CSP blocks.
            env.useWasmCache = false
            env.backends.onnx.wasm.wasmPaths = { mjs: onnxModuleUrl, wasm: onnxWasmUrl }
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
