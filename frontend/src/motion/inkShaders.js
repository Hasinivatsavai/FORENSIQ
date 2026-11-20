// The image contains pigment with transparent paper. The shader displaces its
// sampling coordinates around two drifting plumes and the pointer's wake.
export const vertexSource = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

export const fragmentSource = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uPigment;
  uniform float uTime;
  uniform float uAspect;
  uniform float uDark;
  uniform vec2 uPointer;
  uniform vec2 uVelocity;
  uniform float uEnergy;

  // Estimate the movement of a drum of ink suspended in a shallow water bath.
  vec2 currents(vec2 uv) {
    float t = uTime;
    vec2 drift = 0.017 * vec2(
      sin(6.4 * uv.y + 0.84 * t) + sin(9.7 * uv.y - t * 0.29),
      cos(7.2 * uv.x - 0.66 * t) + cos(8.2 * uv.y + t * 0.37)
    );
    vec2 delta = (uv - uPointer) * vec2(uAspect, 1.0);
    float d = length(delta);
    float reach = exp(-d * d * 9.5);
    vec2 perpendicular = vec2(-delta.y, delta.x) / max(d, 0.015);
    vec2 curl = perpendicular * sin(d * 18.0 - t * 2.4) * reach;
    return drift - uVelocity * reach * 0.105 + curl * uEnergy * 0.053;
  }

  vec4 plume(vec2 uv, vec2 center, vec2 size, float angle) {
    vec2 p = (uv - center) * vec2(uAspect, 1.0);
    float c = cos(angle);
    float s = sin(angle);
    p = vec2(p.x*c - p.y*s, p.x*s + p.y*c) / size + 0.5;
    vec4 ink = texture2D(uPigment, clamp(p, 0.0, 1.0));
    ink.a *= smoothstep(0.0, 0.045, p.x) * smoothstep(0.0, 0.045, 1.0 - p.x);
    ink.a *= smoothstep(0.0, 0.045, p.y) * smoothstep(0.0, 0.045, 1.0 - p.y);
    return ink;
  }

  void main() {
    vec2 uv = vUv;
    uv += currents(uv);
    vec2 pull = (uPointer - 0.5) * vec2(0.046, 0.034);
    vec4 a = plume(uv, vec2(0.005, 0.83) + pull, vec2(0.72, 1.20), -0.54);
    vec4 b = plume(uv, vec2(0.98, 0.94) - pull, vec2(0.62, 0.96), 0.98);
    vec4 c = plume(uv, vec2(1.05, 0.01) + 0.5 * pull, vec2(0.63, 0.84), 2.6);
    float edgeMask = mix(0.42 + 0.58 * smoothstep(0.20, 0.48, abs(vUv.x - 0.5)), 1.0, smoothstep(0.58, 1.05, uAspect));
    float bandMask = 0.24 + 0.76 * smoothstep(0.0, 0.09, vUv.y) * (1.0 - smoothstep(0.91, 1.0, vUv.y));
    float alpha = bandMask * edgeMask * min(a.a * 0.67 + b.a * 0.57 + c.a * 0.23, 0.71);
    vec3 pigment = (a.rgb * a.a + b.rgb * b.a + c.rgb * c.a) / max(a.a + b.a + c.a, 0.0001);
    float density = clamp(pigment.r, 0.0, 1.0);
    vec3 crimson = mix(vec3(0.46, 0.025, 0.19), vec3(0.94, 0.17, 0.25), density);
    vec3 coral = mix(vec3(0.73, 0.09, 0.30), vec3(1.0, 0.44, 0.42), density);
    pigment = mix(crimson, coral, uDark);
    gl_FragColor = vec4(pigment, alpha);
  }
`;
