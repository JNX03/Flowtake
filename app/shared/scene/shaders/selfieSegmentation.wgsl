struct GlobalUniforms {
    projectionMatrix:mat3x3<f32>,
    worldTransformMatrix:mat3x3<f32>,
    worldColorAlpha: vec4<f32>,
    uResolution: vec2<f32>,
}

struct LocalUniforms {
    uTransformMatrix:mat3x3<f32>,
    uColor:vec4<f32>,
    uRound:f32,
}

// custom uniform group
struct SegmentationUniforms {
    uAlpha: f32,
    uIsEnabled: i32,
};

@group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
@group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;

@group(2) @binding(1) var uTexture : texture_2d<f32>;
@group(2) @binding(2) var uSampler : sampler;
@group(2) @binding(3) var uMaskTexture : texture_2d<f32>;
@group(2) @binding(4) var uMaskSampler : sampler;
@group(2) @binding(5) var<uniform> segmentationUniforms : SegmentationUniforms;

// struct to pass data from vertex to fragment shader
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) vUV: vec2<f32>,
};

@vertex
fn mainVert(
    @location(0) aPosition: vec2<f32>,
    @location(1) aUV: vec2<f32>
) -> VertexOutput {
    var mvp = globalUniforms.projectionMatrix 
        * globalUniforms.worldTransformMatrix 
        * localUniforms.uTransformMatrix;
    
    return VertexOutput(
        vec4<f32>(mvp * vec3<f32>(aPosition, 1.0), 1.0),
        aUV,
    );
}

@fragment
fn mainFrag(input: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(uTexture, uSampler, input.vUV);
    if (segmentationUniforms.uIsEnabled == 0) {
        return color * segmentationUniforms.uAlpha;
    } else {
        let mask = textureSample(uMaskTexture, uMaskSampler, input.vUV);
        let alpha = mask.r * segmentationUniforms.uAlpha;
        return vec4<f32>(color.rgb * alpha, alpha);
    }
}