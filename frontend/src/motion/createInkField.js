import { fragmentSource, vertexSource } from './inkShaders.js';

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Shader unavailable');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    throw new Error('Shader compilation unavailable');
  }
  return shader;
}

// Returns a small rendering interface. React owns listeners and animation timing.
// If hardware acceleration is unavailable, the CSS photographic layers stay visible.
export function createInkField(canvas, source) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;
  let vertex;
  let fragment;
  let program;
  let buffer;
  let texture;
  const dispose = () => {
    if (buffer) gl.deleteBuffer(buffer);
    if (texture) gl.deleteTexture(texture);
    if (program) gl.deleteProgram(program);
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
  };

  try {
    vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    if (!program) throw new Error('Program unavailable');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error('Program linking unavailable');
    gl.useProgram(program);

    buffer = gl.createBuffer();
    texture = gl.createTexture();
    if (!buffer || !texture) throw new Error('Texture unavailable');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // One oversize triangle covers the canvas without a diagonal sampling seam.
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(gl.getUniformLocation(program, 'uPigment'), 0);
    const loc = Object.fromEntries(
      ['uAspect', 'uTime', 'uPointer', 'uVelocity', 'uDark', 'uEnergy'].map(
        (name) => [name, gl.getUniformLocation(program, name)],
      ),
    );

    return {
      draw({ time, x, y, vx, vy, dark, energy }) {
        gl.uniform1f(loc.uTime, time);
        gl.uniform1f(loc.uAspect, canvas.width / canvas.height);
        gl.uniform1f(loc.uDark, dark ? 1 : 0);
        gl.uniform1f(loc.uEnergy, energy);
        gl.uniform2f(loc.uPointer, x, y);
        gl.uniform2f(loc.uVelocity, vx, vy);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      resize(width, height) {
        // Soft pigment needs fewer pixels than text. Limit both GPU memory and fill rate.
        const scale = Math.min(0.85, Math.sqrt(650000 / (width * height)));
        canvas.width = Math.max(1, Math.floor(width * scale));
        canvas.height = Math.max(1, Math.floor(height * scale));
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      dispose,
    };
  } catch {
    dispose();
    return null;
  }
}
