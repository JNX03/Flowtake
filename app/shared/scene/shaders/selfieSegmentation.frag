in vec2 vUV;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uMaskTexture;
uniform float uAlpha;
uniform int uIsEnabled;

void main() {
    vec4 color = texture(uTexture, vUV);
    if (uIsEnabled == 0) {
        finalColor = color * uAlpha;
    } else {
        vec4 mask = texture(uMaskTexture, vUV);
        float alpha = mask.r * uAlpha;
        finalColor = vec4(color.rgb * alpha, alpha);
    }
}